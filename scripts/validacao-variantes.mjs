// Compara VARIANTES de score pela métrica que importa: recall@top10% contra aquisições reais.
//
// Por que não bastou o lift condicional (validacao-lift-coorte.mjs): lá capital alto, filial,
// 5+ sócios e sócio PJ têm lift forte, mas são todos proxy de "empresa maior". Somar os quatro
// como eixos independentes conta tamanho quatro vezes e piora o ranking. Recall resolve isso
// sozinho — se um eixo novo só repete o que outro já diz, ele não move o recall.
//
// HOLDOUT: metade das empresas (hash do CNPJ) fica de fora e é onde o número reportado é medido.
// Honestidade sobre o que o holdout NÃO cobre: as features foram escolhidas olhando o lift da
// amostra inteira, então a SELEÇÃO tem vazamento. O que o holdout garante é que a comparação
// entre variantes e o ganho sobre o v0 não vêm de sobreajuste dos cortes.
//
// Roda: node --env-file=.env.local scripts/validacao-variantes.mjs
import { BigQuery } from "@google-cloud/bigquery";
import { readFileSync } from "fs";
import path from "path";

const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: path.resolve(process.env.GCP_KEY_PATH),
});
const CORTE = "2023-06-10";
const NOVO = "2025-11-09";

const reg = JSON.parse(readFileSync(path.resolve("src/lib/setores.json"), "utf8"));
const likeDe = (s) => "(" + s.cnaes.map((p) => `e.cnae_fiscal_principal LIKE '${p}%'`).join(" OR ") + ")";
const caseVertical = "CASE " + reg.setores.map((s) => `WHEN ${likeDe(s)} THEN '${s.id}'`).join(" ") + " END";
const filtroCnae = "(" + reg.setores.map(likeDe).join(" OR ") + ")";

/* Capital social é nominal e a escala muda por setor (uma metalúrgica não se compara a uma
   clínica). Por isso o eixo usa PERCENTIL DENTRO DO VERTICAL, não o valor absoluto — senão o
   score viraria um ranking de setor rico contra setor pobre. */
