// SONDA: distress ANTECEDE a troca de controle? Só com dado CNPJ-linkável já em mãos (br_me_cnpj).
// Proxies de distress pré-janela (RAIS não tem CNPJ; PGFN fora do acesso):
//   (1) exclusão do Simples antes do corte (2023-06-10)
//   (2) exclusão do MEI antes do corte
//   (3) situação cadastral != ativa no snapshot de 2023 (suspensa/inapta) apesar de ativa em 2025
// Compara TRATAMENTO (7.877 aquisições limpas) vs CONTROLE (matriz ativa 2025, idade>=5, NÃO adquiridas).
import { BigQuery } from "@google-cloud/bigquery";
import { readFileSync } from "fs";
import path from "path";
const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID, keyFilename: path.resolve(process.env.GCP_KEY_PATH) });
const CORTE = "2023-06-10", NOVO = "2025-11-09";

const gt = JSON.parse(readFileSync(path.resolve("scripts/data/aquisicoes-br.json"), "utf8"));
const alvo = gt.aquisicoes.filter((r) => r.limpa).map((r) => r.cnpj_basico);
console.log(`tratamento: ${alvo.length} CNPJs limpos`);
const lit = alvo.map((c) => `'${c}'`).join(",");

const sql = `
WITH
base AS ( -- elegíveis: matriz ativa em 2025, idade>=5 no corte
  SELECT cnpj_basico
  FROM \`basedosdados.br_me_cnpj.estabelecimentos\`
  WHERE data='${NOVO}' AND identificador_matriz_filial='1' AND situacao_cadastral='2'
    AND (2023 - EXTRACT(YEAR FROM data_inicio_atividade)) >= 5),
alvo AS (SELECT cnpj_basico FROM UNNEST([${lit}]) AS cnpj_basico),
grp AS (
  SELECT b.cnpj_basico, IF(a.cnpj_basico IS NULL,'controle','tratamento') AS g
  FROM base b LEFT JOIN alvo a USING(cnpj_basico)),
sim AS (SELECT cnpj_basico, data_exclusao_simples, data_exclusao_mei
        FROM \`basedosdados.br_me_cnpj.simples\`),
sit23 AS (SELECT cnpj_basico, situacao_cadastral AS sit
          FROM \`basedosdados.br_me_cnpj.estabelecimentos\`
          WHERE data='${CORTE}' AND identificador_matriz_filial='1')
SELECT g.g,
  COUNT(*) AS n,
  ROUND(100*COUNTIF(s.data_exclusao_simples < '${CORTE}')/COUNT(*),2) AS pct_excl_simples_pre,
  ROUND(100*COUNTIF(s.data_exclusao_mei < '${CORTE}')/COUNT(*),2) AS pct_excl_mei_pre,
  ROUND(100*COUNTIF(t.sit IS NOT NULL AND t.sit!='2')/COUNT(*),2) AS pct_nao_ativa_2023
FROM grp g
LEFT JOIN sim s USING(cnpj_basico)
LEFT JOIN sit23 t USING(cnpj_basico)
GROUP BY 1 ORDER BY 1`;

const [rows] = await bq.query({ query: sql, location: "US" });
console.log("\ngrupo        n          excl.Simples<2023  excl.MEI<2023  não-ativa@2023");
for (const r of rows) {
  console.log(`${r.g.padEnd(11)} ${String(r.n).padStart(9)}   ${String(r.pct_excl_simples_pre).padStart(6)}%          ${String(r.pct_excl_mei_pre).padStart(6)}%       ${String(r.pct_nao_ativa_2023).padStart(6)}%`);
}
// razão tratamento/controle (lift) por sinal
const t = rows.find((r) => r.g === "tratamento"), c = rows.find((r) => r.g === "controle");
if (t && c) {
  const lift = (a, b) => (b > 0 ? (a / b).toFixed(2) + "x" : "n/a");
  console.log(`\nlift (tratamento/controle):`);
  console.log(`  excl.Simples: ${lift(t.pct_excl_simples_pre, c.pct_excl_simples_pre)}   excl.MEI: ${lift(t.pct_excl_mei_pre, c.pct_excl_mei_pre)}   não-ativa@2023: ${lift(t.pct_nao_ativa_2023, c.pct_nao_ativa_2023)}`);
}
