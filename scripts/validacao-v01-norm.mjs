// Re-valida os pesos v0.1 NORMALIZADOS (0-100, pra manter a escala da UI) contra o benchmark.
// Se mantiver ~26% top decil, são esses os pesos a portar pro scoring.ts.
// idade(max 30) + antiguidade(max 30) + porte(max 30) + quadro plural(+10). Sem estabilidade.
// Roda: node --env-file=.env.local scripts/validacao-v01-norm.mjs
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
  SELECT cnpj_basico, MAX(SAFE_CAST(faixa_etaria AS INT64)) AS mf, COUNTIF(tipo='2') AS n_pf
  FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${CORTE}' GROUP BY 1
),
universo AS (
  SELECT e.cnpj_basico,
    (CASE sc.mf WHEN 9 THEN 30 WHEN 8 THEN 26 WHEN 7 THEN 20 WHEN 6 THEN 10 ELSE 0 END)        -- idade (30)
    + (CASE WHEN 2023-EXTRACT(YEAR FROM e.data_inicio_atividade) >= 40 THEN 30
            WHEN 2023-EXTRACT(YEAR FROM e.data_inicio_atividade) >= 25 THEN 22
            WHEN 2023-EXTRACT(YEAR FROM e.data_inicio_atividade) >= 15 THEN 10 ELSE 0 END)      -- antiguidade (30)
    + (CASE WHEN REGEXP_REPLACE(emp.porte,'^0','')='5' THEN 30
            WHEN REGEXP_REPLACE(emp.porte,'^0','')='3' THEN 15
            WHEN REGEXP_REPLACE(emp.porte,'^0','')='1' THEN 5 ELSE 0 END)                       -- porte (30)
    + (CASE WHEN sc.n_pf >= 2 THEN 10 ELSE 0 END)                                              -- quadro plural (+10)
    AS score
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
adq AS (SELECT a.cnpj_basico FROM a JOIN b USING(cnpj_basico) WHERE b.pj>a.pj AND b.pf<a.pf)
SELECT COUNT(*) n,
  ROUND(COUNTIF(decil=1)/COUNT(*)*100,0) top10,
  ROUND(COUNTIF(decil<=3)/COUNT(*)*100,0) top30,
  ROUND(AVG(decil),2) decil_medio
FROM adq JOIN ranked USING(cnpj_basico)`;

const [[r]] = await bq.query({ query: sql, location: "US" });
console.log(`Score v0.1 NORMALIZADO (0-100) — N=${r.n} aquisições\n`);
console.log(`  TOP 10%:      ${r.top10}%   (v0.1 não-norm: 26% · v0: 17% · aleatório: 10%)`);
console.log(`  TOP 30%:      ${r.top30}%   (v0.1: 65% · v0: 45%)`);
console.log(`  decil médio:  ${r.decil_medio}   (v0.1: 2.94 · v0: 4.39 · aleatório: 5.5)`);
console.log(r.top10 >= 24 ? "\n✓ Mantém o ganho — pesos OK pra portar." : "\n⚠ Caiu — revisar normalização.");
