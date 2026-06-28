// Valida o research HIBRIDO end-to-end: roda o mesmo research COM e SEM o contexto do site
// (coletado pelo Scrapling em site-cache.json) e imprime o A/B. Via assinatura (custo zero).
//   node scripts/valida-research-hibrido.mjs
import { query } from "@anthropic-ai/claude-agent-sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(fs.readFileSync(path.resolve(__dirname, p), "utf8").replace(/^﻿/, ""));
const demo = read("../src/lib/demo-cache.json");
const site = read("../src/lib/site-cache.json");

// Prensa Jundiai e Alpina: ambas com site coletado por email (alta confianca).
const IDS = ["6849dfd9-a629-4b41-b0c5-447dea74f9ec", "d20b27e5-ebb9-4c4c-a111-f4495de4b3a3"];

function achar(id) {
  for (const resp of Object.values(demo))
    for (const e of resp.empresas ?? resp.resultados ?? []) if (e.id === id) return e;
  return null;
}

const SYSTEM =
  "Você é um analista de origination de M&A investigando uma empresa familiar brasileira para avaliar " +
  "risco sucessório. Você pesquisa SOMENTE fontes públicas. NUNCA inventa fatos. Toda afirmação precisa de fonte.";
const TIPOS = "mencao_sucessao_venda, banco_investimento, herdeiro_fora_carreira, csuite_externo, big4_auditoria, sem_presenca_digital, sucessor_familiar_ativo";

async function investigar(e, contextoSite) {
  const socios = (e.socio ?? []).map((s) => s.nome).join(", ");
  const ctx = contextoSite
    ? `\nCONTEXTO JÁ COLETADO DO SITE OFICIAL (use como base do perfil_negocio e para guiar as buscas — ` +
      `NÃO re-busque o site, foque nos sinais de sucessão/venda):\n"""\n${contextoSite.slice(0, 12000)}\n"""\n`
    : "";
  const prompt = `Investigue esta empresa na web e procure sinais de risco/propensão sucessória.

Empresa: ${e.razao_social}${e.nome_fantasia ? ` (${e.nome_fantasia})` : ""}
Setor: ${e.cnae_principal_desc ?? e.cnae_principal}
Cidade: ${e.municipio} / ${e.uf}
Fundada em: ${e.data_inicio_atividade?.slice(0, 4) ?? "?"}
Sócios: ${socios || "não informado"}
${ctx}
Procure evidência pública (só reporte o que achar, com fonte). Tipos válidos de "tipo": ${TIPOS}.
- "perfil_negocio": 2-3 frases (o que faz, modelo, cliente). Só com o que achar; não invente faturamento.
- "gatilho": 1 frase do motivo mais acionável pra abordar agora (ou null).

Responda APENAS este JSON (sem markdown):
{"presenca_digital":"baixa","perfil_negocio":"...","sinais":[{"tipo":"<id>","descricao":"...","fonte_url":"https://..."}],"gatilho":"... ou null"}
EFICIÊNCIA: ${contextoSite ? "site já dado, máx 3 buscas (foque sucessão)" : "máx 4 buscas"}, depois conclua.`;

  let raw = null;
  let buscas = 0;
  for await (const m of query({
    prompt,
    options: { systemPrompt: SYSTEM, allowedTools: ["WebSearch", "WebFetch"], maxTurns: 18, env: { ...process.env, ANTHROPIC_API_KEY: undefined } },
  })) {
    if (m.type === "assistant")
      for (const b of m.message?.content ?? []) if (b.type === "tool_use" && /search|fetch/i.test(b.name ?? "")) buscas++;
    if (m.type === "result" && m.subtype === "success") raw = m.result;
  }
  if (!raw) throw new Error("sem resultado");
  const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)[0]);
  return { perfil: parsed.perfil_negocio, sinais: parsed.sinais ?? [], gatilho: parsed.gatilho, presenca: parsed.presenca_digital, buscas };
}

for (const id of IDS) {
  const e = achar(id);
  const ctx = site[id]?.texto;
  console.log("\n" + "#".repeat(74) + `\n# ${e.razao_social}  (site: ${site[id]?.url ?? "—"} [${site[id]?.confianca ?? "—"}])`);
  for (const [rotulo, contexto] of [["SEM contexto (só web_search)", null], ["COM contexto do site", ctx]]) {
    process.stdout.write(`\n>>> ${rotulo} … `);
    const t0 = Date.now();
    try {
      const r = await investigar(e, contexto);
      console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s · ~${r.buscas} buscas · ${r.sinais.length} sinais · presença:${r.presenca}`);
      console.log("  PERFIL:", r.perfil);
      if (r.gatilho) console.log("  GATILHO:", r.gatilho);
    } catch (err) {
      console.log("FALHOU:", err.message);
    }
  }
}
