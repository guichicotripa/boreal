// Mede o CUSTO REAL por empresa (via API), capturando o usage de cada resposta da Anthropic.
// Roda o pipeline de verdade (reasoner + research + dossiê) em N empresas de amostra e reporta:
// custo por empresa investigada, custo por busca, e extrapolação mensal pro piloto.
//   node --env-file=.env.local scripts/medir-custo.mjs [N=3]
//
// ATENÇÃO: usa a API (gasta ~$0,20/empresa). Com N=3 ≈ $0,60-1,00. É o preço de ter o número medido.
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEMO = path.resolve(__dirname, "../src/lib/demo-cache.json");
const N = Number(process.argv[2] ?? 3);
const client = new Anthropic();

// Pricing (USD por 1M tokens) — Sonnet 4.6 e Haiku 4.5; web search $10/1k buscas.
const PRICE = {
  "claude-sonnet-4-6": { in: 3, out: 15 },
  "claude-haiku-4-5": { in: 1, out: 5 },
};
const WEB_SEARCH_PER_REQ = 0.01;
const USD_BRL = 5.5;

function custo(model, usage) {
  const p = PRICE[model];
  const tokIn = usage.input_tokens ?? 0;
  const tokOut = usage.output_tokens ?? 0;
  const web = usage.server_tool_use?.web_search_requests ?? 0;
  const usd = (tokIn * p.in + tokOut * p.out) / 1_000_000 + web * WEB_SEARCH_PER_REQ;
  return { usd, tokIn, tokOut, web };
}

const FAIXA = { "1": "0-12", "2": "13-20", "3": "21-30", "4": "31-40", "5": "41-50", "6": "51-60", "7": "61-70", "8": "71-80", "9": "80+" };

// ── chamadas reais (espelham research.ts / dossier.ts / reasoner.ts) ──
async function research(e) {
  const socios = (e.socio ?? []).map((s) => s.nome).join(", ");
  const prompt = `Investigue esta empresa na web e procure sinais de risco/propensão sucessória.

Empresa: ${e.razao_social}
Setor: ${e.cnae_principal_desc ?? e.cnae_principal}
Cidade: ${e.municipio} / ${e.uf}
Fundada em: ${e.data_inicio_atividade?.slice(0, 4) ?? "?"}
Sócios: ${socios || "não informado"}

Procure sinais públicos de sucessão/venda (menção a venda, banco contratado, herdeiro fora da carreira,
C-suite externo, Big 4, sucessor ativo, ausência de pegada digital). Descreva também o negócio (produtos,
modelo, clientes). Responda em 3-4 frases + os sinais achados com fonte. Máximo 4 buscas na web.`;
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6", max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }],
  });
  return custo("claude-sonnet-4-6", msg.usage);
}

async function dossie(e) {
  const socios = (e.socio ?? []).map((s) => ({ nome: s.nome, faixa: s.faixa_etaria ? FAIXA[s.faixa_etaria] : null, entrou: s.data_entrada_sociedade?.slice(0, 4) ?? null }));
  const dados = { razao_social: e.razao_social, setor: e.cnae_principal_desc ?? e.cnae_principal, cidade: e.municipio, uf: e.uf, fundada_em: e.data_inicio_atividade?.slice(0, 4) ?? null, capital_social: e.capital_social, porte: e.porte, score: e.score?.score ?? null, sinais: e.score?.sinais ?? [], quadro_societario: socios };
  const prompt = `Gere a análise do dossiê desta empresa (overview, análise sucessória, red flags com como verificar,
4-5 perguntas de abordagem, tese, próximo passo). Use SÓ os dados; não invente financeiro. Responda em JSON.

Dados:
${JSON.stringify(dados, null, 2)}`;
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6", max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });
  return custo("claude-sonnet-4-6", msg.usage);
}

async function reasoner(empresas) {
  const sample = empresas.slice(0, 15).map((e) => ({ id: e.id, nome: e.razao_social, setor: e.cnae_principal_desc, fundada: e.data_inicio_atividade?.slice(0, 4), porte: e.porte, score: e.score?.score, socios: (e.socio ?? []).map((s) => ({ nome: s.nome, faixa: s.faixa_etaria ? FAIXA[s.faixa_etaria] : null })) }));
  const prompt = `Analise estas ${sample.length} empresas. Para cada uma: one_liner (1 frase específica) + flags (2-3 tags).
Responda em JSON array. Dados:\n${JSON.stringify(sample, null, 2)}`;
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6", max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });
  return custo("claude-sonnet-4-6", msg.usage);
}

async function parse() {
  const msg = await client.messages.create({
    model: "claude-haiku-4-5", max_tokens: 300,
    messages: [{ role: "user", content: `Traduza "clínicas com sócios acima de 70 anos no interior de SP" em JSON de filtros (cnaePrefixes, minFaixaEtaria, maxAnoFundacao, limit).` }],
  });
  return custo("claude-haiku-4-5", msg.usage);
}

// ── roda ──
const demo = JSON.parse(fs.readFileSync(DEMO, "utf8"));
const pool = [];
for (const [k, r] of Object.entries(demo)) if (k.includes("|")) pool.push(...r.empresas);
const amostra = pool.slice(0, N);
const lista15 = pool.slice(0, 15);

console.log(`Medindo custo real em ${amostra.length} empresas (via API)…\n`);

const fmt = (u) => `$${u.usd.toFixed(4)} (in ${u.tokIn}, out ${u.tokOut}${u.web ? `, web ${u.web}` : ""})`;

console.log("PARSE (Haiku, por busca):");
const cParse = await parse();
console.log("  " + fmt(cParse));

console.log("REASONER (Sonnet, top 15, por busca):");
const cReason = await reasoner(lista15);
console.log("  " + fmt(cReason));

let somaR = 0, somaD = 0;
for (let i = 0; i < amostra.length; i++) {
  const e = amostra[i];
  process.stdout.write(`[${i + 1}/${amostra.length}] ${e.razao_social.slice(0, 32)}\n`);
  const cR = await research(e); somaR += cR.usd;
  console.log("    research: " + fmt(cR));
  const cD = await dossie(e); somaD += cD.usd;
  console.log("    dossiê:   " + fmt(cD));
  console.log(`    => empresa: $${(cR.usd + cD.usd).toFixed(4)}`);
}

const mR = somaR / amostra.length, mD = somaD / amostra.length, mEmp = mR + mD;
const cBusca = cParse.usd + cReason.usd;

console.log("\n══════════════ RESULTADO MEDIDO ══════════════");
console.log(`Por busca (parse + reasoner):     $${cBusca.toFixed(4)}  (R$${(cBusca * USD_BRL).toFixed(2)})`);
console.log(`Research médio/empresa:           $${mR.toFixed(4)}`);
console.log(`Dossiê médio/empresa:             $${mD.toFixed(4)}`);
console.log(`POR EMPRESA INVESTIGADA (R+D):    $${mEmp.toFixed(4)}  (R$${(mEmp * USD_BRL).toFixed(2)})`);
console.log("\n── Extrapolação mensal (3 originadores) ──");
for (const inv of [200, 300, 400]) {
  const buscas = Math.round(inv * 1.5); // ~1,5 buscas por empresa investigada
  const total = inv * mEmp + buscas * cBusca;
  console.log(`  ${inv} empresas/mês (~${buscas} buscas): $${total.toFixed(2)}  (R$${(total * USD_BRL).toFixed(2)})`);
}
console.log("\n(API só. Fora: Claude Max ~$100-200, Supabase Pro ~$25 se crescer, Vercel $0-20, BigQuery ~$0 no free tier.)");
