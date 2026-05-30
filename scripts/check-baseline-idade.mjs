// Testa a hipótese: saúde tem baseline de idade alta (médicos), então o score de idade
// discrimina menos que em metalmecânica. Roda: node --env-file=.env.local scripts/check-baseline-idade.mjs
import { BigQuery } from "@google-cloud/bigquery";
import path from "path";

const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: path.resolve(process.env.GCP_KEY_PATH),
});

function q(cnaePrefix) {
  return `
    WITH s AS (
      SELECT cnpj_basico, MAX(SAFE_CAST(faixa_etaria AS INT64)) AS mf
      FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='2025-11-09' GROUP BY 1
    )
    SELECT
      COUNT(*) AS total,
      COUNTIF(s.mf >= 7) AS idosos_61mais,
      COUNTIF(s.mf >= 8) AS idosos_71mais
    FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e
    JOIN s ON s.cnpj_basico = e.cnpj_basico
    WHERE e.data='2025-11-09' AND e.sigla_uf='SP' AND e.situacao_cadastral='2'
      AND e.identificador_matriz_filial='1' AND e.cnae_fiscal_principal LIKE '${cnaePrefix}%'`;
}

for (const [label, cnae] of [["SAÚDE (86)", "86"], ["METALMEC (24/25/28→25)", "25"]]) {
  const [[r]] = await bq.query({ query: q(cnae), location: "US" });
  const t = Number(r.total), i7 = Number(r.idosos_61mais), i8 = Number(r.idosos_71mais);
  console.log(`${label}: ${((i7/t)*100).toFixed(1)}% com sócio 61+ · ${((i8/t)*100).toFixed(1)}% com sócio 71+ · total ${t}`);
}
