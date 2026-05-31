// Validação retroativa do score v0.1 QUEBRADA POR VERTICAL (saúde vs metalmec), com o decil
// calculado DENTRO de cada vertical (PARTITION BY) — porque o Relay rankeia empresas do mesmo
// setor entre si, não saúde contra metalúrgica. Mede o recall@top10% (decision gate do Relay:
// % das aquisições conhecidas que o score colocou no top decil 12+ meses antes, sem leakage).
// Ground truth = transições do próprio CNPJ (PJ entra + PF sai). Roda:
//   node --env-file=.env.local scripts/validacao-vertical.mjs
import { BigQuery } from "@google-cloud/bigquery";
import path from "path";

const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: path.resolve(process.env.GCP_KEY_PATH),
});
const CORTE = "2023-06-10"; // score pré-deal
const NOVO = "2025-11-09";  // snapshot atual (detecta o que mudou)

const sql = `
WITH sc AS (
  SELECT cnpj_basico, MAX(SAFE_CAST(faixa_etaria AS INT64)) AS mf, COUNTIF(tipo='2') AS n_pf
  FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${CORTE}' GROUP BY 1
),
universo AS (
  SELECT e.cnpj_basico,
    CASE WHEN e.cnae_fiscal_principal LIKE '86%' THEN 'saude' ELSE 'metalmec' END AS vertical,
    (CASE sc.mf WHEN 9 THEN 30 WHEN 8 THEN 26 WHEN 7 THEN 20 WHEN 6 THEN 10 ELSE 0 END)
    + (CASE WHEN 2023-EXTRACT(YEAR FROM e.data_inicio_atividade) >= 40 THEN 30
            WHEN 2023-EXTRACT(YEAR FROM e.data_inicio_atividade) >= 25 THEN 22
            WHEN 2023-EXTRACT(YEAR FROM e.data_inicio_atividade) >= 15 THEN 10 ELSE 0 END)
    + (CASE WHEN REGEXP_REPLACE(emp.porte,'^0','')='5' THEN 30
            WHEN REGEXP_REPLACE(emp.porte,'^0','')='3' THEN 15
            WHEN REGEXP_REPLACE(emp.porte,'^0','')='1' THEN 5 ELSE 0 END)
    + (CASE WHEN sc.n_pf >= 2 THEN 10 ELSE 0 END) AS score
  FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e
  JOIN \`basedosdados.br_me_cnpj.empresas\` emp ON emp.cnpj_basico=e.cnpj_basico AND emp.data='${CORTE}'
  LEFT JOIN sc ON sc.cnpj_basico=e.cnpj_basico
  WHERE e.data='${CORTE}' AND e.sigla_uf='SP' AND e.identificador_matriz_filial='1'
    AND (e.cnae_fiscal_principal LIKE '86%' OR e.cnae_fiscal_principal LIKE '24%'
         OR e.cnae_fiscal_principal LIKE '25%' OR e.cnae_fiscal_principal LIKE '28%')
),
ranked AS (
  SELECT cnpj_basico, vertical,
    NTILE(10) OVER (PARTITION BY vertical ORDER BY score DESC) AS decil  -- decil DENTRO do vertical
  FROM universo
),
univ AS (SELECT vertical, COUNT(*) AS n_univ FROM universo GROUP BY 1),
a AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${CORTE}' GROUP BY 1),
b AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${NOVO}' GROUP BY 1),
adq AS (SELECT a.cnpj_basico FROM a JOIN b USING(cnpj_basico) WHERE b.pj>a.pj AND b.pf<a.pf)
SELECT r.vertical, u.n_univ AS universo, COUNT(*) AS n_adq,
  ROUND(COUNTIF(r.decil=1)/COUNT(*)*100,0) AS top10,
  ROUND(COUNTIF(r.decil<=2)/COUNT(*)*100,0) AS top20,
  ROUND(COUNTIF(r.decil<=3)/COUNT(*)*100,0) AS top30,
  ROUND(AVG(r.decil),2) AS decil_medio
FROM adq JOIN ranked r USING(cnpj_basico) JOIN univ u ON u.vertical=r.vertical
GROUP BY r.vertical, u.n_univ
ORDER BY r.vertical`;

console.log(`Validação retroativa v0.1 POR VERTICAL — score em ${CORTE} vs aquisições até ${NOVO}`);
console.log(`Decil calculado DENTRO de cada vertical. Decision gate Relay: recall@top10% >= 40%.\n`);
const [rows] = await bq.query({ query: sql, location: "US" });
for (const r of rows) {
  const gate = r.top10 >= 40 ? "✅ PASSA (>=40%)" : r.top10 >= 25 ? "🟡 ITERA (25-40%)" : "🔴 PARA (<25%)";
  console.log(`[${r.vertical.toUpperCase()}]  universo ${r.universo} · ${r.n_adq} aquisições no ground truth`);
  console.log(`   recall TOP10%: ${r.top10}%   ${gate}`);
  console.log(`   recall TOP20%: ${r.top20}%  ·  TOP30%: ${r.top30}%  ·  decil médio ${r.decil_medio} (5.5=aleatório)\n`);
}
