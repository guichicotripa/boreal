// Decisão de vertical do Relay (educação básica vs facilities, no Nordeste): mede recall@top10%
// (decision gate) E decompõe consolidação vs sucessão (a armadilha que matou saúde). Decil DENTRO
// do vertical. Ground truth = transições do CNPJ (PJ entra + PF sai). v0.1.
// node --env-file=.env.local scripts/validacao-edu-facilities.mjs
import { BigQuery } from "@google-cloud/bigquery";
import path from "path";
const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID, keyFilename: path.resolve(process.env.GCP_KEY_PATH) });
const CORTE = "2023-06-10", NOVO = "2025-11-09";
const NE = "'BA','PE','CE','MA','PB','RN','AL','SE','PI'";
const escopo = (process.argv[2] || "ne").toLowerCase();           // 'ne' ou 'br'
const ufWhere = escopo === "br" ? "" : `AND e.sigla_uf IN (${NE})`;

const sql = `
WITH sc AS (
  SELECT cnpj_basico, MAX(SAFE_CAST(faixa_etaria AS INT64)) AS mf, COUNTIF(tipo='2') AS n_pf
  FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${CORTE}' GROUP BY 1
),
universo AS (
  SELECT e.cnpj_basico, sc.mf AS mf, (2023-EXTRACT(YEAR FROM e.data_inicio_atividade)) AS idade_emp,
    CASE WHEN e.cnae_fiscal_principal LIKE '851%' OR e.cnae_fiscal_principal LIKE '852%' THEN 'educacao_basica'
         ELSE 'facilities' END AS vertical,
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
  WHERE e.data='${CORTE}' ${ufWhere} AND e.identificador_matriz_filial='1'
    AND (e.cnae_fiscal_principal LIKE '851%' OR e.cnae_fiscal_principal LIKE '852%'
         OR e.cnae_fiscal_principal LIKE '81%')
),
ranked AS (SELECT cnpj_basico, vertical, mf, idade_emp,
  NTILE(10) OVER (PARTITION BY vertical ORDER BY score DESC) AS decil FROM universo),
univ AS (SELECT vertical, COUNT(*) n_univ FROM universo GROUP BY 1),
a AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${CORTE}' GROUP BY 1),
b AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${NOVO}' GROUP BY 1),
adq AS (SELECT a.cnpj_basico FROM a JOIN b USING(cnpj_basico) WHERE b.pj>a.pj AND b.pf<a.pf)
SELECT r.vertical,
  CASE WHEN r.mf>=7 AND r.idade_emp>=25 THEN '1_sucessao' WHEN r.mf>=7 OR r.idade_emp>=25 THEN '2_parcial' ELSE '3_consolidacao' END AS perfil,
  COUNT(*) AS n_adq, COUNTIF(r.decil=1) AS n_top10
FROM adq JOIN ranked r USING(cnpj_basico)
GROUP BY r.vertical, perfil`;

const [rows] = await bq.query({ query: sql, location: "US" });

// Agrega por vertical
const verts = {};
for (const r of rows) {
  const v = (verts[r.vertical] ??= { total: 0, top10: 0, perfis: {} });
  v.total += Number(r.n_adq); v.top10 += Number(r.n_top10);
  v.perfis[r.perfil] = { n: Number(r.n_adq), top10: Number(r.n_top10) };
}
console.log(`Decisão de vertical — escopo ${escopo.toUpperCase()} — recall@top10% + decomposição (v0.1)\n`);
for (const [vert, d] of Object.entries(verts)) {
  const recall = Math.round(d.top10 / d.total * 100);
  const gate = recall >= 40 ? "✅ PASSA" : recall >= 25 ? "🟡 ITERA" : "🔴 PARA";
  console.log(`[${vert.toUpperCase()}]  ${d.total} aquisições  ·  recall@top10% geral: ${recall}% ${gate}`);
  for (const perf of ["1_sucessao", "2_parcial", "3_consolidacao"]) {
    const p = d.perfis[perf]; if (!p) continue;
    const pct = Math.round(p.n / d.total * 100);
    const rc = p.n ? Math.round(p.top10 / p.n * 100) : 0;
    console.log(`     ${perf}: ${p.n} (${pct}%) · recall ${rc}%`);
  }
  console.log("");
}
