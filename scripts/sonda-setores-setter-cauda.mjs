/**
 * Segunda passada da sondagem dos setores da Setter: TAMANHO, nao contagem.
 *
 *   node --env-file=.env.local scripts/sonda-setores-setter-cauda.mjs
 *
 * A primeira passada (sonda-setores-setter.mjs) devolveu capital mediano de R$10k a R$20k nos
 * quatro grupos, ou seja, universo dominado por micro. Contagem de universo nao decide nada se
 * quase tudo estiver abaixo do tamanho de mandato de uma boutique. Esta query mede a CAUDA:
 * quantas empresas por grupo passam de R$1 mi, R$5 mi e R$20 mi de capital social, e quais sao
 * as maiores pelo nome, pra dar com o que sanity-check na call.
 *
 * RESSALVA QUE VALE REPETIR: capital social e declarado na constituicao e frequentemente nunca
 * atualizado, entao ele SUBESTIMA empresa antiga. E o proxy de tamanho mais forte que existe hoje
 * (lift 3,80x) e ao mesmo tempo o mais sujo. Ver `pending.md`, item "proxy limpo de tamanho".
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

const NOME_NORM = `REGEXP_REPLACE(NORMALIZE(UPPER(CONCAT(
    COALESCE(emp.razao_social, ''), ' ', COALESCE(e.nome_fantasia, ''))), NFD), r'\\pM', '')`;

const RX_LAB = `'LABORAT|DIAGNOSTIC|PATOLOG|ANALISES CLINICAS|ANALISES VET|CITOPATOL|HEMATOLOG'`;
const RX_PLANO = `'PLANO|ASSISTENCIA|SAUDE ANIMAL|SAUDE PET|OPERADORA'`;
const RX_PET = `'\\\\bPET\\\\b|ANIMAL|VETERINARI|\\\\bVET\\\\b|\\\\bPETS\\\\b'`;

const GRUPOS = `
  CASE
    WHEN cnae LIKE '7500%' AND REGEXP_CONTAINS(nome, ${RX_LAB})   THEN 'A_vet_lab'
    WHEN cnae LIKE '8640%' AND REGEXP_CONTAINS(nome, ${RX_PET})   THEN 'A_lab_vet_em_8640'
    WHEN cnae LIKE '7500%' AND REGEXP_CONTAINS(nome, ${RX_PLANO}) THEN 'B_vet_plano'
    WHEN (cnae LIKE '6550%' OR cnae LIKE '6512%')
         AND REGEXP_CONTAINS(nome, ${RX_PET})                     THEN 'B_plano_pet_seguro'
    WHEN cnae LIKE '7500%'                                        THEN 'vet_outros'
    WHEN cnae LIKE '9603%'                                        THEN 'death_care'
    WHEN cnae LIKE '65111%'                                       THEN 'plano_funeral'
  END`;

const FILTRO = `(e.cnae_fiscal_principal LIKE '7500%'
   OR e.cnae_fiscal_principal LIKE '9603%'
   OR e.cnae_fiscal_principal LIKE '65111%'
   OR e.cnae_fiscal_principal LIKE '6550%'
   OR e.cnae_fiscal_principal LIKE '6512%'
   OR e.cnae_fiscal_principal LIKE '8640%')`;

const sql = `
WITH sc AS (
  SELECT cnpj_basico, MAX(NULLIF(SAFE_CAST(faixa_etaria AS INT64), 0)) AS mf, COUNTIF(tipo='2') AS n_pf
  FROM \`basedosdados.br_me_cnpj.socios\` WHERE data = '${CORTE}' GROUP BY 1
),
cru AS (
  SELECT
    e.cnpj_basico, e.cnae_fiscal_principal AS cnae, ${NOME_NORM} AS nome,
    e.sigla_uf, COALESCE(sc.mf, 0) AS mf, COALESCE(sc.n_pf, 0) AS n_pf,
    DATE_DIFF(DATE('${CORTE}'), e.data_inicio_atividade, YEAR) AS anos_emp,
    COALESCE(SAFE_CAST(emp.capital_social AS FLOAT64), 0) AS capital
  FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e
  JOIN \`basedosdados.br_me_cnpj.empresas\` emp
    ON emp.cnpj_basico = e.cnpj_basico AND emp.data = '${CORTE}'
  LEFT JOIN sc ON sc.cnpj_basico = e.cnpj_basico
  WHERE e.data = '${CORTE}' AND e.identificador_matriz_filial = '1'
    AND e.situacao_cadastral = '2' AND ${FILTRO}
),
base AS (SELECT *, ${GRUPOS} AS grupo FROM cru)
SELECT
  grupo,
  COUNT(*)                                    AS n,
  COUNTIF(capital >= 1000000)                 AS cap_1mi,
  COUNTIF(capital >= 5000000)                 AS cap_5mi,
  COUNTIF(capital >= 20000000)                AS cap_20mi,
  COUNTIF(capital >= 1000000 AND mf >= 7 AND anos_emp >= 25) AS cap_1mi_perfil,
  APPROX_QUANTILES(capital, 100)[OFFSET(90)]  AS p90,
  APPROX_QUANTILES(capital, 100)[OFFSET(99)]  AS p99
FROM base WHERE grupo IS NOT NULL
GROUP BY grupo ORDER BY cap_1mi DESC`;

console.log(`corte ${CORTE}\nconsultando cauda de tamanho...\n`);
const [rows] = await bq.query({ query: sql, location: "US" });

const n = (v) => Math.round(Number(v ?? 0)).toLocaleString("pt-BR");
const cab = ["grupo", "n", ">=1mi", ">=5mi", ">=20mi", ">=1mi+perfil", "p90", "p99"];
const larg = [22, 9, 8, 8, 9, 14, 12, 14];
console.log(cab.map((c, i) => c.padStart(larg[i])).join(""));
console.log("-".repeat(larg.reduce((a, b) => a + b, 0)));
for (const r of rows) {
  const v = [r.grupo, n(r.n), n(r.cap_1mi), n(r.cap_5mi), n(r.cap_20mi), n(r.cap_1mi_perfil), n(r.p90), n(r.p99)];
  console.log(v.map((c, i) => String(c).padStart(larg[i])).join(""));
}
