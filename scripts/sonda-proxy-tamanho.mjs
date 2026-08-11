/**
 * O `capital_social` presta como proxy de tamanho, ou e lixo declarado uma vez e nunca mexido?
 *
 *   node --env-file=.env.local scripts/sonda-proxy-tamanho.mjs --schema
 *   node --env-file=.env.local scripts/sonda-proxy-tamanho.mjs
 *
 * POR QUE ELE EXISTE: toda a sondagem dos setores da Setter (11/08) usou "capital >= R$1 mi" como
 * corte de tamanho de mandato, e o proprio Guilherme apontou o furo: capital social e declarado no
 * registro do CNPJ e empresa nao atualiza. Se for verdade, o corte enviesa contra empresa antiga,
 * que e exatamente o alvo da tese sucessoria, e todo numero da sondagem esta subestimado de forma
 * NAO uniforme. Declarar a ressalva e barato; medir e o que vale.
 *
 * TRES MEDIDAS:
 *   1. ESTAGNACAO. Qual fracao das empresas tem capital_social IDENTICO em 2023-06-10 e 2025-11-09.
 *      Numero alto confirma que o campo nao acompanha a empresa.
 *   2. VIES POR IDADE. Capital mediano por decada de fundacao. Se o campo fosse vivo, empresa mais
 *      velha teria capital maior (mais tempo capitalizando). Se estiver morto, a mediana CAI com a
 *      idade, porque o valor ficou congelado em moeda de outra epoca.
 *   3. SUBSTITUTO. `porte` e a faixa da Receita (1=ME, 3=EPP, 5=DEMAIS) e `simples` tras a data de
 *      exclusao do Simples. Os dois tem consequencia tributaria, entao a empresa e obrigada a
 *      manter. Sair do Simples significa ter estourado o teto de receita (R$4,8 mi), que e um sinal
 *      de TAMANHO com data, e nao um numero declarado na fundacao.
 */
import { BigQuery } from "@google-cloud/bigquery";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: path.resolve(__dirname, "..", process.env.GCP_KEY_PATH),
});

if (process.argv.includes("--schema")) {
  const [r] = await bq.query({
    query: `SELECT column_name, data_type FROM \`basedosdados.br_me_cnpj.INFORMATION_SCHEMA.COLUMNS\` WHERE table_name='simples' ORDER BY ordinal_position`,
    location: "US",
  });
  console.log(r.map((x) => `${x.column_name}:${x.data_type}`).join(", "));
  process.exit(0);
}

const CORTE = "2023-06-10", SNAP = "2025-11-09";
const NOME = `REGEXP_REPLACE(NORMALIZE(UPPER(CONCAT(COALESCE(e2.razao_social,''),' ',COALESCE(x.nome_fantasia,''))), NFD), r'\\pM','')`;

const GRUPO = `CASE
    WHEN cnae LIKE '7500%' AND REGEXP_CONTAINS(nome,'LABORAT|DIAGNOSTIC|PATOLOG|ANALISES CLINICAS|ANALISES VET|CITOPATOL|HEMATOLOG') THEN 'A_vet_lab'
    WHEN cnae LIKE '9603%' OR cnae LIKE '65111%' THEN 'death_care'
    WHEN cnae LIKE '7500%' THEN 'vet_outros' END`;

const sql = `
WITH x AS (
  SELECT cnpj_basico, cnae_fiscal_principal AS cnae, nome_fantasia, sigla_uf,
         EXTRACT(YEAR FROM data_inicio_atividade) AS ano_fund,
         DATE_DIFF(DATE('${SNAP}'), data_inicio_atividade, YEAR) AS anos_emp
  FROM \`basedosdados.br_me_cnpj.estabelecimentos\`
  WHERE data='${SNAP}' AND identificador_matriz_filial='1' AND situacao_cadastral='2'
    AND (cnae_fiscal_principal LIKE '7500%' OR cnae_fiscal_principal LIKE '9603%'
      OR cnae_fiscal_principal LIKE '65111%')
),
e2 AS (SELECT cnpj_basico, razao_social, SAFE_CAST(capital_social AS FLOAT64) cap, porte
       FROM \`basedosdados.br_me_cnpj.empresas\` WHERE data='${SNAP}'),
e1 AS (SELECT cnpj_basico, SAFE_CAST(capital_social AS FLOAT64) cap
       FROM \`basedosdados.br_me_cnpj.empresas\` WHERE data='${CORTE}'),
sc AS (SELECT cnpj_basico, MAX(NULLIF(SAFE_CAST(faixa_etaria AS INT64),0)) mf
       FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${SNAP}' GROUP BY 1),
j AS (
  SELECT x.cnpj_basico, x.cnae, x.ano_fund, x.anos_emp, x.sigla_uf,
         ${NOME} AS nome, e2.cap AS cap25, e1.cap AS cap23, e2.porte, COALESCE(sc.mf,0) AS mf
  FROM x JOIN e2 USING(cnpj_basico) LEFT JOIN e1 USING(cnpj_basico) LEFT JOIN sc USING(cnpj_basico)
),
g AS (SELECT *, ${GRUPO} AS grupo FROM j)
SELECT
  grupo,
  COUNT(*) AS n,
  ROUND(100 * COUNTIF(cap23 IS NOT NULL AND cap25 = cap23) / NULLIF(COUNTIF(cap23 IS NOT NULL),0), 1) AS pct_cap_congelado,
  COUNTIF(porte='5')                       AS porte_demais,
  COUNTIF(porte='3')                       AS porte_epp,
  COUNTIF(porte='1')                       AS porte_me,
  COUNTIF(cap25 >= 1000000)                AS cap_1mi,
  COUNTIF(porte='5' AND cap25 < 1000000)   AS demais_mas_cap_baixo,
  COUNTIF(porte='5' AND mf>=7 AND anos_emp>=25) AS demais_perfil,
  COUNTIF(cap25 >= 1000000 AND mf>=7 AND anos_emp>=25) AS cap1mi_perfil
FROM g WHERE grupo IS NOT NULL GROUP BY 1 ORDER BY n DESC`;

