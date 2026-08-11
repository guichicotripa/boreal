/**
 * Sondagem dos setores que a Setter pediu pro piloto (11/08/2026), ANTES de prometer qualquer
 * coisa na call de quinta.
 *
 *   node --env-file=.env.local scripts/sonda-setores-setter.mjs --schema
 *   node --env-file=.env.local scripts/sonda-setores-setter.mjs --dry
 *   node --env-file=.env.local scripts/sonda-setores-setter.mjs
 *
 * PERGUNTA QUE ELA RESPONDE: os dois focos do Henrique sao setor ou sao mandato?
 *   foco A = laboratorio de diagnostico veterinario
 *   foco B = operadora de plano de saude pet
 *
 * Nenhum dos dois tem CNAE proprio: os dois caem dentro de 7500-1/00 (atividades veterinarias),
 * junto com clinica de bairro, consultorio e vacinacao. Entao a sondagem faz duas coisas:
 *   1. mede o universo dos CNAEs candidatos (7500 veterinaria, 9603 death care, 65111 plano funeral)
 *   2. recorta DENTRO deles por razao social, que e o unico proxy de registro pro sub-setor
 *
 * Tambem conta aquisicoes detectaveis pelo mesmo proxy da validacao (entra socio PJ e sai socio PF
 * entre os dois snapshots), pra saber se o setor sustenta um recall proprio ou se o enquadramento
 * honesto e so descoberta. ATENCAO: esse label e o mesmo que a calibracao de 02/08 mostrou ser cego
 * pra empresa de socio unico, entao a coluna `elegivel` (>= 2 socios PF) e a que vale pra decidir.
 */
import { BigQuery } from "@google-cloud/bigquery";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const args = process.argv.slice(2);

const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: path.resolve(ROOT, process.env.GCP_KEY_PATH),
});

const CORTE = "2023-06-10";
const NOVO = "2025-11-09";

if (args.includes("--schema")) {
  for (const t of ["empresas", "estabelecimentos"]) {
    const q = `SELECT column_name FROM \`basedosdados.br_me_cnpj.INFORMATION_SCHEMA.COLUMNS\` WHERE table_name = '${t}' ORDER BY ordinal_position`;
    const [rows] = await bq.query({ query: q, location: "US" });
    console.log(`=== ${t}\n${rows.map((r) => r.column_name).join(", ")}\n`);
  }
  process.exit(0);
}

/* Razao social e nome fantasia vem com acento e em caixa mista. NORMALIZE(NFD) separa a letra
   do acento e o REGEXP_REPLACE joga fora a marca diacritica, entao 'Análises' vira 'ANALISES'
   e um unico padrao casa as duas grafias. Sem isso, procurar por 'DIAGNOSTICO' perde
   'DIAGNÓSTICO', que e como a maioria escreve. */
const NOME_NORM = `REGEXP_REPLACE(NORMALIZE(UPPER(CONCAT(
    COALESCE(emp.razao_social, ''), ' ', COALESCE(e.nome_fantasia, ''))), NFD), r'\\pM', '')`;

const RX_LAB = `'LABORAT|DIAGNOSTIC|PATOLOG|ANALISES CLINICAS|ANALISES VET|CITOPATOL|HEMATOLOG'`;
const RX_PLANO = `'PLANO|ASSISTENCIA|SAUDE ANIMAL|SAUDE PET|OPERADORA'`;
const RX_PET = `'\\\\bPET\\\\b|ANIMAL|VETERINARI|\\\\bVET\\\\b|\\\\bPETS\\\\b'`;

