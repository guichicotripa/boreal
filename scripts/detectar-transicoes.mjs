// A MINA: detecta eventos societários comparando dois snapshots do CNPJ (QSA).
// "Entrou sócio PJ" = aquisição provável. "Saiu PF" = saída de fundador/sucessão.
// Ground truth de M&A/sucessão gerado pela própria base — em escala, proprietário.
// tipo='1' PJ · tipo='2' PF. Roda: node --env-file=.env.local scripts/detectar-transicoes.mjs
import { BigQuery } from "@google-cloud/bigquery";
import path from "path";

const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: path.resolve(process.env.GCP_KEY_PATH),
});

const ANTIGO = "2023-06-10";
const NOVO = "2025-11-09";

const sql = `
WITH alvos AS (
  SELECT DISTINCT cnpj_basico
  FROM \`basedosdados.br_me_cnpj.estabelecimentos\`
  WHERE data = '${NOVO}' AND sigla_uf = 'SP' AND identificador_matriz_filial = '1'
    AND (cnae_fiscal_principal LIKE '86%' OR cnae_fiscal_principal LIKE '24%'
         OR cnae_fiscal_principal LIKE '25%' OR cnae_fiscal_principal LIKE '28%')
),
a AS (
  SELECT cnpj_basico, COUNTIF(tipo='1') AS pj, COUNTIF(tipo='2') AS pf
  FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${ANTIGO}' GROUP BY 1
),
b AS (
  SELECT cnpj_basico, COUNTIF(tipo='1') AS pj, COUNTIF(tipo='2') AS pf
  FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${NOVO}' GROUP BY 1
)
SELECT
  COUNT(*) AS empresas_comparadas,
  COUNTIF(b.pj > a.pj) AS entrou_pj,
  COUNTIF(b.pj > a.pj AND b.pf < a.pf) AS aquisicao_classica,
  COUNTIF(b.pf < a.pf AND a.pf > 0) AS saiu_pf,
  COUNTIF(b.pf > a.pf) AS entrou_pf
FROM alvos
JOIN a USING (cnpj_basico)
JOIN b USING (cnpj_basico)`;

console.log(`Transições societárias: ${ANTIGO} → ${NOVO}`);
console.log(`Universo: saúde (86) + metalmecânica (24/25/28), SP, matriz\n`);

const [[r]] = await bq.query({ query: sql, location: "US" });
const n = Number(r.empresas_comparadas);
const pct = (x) => `${((Number(x) / n) * 100).toFixed(1)}%`;

console.log(`Empresas comparadas (nos dois snapshots): ${n}`);
console.log(`\n  Entrou sócio PJ (aquisição provável):      ${r.entrou_pj}  (${pct(r.entrou_pj)})`);
console.log(`  PJ entrou + PF saiu (aquisição clássica):  ${r.aquisicao_classica}  (${pct(r.aquisicao_classica)})`);
console.log(`  Saiu sócio PF (fundador deixou):           ${r.saiu_pf}  (${pct(r.saiu_pf)})`);
console.log(`  Entrou sócio PF (sucessão? filho entrou):  ${r.entrou_pf}  (${pct(r.entrou_pf)})`);
console.log(`\n→ Cada 'aquisição clássica' é um outcome rotulado, de graça, sem boutique.`);
