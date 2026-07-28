/**
 * Pré-computa MEMOS em lote, via assinatura, gravando no banco (migration 0009).
 *
 *   node --experimental-strip-types --env-file=.env.local scripts/precompute-memos.ts --n=100
 *   node --experimental-strip-types --env-file=.env.local scripts/precompute-memos.ts --n=50 --setor=agro
 *   node --experimental-strip-types --env-file=.env.local scripts/precompute-memos.ts --n=20 --dry
 *
 * É o "deixo o universo deles carregado antes do dia 1" do onepager, na forma que
 * escala: o memo vai pro BANCO, não pro bundle. src/lib/dossier-cache.json só
 * comporta as 51 dos demos porque é importado dentro da função serverless.
 *
 * RESUMÍVEL E IDEMPOTENTE de propósito. A assinatura tem limite de sessão, e uma
 * execução longa vai estourar no meio — já aconteceu com o cache de insights, que
 * perdeu tudo por não ser resumível. Aqui cada memo é gravado assim que sai, e a
 * próxima execução pula quem já tem. Interromper com Ctrl-C não perde nada.
 *
 * ORDEM IMPORTA: quem já tem investigação (v1) vem primeiro, e o memo é gerado COM
 * ela. Memo escrito sem v1 conhece só o registro do CNPJ — é cego para assessor
 * contratado, menção pública a venda e sucessor já atuando, que são os fatos que
 * definem o ângulo da abordagem. Gerar memo antes do v1 é produzir material que
 * vai precisar ser refeito; a coluna `com_v1` marca quais.
 * Dentro de cada grupo, score_v0 desc — descreve primeiro quem o originador vê primeiro.
 *
 * Usa o MESMO promptDossier/parseDossier da rota, para o memo do lote e o do uso
 * real não divergirem.
 */
import { createClient } from "@supabase/supabase-js";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { calcScore } from "../src/lib/scoring.ts";
import { promptDossier, parseDossier, DOSSIER_SYSTEM } from "../src/lib/dossier.ts";
import { salvarMemo } from "../src/lib/memo-store.ts";
import { lerResearchSalvo } from "../src/lib/research-store.ts";
import { setorPorId } from "../src/lib/setores.ts";
import { MODELO_ANALISE } from "../src/lib/modelos.ts";
import type { Empresa, ResearchResult } from "../src/lib/types.ts";

