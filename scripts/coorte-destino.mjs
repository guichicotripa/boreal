// TESTE DA TESE — das empresas QUENTES em 2023, o que aconteceu até 2025? Decide se "congelado por
// falta de originação" se sustenta. Destinos mutuamente exclusivos (prioridade nessa ordem):
//   vendida (PJ entrou + PF saiu) > baixada/inativa (situacao != ativa) > sucessao_familiar (PF
//   entrou, sem PJ) > socio_saiu (PF saiu, sem PJ) > inalterada (ativa, mesma estrutura).
//   node --env-file=.env.local scripts/coorte-destino.mjs
import { BigQuery } from "@google-cloud/bigquery";
import { writeFileSync } from "fs";
import path from "path";

const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: path.resolve(process.env.GCP_KEY_PATH),
});
const T0 = "2023-06-10";
const T2 = "2025-11-09";

const sql = `
WITH soc0 AS (
  SELECT cnpj_basico, MAX(SAFE_CAST(faixa_etaria AS INT64)) AS mf, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf
  FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${T0}' GROUP BY 1
),
-- coorte quente em 2023
coorte AS (
  SELECT e.cnpj_basico,
    CASE WHEN e.cnae_fiscal_principal LIKE '86%' THEN 'saude' ELSE 'metalmec' END AS vertical,
    s.pj AS pj0, s.pf AS pf0
  FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e
  JOIN soc0 s ON s.cnpj_basico=e.cnpj_basico
  WHERE e.data='${T0}' AND e.sigla_uf='SP' AND e.identificador_matriz_filial='1'
    AND e.situacao_cadastral='2'  -- ATIVA em 2023 (senão "baixada em 2025" pode ser de antes da janela)
    AND (e.cnae_fiscal_principal LIKE '24%' OR e.cnae_fiscal_principal LIKE '25%'
         OR e.cnae_fiscal_principal LIKE '28%' OR e.cnae_fiscal_principal LIKE '86%')
    AND s.pj=0 AND s.pf>=1 AND s.mf>=7 AND (2023 - EXTRACT(YEAR FROM e.data_inicio_atividade)) >= 25
),
-- estado em 2025
est2 AS (
  SELECT cnpj_basico, situacao_cadastral AS sit
  FROM \`basedosdados.br_me_cnpj.estabelecimentos\` WHERE data='${T2}' AND identificador_matriz_filial='1'
),
soc2 AS (
  SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf
  FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${T2}' GROUP BY 1
),
classif AS (
  SELECT c.vertical,
    CASE
      WHEN s2.pj > c.pj0 AND s2.pf < c.pf0 THEN 'vendida'
      WHEN e2.sit IS NULL OR UPPER(CAST(e2.sit AS STRING)) NOT IN ('02','2','ATIVA') THEN 'baixada_inativa'
      WHEN s2.pf > c.pf0 THEN 'sucessao_familiar'
      WHEN s2.pf < c.pf0 OR s2.pj > c.pj0 THEN 'socio_saiu_ou_pj'
      ELSE 'inalterada'
    END AS destino
  FROM coorte c
  LEFT JOIN est2 e2 ON e2.cnpj_basico=c.cnpj_basico
  LEFT JOIN soc2 s2 ON s2.cnpj_basico=c.cnpj_basico
)
SELECT vertical, destino, COUNT(*) AS n
FROM classif GROUP BY vertical, destino ORDER BY vertical, n DESC`;

const [rows] = await bq.query({ query: sql, location: "US" });

const verticais = {};
for (const r of rows) {
  verticais[r.vertical] = verticais[r.vertical] || { total: 0, destinos: {} };
  verticais[r.vertical].destinos[r.destino] = Number(r.n);
  verticais[r.vertical].total += Number(r.n);
}

const ORDEM = ["vendida", "baixada_inativa", "sucessao_familiar", "socio_saiu_ou_pj", "inalterada"];
const ROTULO = {
  vendida: "Vendida (aquisição)",
  baixada_inativa: "Baixada / inativa",
  sucessao_familiar: "Sucessão familiar (PF entrou)",
  socio_saiu_ou_pj: "Sócio saiu / mudança",
  inalterada: "Inalterada (mesmo dono)",
};

for (const [v, d] of Object.entries(verticais)) {
  console.log(`\n[${v.toUpperCase()}] coorte quente 2023 = ${d.total}`);
  for (const k of ORDEM) {
    const n = d.destinos[k] || 0;
    console.log(`  ${ROTULO[k].padEnd(32)} ${String(n).padStart(6)}  ${((n / d.total) * 100).toFixed(1)}%`);
  }
}

const out = path.resolve("src/lib/coorte-destino.json");
writeFileSync(out, JSON.stringify({ gerado_em: new Date().toISOString().slice(0, 10), janela: { de: T0, ate: T2 }, verticais }, null, 2) + "\n", "utf8");
console.log(`\n✓ ${out}`);
