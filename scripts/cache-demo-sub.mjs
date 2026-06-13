// Gera o demo-cache das teses de SAÚDE e EDUCAÇÃO (chave composta `setor|tese`), com as
// empresas top de cada uma, VIA ASSINATURA. O caminho de busca é replicado fielmente do
// route /api/search: query no Supabase + score determinístico (réplica de src/lib/scoring.ts),
// e SÓ o reasoner roda no LLM, via Agent SDK na assinatura (custo zero). Sem API key, sem dev server.
//
// Metalmec NÃO é tocado (já está cacheado sob chave de texto puro, que é o que a home manda
// quando o setor é o default). Mescla no demo-cache.json existente.
//   node --env-file=.env.local scripts/cache-demo-sub.mjs
import { createClient } from "@supabase/supabase-js";
import { query } from "@anthropic-ai/claude-agent-sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Env via `node --env-file=.env.local` (parser nativo). Supabase lê das vars; o Agent SDK
// força a assinatura zerando ANTHROPIC_API_KEY no env do query().
const OUT = path.resolve(__dirname, "../src/lib/demo-cache.json");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Teses por setor (as mesmas chips da home) + parse determinístico (CNAE vem do setor;
// idade/ano extraídos da frase). "acima de 70" => faixa ≥ 8 (71-80); "idoso/acima de 60" => ≥ 7.
const TESES = [
  { setor: "saude",    cnaes: ["86"],         text: "clínicas com sócios acima de 70 anos",          minFaixa: 8,    maxAno: null },
  { setor: "saude",    cnaes: ["86"],         text: "laboratórios fundados antes de 1990",            minFaixa: null, maxAno: 1990 },
  { setor: "saude",    cnaes: ["86"],         text: "consultórios com sócio único idoso",             minFaixa: 7,    maxAno: null },
  { setor: "educacao", cnaes: ["851", "852"], text: "escolas familiares com sócios acima de 70 anos", minFaixa: 8,    maxAno: null },
  { setor: "educacao", cnaes: ["851", "852"], text: "colégios fundados antes de 1990",                minFaixa: null, maxAno: 1990 },
  { setor: "educacao", cnaes: ["851", "852"], text: "creches e educação infantil de dono idoso",      minFaixa: 7,    maxAno: null },
];
const LIMIT = 50;

const normalizeQuery = (q) =>
  q.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

// ── Score: réplica FIEL de src/lib/scoring.ts (v0.1 calibrado). Não alterar sem sincronizar lá. ──
const faixasPF = (socios) => (socios ?? []).map((s) => Number(s.faixa_etaria)).filter((n) => Number.isFinite(n) && n >= 1 && n <= 9);
function scoreIdade(socios) {
  const f = faixasPF(socios); if (!f.length) return { pts: 0, sinal: null };
  const max = Math.max(...f); const table = { 9: 30, 8: 26, 7: 20, 6: 10 }; const pts = table[max] ?? 0;
  if (!pts) return { pts: 0, sinal: null };
  const lbl = { 9: "80+", 8: "71–80", 7: "61–70", 6: "51–60" }; const qtd = f.filter((x) => x === max).length;
  return { pts, sinal: qtd > 1 ? `${qtd} sócios na faixa ${lbl[max]} anos` : `Sócio mais velho na faixa ${lbl[max]} anos` };
}
function scoreAntiguidade(dataInicio) {
  if (!dataInicio) return { pts: 0, sinal: null };
  const ano = Number(String(dataInicio).slice(0, 4)); if (!Number.isFinite(ano)) return { pts: 0, sinal: null };
  const anos = 2026 - ano;
  if (anos >= 40) return { pts: 30, sinal: `Fundada em ${ano} (${anos} anos de operação)` };
  if (anos >= 25) return { pts: 22, sinal: `Fundada em ${ano} (${anos} anos de operação)` };
  if (anos >= 15) return { pts: 10, sinal: `Fundada em ${ano}` };
  return { pts: 0, sinal: null };
}
function scorePorte(porte) {
  if (!porte) return { pts: 0, sinal: null }; const p = String(porte).toUpperCase();
  if (p.includes("DEMAIS")) return { pts: 30, sinal: "Porte relevante (não-ME/EPP)" };
  if (p === "EPP") return { pts: 15, sinal: "Porte EPP" };
  if (p === "ME") return { pts: 5, sinal: null };
  return { pts: 0, sinal: null };
}
function scorePlural(socios) {
  const n = faixasPF(socios).length;
  if (n >= 2) return { pts: 10, sinal: `Quadro com ${n} sócios` };
  if (n === 1) return { pts: 0, sinal: "Sócio único (perfil menos transacionável)" };
  return { pts: 0, sinal: null };
}
function perfilSucessorio(e) {
  const f = faixasPF(e.socio); const idoso = f.length > 0 && Math.max(...f) >= 7;
  const ano = e.data_inicio_atividade ? Number(String(e.data_inicio_atividade).slice(0, 4)) : NaN;
  return idoso && Number.isFinite(ano) && 2026 - ano >= 25;
}
function calcScore(e) {
  const idade = scoreIdade(e.socio), ant = scoreAntiguidade(e.data_inicio_atividade), porte = scorePorte(e.porte), plural = scorePlural(e.socio);
  const breakdown = { idade_socios: idade.pts, antiguidade_empresa: ant.pts, porte_relevancia: porte.pts, quadro_plural: plural.pts };
  const sinais = [idade, ant, porte, plural].filter((x) => x.sinal).sort((a, b) => b.pts - a.pts).map((x) => x.sinal);
  return { score: idade.pts + ant.pts + porte.pts + plural.pts, breakdown, sinais, perfil_sucessorio: perfilSucessorio(e) };
}

// ── Reasoner: réplica de src/lib/reasoner.ts, mas via Agent SDK (assinatura). ──
const FAIXA_LABEL = { "1": "0-12", "2": "13-20", "3": "21-30", "4": "31-40", "5": "41-50", "6": "51-60", "7": "61-70", "8": "71-80", "9": "80+" };
const REASONER_SYSTEM =
  "Você é um analista sênior de PE/M&A no Brasil, especializado em empresas familiares com risco " +
  "sucessório. Recebe dados estruturados de empresas e escreve análises curtas e específicas. " +
  "Responde SEMPRE e APENAS com JSON válido (array), sem texto antes/depois, sem markdown.";
function compact(e) {
  const socios = (e.socio ?? []).map((s) => ({
    nome: s.nome, faixa: s.faixa_etaria ? FAIXA_LABEL[s.faixa_etaria] ?? s.faixa_etaria : null,
    entrou_em: s.data_entrada_sociedade?.slice(0, 4) ?? null,
  }));
  return {
    id: e.id, nome: e.razao_social, setor: e.cnae_principal_desc ?? e.cnae_principal, cidade: e.municipio,
    natureza: e.natureza_juridica, fundada_em: e.data_inicio_atividade?.slice(0, 4) ?? null,
    capital_social: e.capital_social, porte: e.porte, score: e.score?.score ?? null,
    sinais_score: e.score?.sinais ?? [], socios,
  };
}
async function reason(empresas, topN = 15) {
  const sample = empresas.slice(0, topN).map(compact);
  if (!sample.length) return [];
  const prompt = `Analise estas ${sample.length} empresas com possível risco sucessório.

Para CADA uma, escreva:
- "one_liner": 1 frase (máx 25 palavras) em português que prove que você leu os dados dessa empresa específica. Cite ano de fundação, idade dos sócios, ou outro dado concreto. NUNCA frases genéricas tipo "empresa com sinais de risco sucessório".
- "flags": 2 a 3 tags curtas (máx 3 palavras cada) que resumem o perfil. Exemplos: "sócios 80+", "quadro travado 40 anos", "porte sweet spot", "fundador único".

Responda APENAS com este JSON (array, mesma ordem):
[{"empresa_id":"...","one_liner":"...","flags":["...","..."]}]

Dados:
${JSON.stringify(sample, null, 2)}`;

  let raw = null;
  for await (const m of query({
    prompt,
    options: { systemPrompt: REASONER_SYSTEM, allowedTools: [], maxTurns: 4, env: { ...process.env, ANTHROPIC_API_KEY: undefined } },
  })) {
    if (m.type === "result" && m.subtype === "success") raw = m.result;
  }
  if (!raw) throw new Error("reasoner sem resultado");
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("reasoner sem array JSON: " + raw.slice(0, 120));
  return JSON.parse(match[0])
    .filter((x) => x && typeof x === "object")
    .map((x) => ({ empresa_id: String(x.empresa_id ?? ""), one_liner: String(x.one_liner ?? "").trim(), flags: Array.isArray(x.flags) ? x.flags.map((f) => String(f).trim()).filter(Boolean).slice(0, 3) : [] }))
    .filter((x) => x.empresa_id && x.one_liner);
}

// ── Query no Supabase: réplica do route /api/search. ──
async function buscar(t) {
  const socioEmbed = t.minFaixa != null ? "socio!inner" : "socio";
  let q = supabase.from("empresa").select(
    `id, cnpj, razao_social, nome_fantasia, cnae_principal, cnae_principal_desc,
     cnaes_secundarios, natureza_juridica, municipio, uf,
     data_inicio_atividade, capital_social, porte, telefone, email,
     ${socioEmbed}(id, nome, qualificacao, faixa_etaria, data_entrada_sociedade)`
  );
  q = q.or(t.cnaes.map((p) => `cnae_principal.like.${p}*`).join(","));
  if (t.minFaixa != null) q = q.gte("socio.faixa_etaria", String(t.minFaixa));
  if (t.maxAno != null) q = q.lte("data_inicio_atividade", `${t.maxAno}-12-31`);
  q = q.limit(LIMIT);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  let empresas = data ?? [];
  // Inner join projeta só os sócios que batem o filtro; o score precisa do quadro COMPLETO.
  if (t.minFaixa != null && empresas.length) {
    const ids = empresas.map((e) => e.id);
    const { data: todos } = await supabase.from("socio")
      .select("id, empresa_id, nome, qualificacao, faixa_etaria, data_entrada_sociedade").in("empresa_id", ids);
    if (todos) {
      const m = new Map();
      for (const s of todos) { const a = m.get(s.empresa_id) ?? []; a.push(s); m.set(s.empresa_id, a); }
      for (const e of empresas) e.socio = m.get(e.id) ?? e.socio;
    }
  }
  return empresas;
}

// ── Main ──
const cache = JSON.parse(fs.readFileSync(OUT, "utf8"));
console.log(`Gerando ${TESES.length} teses (saúde + educação) via assinatura…\n`);
for (const t of TESES) {
  process.stdout.write(`[${t.setor}] "${t.text}" … `);
  const t0 = Date.now();
  const empresas = await buscar(t);
  const scored = empresas.map((e) => ({ ...e, score: calcScore(e) })).sort((a, b) => (b.score.score ?? 0) - (a.score.score ?? 0));
  let insights = [];
  try { insights = await reason(scored, 15); } catch (err) { console.log(`(reasoner falhou: ${err.message})`); }
  const byId = new Map(insights.map((i) => [i.empresa_id, i]));
  let reasonedCount = 0;
  for (const e of scored) { const ins = byId.get(e.id); if (ins) { e.insight = { one_liner: ins.one_liner, flags: ins.flags }; reasonedCount++; } }
  const resp = {
    filters: { cnaePrefixes: t.cnaes, minFaixaEtaria: t.minFaixa, maxAnoFundacao: t.maxAno, limit: LIMIT },
    parsedBy: "heuristic", count: scored.length, empresas: scored, reasoned: reasonedCount > 0, reasonedCount,
  };
  cache[`${t.setor}|${normalizeQuery(t.text)}`] = resp;
  console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s · ${scored.length} empresas · ${reasonedCount} com insight`);
}
fs.writeFileSync(OUT, JSON.stringify(cache, null, 2));
console.log(`\n✓ demo-cache.json atualizado (+${TESES.length} chaves compostas saúde/educação; metalmec intacto).`);
