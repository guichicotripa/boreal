// Testa o research-agent via Anthropic API + web search tool (server-side) num caso real.
// Espelha a lógica de src/lib/research.ts. Roda: node scripts/check-research.mjs
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8").split("\n").reduce((a, l) => {
  const i = l.indexOf("="); if (i > 0) a[l.slice(0, i).trim()] = l.slice(i + 1).trim(); return a;
}, {});
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

// Pesos idênticos ao research.ts (determinístico no código, LLM não inventa score).
const PESOS = {
  mencao_sucessao_venda: +12, banco_investimento: +15, herdeiro_fora_carreira: +8,
  csuite_externo: +6, big4_auditoria: +5, sem_presenca_digital: +3, sucessor_familiar_ativo: -25,
};

// Tenta o caso conhecido (PRENSA JUNDIAI 100→75); se não achar, pega uma empresa porte DEMAIS.
let { data } = await sb
  .from("empresa")
  .select("razao_social,nome_fantasia,cnae_principal_desc,municipio,uf,data_inicio_atividade,porte,socio(nome,faixa_etaria)")
  .ilike("razao_social", "%PRENSA%").limit(1);
if (!data?.length) {
  ({ data } = await sb
    .from("empresa")
    .select("razao_social,nome_fantasia,cnae_principal_desc,municipio,uf,data_inicio_atividade,porte,socio(nome,faixa_etaria)")
    .eq("porte", "DEMAIS").limit(5));
  data = [data[2]];
}
const empresa = data[0];
const socios = (empresa.socio ?? []).map((s) => s.nome).join(", ");

const prompt = `Investigue esta empresa na web e procure sinais de risco/propensão sucessória.

Empresa: ${empresa.razao_social}${empresa.nome_fantasia ? ` (${empresa.nome_fantasia})` : ""}
Setor: ${empresa.cnae_principal_desc}
Cidade: ${empresa.municipio} / ${empresa.uf}
Fundada em: ${empresa.data_inicio_atividade?.slice(0,4)}
Sócios: ${socios}

Tipos de sinal (use o identificador EXATO no campo "tipo"): mencao_sucessao_venda, banco_investimento, herdeiro_fora_carreira, csuite_externo, big4_auditoria, sucessor_familiar_ativo, sem_presenca_digital.

EFICIÊNCIA: no máximo 4 buscas, depois conclua. Responda APENAS com JSON:
{"presenca_digital":"alta|media|baixa|nenhuma","resumo":"...","sinais":[{"tipo":"<identificador exato>","descricao":"...","fonte_url":"https://..."}]}`;

console.log(`Investigando: ${empresa.razao_social} (${empresa.municipio})\nvia Anthropic API + web search tool\n`);
const start = Date.now();

const message = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 4096,
  system: "Analista de M&A. Pesquisa SÓ fontes públicas. NUNCA inventa. Toda afirmação com URL real. Campo 'tipo' = identificador snake_case exato da lista.",
  messages: [{ role: "user", content: prompt }],
  tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }],
});

const raw = message.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
console.log(`Latência: ${((Date.now()-start)/1000).toFixed(1)}s`);
const searches = message.content.filter((b) => b.type === "server_tool_use").length;
console.log(`Buscas na web: ${searches} · tokens in/out: ${message.usage.input_tokens}/${message.usage.output_tokens}`);

const match = raw.match(/\{[\s\S]*\}/);
if (!match) { console.log(`\n⚠️ Sem JSON na resposta:\n${raw.slice(0, 500)}`); process.exit(1); }
const parsed = JSON.parse(match[0]);

const ajuste = (parsed.sinais ?? []).reduce((acc, s) => acc + (PESOS[s.tipo] ?? 0), 0);
console.log(`\n--- SINAIS ---`);
for (const s of parsed.sinais ?? []) {
  const p = PESOS[s.tipo];
  console.log(`  ${p > 0 ? "+" : ""}${p ?? "?"} ${s.tipo}: ${s.descricao}\n     fonte: ${s.fonte_url ?? "(sem url)"}`);
}
console.log(`\nPresença digital: ${parsed.presenca_digital}`);
console.log(`Resumo: ${parsed.resumo}`);
console.log(`Ajuste total sobre score v0: ${ajuste > 0 ? "+" : ""}${ajuste}`);
