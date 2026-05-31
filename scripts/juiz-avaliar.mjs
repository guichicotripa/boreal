// O JUIZ DE M&A: avalia um output real do Boreal (dossiê) contra o rubric fundamentado em pesquisa.
// Critica como um sócio sênior faria — nota por dimensão + o que falta. É o eval que acelera a
// iteração de qualidade SEM depender de calls humanas.
// Usa Anthropic API (avaliar texto não precisa web search; rápido). Pré-req: dev server + rubric.
// Roda: node scripts/juiz-avaliar.mjs [empresaId]
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8").split("\n").reduce((a, l) => {
  const i = l.indexOf("="); if (i > 0) a[l.slice(0, i).trim()] = l.slice(i + 1).trim(); return a;
}, {});
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const rubric = JSON.parse(fs.readFileSync("scripts/juiz-rubric.json", "utf8"));
const empresaId = process.argv[2] || "6849dfd9-a629-4b41-b0c5-447dea74f9ec"; // PRENSA JUNDIAI

// 1. Gera o dossiê real via endpoint do produto.
console.log("Gerando dossiê real do Boreal…");
const r = await fetch("http://localhost:3000/api/dossier", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ empresaId }),
});
const d = await r.json();
if (d.error) { console.log("Erro ao gerar dossiê:", d.error); process.exit(1); }
const { empresa, analise } = d;

const dossie = `EMPRESA: ${empresa.razao_social} · ${empresa.municipio}/${empresa.uf} · ${empresa.cnae_principal_desc}
OVERVIEW: ${analise.overview}
ANÁLISE DE RISCO SUCESSÓRIO: ${analise.analise_sucessoria}
PERGUNTAS DE ABORDAGEM: ${analise.perguntas_abordagem.map((p, i) => `(${i + 1}) ${p}`).join(" ")}
TESE DE APROXIMAÇÃO: ${analise.tese_aproximacao}`;

// 2. O juiz critica contra o rubric.
console.log("Juiz avaliando…\n");
const prompt = `Você é um sócio sênior de M&A com 20 anos de originação no middle market. Avalie este
MEMO DE OPORTUNIDADE gerado por uma plataforma de deal sourcing, usando o RUBRIC abaixo. Seja DURO,
ESPECÍFICO e ÚTIL — aponte exatamente o que falta e o que está amador. Nada de elogio genérico.

RUBRIC (fundamentado em pesquisa de melhores práticas):
${JSON.stringify(rubric, null, 2)}

MEMO A AVALIAR:
${dossie}

Responda APENAS com JSON:
{
  "avaliacoes": [{"dimensao": "...", "nota": 0-10, "critica": "específica — o que falta/está fraco"}],
  "nota_geral": 0-10,
  "o_que_um_profissional_faria_diferente": ["pontos concretos"],
  "veredito": "1-2 frases: esse memo é usável por um profissional? por quê?"
}`;

const msg = await anthropic.messages.create({
  model: "claude-sonnet-4-6", max_tokens: 2000,
  messages: [{ role: "user", content: prompt }],
});
const texto = msg.content[0].type === "text" ? msg.content[0].text : "";
const m = texto.match(/\{[\s\S]*\}/);
const av = JSON.parse(m[0]);

console.log(`=== JUIZ DE M&A — ${empresa.razao_social} ===\n`);
console.log(`NOTA GERAL: ${av.nota_geral}/10`);
console.log(`VEREDITO: ${av.veredito}\n`);
console.log(`Por dimensão:`);
for (const a of av.avaliacoes) console.log(`  ${a.nota}/10 · ${a.dimensao}\n      ${a.critica}`);
console.log(`\nO que um profissional faria diferente:`);
for (const p of av.o_que_um_profissional_faria_diferente) console.log(`  • ${p}`);
