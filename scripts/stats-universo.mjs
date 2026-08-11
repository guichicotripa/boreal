/**
 * O funil do universo, do Brasil inteiro ate a lista que o produto entrega.
 *
 *   node --env-file=.env.local scripts/stats-universo.mjs
 *   node --env-file=.env.local scripts/stats-universo.mjs --json    # so o JSON, pro README
 *
 * DUAS RAZOES PRA ELE EXISTIR:
 *
 * 1. O README fala de "registro publico de empresas do Brasil inteiro" sem nunca dizer quantas
 *    empresas sao. Sem o numero, ninguem consegue julgar se 1,4 milhao de linhas na matriz de
 *    calibracao e muito ou pouco, nem quanto do pais o produto realmente cobre.
 *
 * 2. E teste de saude da base. As taxas de preenchimento aqui sao as mesmas de que o score
 *    depende: se `faixa_etaria` do socio vier vazia em metade das empresas, o eixo `idade_controle`
 *    esta cego em metade do universo, e isso nao aparece em nenhuma metrica de recall.
 *
 * Escreve `src/lib/stats-universo.json`, que e o que o README cita. Regerar quando entrar snapshot
 * novo, senao o numero envelhece em silencio.
 */
import { BigQuery } from "@google-cloud/bigquery";
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SO_JSON = process.argv.includes("--json");

const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: path.resolve(ROOT, process.env.GCP_KEY_PATH),
});

const SNAP = "2025-11-09";
const reg = JSON.parse(readFileSync(path.resolve(ROOT, "src/lib/setores.json"), "utf8"));
const likeDe = (s) => "(" + s.cnaes.map((p) => `cnae_fiscal_principal LIKE '${p}%'`).join(" OR ") + ")";
const filtroCnae = "(" + reg.setores.map(likeDe).join(" OR ") + ")";

/* Uma query so, com COUNTIF empilhado, em vez de uma por linha do funil: o custo do BigQuery e a
   varredura da particao, entao sete queries pequenas custariam sete varreduras. */
