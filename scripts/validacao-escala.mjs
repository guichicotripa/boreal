// Validação retroativa EM ESCALA: usa as aquisições detectadas no próprio CNPJ (PJ entrou +
// PF saiu entre 2023-06 e 2025-11) como ground truth, e mede se o score v0 em 2023-06 (pré-deal,
// sem leakage) as colocava no topo do ranking. N grande, sem boutique, sem garimpo de imprensa.
// Roda: node --env-file=.env.local scripts/validacao-escala.mjs
import { BigQuery } from "@google-cloud/bigquery";
import path from "path";

const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: path.resolve(process.env.GCP_KEY_PATH),
});

const CORTE = "2023-06-10"; // snapshot pré-deal (as aquisições aconteceram depois disso)
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
ranked AS (
  SELECT cnpj_basico, score, NTILE(10) OVER (ORDER BY score DESC) AS decil FROM universo
),
a AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${CORTE}' GROUP BY 1),
b AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${NOVO}' GROUP BY 1),
aquisicoes AS (
  SELECT a.cnpj_basico FROM a JOIN b USING(cnpj_basico) WHERE b.pj > a.pj AND b.pf < a.pf
)
SELECT
  (SELECT COUNT(*) FROM ranked) AS universo,
  COUNT(*) AS n_aquisicoes,
  COUNTIF(r.decil = 1) AS top10,
  COUNTIF(r.decil <= 2) AS top20,
  COUNTIF(r.decil <= 3) AS top30,
  ROUND(AVG(r.decil), 2) AS decil_medio
FROM aquisicoes aq JOIN ranked r USING (cnpj_basico)`;

console.log(`Validação retroativa EM ESCALA — score em ${CORTE} vs aquisições até ${NOVO}\n`);
const [[r]] = await bq.query({ query: sql, location: "US" });
const n = Number(r.n_aquisicoes);
console.log(`Universo rankeado: ${r.universo} empresas`);
console.log(`Aquisições validadas (com score no corte): ${n}\n`);
console.log(`  No TOP 10% (decil 1): ${r.top10}  (${((r.top10/n)*100).toFixed(0)}%)`);
console.log(`  No TOP 20%:           ${r.top20}  (${((r.top20/n)*100).toFixed(0)}%)`);
console.log(`  No TOP 30%:           ${r.top30}  (${((r.top30/n)*100).toFixed(0)}%)`);
console.log(`  Decil médio:          ${r.decil_medio}/10  (5.5 = aleatório)`);
console.log(`\nSe o score não tivesse sinal, esperaríamos ~10% no top decil e decil médio 5.5.`);
