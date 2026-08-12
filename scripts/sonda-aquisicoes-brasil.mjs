/**
 * Quantas aquisicoes o nosso label acha no BRASIL INTEIRO, e nao so nos 4 setores validados?
 *
 *   node --env-file=.env.local scripts/sonda-aquisicoes-brasil.mjs
 *
 * CONTEXTO. O numero de 1.610 aquisicoes que citamos e a soma de 4 setores (saude, agro,
 * metalmecanica, educacao), 1.465.665 empresas. A ancora externa que usamos pra validar a ordem de
 * grandeza (1.581 deals no Brasil em 2025, report da KKR) e do pais inteiro e de UM ano. Comparar
 * os dois direto e comparar escopos diferentes: se 4 setores ja dao 42% do pais, ou o label esta
 * generoso, ou os 4 setores concentram o M&A brasileiro de um jeito improvavel.
 *
 * Este script tira a duvida rodando o MESMO label, com os MESMOS filtros, sem recorte de CNAE:
 *   label = entre os dois snapshots, o numero de socios PJ SOBE e o de socios PF CAI
 *
 * Devolve tambem a quebra por secao de CNAE, pra ver quanto do total esta dentro dos 4 setores e
 * onde o resto se concentra. Se o label for razoavel, o Brasil inteiro deve dar poucos milhares em
 * 2,4 anos; se der dezenas de milhares, o label captura reorganizacao societaria e nao aquisicao,
 * e o numero publicado precisa de ressalva.
 */
import { BigQuery } from "@google-cloud/bigquery";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: path.resolve(ROOT, process.env.GCP_KEY_PATH),
});

const CORTE = "2023-06-10";
const NOVO = "2025-11-09";

const sql = `
WITH sa AS (
  SELECT cnpj_basico, COUNTIF(tipo='2') AS pf, COUNTIF(tipo='1') AS pj
  FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${CORTE}' GROUP BY 1
),
sb AS (
  SELECT cnpj_basico, COUNTIF(tipo='2') AS pf, COUNTIF(tipo='1') AS pj
  FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${NOVO}' GROUP BY 1
),
base AS (
  SELECT
    e.cnpj_basico,
    SUBSTR(e.cnae_fiscal_principal, 1, 2) AS div,
    COALESCE(sa.pf, 0) AS pf_a, COALESCE(sa.pj, 0) AS pj_a,
    IF(sb.cnpj_basico IS NULL, -1, sb.pf) AS pf_b,
    IF(sb.cnpj_basico IS NULL, -1, sb.pj) AS pj_b
  FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e
  LEFT JOIN sa ON sa.cnpj_basico = e.cnpj_basico
  LEFT JOIN sb ON sb.cnpj_basico = e.cnpj_basico
  WHERE e.data='${CORTE}'
    AND e.identificador_matriz_filial='1'
    AND e.situacao_cadastral='2'
)
SELECT
  div,
  COUNT(*) AS universo,
  COUNTIF(pf_a >= 2) AS com_2_mais_pf,
  COUNTIF(pj_b > pj_a AND pf_b < pf_a AND pf_b >= 0) AS aquisicoes
FROM base
GROUP BY 1
ORDER BY aquisicoes DESC`;

console.log("rodando no Brasil inteiro, sem recorte de CNAE...");
const [rows] = await bq.query({ query: sql, location: "US" });

const num = (v) => Number(v).toLocaleString("pt-BR");
const DIVS_4 = { "86": "saude", "01": "agro", "02": "agro", "03": "agro", "24": "metalmec", "25": "metalmec", "28": "metalmec", "85": "educacao" };

const tot = rows.reduce((s, r) => s + Number(r.universo), 0);
const totA = rows.reduce((s, r) => s + Number(r.aquisicoes), 0);
const tot2 = rows.reduce((s, r) => s + Number(r.com_2_mais_pf), 0);
const dentro = rows.filter((r) => DIVS_4[r.div]);
const totDentro = dentro.reduce((s, r) => s + Number(r.aquisicoes), 0);
const uniDentro = dentro.reduce((s, r) => s + Number(r.universo), 0);

const ANOS = (new Date(NOVO) - new Date(CORTE)) / (365.25 * 24 * 3600 * 1000);

console.log(`\njanela ${CORTE} -> ${NOVO} (${ANOS.toFixed(2)} anos)\n`);
console.log(`BRASIL INTEIRO`);
console.log(`  matrizes ativas ................ ${num(tot)}`);
console.log(`  com 2+ socios PF (elegiveis) ... ${num(tot2)}  (${(tot2 / tot * 100).toFixed(1)}%)`);
console.log(`  aquisicoes pelo label .......... ${num(totA)}`);
console.log(`  por ano ........................ ${num(Math.round(totA / ANOS))}`);
console.log(`  taxa sobre elegiveis ........... ${(totA / tot2 * 100).toFixed(2)}%`);
console.log(`\nDIVISOES DE CNAE DOS 4 SETORES VALIDADOS`);
console.log(`  universo ....................... ${num(uniDentro)}  (${(uniDentro / tot * 100).toFixed(1)}% do Brasil)`);
console.log(`  aquisicoes ..................... ${num(totDentro)}  (${(totDentro / totA * 100).toFixed(1)}% do Brasil)`);

console.log(`\nTOP 15 DIVISOES POR AQUISICAO`);
console.log("  div" + "universo".padStart(12) + "2+ PF".padStart(11) + "aquisic.".padStart(10) + "taxa".padStart(9) + "  nos 4?");
for (const r of rows.slice(0, 15)) {
  const t2 = Number(r.com_2_mais_pf);
  console.log(`  ${r.div} ` + num(r.universo).padStart(11) + num(t2).padStart(11) +
    num(r.aquisicoes).padStart(10) + (t2 ? (Number(r.aquisicoes) / t2 * 100).toFixed(2) + "%" : "-").padStart(9) +
    (DIVS_4[r.div] ? "  " + DIVS_4[r.div] : ""));
}
