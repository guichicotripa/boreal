// Decompõe as aquisições de UM setor por perfil do alvo (sucessão clássica / parcial / consolidação)
// e mede recall@top10% do score em cada bucket. Responde "o score é ruim, ou o label está sujo?".
//   node --env-file=.env.local scripts/validacao-decomp.mjs educacao
import { BigQuery } from "@google-cloud/bigquery";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reg = JSON.parse(readFileSync(path.resolve(__dirname, "../src/lib/setores.json"), "utf8"));
const setorId = (process.argv[2] || "educacao").trim();
const setor = reg.setores.find((s) => s.id === setorId);
if (!setor) { console.error(`setor "${setorId}" não existe`); process.exit(1); }
const cnaeFiltro = "(" + setor.cnaes.map((p) => `e.cnae_fiscal_principal LIKE '${p}%'`).join(" OR ") + ")";

const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID, keyFilename: path.resolve(process.env.GCP_KEY_PATH) });
const CORTE = "2023-06-10", NOVO = "2025-11-09";

const sql = `
WITH sc AS (
  SELECT cnpj_basico, MAX(SAFE_CAST(faixa_etaria AS INT64)) AS mf, COUNTIF(tipo='2') AS n_pf
  FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${CORTE}' GROUP BY 1
),
universo AS (
  SELECT e.cnpj_basico,
    (2023-EXTRACT(YEAR FROM e.data_inicio_atividade)) AS idade_emp, sc.mf AS mf,
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
  WHERE e.data='${CORTE}' AND e.sigla_uf='SP' AND e.identificador_matriz_filial='1' AND ${cnaeFiltro}
),
ranked AS (SELECT cnpj_basico, idade_emp, mf, NTILE(10) OVER (ORDER BY score DESC) AS decil FROM universo),
a AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${CORTE}' GROUP BY 1),
b AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${NOVO}' GROUP BY 1),
adq AS (SELECT a.cnpj_basico FROM a JOIN b USING(cnpj_basico) WHERE b.pj>a.pj AND b.pf<a.pf)
SELECT
  CASE WHEN r.mf>=7 AND r.idade_emp>=25 THEN '1_sucessao_classica (idoso + 25+ anos)'
       WHEN r.mf>=7 OR r.idade_emp>=25 THEN '2_parcial (idoso OU antiga)'
       ELSE '3_consolidacao (jovem e/ou nova)' END AS perfil,
  COUNT(*) AS n_adq,
  ROUND(COUNTIF(r.decil=1)/COUNT(*)*100,0) AS recall_top10,
  ROUND(AVG(r.decil),2) AS decil_medio
FROM adq JOIN ranked r USING(cnpj_basico)
GROUP BY perfil ORDER BY perfil`;

const [rows] = await bq.query({ query: sql, location: "US" });
const tot = rows.reduce((s, r) => s + Number(r.n_adq), 0);
console.log(`Aquisições de ${setor.nome.toUpperCase()} decompostas (N=${tot}):\n`);
for (const r of rows) {
  console.log(`  ${r.perfil}`);
  console.log(`     ${r.n_adq} deals (${Math.round(r.n_adq / tot * 100)}%) · recall@top10%: ${r.recall_top10}% · decil médio ${r.decil_medio}\n`);
}
