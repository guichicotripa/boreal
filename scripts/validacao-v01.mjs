// Score v0.1 — recalibrado pelo lift: porte ganha peso (lift 2.38, era subaproveitado),
// antiguidade idem (2.56), idade mantém, "estabilidade" REMOVIDA (lift 0.81, premiava errado),
// penalidade pra sócio único (lift 0). Re-mede contra o mesmo benchmark de 340 aquisições.
// Roda: node --env-file=.env.local scripts/validacao-v01.mjs
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
    -- v0.1: pesos guiados pelo lift observado
    (CASE sc.mf WHEN 9 THEN 25 WHEN 8 THEN 22 WHEN 7 THEN 18 WHEN 6 THEN 8 ELSE 0 END)         -- idade
    + (CASE WHEN 2023-EXTRACT(YEAR FROM e.data_inicio_atividade) >= 40 THEN 25
            WHEN 2023-EXTRACT(YEAR FROM e.data_inicio_atividade) >= 25 THEN 18
            WHEN 2023-EXTRACT(YEAR FROM e.data_inicio_atividade) >= 15 THEN 8 ELSE 0 END)      -- antiguidade
    + (CASE WHEN REGEXP_REPLACE(emp.porte,'^0','')='5' THEN 25
            WHEN REGEXP_REPLACE(emp.porte,'^0','')='3' THEN 12
            WHEN REGEXP_REPLACE(emp.porte,'^0','')='1' THEN 4 ELSE 0 END)                       -- porte (peso ↑)
    + (CASE WHEN sc.n_pf = 1 THEN -20 ELSE 0 END)                                              -- sócio único (penal.)
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
  ROUND(COUNTIF(decil<=2)/COUNT(*)*100,0) top20,
  ROUND(COUNTIF(decil<=3)/COUNT(*)*100,0) top30,
  ROUND(AVG(decil),2) decil_medio
FROM adq JOIN ranked USING(cnpj_basico)`;

const [[r]] = await bq.query({ query: sql, location: "US" });
console.log(`Score v0.1 (recalibrado por lift) — N=${r.n} aquisições\n`);
console.log(`              v0 (antigo)   v0.1 (novo)`);
console.log(`  TOP 10%:        17%          ${r.top10}%`);
console.log(`  TOP 20%:        33%          ${r.top20}%`);
console.log(`  TOP 30%:        45%          ${r.top30}%`);
console.log(`  decil médio:    4.39         ${r.decil_medio}    (5.5 = aleatório)`);
