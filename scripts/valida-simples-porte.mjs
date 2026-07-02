// VALIDAÇÃO: a saída do Simples adiciona sinal ALÉM do porte, ou é redundante com ele?
// Estratifica tratamento (7.877 aquisições limpas) vs controle (elegíveis) por porte × saída-do-Simples.
// Se dentro de cada banda de porte a taxa de saída ainda for MAIOR no tratamento, a feature agrega.
import { BigQuery } from "@google-cloud/bigquery";
import { readFileSync } from "fs";
import path from "path";
const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID, keyFilename: path.resolve(process.env.GCP_KEY_PATH) });
const CORTE = "2023-06-10", NOVO = "2025-11-09";

const gt = JSON.parse(readFileSync(path.resolve("scripts/data/aquisicoes-br.json"), "utf8"));
const alvo = gt.aquisicoes.filter((r) => r.limpa).map((r) => r.cnpj_basico);
const lit = alvo.map((c) => `'${c}'`).join(",");

const sql = `
WITH
base AS (
  SELECT cnpj_basico FROM \`basedosdados.br_me_cnpj.estabelecimentos\`
  WHERE data='${NOVO}' AND identificador_matriz_filial='1' AND situacao_cadastral='2'
    AND (2023 - EXTRACT(YEAR FROM data_inicio_atividade)) >= 5),
alvo AS (SELECT cnpj_basico FROM UNNEST([${lit}]) AS cnpj_basico),
grp AS (SELECT b.cnpj_basico, IF(a.cnpj_basico IS NULL,'controle','tratamento') g
        FROM base b LEFT JOIN alvo a USING(cnpj_basico)),
emp AS (SELECT cnpj_basico, porte FROM \`basedosdados.br_me_cnpj.empresas\` WHERE data='${CORTE}'),
sim AS (SELECT cnpj_basico, data_exclusao_simples FROM \`basedosdados.br_me_cnpj.simples\`)
SELECT
  CASE e.porte WHEN '5' THEN 'DEMAIS' WHEN '3' THEN 'EPP' WHEN '1' THEN 'ME' ELSE COALESCE(e.porte,'?') END porte,
  g.g,
  COUNT(*) n,
  ROUND(100*COUNTIF(s.data_exclusao_simples < '${CORTE}')/COUNT(*),1) pct_saiu_simples
FROM grp g
LEFT JOIN emp e USING(cnpj_basico)
LEFT JOIN sim s USING(cnpj_basico)
GROUP BY 1,2 ORDER BY 1,2`;

const [rows] = await bq.query({ query: sql, location: "US" });
console.log("porte    grupo        n           %saiu do Simples (pré-2023)");
const byPorte = {};
for (const r of rows) {
  console.log(`${String(r.porte).padEnd(8)} ${r.g.padEnd(11)} ${String(r.n).padStart(9)}      ${String(r.pct_saiu_simples).padStart(5)}%`);
  (byPorte[r.porte] ??= {})[r.g] = r.pct_saiu_simples;
}
console.log("\nLift dentro de cada porte (tratamento/controle) — >1 = agrega sinal além do porte:");
for (const [p, v] of Object.entries(byPorte)) {
  if (v.tratamento != null && v.controle) console.log(`  ${p.padEnd(8)} ${(v.tratamento / v.controle).toFixed(2)}x  (${v.tratamento}% vs ${v.controle}%)`);
}
