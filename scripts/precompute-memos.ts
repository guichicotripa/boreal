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
 * Ordem: score_v0 desc — descreve primeiro quem o originador vai ver primeiro.
 * Usa o MESMO promptDossier/parseDossier da rota, para o memo do lote e o do uso
 * real não divergirem.
 */
import { createClient } from "@supabase/supabase-js";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { calcScore } from "../src/lib/scoring.ts";
import { promptDossier, parseDossier, DOSSIER_SYSTEM } from "../src/lib/dossier.ts";
import { salvarMemo, idsComMemo } from "../src/lib/memo-store.ts";
import { setorPorId } from "../src/lib/setores.ts";
import type { Empresa } from "../src/lib/types.ts";

const args = process.argv.slice(2);
const flag = (n: string, p: string | null = null) => {
  const a = args.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3).trim() : p;
};
const N = Number(flag("n", "50"));
const setorId = flag("setor");
const dry = args.includes("--dry");

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

/* Busca um bloco de candidatas já sem memo. Pagina com `.order` explícito: sem
   ordenação estável o `.range()` repete linha numa página e pula em outra — foi
   assim que o backfill de score_v0 deixou 18.386 empresas de fora. */
async function candidatas(precisa: number): Promise<Empresa[]> {
  const escolhidas: Empresa[] = [];
  const BLOCO = 200;
  for (let from = 0; escolhidas.length < precisa; from += BLOCO) {
    let q = supabase
      .from("empresa")
      .select(SELECT)
      .order("score_v0", { ascending: false, nullsFirst: false })
      .order("id")
      .range(from, from + BLOCO - 1);
    if (setor) q = q.or(setor.cnaes.map((p) => `cnae_principal.like.${p}*`).join(","));

    const { data, error } = await q;
    if (error) { console.error("FAIL leitura:", error.message); process.exit(1); }
    if (!data?.length) break;

    const bloco = data as unknown as Empresa[];
    const jaTem = await idsComMemo(supabase, bloco.map((e) => e.id));
    for (const e of bloco) {
      if (jaTem.has(e.id)) continue;
      escolhidas.push(e);
      if (escolhidas.length >= precisa) break;
    }
    if (data.length < BLOCO) break;
  }
  return escolhidas;
}

async function gerarPorAssinatura(empresa: Empresa) {
  let raw: string | null = null;
  for await (const m of query({
    prompt: promptDossier(empresa),
    options: {
      systemPrompt: DOSSIER_SYSTEM,
      allowedTools: [],
      maxTurns: 4,
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

const lista = await candidatas(N);
if (!lista.length) { console.log("Nada a fazer: todas as candidatas já têm memo."); process.exit(0); }
console.log(`${lista.length} empresas selecionadas.\n`);

if (dry) {
  for (const e of lista.slice(0, 20)) {
    console.log(`  ${String(calcScore(e).score).padStart(3)} · ${e.razao_social.slice(0, 46)} · ${e.municipio ?? "?"}`);
  }
  if (lista.length > 20) console.log(`  … e mais ${lista.length - 20}`);
  console.log("\n[dry] nada gerado nem gravado.");
  process.exit(0);
}

let ok = 0, falhas = 0;
const t0 = Date.now();
for (const [i, empresa] of lista.entries()) {
  empresa.score = calcScore(empresa);
  const rotulo = `[${i + 1}/${lista.length}] ${empresa.razao_social.slice(0, 40)}`;
  try {
    const analise = await gerarDossierComRetry(empresa);
    // Grava IMEDIATAMENTE: se a próxima estourar o limite de sessão, esta já ficou.
    const gravou = await salvarMemo(supabase, empresa.id, analise, "assinatura/precompute");
    if (!gravou) { console.log(`${rotulo} — gerado mas NÃO gravado (migration 0009?)`); falhas++; continue; }
    ok++;
    console.log(`${rotulo} ✓ ${analise.red_flags.length} red flags`);
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

async function gerarDossierComRetry(empresa: Empresa, tentativas = 2) {
  let ultimo: Error | null = null;
  for (let i = 0; i < tentativas; i++) {
    try { return await gerarPorAssinatura(empresa); } catch (err) {
      ultimo = err as Error;
      if (/session limit|rate.?limit/i.test(ultimo.message)) throw ultimo; // não insiste
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw ultimo ?? new Error("falha desconhecida");
}

const mins = ((Date.now() - t0) / 60000).toFixed(1);
const { count: total } = await supabase.from("empresa_memo").select("*", { count: "exact", head: true });
console.log(`\n✓ ${ok} memos gravados, ${falhas} falhas, em ${mins} min.`);
console.log(`  empresas com memo no banco: ${total}`);
