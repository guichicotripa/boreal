// O JUIZ DE M&A: avalia um dossiê real do Boreal contra o rubric fundamentado em pesquisa.
// Critica como um sócio sênior faria — nota por dimensão + o que falta. Eval que acelera a
// iteração de qualidade SEM depender de calls humanas.
// Via ASSINATURA (Agent SDK, custo zero). Pré-req: dev server em localhost:3000 + rubric.
// O dossiê vem do /api/dossier (cache hit → instantâneo, custo zero); os dados da empresa pro
// header saem do demo-cache (o cache hit do dossiê devolve só `analise`).
// Roda: node scripts/juiz-avaliar.mjs [empresaId]
import { query } from "@anthropic-ai/claude-agent-sdk";
import fs from "fs";

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8").replace(/^﻿/, "")); // tolera BOM
const rubric = readJson("scripts/juiz-rubric.json");
const empresaId = process.argv[2] || "6849dfd9-a629-4b41-b0c5-447dea74f9ec"; // PRENSA JUNDIAI

// Dados da empresa pro header (custo zero, do demo-cache).
const demo = readJson("src/lib/demo-cache.json");
let empresa = null;
for (const resp of Object.values(demo)) {
  const e = (resp.empresas ?? []).find((x) => x.id === empresaId);
  if (e) { empresa = e; break; }
}
if (!empresa) { console.log("Empresa não está no demo-cache:", empresaId); process.exit(1); }

// Dossiê real via endpoint (cache hit → instantâneo). URL configurável (dev pode subir em 3001).
const BASE = process.env.BOREAL_URL || "http://localhost:3000";
console.log(`Buscando dossiê: ${empresa.razao_social} (${BASE})…`);
const r = await fetch(`${BASE}/api/dossier`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ empresaId }),
});
const d = await r.json();
if (!r.ok || d.error) { console.log("Erro ao obter dossiê:", d.error ?? r.status); process.exit(1); }
const analise = d.analise;

const dossie = `EMPRESA: ${empresa.razao_social} · ${empresa.municipio}/${empresa.uf} · ${empresa.cnae_principal_desc ?? empresa.cnae_principal}
OVERVIEW: ${analise.overview}
ANÁLISE DE RISCO SUCESSÓRIO: ${analise.analise_sucessoria}
PERGUNTAS DE ABORDAGEM: ${analise.perguntas_abordagem.map((p, i) => `(${i + 1}) ${p}`).join(" ")}
TESE DE APROXIMAÇÃO: ${analise.tese_aproximacao}`;

// O juiz critica contra o rubric (assinatura, sem web search).
console.log("Juiz avaliando (assinatura)…\n");
const SYSTEM =
  "Você é um sócio sênior de M&A com 20 anos de originação no middle market brasileiro. Avalia memos " +
  "de oportunidade com rigor de quem leva (ou mata) deals. Seja DURO, ESPECÍFICO e ÚTIL — aponte o que " +
  "falta e o que está amador. Nada de elogio genérico. Responde SEMPRE e APENAS com JSON válido, sem markdown.";
const prompt = `Avalie este MEMO DE OPORTUNIDADE gerado por uma plataforma de deal sourcing, usando o RUBRIC abaixo.

RUBRIC (fundamentado em pesquisa de melhores práticas):
${JSON.stringify(rubric, null, 2)}

MEMO A AVALIAR:
${dossie}

Responda APENAS com JSON:
{
  "avaliacoes": [{"dimensao": "...", "nota": 0, "critica": "específica — o que falta/está fraco"}],
  "nota_geral": 0,
  "o_que_um_profissional_faria_diferente": ["pontos concretos"],
  "veredito": "1-2 frases: esse memo é usável por um profissional? por quê?"
}`;

let raw = null;
for await (const m of query({
  prompt,
  options: { systemPrompt: SYSTEM, maxTurns: 1, env: { ...process.env, ANTHROPIC_API_KEY: undefined } },
})) {
  if (m.type === "result" && m.subtype === "success") raw = m.result;
}
const mt = raw?.match(/\{[\s\S]*\}/);
if (!mt) { console.log("Sem JSON na resposta:\n", raw?.slice(0, 400)); process.exit(1); }
const av = JSON.parse(mt[0]);

console.log(`=== JUIZ DE M&A — ${empresa.razao_social} ===\n`);
console.log(`NOTA GERAL: ${av.nota_geral}/10`);
console.log(`VEREDITO: ${av.veredito}\n`);
console.log("Por dimensão:");
for (const a of av.avaliacoes ?? []) console.log(`  ${a.nota}/10 · ${a.dimensao}\n      ${a.critica}`);
console.log("\nO que um profissional faria diferente:");
for (const p of av.o_que_um_profissional_faria_diferente ?? []) console.log(`  • ${p}`);
