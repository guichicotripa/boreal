// Testa o research-agent via Agent SDK (ASSINATURA — custo zero) num caso real.
// Roda: node scripts/check-research.mjs
import { query } from "@anthropic-ai/claude-agent-sdk";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8").split("\n").reduce((a, l) => {
  const i = l.indexOf("="); if (i > 0) a[l.slice(0, i).trim()] = l.slice(i + 1).trim(); return a;
}, {});
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data } = await sb
  .from("empresa")
  .select("razao_social,nome_fantasia,cnae_principal_desc,municipio,uf,data_inicio_atividade,porte,socio(nome,faixa_etaria)")
  .eq("porte", "DEMAIS")
  .limit(5);

const empresa = data[2];
const socios = (empresa.socio ?? []).map((s) => s.nome).join(", ");

const prompt = `Investigue esta empresa na web e procure sinais de risco/propensão sucessória.

Empresa: ${empresa.razao_social}
Setor: ${empresa.cnae_principal_desc}
Cidade: ${empresa.municipio} / ${empresa.uf}
Fundada em: ${empresa.data_inicio_atividade?.slice(0,4)}
Sócios: ${socios}

Tipos de sinal (use o identificador EXATO no campo "tipo"): mencao_sucessao_venda, banco_investimento, herdeiro_fora_carreira, csuite_externo, big4_auditoria, sucessor_familiar_ativo, sem_presenca_digital.

Responda APENAS com JSON: {"presenca_digital":"alta|media|baixa|nenhuma","resumo":"...","sinais":[{"tipo":"<identificador exato>","descricao":"...","fonte_url":"https://..."}]}`;

console.log(`Investigando: ${empresa.razao_social} (${empresa.municipio})\nvia Agent SDK (assinatura, custo zero)\n`);
const start = Date.now();

let raw = null;
for await (const m of query({
  prompt,
  options: {
    systemPrompt: "Analista de M&A. Pesquisa SÓ fontes públicas. NUNCA inventa. Toda afirmação com URL real. Campo 'tipo' = identificador snake_case exato da lista.",
    allowedTools: ["WebSearch", "WebFetch"],
    maxTurns: 10,
    env: { ...process.env, ANTHROPIC_API_KEY: undefined },
  },
})) {
  if (m.type === "result" && m.subtype === "success") raw = m.result;
}

console.log(`Latência: ${((Date.now()-start)/1000).toFixed(1)}s`);
console.log(`\n--- RESPOSTA ---\n${raw}`);