const args = process.argv.slice(2);
const flag = (n: string, p: string | null = null) => {
  const a = args.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3).trim() : p;
};
const N = Number(flag("n", "50"));
const setorId = flag("setor");
const dry = args.includes("--dry");
/* Modelo FIXO, não o default do CLI — que variou entre duas execuções no mesmo
   dia. Corpus metade escrito por um modelo e metade por outro tem profundidade
   desigual sem nada na tela indicando por quê. Fica gravado em
   empresa_memo.modelo, então dá pra saber depois de onde veio cada memo.

   Padrão é o Sonnet 5 (MODELO_ANALISE). Para o topo da lista vale
   `--modelo=claude-opus-5`: medido, o Opus 5 lê campos que o Sonnet ignora (ver
   src/lib/modelos.ts), ao custo de ~4x o tempo por memo. */
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
  cnaes_secundarios, natureza_juridica, municipio, uf, data_inicio_atividade,
  capital_social, porte, telefone, email,
  socio(id, nome, qualificacao, faixa_etaria, data_entrada_sociedade)`;

/** Empresas que já têm investigação (v1) — são a fila prioritária. */
async function idsComV1(): Promise<Set<string>> {
  const ids = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("score_run")
      .select("empresa_id")
      .not("research", "is", null)
      .order("empresa_id")
      .range(from, from + 999);
    if (error || !data?.length) break;
    for (const r of data as { empresa_id: string }[]) ids.add(r.empresa_id);
    if (data.length < 1000) break;
  }
  return ids;
}

/* Busca candidatas. Pagina com `.order` explícito: sem ordenação estável o
   `.range()` repete linha numa página e pula em outra — foi assim que o backfill
   de score_v0 deixou 18.386 empresas de fora.

   Elegível = sem memo, OU com memo escrito sem v1 numa empresa que hoje TEM v1
   (esse memo é inferior ao que dá pra escrever agora e precisa ser refeito).
   Prioridade: quem tem v1 primeiro, para não gerar material que já nasce para
   ser refeito. */
type LinhaComMemo = Empresa & { empresa_memo?: { com_v1: boolean } | { com_v1: boolean }[] | null };

/* O memo embutido vem como OBJETO, não array: empresa_id é chave primária em
   empresa_memo, então o PostgREST trata a relação como um-para-um. Ler com
   `[0]` devolvia undefined SEMPRE — e o script achava que ninguém tinha memo,
   regerando quem já estava pronto e queimando sessão à toa. Aceita as duas
   formas porque a decisão é do PostgREST, não nossa. */
function memoDa(row: LinhaComMemo): { com_v1: boolean } | undefined {
  const rel = row.empresa_memo;
  if (!rel) return undefined;
  return Array.isArray(rel) ? rel[0] : rel;
}

/** Elegível = sem memo, OU com memo cego numa empresa que hoje TEM investigação. */
function elegivel(row: LinhaComMemo, temV1: boolean): "novo" | "refacao" | null {
  const memo = memoDa(row);
  if (!memo) return "novo";
  return !memo.com_v1 && temV1 ? "refacao" : null;
}

async function candidatas(precisa: number): Promise<{ lista: Empresa[]; refacoes: number }> {
  const comV1 = await idsComV1();
  const prioritarias: Empresa[] = [];
  const resto: Empresa[] = [];
  let refacoes = 0;
  const BLOCO = 200;
  const cnaeFiltro = setor ? setor.cnaes.map((p) => `cnae_principal.like.${p}*`).join(",") : null;

  /* Passo 1 — quem tem v1, consultado por id em vez de varrendo a base. Antes o
     laço só parava quando a fila prioritária enchia, o que nunca acontecia com
     poucas empresas investigadas: varria as 51 mil linhas toda execução. */
  const idsV1 = [...comV1];
  for (let i = 0; i < idsV1.length && prioritarias.length < precisa; i += BLOCO) {
    let q = supabase
      .from("empresa")
      .select(`${SELECT}, empresa_memo(com_v1)`)
      .in("id", idsV1.slice(i, i + BLOCO))
      .order("score_v0", { ascending: false, nullsFirst: false })
      .order("id");
    if (cnaeFiltro) q = q.or(cnaeFiltro);

    const { data, error } = await q;
    if (error) { console.error("FAIL leitura (v1):", error.message); process.exit(1); }
    for (const row of (data ?? []) as unknown as LinhaComMemo[]) {
      const tipo = elegivel(row, true);
      if (!tipo) continue;
      if (tipo === "refacao") refacoes++;
      prioritarias.push(row);
      if (prioritarias.length >= precisa) break;
    }
  }

  // Passo 2 — completa por score só se a fila prioritária não encheu o alvo.
  for (let from = 0; prioritarias.length + resto.length < precisa; from += BLOCO) {
    let q = supabase
      .from("empresa")
      .select(`${SELECT}, empresa_memo(com_v1)`)
      .order("score_v0", { ascending: false, nullsFirst: false })
      .order("id")
      .range(from, from + BLOCO - 1);
    if (cnaeFiltro) q = q.or(cnaeFiltro);

    const { data, error } = await q;
    if (error) { console.error("FAIL leitura:", error.message); process.exit(1); }
    if (!data?.length) break;

    for (const row of data as unknown as LinhaComMemo[]) {
      if (comV1.has(row.id)) continue; // já tratado no passo 1
      if (elegivel(row, false) !== "novo") continue;
      resto.push(row);
      if (prioritarias.length + resto.length >= precisa) break;
    }
    if (data.length < BLOCO) break;
  }

  return { lista: [...prioritarias, ...resto].slice(0, precisa), refacoes };
}

async function gerarPorAssinatura(empresa: Empresa, research: ResearchResult | null) {
  let raw: string | null = null;
  for await (const m of query({
    prompt: promptDossier(empresa, research),
    options: {
      systemPrompt: DOSSIER_SYSTEM,
      allowedTools: [],
      maxTurns: 4,
      model: MODELO,
      // Zerar a key força autenticação pela assinatura em vez de cobrar da API.
      env: { ...process.env, ANTHROPIC_API_KEY: undefined } as NodeJS.ProcessEnv,
    },
  })) {
    if (m.type === "result" && m.subtype === "success") raw = m.result;
  }
  if (!raw) throw new Error("sem resultado do modelo");
  return parseDossier(raw);
}

const alvo = setor ? `${setor.nome}` : "todos os setores";
console.log(`Memos em lote · ${alvo} · alvo ${N} empresas sem memo · ordem score_v0 desc\n`);

const { lista, refacoes } = await candidatas(N);
if (!lista.length) { console.log("Nada a fazer: todas as candidatas já têm memo tão bom quanto dá."); process.exit(0); }
console.log(`${lista.length} empresas selecionadas${refacoes ? ` (${refacoes} são refação: memo antigo sem v1)` : ""}.\n`);

if (dry) {
  for (const e of lista.slice(0, 20)) {
    console.log(`  ${String(calcScore(e).score).padStart(3)} · ${e.razao_social.slice(0, 46)} · ${e.municipio ?? "?"}`);
  }
  if (lista.length > 20) console.log(`  … e mais ${lista.length - 20}`);
  console.log("\n[dry] nada gerado nem gravado.");
  process.exit(0);
}

let ok = 0, falhas = 0, comV1 = 0;
const t0 = Date.now();
for (const [i, empresa] of lista.entries()) {
  empresa.score = calcScore(empresa);
  const rotulo = `[${i + 1}/${lista.length}] ${empresa.razao_social.slice(0, 38)}`;
  try {
    const v1 = await lerResearchSalvo(supabase, empresa.id);
    const analise = await gerarDossierComRetry(empresa, v1?.research ?? null);
    // Grava IMEDIATAMENTE: se a próxima estourar o limite de sessão, esta já ficou.
    const gravou = await salvarMemo(supabase, empresa.id, analise, `assinatura/${MODELO}`, !!v1);
    if (!gravou) { console.log(`${rotulo} — gerado mas NÃO gravado (migration 0009?)`); falhas++; continue; }
    ok++;
    if (v1) comV1++;
    console.log(`${rotulo} ✓ ${analise.red_flags.length} red flags ${v1 ? "· com v1" : "· sem v1"}`);
  } catch (err) {
    const msg = (err as Error).message;
    falhas++;
    console.log(`${rotulo} ✗ ${msg}`);
    /* Limite de sessão não adianta insistir: para e reporta o que já ficou salvo.
       Rodar de novo depois do reset continua de onde parou. */
    if (/session limit|rate.?limit/i.test(msg)) {
      console.log("\n⚠ limite da assinatura atingido — parando aqui. O que foi gravado está salvo.");
      break;
    }
  }
}

async function gerarDossierComRetry(empresa: Empresa, research: ResearchResult | null, tentativas = 2) {
  let ultimo: Error | null = null;
  for (let i = 0; i < tentativas; i++) {
    try { return await gerarPorAssinatura(empresa, research); } catch (err) {
      ultimo = err as Error;
      if (/session limit|rate.?limit/i.test(ultimo.message)) throw ultimo; // não insiste
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw ultimo ?? new Error("falha desconhecida");
}

const mins = ((Date.now() - t0) / 60000).toFixed(1);
const { count: total } = await supabase.from("empresa_memo").select("*", { count: "exact", head: true });
console.log(`\n✓ ${ok} memos gravados (${comV1} com investigação), ${falhas} falhas, em ${mins} min.`);
if (ok > comV1) {
  console.log(`  ⚠ ${ok - comV1} escritos SEM v1 — inferiores, e marcados com_v1=false.`);
  console.log(`    Quando essas empresas forem investigadas, rode este lote de novo: ele refaz.`);
}
console.log(`  empresas com memo no banco: ${total}`);
