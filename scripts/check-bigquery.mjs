/**
 * Smoke test + discovery final para br_me_cnpj.
 * Roda: node --env-file=.env.local scripts/check-bigquery.mjs
 *
 * Valores de situacao_cadastral: 1=Nula 2=Ativa 3=Suspensa 4=Inapta 8=Baixada
 * UF: sigla_uf (ex: 'SP')
 * Snapshot mais recente: 2025-11-09
 */
import { BigQuery } from "@google-cloud/bigquery";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const keyFilename = path.resolve(projectRoot, process.env.GCP_KEY_PATH);
const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID, keyFilename });

const SNAPSHOT = "2025-11-09";

// ── Contagem: CNAE 24/25/28, SP, ATIVA ────────────────────────────────────────
console.log("── Empresas ATIVAS, CNAE 24/25/28, SP:");
const [countRows] = await bq.query({
  query: `
    SELECT COUNT(*) AS total
    FROM \`basedosdados.br_me_cnpj.estabelecimentos\`
    WHERE data = '${SNAPSHOT}'
      AND (cnae_fiscal_principal LIKE '24%'
        OR cnae_fiscal_principal LIKE '25%'
        OR cnae_fiscal_principal LIKE '28%')
      AND sigla_uf = 'SP'
      AND situacao_cadastral = '2'
  `,
  location: "US",
});
console.table(countRows);

// ── Amostra 5 linhas ──────────────────────────────────────────────────────────
console.log("── Amostra (5 linhas):");
const [rows] = await bq.query({
  query: `
    SELECT
      e.cnpj,
      emp.razao_social,
      e.nome_fantasia,
      e.cnae_fiscal_principal,
      e.data_inicio_atividade,
      e.sigla_uf,
      e.id_municipio,
      e.email,
      CONCAT(COALESCE(e.ddd_1,''), COALESCE(e.telefone_1,'')) AS telefone,
      emp.capital_social,
      emp.porte
    FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e
    JOIN \`basedosdados.br_me_cnpj.empresas\` emp
      ON emp.cnpj_basico = e.cnpj_basico AND emp.data = '${SNAPSHOT}'
    WHERE
      e.data = '${SNAPSHOT}'
      AND (e.cnae_fiscal_principal LIKE '24%'
        OR e.cnae_fiscal_principal LIKE '25%'
        OR e.cnae_fiscal_principal LIKE '28%')
      AND e.sigla_uf = 'SP'
      AND e.situacao_cadastral = '2'
    LIMIT 5
  `,
  location: "US",
});
console.log(JSON.stringify(rows, null, 2));

// ── Sócios da primeira empresa ────────────────────────────────────────────────
if (rows.length > 0) {
  const cnpjBasico = String(rows[0].cnpj).slice(0, 8);
  console.log(`\n── Sócios do CNPJ básico ${cnpjBasico}:`);
  const [socioRows] = await bq.query({
    query: `
      SELECT nome, qualificacao, data_entrada_sociedade, faixa_etaria
      FROM \`basedosdados.br_me_cnpj.socios\`
      WHERE cnpj_basico = '${cnpjBasico}' AND data = '${SNAPSHOT}'
    `,
    location: "US",
  });
  console.log(JSON.stringify(socioRows, null, 2));
}

console.log("\n✓ BigQuery OK.");
