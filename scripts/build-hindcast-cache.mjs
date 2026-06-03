// FEATURE ESTRELA — hindcast nominal. Pega aquisições REAIS de metalmec (detectadas na mina do CNPJ,
// PJ entrou + PF saiu depois do CORTE) e mostra, empresa por empresa COM NOME, em que decil o modelo
// as colocava no CORTE — ANTES do deal. Transforma o "67%" abstrato em "essas empresas concretas a
// gente já tinha pego". Honesto: lista também o decil das que erramos (não cherry-pick).
//   node --env-file=.env.local scripts/build-hindcast-cache.mjs
import { BigQuery } from "@google-cloud/bigquery";
import { writeFileSync } from "fs";
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
  SELECT e.cnpj_basico, est.id_municipio AS mun, e2.razao_social, e.cnae_fiscal_principal AS cnae,
    EXTRACT(YEAR FROM e.data_inicio_atividade) AS ano_fund,
    (CASE sc.mf WHEN 9 THEN 30 WHEN 8 THEN 26 WHEN 7 THEN 20 WHEN 6 THEN 10 ELSE 0 END)
    + (CASE WHEN 2023-EXTRACT(YEAR FROM e.data_inicio_atividade) >= 40 THEN 30
            WHEN 2023-EXTRACT(YEAR FROM e.data_inicio_atividade) >= 25 THEN 22
            WHEN 2023-EXTRACT(YEAR FROM e.data_inicio_atividade) >= 15 THEN 10 ELSE 0 END)
    + (CASE WHEN REGEXP_REPLACE(e2.porte,'^0','')='5' THEN 30
            WHEN REGEXP_REPLACE(e2.porte,'^0','')='3' THEN 15
            WHEN REGEXP_REPLACE(e2.porte,'^0','')='1' THEN 5 ELSE 0 END)
    + (CASE WHEN sc.n_pf >= 2 THEN 10 ELSE 0 END) AS score
  FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e
  JOIN \`basedosdados.br_me_cnpj.estabelecimentos\` est
    ON est.cnpj_basico=e.cnpj_basico AND est.data='${CORTE}' AND est.identificador_matriz_filial='1'
  JOIN \`basedosdados.br_me_cnpj.empresas\` e2 ON e2.cnpj_basico=e.cnpj_basico AND e2.data='${CORTE}'
  LEFT JOIN sc ON sc.cnpj_basico=e.cnpj_basico
  WHERE e.data='${CORTE}' AND e.sigla_uf='SP' AND e.identificador_matriz_filial='1'
    AND (e.cnae_fiscal_principal LIKE '24%' OR e.cnae_fiscal_principal LIKE '25%'
         OR e.cnae_fiscal_principal LIKE '28%')
),
ranked AS (
  SELECT cnpj_basico, razao_social, mun, cnae, ano_fund, score,
    NTILE(10) OVER (ORDER BY score DESC) AS decil,
    ROUND(PERCENT_RANK() OVER (ORDER BY score DESC)*100, 1) AS pct_rank
  FROM universo
),
-- aquisição + a data em que o sócio PJ entrou (proxy da data do deal)
ant AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${CORTE}' GROUP BY 1),
nov AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${NOVO}' GROUP BY 1),
entrada AS (
  SELECT cnpj_basico, MIN(data_entrada_sociedade) AS dt
  FROM \`basedosdados.br_me_cnpj.socios\`
  WHERE data='${NOVO}' AND tipo='1' AND data_entrada_sociedade > DATE('${CORTE}')
  GROUP BY 1
),
adq AS (
  SELECT a.cnpj_basico, e.dt FROM ant a JOIN nov b USING(cnpj_basico) LEFT JOIN entrada e USING(cnpj_basico)
  WHERE b.pj>a.pj AND b.pf<a.pf
)
SELECT r.razao_social, r.mun, r.cnae, r.ano_fund, r.score, r.decil, r.pct_rank,
  EXTRACT(YEAR FROM adq.dt) AS ano_deal
FROM adq JOIN ranked r USING(cnpj_basico)
ORDER BY r.pct_rank ASC`;

console.log("Rodando hindcast nominal (metalmec)...");
const [rows] = await bq.query({ query: sql, location: "US" });

function titulo(s) {
  return (s || "").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
const total = rows.length;
const top10 = rows.filter((r) => r.decil === 1).length;

const deals = rows.map((r) => ({
  nome: titulo(r.razao_social),
  municipio: titulo(String(r.mun)),
  cnae: r.cnae,
  fundada: Number(r.ano_fund),
  score: Number(r.score),
  decil: Number(r.decil),
  pct_rank: Number(r.pct_rank), // 0 = topo absoluto do ranking
  ano_deal: r.ano_deal ? Number(r.ano_deal) : null,
}));

const artefato = {
  gerado_em: new Date().toISOString().slice(0, 10),
  vertical: "Metalmecânica · interior SP",
  corte: CORTE,
  total_aquisicoes: total,
  no_top10: top10,
  recall_top10: Math.round((top10 / total) * 100),
  nota:
    "Aquisições REAIS detectadas na mina do CNPJ (sócio PJ entrou + PF saiu) DEPOIS de " +
    CORTE +
    ". O decil/rank é o que o modelo dava a cada empresa NAQUELA data — antes do deal. Sem leakage.",
  deals,
};
const out = path.resolve("src/lib/hindcast.json");
writeFileSync(out, JSON.stringify(artefato, null, 2) + "\n", "utf8");
console.log(`\n✓ ${out}`);
console.log(`  ${total} aquisições reais · ${top10} no top decil (${artefato.recall_top10}%)`);
console.log("  top 5 (melhor rank que demos antes do deal):");
for (const d of deals.slice(0, 5)) {
  console.log(`   pct ${String(d.pct_rank).padStart(4)} · decil ${d.decil} · ${d.nome.slice(0, 38)} · vendida ${d.ano_deal ?? "?"}`);
}
