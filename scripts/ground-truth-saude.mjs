// Fase A da validação retroativa: garimpa aquisições de clínicas/labs/hospitais
// FAMILIARES regionais em SP (testam a tese de sucessão), via Agent SDK (assinatura).
// Roda: node scripts/ground-truth-saude.mjs
//
// Saída: scripts/ground-truth-saude.json — lista de deals pra depois localizar no BigQuery.
import { query } from "@anthropic-ai/claude-agent-sdk";
import fs from "fs";

const prompt = `Preciso montar um dataset de aquisições reais (M&A) no setor de saúde brasileiro para
validar um modelo de risco sucessório. Busque na web aquisições onde um CONSOLIDADOR comprou uma
clínica médica, laboratório de análises clínicas, centro de diagnóstico por imagem, ou hospital de
pequeno/médio porte que ERA uma EMPRESA FAMILIAR/REGIONAL (fundada e controlada por médico(s) ou
família, não por outro grande grupo ou fundo).

Consolidadores típicos: Oncoclínicas, Kora Saúde, Alliar, Rede D'Or, Hapvida, Dasa, Fleury,
Grupo Sabin, Hermes Pardini, Amil, Care Plus, Athena Saúde, Opy Health.

Foco: alvos em São Paulo (capital ou interior), período 2024-2025 (PRIORIDADE — preciso de deals
recentes). Quero empresas familiares (fundador envelhecendo, sucessão) — NÃO fusões entre gigantes
(ex: Dasa-Amil não serve). Preciso de QUANTIDADE: busque exaustivamente, quero 15-20 deals se possível.

Para cada aquisição que encontrar, reúna o máximo de: nome da empresa adquirida, adquirente, ano,
cidade/UF, e se possível indícios de ser familiar (nome do fundador, "fundada em", médico-fundador).

Faça várias buscas. Ao final, responda APENAS com JSON:
{
  "deals": [
    {"adquirida": "...", "adquirente": "...", "ano": 2023, "cidade": "...", "uf": "SP",
     "familiar_indicios": "ex: fundada em 1985 pelo Dr. X", "fonte_url": "https://..."}
  ]
}
Só inclua deals com fonte real. Se não tiver certeza que era familiar, inclua mesmo assim mas
anote no campo familiar_indicios "não confirmado".`;

console.log("Garimpando aquisições de saúde via Agent SDK (assinatura)…\n");
const start = Date.now();

let raw = null;
for await (const m of query({
  prompt,
  options: {
    systemPrompt:
      "Você é um analista de M&A montando um dataset de transações reais. Pesquisa SÓ fontes " +
      "públicas (imprensa, CADE, releases). NUNCA inventa deals — só reporta o que achar com fonte real.",
    allowedTools: ["WebSearch", "WebFetch"],
    maxTurns: 24,
    env: { ...process.env, ANTHROPIC_API_KEY: undefined },
  },
})) {
  if (m.type === "result" && m.subtype === "success") raw = m.result;
}

console.log(`Latência: ${((Date.now() - start) / 1000).toFixed(0)}s\n`);

const match = raw?.match(/\{[\s\S]*\}/);
if (!match) {
  console.log("Sem JSON. Resposta crua:\n", raw?.slice(0, 1000));
  process.exit(1);
}
const parsed = JSON.parse(match[0]);
fs.writeFileSync("scripts/ground-truth-saude-recente.json", JSON.stringify(parsed, null, 2));

console.log(`✓ ${parsed.deals?.length ?? 0} deals encontrados:\n`);
for (const d of parsed.deals ?? []) {
  console.log(`  ${d.ano} · ${d.adquirida} (${d.cidade}/${d.uf}) <- ${d.adquirente}`);
  console.log(`        ${d.familiar_indicios ?? ""}`);
}
console.log(`\nSalvo em scripts/ground-truth-saude.json`);
