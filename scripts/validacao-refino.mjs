// Refino do ground truth: testa 3 definições de "aquisição" e mede qual o score v0 prediz melhor.
// Hipótese: filtrar reorganização patrimonial (holding da própria família) limpa o sinal.
// Roda: node --env-file=.env.local scripts/validacao-refino.mjs
import { BigQuery } from "@google-cloud/bigquery";
import path from "path";

const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: path.resolve(process.env.GCP_KEY_PATH),
});

const CORTE = "2023-06-10";
const NOVO = "2025-11-09";

const sql = `
WITH sc AS (
  SELECT cnpj_basico, MAX(SAFE_CAST(faixa_etaria AS INT64)) AS mf, MAX(data_entrada_sociedade) AS ult
  FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${CORTE}' GROUP BY 1
),
universo AS (
  SELECT e.cnpj_basico,
    (CASE sc.mf WHEN 9 THEN 40 WHEN 8 THEN 35 WHEN 7 THEN 25 WHEN 6 THEN 12 ELSE 0 END)
    + (CASE WHEN 2023 - EXTRACT(YEAR FROM e.data_inicio_atividade) >= 40 THEN 30
            WHEN 2023 - EXTRACT(YEAR FROM e.data_inicio_atividade) >= 25 THEN 22
            WHEN 2023 - EXTRACT(YEAR FROM e.data_inicio_atividade) >= 15 THEN 12 ELSE 0 END)
    + (CASE WHEN sc.ult IS NULL THEN 10
            WHEN DATE_DIFF(DATE('${CORTE}'), sc.ult, YEAR) > 10 THEN 20
            WHEN DATE_DIFF(DATE('${CORTE}'), sc.ult, YEAR) >= 5 THEN 12
            WHEN DATE_DIFF(DATE('${CORTE}'), sc.ult, YEAR) >= 2 THEN 5 ELSE 0 END)
    + (CASE WHEN REGEXP_REPLACE(emp.porte,'^0','')='5' THEN 10
            WHEN REGEXP_REPLACE(emp.porte,'^0','')='3' THEN 6
            WHEN REGEXP_REPLACE(emp.porte,'^0','')='1' THEN 2 ELSE 0 END) AS score
  FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e
  JOIN \`basedosdados.br_me_cnpj.empresas\` emp ON emp.cnpj_basico=e.cnpj_basico AND emp.data='${CORTE}'
  LEFT JOIN sc ON sc.cnpj_basico=e.cnpj_basico
  WHERE e.data='${CORTE}' AND e.sigla_uf='SP' AND e.identificador_matriz_filial='1'
    AND (e.cnae_fiscal_principal LIKE '86%' OR e.cnae_fiscal_principal LIKE '24%'
         OR e.cnae_fiscal_principal LIKE '25%' OR e.cnae_fiscal_principal LIKE '28%')
),
ranked AS (SELECT cnpj_basico, NTILE(10) OVER (ORDER BY score DESC) AS decil FROM universo),
a AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${CORTE}' GROUP BY 1),
b AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${NOVO}' GROUP BY 1),
ev AS (
  SELECT a.cnpj_basico,
    (b.pj>a.pj AND b.pf<a.pf) AS classica,
    (a.pj=0 AND b.pj>=1 AND b.pf<a.pf) AS primeira_pj,
    (a.pf>0 AND b.pf=0 AND b.pj>=1) AS controle_total
  FROM a JOIN b USING(cnpj_basico)
)
SELECT defn,
  COUNT(*) AS n,
  ROUND(COUNTIF(decil=1)/COUNT(*)*100,0) AS top10,
  ROUND(COUNTIF(decil<=3)/COUNT(*)*100,0) AS top30,
  ROUND(AVG(decil),2) AS decil_medio
FROM (
  SELECT 'classica' AS defn, r.decil FROM ev e JOIN ranked r USING(cnpj_basico) WHERE e.classica
  UNION ALL SELECT 'primeira_pj', r.decil FROM ev e JOIN ranked r USING(cnpj_basico) WHERE e.primeira_pj
  UNION ALL SELECT 'controle_total', r.decil FROM ev e JOIN ranked r USING(cnpj_basico) WHERE e.controle_total
)
GROUP BY defn ORDER BY top10 DESC`;

console.log(`Refino do ground truth — qual definição de aquisição o score v0 prediz melhor?\n`);
console.log(`(aleatório: top10=10%, top30=30%, decil_medio=5.5)\n`);
const [rows] = await bq.query({ query: sql, location: "US" });
for (const r of rows) {
  console.log(`  ${r.defn.padEnd(16)} N=${String(r.n).padStart(4)} · top10=${r.top10}% · top30=${r.top30}% · decil médio ${r.decil_medio}`);
}
