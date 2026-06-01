// Primeira lista REAL de alvos: escolas básicas familiares do CE, perfil sucessório, ordenadas por
// score v0.1. Teaser tangível pro Taylor/Guilherme — nomes e municípios reconhecíveis.
// Standalone (BigQuery), não toca o app do Boreal. node --env-file=.env.local scripts/alvos-educacao-ce.mjs
import { BigQuery } from "@google-cloud/bigquery";
import path from "path";
const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID, keyFilename: path.resolve(process.env.GCP_KEY_PATH) });
const NOVO = "2025-11-09";
const FAIXA = { "6": "51-60", "7": "61-70", "8": "71-80", "9": "80+" };

const sql = `
WITH sc AS (
  SELECT cnpj_basico, MAX(SAFE_CAST(faixa_etaria AS INT64)) AS mf, COUNTIF(tipo='2') AS n_pf
  FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${NOVO}' GROUP BY 1
),
alvos AS (
  SELECT e.cnpj_basico, emp.razao_social, e.id_municipio, sc.mf,
    (2025-EXTRACT(YEAR FROM e.data_inicio_atividade)) AS idade_emp, sc.n_pf,
    (CASE sc.mf WHEN 9 THEN 30 WHEN 8 THEN 26 WHEN 7 THEN 20 WHEN 6 THEN 10 ELSE 0 END)
    + (CASE WHEN 2025-EXTRACT(YEAR FROM e.data_inicio_atividade) >= 40 THEN 30
            WHEN 2025-EXTRACT(YEAR FROM e.data_inicio_atividade) >= 25 THEN 22
            WHEN 2025-EXTRACT(YEAR FROM e.data_inicio_atividade) >= 15 THEN 10 ELSE 0 END)
    + (CASE WHEN REGEXP_REPLACE(emp.porte,'^0','')='5' THEN 30
            WHEN REGEXP_REPLACE(emp.porte,'^0','')='3' THEN 15 ELSE 0 END)
    + (CASE WHEN sc.n_pf >= 2 THEN 10 ELSE 0 END) AS score
  FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e
  JOIN \`basedosdados.br_me_cnpj.empresas\` emp ON emp.cnpj_basico=e.cnpj_basico AND emp.data='${NOVO}'
  JOIN sc ON sc.cnpj_basico=e.cnpj_basico
  WHERE e.data='${NOVO}' AND e.sigla_uf='CE' AND e.identificador_matriz_filial='1'
    AND (e.cnae_fiscal_principal LIKE '851%' OR e.cnae_fiscal_principal LIKE '852%')
    AND e.situacao_cadastral='2' AND emp.natureza_juridica LIKE '2%'
    AND sc.n_pf >= 1 AND sc.mf >= 7 AND (2025-EXTRACT(YEAR FROM e.data_inicio_atividade)) >= 25
)
SELECT a.razao_social, COALESCE(m.nome, a.id_municipio) AS municipio, a.mf, a.idade_emp, a.n_pf, a.score
FROM alvos a
LEFT JOIN \`basedosdados.br_bd_diretorios_brasil.municipio\` m ON m.id_municipio_rf = a.id_municipio
ORDER BY a.score DESC, a.idade_emp DESC LIMIT 20`;

const [rows] = await bq.query({ query: sql, location: "US" });
console.log(`Primeiros alvos — escolas básicas familiares no CE (sucessão clássica, top 20 por score)\n`);
for (const r of rows) {
  const fx = FAIXA[String(r.mf)] ?? r.mf;
  console.log(`[${r.score}] ${r.razao_social.slice(0, 44).padEnd(44)} ${String(r.municipio).slice(0,18).padEnd(18)} sócio ${fx}, ${r.idade_emp}a, ${r.n_pf} sócios`);
}
