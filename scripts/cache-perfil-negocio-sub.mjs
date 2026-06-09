// Enriquece o research-cache.json com "perfil_negocio" (o que a empresa faz, produtos,
// modelo, clientes) via ASSINATURA (Agent SDK + WebSearch, custo zero). Atende o feedback
// da Illa: descrever o negócio do alvo, não só o sinal sucessório.
//
// SEGURO PRO DEMO: só ADICIONA o campo perfil_negocio às entradas que já estão no cache —
// não toca sinais, score_v0, score_v1, delta nem gatilho. Idempotente (pula quem já tem).
// Pega os dados da empresa no demo-cache.json (mesma fonte do cache-research-sub.mjs).
//   node scripts/cache-perfil-negocio-sub.mjs
import { query } from "@anthropic-ai/claude-agent-sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEMO = path.resolve(__dirname, "../src/lib/demo-cache.json");
const CACHE = path.resolve(__dirname, "../src/lib/research-cache.json");

const demo = JSON.parse(fs.readFileSync(DEMO, "utf8"));
const cache = JSON.parse(fs.readFileSync(CACHE, "utf8"));

// Índice id -> empresa (a partir do demo-cache, que tem os dados completos).
const porId = {};
for (const resp of Object.values(demo)) {
  for (const e of resp.empresas ?? []) porId[e.id] = e;
}

const SYSTEM =
  "Você é um analista que perfila empresas para originação de M&A. Pesquisa SOMENTE fontes " +
  "públicas (site oficial, LinkedIn, imprensa, catálogos setoriais). NUNCA inventa fatos nem " +
  "estima faturamento/EBITDA. Se não achar informação além do CNAE genérico, diz que não há.";

async function perfilar(e) {
  const prompt = `Pesquise esta empresa na web e descreva o NEGÓCIO dela.

Empresa: ${e.razao_social}${e.nome_fantasia ? ` (${e.nome_fantasia})` : ""}
Setor (CNAE): ${e.cnae_principal_desc ?? e.cnae_principal}
Cidade: ${e.municipio} / ${e.uf}

Escreva 2-3 frases (PT-BR) sobre: o que a empresa faz na prática (produtos/serviços principais),
o modelo de negócio (como ganha dinheiro) e o tipo de cliente (B2B/B2C, setores atendidos,
clientes conhecidos se forem públicos). Baseie-se SÓ no que encontrar; NÃO invente nem estime
faturamento. Se não achar nada além do CNAE genérico, responda exatamente {"perfil_negocio": null}.

Responda APENAS com JSON (sem markdown): {"perfil_negocio": "..."} ou {"perfil_negocio": null}.
EFICIÊNCIA: no máximo 3 buscas na web, depois conclua.`;

  let raw = null;
  for await (const m of query({
    prompt,
    options: {
      systemPrompt: SYSTEM,
      allowedTools: ["WebSearch", "WebFetch"],
      maxTurns: 14,
      env: { ...process.env, ANTHROPIC_API_KEY: undefined }, // força assinatura
    },
  })) {
    if (m.type === "result" && m.subtype === "success") raw = m.result;
  }
  if (!raw) throw new Error("sem resultado");
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("sem JSON: " + raw.slice(0, 120));
  const parsed = JSON.parse(match[0]);
  const v = parsed.perfil_negocio;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

const ids = Object.keys(cache);
console.log(`${ids.length} empresa(s) no research-cache. Gerando perfil_negocio…\n`);

let feitos = 0;
for (let i = 0; i < ids.length; i++) {
  const id = ids[i];
  if (cache[id].perfil_negocio !== undefined) {
    console.log(`[${i + 1}/${ids.length}] ${id.slice(0, 8)} — já tem perfil, pulando.`);
    continue;
  }
  const e = porId[id];
  if (!e) {
    console.log(`[${i + 1}/${ids.length}] ${id.slice(0, 8)} — não achei no demo-cache, pulando.`);
    continue;
  }
  process.stdout.write(`[${i + 1}/${ids.length}] ${e.razao_social.slice(0, 38)} … `);
  const t0 = Date.now();
  try {
    const perfil = await perfilar(e);
    cache[id].perfil_negocio = perfil;
    fs.writeFileSync(CACHE, JSON.stringify(cache, null, 2) + "\n");
    feitos++;
    console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s · ${perfil ? "ok" : "sem base (null)"}`);
  } catch (err) {
    console.log(`FALHOU (${err.message})`);
  }
}
console.log(`\n✓ ${feitos} perfil(is) gravado(s) no research-cache.json (scores intactos).`);
