// TAM operacional do Relay em educação básica no NE: quantas escolas são alvo real de origination.
// Funil: básica privada (CNAE 851/852, natureza empresarial 2xxx, ativa) → familiar (tem sócio PF)
// → perfil sucessório (sócio 61+ OU empresa 25+) → sucessão clássica (61+ E 25+). Snapshot atual.
// Por UF do NE. node --env-file=.env.local scripts/universo-educacao-ne.mjs
import { BigQuery } from "@google-cloud/bigquery";
import path from "path";
const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID, keyFilename: path.resolve(process.env.GCP_KEY_PATH) });
const NOVO = "2025-11-09";
const NE = "'BA','PE','CE','MA','PB','RN','AL','SE','PI'";

const sql = `
WITH sc AS (
  SELECT cnpj_basico, MAX(SAFE_CAST(faixa_etaria AS INT64)) AS mf, COUNTIF(tipo='2') AS n_pf
  FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${NOVO}' GROUP BY 1
),
base AS (
  SELECT e.sigla_uf AS uf, sc.mf AS mf, COALESCE(sc.n_pf,0) AS n_pf,
    (2025-EXTRACT(YEAR FROM e.data_inicio_atividade)) AS idade_emp
  FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e
  JOIN \`basedosdados.br_me_cnpj.empresas\` emp ON emp.cnpj_basico=e.cnpj_basico AND emp.data='${NOVO}'
  LEFT JOIN sc ON sc.cnpj_basico=e.cnpj_basico
  WHERE e.data='${NOVO}' AND e.sigla_uf IN (${NE}) AND e.identificador_matriz_filial='1'
    AND (e.cnae_fiscal_principal LIKE '851%' OR e.cnae_fiscal_principal LIKE '852%')
    AND e.situacao_cadastral='2'
    AND emp.natureza_juridica LIKE '2%'
)
SELECT uf,
  COUNT(*) AS privadas,
  COUNTIF(n_pf >= 1) AS familiares,
  COUNTIF(n_pf >= 1 AND (mf >= 7 OR idade_emp >= 25)) AS perfil_sucessorio,
  COUNTIF(n_pf >= 1 AND mf >= 7 AND idade_emp >= 25) AS sucessao_classica
FROM base GROUP BY uf ORDER BY perfil_sucessorio DESC`;

const [rows] = await bq.query({ query: sql, location: "US" });
const tot = rows.reduce((a, r) => ({
  privadas: a.privadas + Number(r.privadas), familiares: a.familiares + Number(r.familiares),
  perfil: a.perfil + Number(r.perfil_sucessorio), classica: a.classica + Number(r.sucessao_classica),
}), { privadas: 0, familiares: 0, perfil: 0, classica: 0 });

console.log(`Universo-alvo Relay — Educação básica privada no NE (snapshot ${NOVO})\n`);
console.log("UF    privadas  familiares  perfil-suc.  sucessão-clássica");
for (const r of rows) {
  console.log(`${r.uf}     ${String(r.privadas).padStart(6)}  ${String(r.familiares).padStart(9)}  ${String(r.perfil_sucessorio).padStart(10)}  ${String(r.sucessao_classica).padStart(15)}`);
}
console.log(`──────────────────────────────────────────────────────────`);
console.log(`TOTAL  ${String(tot.privadas).padStart(5)}  ${String(tot.familiares).padStart(9)}  ${String(tot.perfil).padStart(10)}  ${String(tot.classica).padStart(15)}`);
console.log(`\nFunil: ${tot.privadas} privadas → ${tot.familiares} familiares → ${tot.perfil} perfil sucessório → ${tot.classica} sucessão clássica (o núcleo quente).`);