const sqlIdade = `
WITH x AS (
  SELECT cnpj_basico, cnae_fiscal_principal AS cnae,
         EXTRACT(YEAR FROM data_inicio_atividade) AS ano_fund
  FROM \`basedosdados.br_me_cnpj.estabelecimentos\`
  WHERE data='${SNAP}' AND identificador_matriz_filial='1' AND situacao_cadastral='2'
    AND (cnae_fiscal_principal LIKE '9603%' OR cnae_fiscal_principal LIKE '65111%')
),
e2 AS (SELECT cnpj_basico, SAFE_CAST(capital_social AS FLOAT64) cap, porte
       FROM \`basedosdados.br_me_cnpj.empresas\` WHERE data='${SNAP}')
SELECT
  CASE WHEN ano_fund < 1980 THEN 'ate 1979'
       WHEN ano_fund < 1990 THEN '1980s' WHEN ano_fund < 2000 THEN '1990s'
       WHEN ano_fund < 2010 THEN '2000s' WHEN ano_fund < 2020 THEN '2010s'
       ELSE '2020s' END AS decada,
  COUNT(*) n,
  APPROX_QUANTILES(cap,100)[OFFSET(50)] AS cap_mediano,
  APPROX_QUANTILES(cap,100)[OFFSET(90)] AS cap_p90,
  ROUND(100*COUNTIF(porte='5')/COUNT(*),1) AS pct_porte_demais
FROM x JOIN e2 USING(cnpj_basico)
GROUP BY 1 ORDER BY 1`;

const n = (v) => Math.round(Number(v ?? 0)).toLocaleString("pt-BR");

console.log("=== 1 e 3. estagnacao do capital e substituto por porte\n");
const [rows] = await bq.query({ query: sql, location: "US" });
const cab = ["grupo", "n", "%cap igual 23-25", "DEMAIS", "EPP", "ME", ">=1mi", "DEMAIS c/ cap<1mi", "DEMAIS+perfil", "1mi+perfil"];
const w = [14, 9, 18, 9, 8, 8, 8, 19, 15, 12];
console.log(cab.map((c, i) => c.padStart(w[i])).join(""));
console.log("-".repeat(w.reduce((a, b) => a + b, 0)));
for (const r of rows) {
  console.log([r.grupo, n(r.n), r.pct_cap_congelado + "%", n(r.porte_demais), n(r.porte_epp), n(r.porte_me),
    n(r.cap_1mi), n(r.demais_mas_cap_baixo), n(r.demais_perfil), n(r.cap1mi_perfil)]
    .map((c, i) => String(c).padStart(w[i])).join(""));
}

console.log("\n\n=== 2. vies por idade, so death care (9603 + 65111)\n");
const [r2] = await bq.query({ query: sqlIdade, location: "US" });
const c2 = ["decada fund.", "n", "cap mediano", "cap p90", "% porte DEMAIS"];
const w2 = [14, 9, 14, 14, 17];
console.log(c2.map((c, i) => c.padStart(w2[i])).join(""));
console.log("-".repeat(w2.reduce((a, b) => a + b, 0)));
for (const r of r2) {
  console.log([r.decada, n(r.n), n(r.cap_mediano), n(r.cap_p90), r.pct_porte_demais + "%"]
    .map((c, i) => String(c).padStart(w2[i])).join(""));
}
