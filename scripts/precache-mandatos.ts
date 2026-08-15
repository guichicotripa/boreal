/**
 * Pré-investiga e escreve o memo das empresas dos mandatos, PERSISTINDO NO BANCO.
 *
 *   node --experimental-strip-types --env-file=.env.local scripts/precache-mandatos.ts --limite=1 --dry
 *   node --experimental-strip-types --env-file=.env.local scripts/precache-mandatos.ts --limite=100
 *   node --experimental-strip-types --env-file=.env.local scripts/precache-mandatos.ts --mandato=death-care --limite=100
 *   node --experimental-strip-types --env-file=.env.local scripts/precache-mandatos.ts --so=dossie
 *
 * POR QUE UM SCRIPT NOVO, e não `cache-research-sub.mjs`:
 *   1. O antigo lê `demo-cache.json` e escreve JSON no bundle. Não conhece mandato, não toca o
 *      Supabase, e o que ele grava NÃO aparece pro usuário da Setter.
 *   2. Ele REPLICA os pesos e o parse do `research.ts` em ~40 linhas. Réplica é como o número do
 *      lote e o da tela passam a discordar — o mesmo defeito que o cabeçalho do `cache-sub.ts` já
 *      criticava. Aqui a única coisa trocada é o TRANSPORTE.
 *
 * O QUE ISTO IMPORTA DE VERDADE, em vez de reescrever:
 *   research.ts → RESEARCH_SYSTEM, promptResearch, parseResearch, ajusteDeSinais
 *   dossier.ts  → DOSSIER_SYSTEM, promptDossier, parseDossier
 *   scoring.ts  → calcScore
 * Trocado: `Anthropic.messages.create` (chave de API, sem crédito desde 25/07) por `query()` do
 * Agent SDK, que roda na assinatura. `ANTHROPIC_API_KEY: undefined` no env do filho é o que força
 * isso — com a chave presente o SDK a usaria e voltaria a cobrar.
 *
 * A WEB SEARCH muda de mecanismo junto: a rota usa a tool server-side
 * `web_search_20250305` com `max_uses`; o Agent SDK usa as tools `WebSearch`/`WebFetch` do próprio
 * harness. O TETO de buscas deixa de ser garantido pela API e passa a valer só pela instrução do
 * prompt ("no máximo 4 buscas"), daí o `maxTurns` como cinto.
 *
 * IDEMPOTENTE E RETOMÁVEL: pula empresa que já tem research (score_run) e memo (empresa_memo).
 * Um lote de 300 empresas leva horas; morrer no meio e recomeçar não pode custar o que já foi feito.
 */
import { createClient } from "@supabase/supabase-js";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { MANDATOS, filtroOr, mandatoPorId } from "../src/lib/mandatos.ts";
import { calcScore } from "../src/lib/scoring.ts";
import { RESEARCH_SYSTEM, promptResearch, parseResearch } from "../src/lib/research.ts";
import { DOSSIER_SYSTEM, promptDossier, parseDossier } from "../src/lib/dossier.ts";
import { salvarResearch, lerResearchSalvo } from "../src/lib/research-store.ts";
import { lerMemoSalvo, salvarMemo } from "../src/lib/memo-store.ts";
import type { Empresa, ResearchResult } from "../src/lib/types.ts";

const args = process.argv.slice(2);
const flag = (n: string, p: string | null = null) => {
  const a = args.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3).trim() : p;
};
const LIMITE = Number(flag("limite", "100"));
const SO = flag("so", "");            // "research" | "dossie" | ""
const DRY = args.includes("--dry");
const MANDATO_ID = flag("mandato");
/* FATIA para rodar em paralelo. `--fatia=2/4` processa só as empresas cujo índice cai na fatia 2
   de 4. Medido em 12/08: uma empresa leva ~186s (a research com WebSearch é quase tudo isso), então
   300 empresas em série passam de 15 horas. Quatro processos em fatias disjuntas cortam pra ~4h.

   Fatiar por ÍNDICE e não por sorteio é o que torna as fatias reproduzíveis: rodar `2/4` de novo
   pega exatamente as mesmas empresas. E a idempotência (pula quem já tem research e memo) já
   protege caso duas fatias se sobreponham por engano. */
const [fatiaI, fatiaN] = (flag("fatia", "1/1") ?? "1/1").split("/").map(Number);
if (!(fatiaN >= 1 && fatiaI >= 1 && fatiaI <= fatiaN)) { console.error("--fatia=i/n inválida"); process.exit(1); }
const alvos = MANDATO_ID ? [mandatoPorId(MANDATO_ID)!].filter(Boolean) : MANDATOS;
if (!alvos.length) { console.error(`mandato "${MANDATO_ID}" não existe`); process.exit(1); }

/* O modelo é registrado junto do artefato (`score_run.model`, `empresa_memo.modelo`) pra que uma
   troca de geração seja rastreável depois. O Agent SDK escolhe o modelo da assinatura, então o
   valor gravado diz o CAMINHO, não uma versão exata que não controlamos daqui. */
const MODELO = "agent-sdk/assinatura";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const SEL = `id, cnpj, razao_social, nome_fantasia, cnae_principal, cnae_principal_desc,
  cnaes_secundarios, natureza_juridica, municipio, uf, data_inicio_atividade,
  capital_social, porte, telefone, email, score_v0,
  socio(id, nome, qualificacao, faixa_etaria, data_entrada_sociedade)`;