const VARIANTES = {
  // Baseline: exatamente src/lib/scoring.ts hoje.
  v0: `
    (CASE mf WHEN 9 THEN 30 WHEN 8 THEN 26 WHEN 7 THEN 20 WHEN 6 THEN 10 ELSE 0 END)
    + (CASE WHEN anos_emp >= 40 THEN 30 WHEN anos_emp >= 25 THEN 22 WHEN anos_emp >= 15 THEN 10 ELSE 0 END)
    + (CASE porte_n WHEN '5' THEN 30 WHEN '3' THEN 15 WHEN '1' THEN 5 ELSE 0 END)
    + (CASE WHEN n_pf >= 2 THEN 10 ELSE 0 END)`,

  // A: só troca porte (3 baldes) por capital em percentil. Isola o eixo mais forte.
  a_capital: `
    (CASE mf WHEN 9 THEN 30 WHEN 8 THEN 26 WHEN 7 THEN 20 WHEN 6 THEN 10 ELSE 0 END)
    + (CASE WHEN anos_emp >= 40 THEN 30 WHEN anos_emp >= 25 THEN 22 WHEN anos_emp >= 15 THEN 10 ELSE 0 END)
    + (CASE WHEN cap_pct >= 0.95 THEN 30 WHEN cap_pct >= 0.85 THEN 24 WHEN cap_pct >= 0.70 THEN 17
            WHEN cap_pct >= 0.50 THEN 10 ELSE 0 END)
    + (CASE WHEN n_pf >= 2 THEN 10 ELSE 0 END)`,

  // B: capital + escala real (filial). Testa se filial acrescenta ou só repete capital.
  b_escala: `
    (CASE mf WHEN 9 THEN 30 WHEN 8 THEN 26 WHEN 7 THEN 20 WHEN 6 THEN 10 ELSE 0 END)
    + (CASE WHEN anos_emp >= 40 THEN 25 WHEN anos_emp >= 25 THEN 18 WHEN anos_emp >= 15 THEN 8 ELSE 0 END)
    + (CASE WHEN cap_pct >= 0.95 THEN 25 WHEN cap_pct >= 0.85 THEN 20 WHEN cap_pct >= 0.70 THEN 14
            WHEN cap_pct >= 0.50 THEN 8 ELSE 0 END)
    + (CASE WHEN n_estab >= 5 THEN 10 WHEN n_estab >= 2 THEN 6 ELSE 0 END)
    + (CASE WHEN n_pf >= 2 THEN 10 ELSE 0 END)`,

  // C: acrescenta o eixo TRANSIÇÃO e achata idade (2+ octogenários tem lift 0,50).
  // É a hipótese central: quem vende é quem está em transição, não quem está parado.
  c_transicao: `
    (CASE mf WHEN 9 THEN 20 WHEN 8 THEN 18 WHEN 7 THEN 14 WHEN 6 THEN 7 ELSE 0 END)
    + (CASE WHEN anos_emp >= 40 THEN 20 WHEN anos_emp >= 25 THEN 15 WHEN anos_emp >= 15 THEN 7 ELSE 0 END)
    + (CASE WHEN cap_pct >= 0.95 THEN 25 WHEN cap_pct >= 0.85 THEN 20 WHEN cap_pct >= 0.70 THEN 14
            WHEN cap_pct >= 0.50 THEN 8 ELSE 0 END)
    + (CASE WHEN n_estab >= 5 THEN 10 WHEN n_estab >= 2 THEN 6 ELSE 0 END)
    + (CASE WHEN menor <= 5 THEN 10 ELSE 0 END)
    + (CASE WHEN anos_ult IS NOT NULL AND anos_ult < 5 THEN 8
            WHEN anos_ult IS NOT NULL AND anos_ult < 10 THEN 4 ELSE 0 END)
    + (CASE WHEN n_pf >= 5 THEN 7 WHEN n_pf >= 2 THEN 4 ELSE 0 END)`,

  // D: C + sócio PJ. Suspeita de confusão com o ground truth (quem já tem estrutura
  // societária faz mais reorganização visível no registro), por isso testado separado.
  d_com_pj: `
    (CASE mf WHEN 9 THEN 20 WHEN 8 THEN 18 WHEN 7 THEN 14 WHEN 6 THEN 7 ELSE 0 END)
    + (CASE WHEN anos_emp >= 40 THEN 18 WHEN anos_emp >= 25 THEN 13 WHEN anos_emp >= 15 THEN 6 ELSE 0 END)
    + (CASE WHEN cap_pct >= 0.95 THEN 24 WHEN cap_pct >= 0.85 THEN 19 WHEN cap_pct >= 0.70 THEN 13
            WHEN cap_pct >= 0.50 THEN 7 ELSE 0 END)
    + (CASE WHEN n_estab >= 5 THEN 9 WHEN n_estab >= 2 THEN 5 ELSE 0 END)
    + (CASE WHEN menor <= 5 THEN 10 ELSE 0 END)
    + (CASE WHEN anos_ult IS NOT NULL AND anos_ult < 5 THEN 8
            WHEN anos_ult IS NOT NULL AND anos_ult < 10 THEN 4 ELSE 0 END)
    + (CASE WHEN n_pf >= 5 THEN 6 WHEN n_pf >= 2 THEN 3 ELSE 0 END)
    + (CASE WHEN n_pj >= 1 THEN 5 ELSE 0 END)`,
};

