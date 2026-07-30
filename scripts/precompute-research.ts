/**
 * Pré-computa INVESTIGAÇÕES (v1) em lote, via assinatura, gravando no score_run.
 *
 *   node --experimental-strip-types --env-file=.env.local scripts/precompute-research.ts --n=50
 *   node --experimental-strip-types --env-file=.env.local scripts/precompute-research.ts --n=30 --setor=metalmec
 *   node --experimental-strip-types --env-file=.env.local scripts/precompute-research.ts --n=20 --dry
 *
 * ESTE LOTE VEM ANTES DO DE MEMO. O memo escrito sem v1 conhece só o registro do
 * CNPJ — é cego para assessor contratado, menção pública a venda e sucessor já
 * atuando, que são os fatos que definem o ângulo e a urgência da abordagem. Gerar
 * memo primeiro é produzir material que já nasce para ser refeito. A ordem certa é
 * precompute-research.ts → precompute-memos.ts.
 *
 * Por que assinatura e não a rota /api/research: a rota usa a API direta com web
 * search server-side, ~$0,04-0,22 por empresa. Aqui o Agent SDK faz as buscas pela
 * assinatura do Claude Code (custo zero, orçamento de sessão em vez de dinheiro).
 * O prompt e o parse são os MESMOS de src/lib/research.ts, então o v1 do lote e o
 * do uso real são o mesmo artefato — não duas versões que divergem.
 *
 * RESUMÍVEL E IDEMPOTENTE. A assinatura tem limite de sessão e uma execução longa
 * vai estourar no meio; cada investigação é gravada assim que sai e a próxima
 * execução pula quem já tem. Ctrl-C não perde nada.
 */
import { createClient } from "@supabase/supabase-js";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { calcScore } from "../src/lib/scoring.ts";
import { promptResearch, parseResearch, RESEARCH_SYSTEM } from "../src/lib/research.ts";
import { idsComResearch, salvarResearch } from "../src/lib/research-store.ts";
import { setorPorId } from "../src/lib/setores.ts";
import { MODELO_ANALISE } from "../src/lib/modelos.ts";
import type { Empresa } from "../src/lib/types.ts";

const args = process.argv.slice(2);
const flag = (n: string, p: string | null = null) => {
  const a = args.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3).trim() : p;
};
const N = Number(flag("n", "25"));
const setorId = flag("setor");
/* Teto e piso de score_v0 da coorte a investigar. Sem --max o lote mira o topo
   absoluto, que e onde o v1 nao consegue mexer no numero (ver candidatas()). */
const scoreMax = flag("max") ? Number(flag("max")) : null;
const scoreMin = flag("min") ? Number(flag("min")) : null;
const dry = args.includes("--dry");
/* Modelo fixo pelo mesmo motivo do lote de memo: default do CLI variou entre duas
   execuções no mesmo dia, e corpus meio escrito por um modelo e meio por outro tem
   profundidade desigual sem nada indicando por quê. Fica gravado em score_run.model. */
const MODELO = flag("modelo", MODELO_ANALISE)!;

if (!Number.isFinite(N) || N <= 0) { console.error(`--n inválido: ${flag("n")}`); process.exit(1); }
const setor = setorId ? setorPorId(setorId) : null;
if (setorId && !setor) { console.error(`setor "${setorId}" não está no registry`); process.exit(1); }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const SELECT = `id, cnpj, razao_social, nome_fantasia, cnae_principal, cnae_principal_desc,
  natureza_juridica, municipio, uf, data_inicio_atividade, capital_social, porte,
  socio(id, nome, qualificacao, faixa_etaria, data_entrada_sociedade)`;

/* Candidatas: sem v1, do topo do ranking pra baixo. O originador vê a lista
   ordenada por score, então investigar em outra ordem é preencher primeiro o que
   ninguém vai abrir. Pagina com `.order` explícito (score_v0, depois id como
   desempate) — sem ordenação estável o `.range()` repete e pula linha.

   `--max` existe por causa de um lote inteiro desperdiçado em 30/07/2026. As 10
   primeiras de metalmecânica estavam todas em score 100, e como v1 = clamp(v0 +
   ajuste, 0, 100), nenhum sinal positivo tinha para onde subir: as 10 voltaram com
   delta 0 depois de 15,8 minutos de inferência. O v1 não mudou nenhuma posição
   porque não havia posição a mudar — o score já tinha decidido.

   Inferência cara tem que ir onde ela MUDA uma decisão. Abaixo do teto, um +12 ou
   um -8 reordena de verdade; no teto, o v1 só serve pelo gatilho, que é outro
   produto. Daí investigar a faixa logo abaixo do topo em vez do topo. */
async function candidatas(precisa: number): Promise<Empresa[]> {
  const jaInvestigadas = await idsComResearch(supabase);
  const lista: Empresa[] = [];
  const BLOCO = 200;
  const cnaeFiltro = setor ? setor.cnaes.map((p) => `cnae_principal.like.${p}*`).join(",") : null;

  for (let from = 0; lista.length < precisa; from += BLOCO) {
    let q = supabase
      .from("empresa")
      .select(SELECT)
      .order("score_v0", { ascending: false, nullsFirst: false })
      .order("id")
      .range(from, from + BLOCO - 1);
    if (cnaeFiltro) q = q.or(cnaeFiltro);
    if (scoreMax != null) q = q.lte("score_v0", scoreMax);
    if (scoreMin != null) q = q.gte("score_v0", scoreMin);

    const { data, error } = await q;
    if (error) { console.error("FAIL leitura:", error.message); process.exit(1); }
    if (!data?.length) break;

    for (const row of data as unknown as Empresa[]) {
      if (jaInvestigadas.has(row.id)) continue;
      lista.push(row);
      if (lista.length >= precisa) break;
    }
    if (data.length < BLOCO) break;
  }
  return lista;
}