/* Os grupos sao avaliados em ordem e a empresa cai no PRIMEIRO que casar, pra que
   `A_vet_lab` e `B_vet_plano` nao sejam contados de novo dentro de `vet_outros`. */
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
  SELECT cnpj_basico,
    MAX(NULLIF(SAFE_CAST(faixa_etaria AS INT64), 0)) AS mf,
    COUNTIF(tipo = '2') AS n_pf,
    COUNTIF(tipo = '1') AS n_pj
  FROM \`basedosdados.br_me_cnpj.socios\` WHERE data = '${CORTE}' GROUP BY 1
),
b AS (
  SELECT cnpj_basico, COUNTIF(tipo = '1') AS pj, COUNTIF(tipo = '2') AS pf
  FROM \`basedosdados.br_me_cnpj.socios\` WHERE data = '${NOVO}' GROUP BY 1
),
cru AS (
  SELECT
    e.cnpj_basico,
    e.cnae_fiscal_principal AS cnae,
    ${NOME_NORM}         AS nome,
    e.sigla_uf,
    COALESCE(sc.mf, 0)   AS mf,
    COALESCE(sc.n_pf, 0) AS n_pf,
    COALESCE(sc.n_pj, 0) AS n_pj,
    DATE_DIFF(DATE('${CORTE}'), e.data_inicio_atividade, YEAR) AS anos_emp,
    SAFE_CAST(emp.capital_social AS FLOAT64) AS capital,
    IF(b.cnpj_basico IS NULL, -1, b.pf) AS pf_novo,
    IF(b.cnpj_basico IS NULL, -1, b.pj) AS pj_novo
  FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e
  JOIN \`basedosdados.br_me_cnpj.empresas\` emp
    ON emp.cnpj_basico = e.cnpj_basico AND emp.data = '${CORTE}'
  LEFT JOIN sc ON sc.cnpj_basico = e.cnpj_basico
  LEFT JOIN b  ON b.cnpj_basico  = e.cnpj_basico
  WHERE e.data = '${CORTE}'
    AND e.identificador_matriz_filial = '1'
    AND e.situacao_cadastral = '2'
    AND ${FILTRO}
),
base AS (SELECT *, ${GRUPOS} AS grupo FROM cru)
SELECT
  grupo,
  COUNT(*)                                                        AS universo,
  COUNTIF(sigla_uf = 'SP')                                        AS universo_sp,
  COUNTIF(mf >= 7 AND anos_emp >= 25)                             AS perfil_sucessorio,
  COUNTIF(n_pf >= 2)                                              AS elegivel,
  APPROX_QUANTILES(capital, 100)[OFFSET(50)]                      AS capital_mediano,
  COUNTIF(pf_novo >= 0 AND pj_novo > n_pj AND pf_novo < n_pf)     AS adq,
  COUNTIF(pf_novo >= 0 AND pj_novo > n_pj AND pf_novo < n_pf
          AND n_pf >= 2)                                          AS adq_elegivel,
  COUNTIF(pf_novo >= 0 AND pj_novo > n_pj AND pf_novo < n_pf
          AND mf >= 7 AND anos_emp >= 25)                         AS adq_perfil
FROM base
WHERE grupo IS NOT NULL
GROUP BY grupo
ORDER BY universo DESC`;

if (args.includes("--dry")) {
  const [job] = await bq.createQueryJob({ query: sql, location: "US", dryRun: true });
  // O dry run valida a SQL, mas este dataset publico nao devolve totalBytesProcessed no
  // statistics do job, entao nao da pra estimar custo por aqui. Serve como checagem de sintaxe.
  const st = job.metadata.statistics ?? {};
  const bytes = Number(st.totalBytesProcessed ?? st.query?.totalBytesProcessed ?? 0);
  console.log(bytes ? `dry run: ${(bytes / 1024 ** 3).toFixed(2)} GB` : "SQL valida. Bytes nao reportados por este dataset.");
  process.exit(0);
}

console.log(`corte ${CORTE} → desfecho ${NOVO}\nconsultando...\n`);
const [rows] = await bq.query({ query: sql, location: "US" });

const n = (v) => Number(v ?? 0).toLocaleString("pt-BR");
const cab = ["grupo", "universo", "SP", "perfil", "elegivel", "cap.mediano", "adq", "adq eleg", "adq perfil"];
const larg = [22, 10, 9, 9, 10, 13, 7, 9, 11];
console.log(cab.map((c, i) => c.padStart(larg[i])).join(""));
console.log("-".repeat(larg.reduce((a, b) => a + b, 0)));
for (const r of rows) {
  const v = [r.grupo, n(r.universo), n(r.universo_sp), n(r.perfil_sucessorio), n(r.elegivel),
             r.capital_mediano == null ? "?" : n(Math.round(r.capital_mediano)),
             n(r.adq), n(r.adq_elegivel), n(r.adq_perfil)];
  console.log(v.map((c, i) => String(c).padStart(larg[i])).join(""));
}

console.log(`\nreferencia: metalmec 250.845 empresas / 211 adq · saude 531.119 / 894 · educacao 64.914 / 59`);