/** Uma volta no Agent SDK. `raw` é o texto final; o parse é o do app, não deste arquivo. */
async function pedirAoModelo(system: string, prompt: string, comWeb: boolean): Promise<string> {
  let raw = "";
  for await (const m of query({
    prompt,
    options: {
      systemPrompt: system,
      /* Dossiê é análise dos dados que já temos: sem web, ele não inventa fonte nem gasta turno.
         Research é o oposto, o valor dela está inteiro na busca. */
      allowedTools: comWeb ? ["WebSearch", "WebFetch"] : [],
      maxTurns: comWeb ? 18 : 2,
      env: { ...process.env, ANTHROPIC_API_KEY: undefined },
    },
  })) {
    if (m.type === "result" && m.subtype === "success") raw = m.result;
  }
  if (!raw) throw new Error("Agent SDK não devolveu resultado");
  return raw;
}

const hhmmss = (ms: number) => new Date(ms).toISOString().slice(11, 19);
let feitos = 0, pulados = 0, falhas = 0;
const t0 = Date.now();

for (const m of alvos) {
  const { data, error } = await supabase
    .from("empresa").select(SEL).or(filtroOr(m))
    .order("score_v0", { ascending: false, nullsFirst: false })
    .order("id")
    .range(0, LIMITE - 1);
  if (error) { console.error(`${m.nome}: ${error.message}`); continue; }

  const empresas = (data ?? []).map((e) => ({ ...e, score: calcScore(e as Empresa, (e as Empresa).socio ?? []) })) as Empresa[];
  console.log(`\n${"=".repeat(78)}\n${m.nome} · ${empresas.length} empresas (top ${LIMITE})\n${"=".repeat(78)}`);

  for (const [i, e] of empresas.entries()) {
    if (i % fatiaN !== fatiaI - 1) continue;
    const rot = `[${m.id} ${String(i + 1).padStart(3)}/${empresas.length}] ${(e.razao_social ?? "").slice(0, 38).padEnd(38)}`;

    const jaResearch = SO === "dossie" ? null : await lerResearchSalvo(supabase, e.id);
    const jaMemo = SO === "research" ? null : await lerMemoSalvo(supabase, e.id);
    const precisaResearch = SO !== "dossie" && !jaResearch;
    const precisaMemo = SO !== "research" && !jaMemo;
    if (!precisaResearch && !precisaMemo) { pulados++; console.log(`${rot} · já em cache`); continue; }

    if (DRY) { console.log(`${rot} · [dry] faria${precisaResearch ? " research" : ""}${precisaMemo ? " dossiê" : ""}`); continue; }

    const t = Date.now();
    let tRes = 0, tDos = 0;
    let research: ResearchResult | null = jaResearch?.research ?? null;
    try {
      if (precisaResearch) {
        const t1 = Date.now();
        research = parseResearch(await pedirAoModelo(RESEARCH_SYSTEM, promptResearch(e), true), e.score?.score ?? 0);
        await salvarResearch(supabase, e.id, research, e.score?.breakdown ?? null, MODELO);
        tRes = Date.now() - t1;
      }
      if (precisaMemo) {
        const t2 = Date.now();
        const analise = parseDossier(await pedirAoModelo(DOSSIER_SYSTEM, promptDossier(e, research), false));
        /* `comV1` marca se a investigação da web entrou na geração. Memo escrito sem ela é cego
           para assessor contratado e sucessor ativo, e a coluna é o que permite refazer só esses. */
        await salvarMemo(supabase, e.id, analise, MODELO, !!research);
        tDos = Date.now() - t2;
      }
      feitos++;
      const dv = research ? ` v0:${research.score_v0}→v1:${research.score_v1} (${research.sinais.length} sinais)` : "";
      /* Tempo separado por fase de propósito: research e dossiê têm ordens de grandeza diferentes
         (uma faz busca na web, a outra só analisa o que já temos), e saber a divisão é o que
         permite decidir cobrir só o dossiê num universo maior. */
      const fases = `${(( Date.now() - t) / 1000).toFixed(0)}s [res ${(tRes / 1000).toFixed(0)}s · dos ${(tDos / 1000).toFixed(0)}s]`;
      console.log(`${rot} · ${fases}${dv}`);
    } catch (err) {
      const msg = (err as Error).message;
      /* PARA NA HORA quando o limite da assinatura estoura. Sem isto o lote atravessa as 300
         empresas repetindo a MESMA falha e sai com código 0, parecendo sucesso: foi o que
         aconteceu em 12/08/2026, 299 falhas em 8 minutos e nenhuma linha gravada. Erro que não
         vai melhorar tentando de novo tem que interromper, não virar 299 linhas de log.

         O limite é da ASSINATURA e é compartilhado com a sessão interativa do Claude Code: rodar
         lote pesado enquanto se conversa consome a mesma cota, e vários processos em paralelo
         consomem várias vezes mais rápido. */
      if (/session limit|usage limit|rate.?limit/i.test(msg)) {
        console.error(`
${rot} · LIMITE DA ASSINATURA: ${msg.slice(0, 140)}`);
        console.error(`
Interrompido com ${feitos} processadas nesta execução. Nada se perde:`);
        console.error("rodar de novo depois do reset pula tudo que já foi salvo.");
        process.exit(3);
      }
      falhas++;
      console.error(`${rot} · FALHOU: ${msg.slice(0, 110)}`);
    }

    if (feitos > 0 && (feitos + falhas) % 10 === 0) {
      const medio = (Date.now() - t0) / (feitos + falhas);
      console.log(`   ── ${feitos} ok · ${falhas} falhas · ${pulados} pulados · média ${(medio / 1000).toFixed(0)}s/empresa · decorrido ${hhmmss(Date.now() - t0)}`);
    }
  }
}

console.log(`\n${feitos} processadas · ${pulados} já em cache · ${falhas} falhas · total ${hhmmss(Date.now() - t0)}`);
if (falhas) console.log("Falha é retomável: rodar de novo pula o que já foi salvo e tenta só o que faltou.");