async function investigarPorAssinatura(empresa: Empresa) {
  let raw: string | null = null;
  for await (const m of query({
    prompt: promptResearch(empresa),
    options: {
      systemPrompt: RESEARCH_SYSTEM,
      allowedTools: ["WebSearch", "WebFetch"],
      maxTurns: 18, // 4 buscas + leitura + resposta; folga pra retomada
      model: MODELO,
      // Zerar a key força autenticação pela assinatura em vez de cobrar da API.
      env: { ...process.env, ANTHROPIC_API_KEY: undefined } as NodeJS.ProcessEnv,
    },
  })) {
    if (m.type === "result" && m.subtype === "success") raw = m.result;
  }
  if (!raw) throw new Error("sem resultado do modelo");
  return parseResearch(raw, empresa.score?.score ?? 0);
}

async function investigarComRetry(empresa: Empresa, tentativas = 2) {
  let ultimo: Error | null = null;
  for (let i = 0; i < tentativas; i++) {
    try { return await investigarPorAssinatura(empresa); } catch (err) {
      ultimo = err as Error;
      if (/session limit|rate.?limit/i.test(ultimo.message)) throw ultimo; // não insiste
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw ultimo ?? new Error("falha desconhecida");
}

const alvo = setor ? setor.nome : "todos os setores";
const faixa = scoreMin != null || scoreMax != null
  ? ` · faixa de score ${scoreMin ?? 0}–${scoreMax ?? 100}` : "";
console.log(`Investigações (v1) em lote · ${alvo} · alvo ${N} empresas sem v1 · ordem score_v0 desc${faixa}`);
console.log(`modelo ${MODELO} · via assinatura (custo zero, orçamento de sessão)\n`);

const lista = await candidatas(N);
if (!lista.length) { console.log("Nada a fazer: todas as candidatas já foram investigadas."); process.exit(0); }
for (const e of lista) e.score = calcScore(e);
console.log(`${lista.length} empresas selecionadas.\n`);

if (dry) {
  for (const e of lista.slice(0, 20)) {
    console.log(`  ${String(e.score?.score ?? 0).padStart(3)} · ${e.razao_social.slice(0, 46)} · ${e.municipio ?? "?"}`);
  }
  if (lista.length > 20) console.log(`  … e mais ${lista.length - 20}`);
  console.log("\n[dry] nada investigado nem gravado.");
  process.exit(0);
}

let ok = 0, falhas = 0, subiram = 0, cairam = 0, comGatilho = 0;
const t0 = Date.now();
for (const [i, empresa] of lista.entries()) {
  const rotulo = `[${i + 1}/${lista.length}] ${empresa.razao_social.slice(0, 36)}`;
  const t1 = Date.now();
  try {
    const research = await investigarComRetry(empresa);
    // Grava IMEDIATAMENTE: se a próxima estourar o limite de sessão, esta já ficou.
    const { persistido } = await salvarResearch(
      supabase, empresa.id, research, empresa.score?.breakdown, `assinatura/${MODELO}`
    );
    if (!persistido) { console.log(`${rotulo} — investigada mas NÃO gravada`); falhas++; continue; }
    ok++;
    if (research.delta > 0) subiram++;
    if (research.delta < 0) cairam++;
    if (research.gatilho) comGatilho++;
    const seta = research.delta > 0 ? "↑" : research.delta < 0 ? "↓" : "=";
    const sinais = research.sinais.map((s) => s.tipo).join(",") || "sem sinais";
    console.log(
      `${rotulo} ✓ ${((Date.now() - t1) / 1000).toFixed(0)}s · ` +
      `v0:${research.score_v0}→v1:${research.score_v1} ${seta}${research.delta} · ${sinais}`
    );
  } catch (err) {
    const msg = (err as Error).message;
    falhas++;
    console.log(`${rotulo} ✗ ${msg.slice(0, 120)}`);
    /* Limite de sessão não adianta insistir: para e reporta o que já ficou salvo.
       Rodar de novo depois do reset continua de onde parou. */
    if (/session limit|rate.?limit/i.test(msg)) {
      console.log("\n⚠ limite da assinatura atingido — parando aqui. O que foi gravado está salvo.");
      break;
    }
  }
}

const mins = ((Date.now() - t0) / 60000).toFixed(1);
console.log(`\n✓ ${ok} investigações gravadas, ${falhas} falhas, em ${mins} min.`);
console.log(`  ${subiram} subiram de score · ${cairam} caíram · ${comGatilho} com gatilho de timing.`);
const total = (await idsComResearch(supabase)).size;
console.log(`  empresas com v1 no banco: ${total}`);
if (ok > 0) {
  console.log(`\nPróximo passo: node --experimental-strip-types --env-file=.env.local scripts/precompute-memos.ts --n=${ok}`);
  console.log("  (o lote de memo prioriza quem tem v1 e refaz os memos cegos)");
}