const sql = `
WITH sc AS (
  SELECT cnpj_basico,
    MAX(SAFE_CAST(faixa_etaria AS INT64)) AS mf,
    MIN(NULLIF(SAFE_CAST(faixa_etaria AS INT64), 0)) AS menor,
    MAX(data_entrada_sociedade) AS ult,
    COUNTIF(tipo='2') AS n_pf, COUNTIF(tipo='1') AS n_pj
  FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${CORTE}' GROUP BY 1
),
est AS (
  SELECT cnpj_basico, COUNT(*) AS n_estab
  FROM \`basedosdados.br_me_cnpj.estabelecimentos\` WHERE data='${CORTE}' GROUP BY 1
),
base AS (
  SELECT e.cnpj_basico, ${caseVertical} AS vertical,
    sc.mf, sc.menor, sc.n_pf, sc.n_pj,
    DATE_DIFF(DATE('${CORTE}'), sc.ult, YEAR) AS anos_ult,
    2023 - EXTRACT(YEAR FROM e.data_inicio_atividade) AS anos_emp,
    REGEXP_REPLACE(emp.porte, '^0', '') AS porte_n,
    SAFE_CAST(emp.capital_social AS FLOAT64) AS capital,
    COALESCE(est.n_estab, 1) AS n_estab,
    MOD(ABS(FARM_FINGERPRINT(e.cnpj_basico)), 2) AS metade
  FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e
  JOIN \`basedosdados.br_me_cnpj.empresas\` emp
    ON emp.cnpj_basico=e.cnpj_basico AND emp.data='${CORTE}'
  LEFT JOIN sc ON sc.cnpj_basico=e.cnpj_basico
  LEFT JOIN est ON est.cnpj_basico=e.cnpj_basico
  WHERE e.data='${CORTE}' AND e.identificador_matriz_filial='1'
    AND e.situacao_cadastral='2' AND ${filtroCnae}
),
comcap AS (
  SELECT *, PERCENT_RANK() OVER (PARTITION BY vertical ORDER BY COALESCE(capital, 0)) AS cap_pct
  FROM base
),
scored AS (
  SELECT cnpj_basico, vertical, metade,
    ${Object.entries(VARIANTES).map(([k, expr]) => `(${expr}) AS s_${k}`).join(",\n    ")}
  FROM comcap
),
ranked AS (
  SELECT cnpj_basico, vertical, metade,
    ${Object.keys(VARIANTES)
      .map((k) => `NTILE(10) OVER (PARTITION BY vertical, metade ORDER BY s_${k} DESC, cnpj_basico) AS d_${k}`)
      .join(",\n    ")}
  FROM scored
),
a AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${CORTE}' GROUP BY 1),
b AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${NOVO}' GROUP BY 1),
adq AS (SELECT a.cnpj_basico FROM a JOIN b USING(cnpj_basico) WHERE b.pj>a.pj AND b.pf<a.pf)
SELECT r.metade, r.vertical, COUNT(*) AS n_adq,
  ${Object.keys(VARIANTES)
    .map((k) => `ROUND(COUNTIF(r.d_${k}=1)/COUNT(*)*100,1) AS top10_${k}`)
    .join(",\n  ")}
FROM adq JOIN ranked r USING(cnpj_basico)
GROUP BY r.metade, r.vertical
ORDER BY r.metade, r.vertical`;

const [rows] = await bq.query({ query: sql, location: "US" });
const nomes = Object.keys(VARIANTES);

for (const metade of [0, 1]) {
  const rs = rows.filter((r) => Number(r.metade) === metade);
  const rotulo = metade === 0 ? "DESENVOLVIMENTO" : "HOLDOUT (número que vale)";
  console.log(`\n=== ${rotulo} ===`);
  console.log(`  vertical      N    ` + nomes.map((n) => n.padStart(12)).join(""));
  for (const r of rs) {
    console.log(
      `  ${r.vertical.padEnd(10)} ${String(r.n_adq).padStart(4)}    ` +
        nomes.map((n) => `${Number(r[`top10_${n}`]).toFixed(1)}%`.padStart(12)).join("")
    );
  }
  // Recall agregado ponderado por nº de aquisições — o número global honesto.
  const total = rs.reduce((a, r) => a + Number(r.n_adq), 0);
  const agg = nomes.map((n) => {
    const acertos = rs.reduce((a, r) => a + (Number(r[`top10_${n}`]) / 100) * Number(r.n_adq), 0);
    return (acertos / total) * 100;
  });
  console.log(`  ${"GERAL".padEnd(10)} ${String(total).padStart(4)}    ` +
    agg.map((v) => `${v.toFixed(1)}%`.padStart(12)).join(""));
  console.log(`  ${"lift".padEnd(10)} ${"".padStart(4)}    ` +
    agg.map((v) => `${(v / 10).toFixed(1)}x`.padStart(12)).join(""));
}
console.log(`\nAleatório = 10%. Recall no HOLDOUT é o que decide.`);
