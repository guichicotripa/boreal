// MONITOR DE TRANSIÇÕES — o sensor forward do loop (o que mais nos diferencia do Grata).
// Para os CNPJs do pipeline, compara o quadro societário entre dois snapshots da Receita e detecta
// MUDANÇA: sócio PJ entrou (aquisição), PF saiu (saída/falecimento), PF entrou (possível sucessão).
// Mesmo padrão do demo-cache: o trabalho pesado (BigQuery) roda aqui → escreve src/lib/monitor.json →
// a UI lê instantâneo. Em produção é um worker periódico; aqui é um script que se roda.
//   node --env-file=.env.local scripts/monitor-transicoes.mjs
import { BigQuery } from "@google-cloud/bigquery";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import path from "path";

const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: path.resolve(process.env.GCP_KEY_PATH),
});
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const T0 = "2023-06-10";
const T2 = "2025-11-09";

// 1. CNPJs do pipeline (oportunidade → empresa).
const { data: ops, error } = await sb.from("oportunidade").select("empresa:empresa_id(cnpj)");
if (error) { console.error(error.message); process.exit(1); }
const cnpjs = [...new Set((ops ?? []).map((o) => o.empresa?.cnpj).filter(Boolean))];
const basicos = [...new Set(cnpjs.map((c) => c.slice(0, 8)))];
console.log(`Pipeline: ${cnpjs.length} empresas (${basicos.length} CNPJs básicos)`);
if (basicos.length === 0) {
  writeFileSync(path.resolve("src/lib/monitor.json"), JSON.stringify({ gerado_em: new Date().toISOString().slice(0, 10), janela: { de: T0, ate: T2 }, mudancas: {} }, null, 2) + "\n");
  console.log("Pipeline vazio — monitor.json zerado."); process.exit(0);
}

// 2. Compara quadro societário T0 × T2 pros CNPJs do pipeline.
const lista = basicos.map((b) => `'${b}'`).join(",");
const sql = `
WITH a AS (
  SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf
  FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${T0}' AND cnpj_basico IN (${lista}) GROUP BY 1
),
b AS (
  SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf
  FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${T2}' AND cnpj_basico IN (${lista}) GROUP BY 1
)
SELECT a.cnpj_basico, a.pj a_pj, a.pf a_pf, COALESCE(b.pj,0) b_pj, COALESCE(b.pf,0) b_pf
FROM a LEFT JOIN b USING (cnpj_basico)`;
const [rows] = await bq.query({ query: sql, location: "US" });

// 3. Classifica a mudança (prioridade: aquisição > PJ entrou > PF saiu > PF entrou).
function classifica(r) {
  const dpj = r.b_pj - r.a_pj, dpf = r.b_pf - r.a_pf;
  if (dpj > 0 && dpf < 0) return { tipo: "aquisicao", severidade: "alta", descricao: "Sócio PJ entrou e PF saiu — assinatura de aquisição." };
  if (dpj > 0) return { tipo: "pj_entrou", severidade: "alta", descricao: "Sócio PJ entrou — possível aquisição ou reorganização." };
  if (dpf < 0) return { tipo: "pf_saiu", severidade: "media", descricao: "Sócio PF saiu — saída/falecimento; janela de sucessão pode ter aberto." };
  if (dpf > 0) return { tipo: "pf_entrou", severidade: "media", descricao: "Sócio PF entrou — possível sucessão (herdeiro) ou novo sócio." };
  return null;
}

const mudancas = {};
for (const r of rows) {
  const c = classifica(r);
  if (c) mudancas[r.cnpj_basico] = c;
}

const artefato = {
  gerado_em: new Date().toISOString().slice(0, 10),
  janela: { de: T0, ate: T2 },
  nota: "Mudança no quadro societário (CNPJ) entre os dois snapshots, pros CNPJs do pipeline.",
  mudancas,
};
writeFileSync(path.resolve("src/lib/monitor.json"), JSON.stringify(artefato, null, 2) + "\n", "utf8");
console.log(`\n✓ src/lib/monitor.json — ${Object.keys(mudancas).length} mudança(s) detectada(s) de ${rows.length} checadas:`);
for (const [cnpj, m] of Object.entries(mudancas)) console.log(`  [${m.severidade}] ${cnpj} · ${m.tipo} — ${m.descricao}`);
