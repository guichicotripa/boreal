// Constrói o RUBRIC do juiz de M&A pesquisando as melhores práticas reais na web (Agent SDK,
// assinatura, custo zero). O rubric vira a base de conhecimento do juiz que avalia os outputs do
// Boreal (dossiê, perguntas de abordagem, tese) sem depender de calls humanas.
// Evolutivo: depois é refinado com transcrições das calls reais.
// Roda: node scripts/build-juiz-rubric.mjs
import { query } from "@anthropic-ai/claude-agent-sdk";
import fs from "fs";

const prompt = `Você vai construir um RUBRIC de avaliação para julgar a qualidade dos outputs de uma
plataforma de deal sourcing / originação de M&A focada em empresas familiares brasileiras com risco
sucessório. O rubric será usado por um "juiz" (avaliador) que critica memos de oportunidade, listas
priorizadas e estratégias de abordagem a fundadores — como um sócio sênior de M&A faria.

Pesquise na web as MELHORES PRÁTICAS REAIS de profissionais de elite. Cubra:
1. Buy-side serial acquirers (Constellation Software, Danaher, Roper, HEICO): como acham, qualificam
   e priorizam targets; o que checam primeiro; o que é dealbreaker.
2. Boutiques de M&A sell-side e advisors: o que torna um "teaser"/memo de oportunidade forte; o que
   um sócio espera ver antes de levar um deal adiante.
3. Abordagem a fundador de empresa familiar sobre venda/sucessão: o que funciona, o que afasta o dono,
   timing, tom, erros fatais.
4. Sinais de risco sucessório e prontidão para venda (succession planning, family business M&A).
5. Red flags e dealbreakers na qualificação inicial de um target.

Faça várias buscas. Depois DESTILE num rubric acionável. Responda APENAS com este JSON:
{
  "dimensoes": [
    {
      "nome": "ex: Qualidade da tese de aquisição",
      "o_que_avalia": "1 frase",
      "nivel_elite": "o que um profissional de elite espera ver",
      "nivel_amador": "o sinal de output amador/fraco",
      "peso": 1-5
    }
  ],
  "red_flags": ["coisas que um profissional consideraria erro grave num output de origination"],
  "fontes": ["urls reais usadas"]
}
Seja específico e fundamentado no que achou — não genérico.`;

console.log("Pesquisando melhores práticas de M&A pra construir o rubric do juiz (assinatura)…\n");
const start = Date.now();

let raw = null;
for await (const m of query({
  prompt,
  options: {
    systemPrompt:
      "Você é um pesquisador montando um rubric de avaliação de M&A de elite. Pesquisa SÓ fontes " +
      "públicas reais e cita URLs. Destila em critérios acionáveis, não platitudes.",
    allowedTools: ["WebSearch", "WebFetch"],
    maxTurns: 24,
    env: { ...process.env, ANTHROPIC_API_KEY: undefined },
  },
})) {
  if (m.type === "result" && m.subtype === "success") raw = m.result;
}

console.log(`Latência: ${((Date.now() - start) / 1000).toFixed(0)}s\n`);
const match = raw?.match(/\{[\s\S]*\}/);
if (!match) { console.log("Sem JSON:\n", raw?.slice(0, 1500)); process.exit(1); }
const parsed = JSON.parse(match[0]);
fs.writeFileSync("scripts/juiz-rubric.json", JSON.stringify(parsed, null, 2));

console.log(`✓ Rubric salvo: ${parsed.dimensoes?.length ?? 0} dimensões, ${parsed.red_flags?.length ?? 0} red flags, ${parsed.fontes?.length ?? 0} fontes\n`);
for (const d of parsed.dimensoes ?? []) console.log(`  [peso ${d.peso}] ${d.nome}`);