const sql = `
WITH est AS (
  SELECT cnpj_basico, identificador_matriz_filial AS mtz, situacao_cadastral AS sit,
         cnae_fiscal_principal, data_inicio_atividade, email, telefone_1
  FROM \`basedosdados.br_me_cnpj.estabelecimentos\` WHERE data = '${SNAP}'
),
soc AS (
  SELECT cnpj_basico,
    COUNTIF(tipo = '2') AS n_pf,
    COUNTIF(tipo = '1') AS n_pj,
    COUNTIF(tipo = '2' AND SAFE_CAST(faixa_etaria AS INT64) BETWEEN 1 AND 9) AS n_pf_com_idade,
    MAX(NULLIF(SAFE_CAST(faixa_etaria AS INT64), 0)) AS mf
  FROM \`basedosdados.br_me_cnpj.socios\` WHERE data = '${SNAP}' GROUP BY 1
),
emp AS (
  SELECT cnpj_basico, SAFE_CAST(capital_social AS FLOAT64) AS capital, porte
  FROM \`basedosdados.br_me_cnpj.empresas\` WHERE data = '${SNAP}'
),
j AS (
  SELECT est.*, emp.capital, emp.porte,
         COALESCE(soc.n_pf, 0) AS n_pf, COALESCE(soc.n_pj, 0) AS n_pj,
         COALESCE(soc.n_pf_com_idade, 0) AS n_pf_com_idade, COALESCE(soc.mf, 0) AS mf,
         DATE_DIFF(DATE('${SNAP}'), est.data_inicio_atividade, YEAR) AS anos_emp,
         (soc.cnpj_basico IS NOT NULL) AS tem_quadro
  FROM est LEFT JOIN soc USING(cnpj_basico) LEFT JOIN emp USING(cnpj_basico)
)
SELECT
  COUNT(*)                                                    AS estabelecimentos_total,
  COUNTIF(mtz = '1')                                          AS empresas_total,
  COUNTIF(mtz = '1' AND sit = '2')                            AS empresas_ativas,
  COUNTIF(mtz = '1' AND sit = '8')                            AS empresas_baixadas,
  COUNTIF(mtz = '1' AND sit IN ('3','4'))                     AS empresas_suspensas_inaptas,
  COUNTIF(mtz = '1' AND sit = '2' AND ${filtroCnae})          AS nos_4_setores,
  COUNTIF(mtz = '1' AND sit = '2' AND ${filtroCnae} AND tem_quadro)     AS com_quadro,
  COUNTIF(mtz = '1' AND sit = '2' AND ${filtroCnae} AND n_pf >= 1)      AS com_socio_pf,
  COUNTIF(mtz = '1' AND sit = '2' AND ${filtroCnae} AND n_pf >= 2)      AS com_2mais_pf,
  COUNTIF(mtz = '1' AND sit = '2' AND ${filtroCnae} AND n_pf_com_idade >= 1) AS com_idade_de_socio,
  COUNTIF(mtz = '1' AND sit = '2' AND ${filtroCnae} AND capital > 0)    AS com_capital,
  COUNTIF(mtz = '1' AND sit = '2' AND ${filtroCnae} AND email IS NOT NULL AND email != '') AS com_email,
  COUNTIF(mtz = '1' AND sit = '2' AND ${filtroCnae} AND telefone_1 IS NOT NULL AND telefone_1 != '') AS com_telefone,
  COUNTIF(mtz = '1' AND sit = '2' AND ${filtroCnae} AND mf >= 7 AND anos_emp >= 25) AS perfil_sucessorio,
  COUNTIF(mtz = '1' AND sit = '2' AND ${filtroCnae} AND mf >= 7 AND anos_emp >= 25 AND n_pf >= 2) AS perfil_e_elegivel
FROM j`;

/* Mesma base, quebrada por setor. Roda no MESMO snapshot que o funil de propósito: misturar o
   total de 2025 com a quebra de 2023 num README faz as linhas não fecharem e ninguém confia mais
   em nenhuma delas. */
const caseVertical = "CASE " + reg.setores.map((s) => `WHEN ${likeDe(s)} THEN '${s.id}'`).join(" ") + " END";
const sqlSetor = `
WITH est AS (
  SELECT cnpj_basico, ${caseVertical} AS setor, data_inicio_atividade
  FROM \`basedosdados.br_me_cnpj.estabelecimentos\`
  WHERE data = '${SNAP}' AND identificador_matriz_filial = '1' AND situacao_cadastral = '2'
    AND ${filtroCnae}
),
soc AS (
  SELECT cnpj_basico, COUNTIF(tipo = '2') AS n_pf,
         MAX(NULLIF(SAFE_CAST(faixa_etaria AS INT64), 0)) AS mf
  FROM \`basedosdados.br_me_cnpj.socios\` WHERE data = '${SNAP}' GROUP BY 1
)
SELECT est.setor,
  COUNT(*) AS universo,
  COUNTIF(soc.mf IS NOT NULL) AS com_idade_de_socio,
  COUNTIF(COALESCE(soc.n_pf, 0) >= 2) AS com_2mais_pf,
  COUNTIF(soc.mf >= 7 AND DATE_DIFF(DATE('${SNAP}'), est.data_inicio_atividade, YEAR) >= 25) AS perfil
FROM est LEFT JOIN soc USING(cnpj_basico)
WHERE est.setor IS NOT NULL GROUP BY 1 ORDER BY universo DESC`;

if (!SO_JSON) console.log(`snapshot ${SNAP} · setores: ${reg.setores.map((s) => s.id).join(", ")}\nconsultando...\n`);
const [[rows], [rowsSetor]] = await Promise.all([
  bq.query({ query: sql, location: "US" }),
  bq.query({ query: sqlSetor, location: "US" }),
]);
const r = Object.fromEntries(Object.entries(rows[0]).map(([k, v]) => [k, Number(v)]));
const porSetor = rowsSetor.map((x) => Object.fromEntries(
  Object.entries(x).map(([k, v]) => [k, k === "setor" ? v : Number(v)])));

const saida = {
  gerado_em: new Date().toISOString().slice(0, 10),
  snapshot: SNAP,
  fonte: "basedosdados.br_me_cnpj (Receita Federal)",
  script: "scripts/stats-universo.mjs",
  setores: reg.setores.map((s) => s.id),
  ...r,
  por_setor: porSetor,
};
writeFileSync(path.resolve(ROOT, "src/lib/stats-universo.json"), JSON.stringify(saida, null, 2) + "\n");

if (SO_JSON) { console.log(JSON.stringify(saida, null, 2)); process.exit(0); }

const n = (v) => v.toLocaleString("pt-BR");
const pct = (a, b) => (b ? (a / b * 100).toFixed(1) + "%" : "-");

console.log("FUNIL DO UNIVERSO");
console.log("-".repeat(74));
const funil = [
  ["Estabelecimentos no registro (matriz + filial)", r.estabelecimentos_total, null],
  ["Empresas (só matriz)", r.empresas_total, r.estabelecimentos_total],
  ["  ativas", r.empresas_ativas, r.empresas_total],
  ["  baixadas", r.empresas_baixadas, r.empresas_total],
  ["  suspensas ou inaptas", r.empresas_suspensas_inaptas, r.empresas_total],
  ["Ativas nos 4 setores do Boreal", r.nos_4_setores, r.empresas_ativas],
];
for (const [rot, v, base] of funil)
  console.log(`${rot.padEnd(48)}${n(v).padStart(14)}${(base ? pct(v, base) : "").padStart(10)}`);

console.log("\nSAUDE DA BASE, dentro dos 4 setores ativos");
console.log("-".repeat(74));
const saude = [
  ["tem quadro societário registrado", r.com_quadro],
  ["tem ao menos 1 sócio pessoa física", r.com_socio_pf],
  ["tem 2 ou mais sócios PF (label consegue ver)", r.com_2mais_pf],
  ["tem faixa etária de algum sócio PF", r.com_idade_de_socio],
  ["tem capital social > 0", r.com_capital],
  ["tem telefone", r.com_telefone],
  ["tem e-mail", r.com_email],
];
for (const [rot, v] of saude)
  console.log(`${rot.padEnd(48)}${n(v).padStart(14)}${pct(v, r.nos_4_setores).padStart(10)}`);

console.log("\nO QUE O ALGORITMO SELECIONA");
console.log("-".repeat(74));
console.log(`${"perfil sucessório (sócio 61+ e empresa 25+)".padEnd(48)}${n(r.perfil_sucessorio).padStart(14)}${pct(r.perfil_sucessorio, r.nos_4_setores).padStart(10)}`);
console.log(`${"  destas, com 2+ sócios PF".padEnd(48)}${n(r.perfil_e_elegivel).padStart(14)}${pct(r.perfil_e_elegivel, r.perfil_sucessorio).padStart(10)}`);

console.log("\nPOR SETOR (mesmo snapshot)");
console.log("-".repeat(74));
console.log("setor".padEnd(12) + "universo".padStart(12) + "c/ idade".padStart(12) + "%".padStart(8) + "2+ PF".padStart(12) + "perfil".padStart(10));
for (const d of porSetor)
  console.log(String(d.setor).padEnd(12) + n(d.universo).padStart(12) + n(d.com_idade_de_socio).padStart(12) +
    pct(d.com_idade_de_socio, d.universo).padStart(8) + n(d.com_2mais_pf).padStart(12) + n(d.perfil).padStart(10));
console.log("\nok: src/lib/stats-universo.json");
