// Discovery pra Fase B da validação: snapshots históricos disponíveis + universo de saúde SP.
// Roda: node --env-file=.env.local scripts/check-saude-bq.mjs
import { BigQuery } from "@google-cloud/bigquery";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: path.resolve(ROOT, process.env.GCP_KEY_PATH),
});

// 1. Quais snapshots (datas) existem? Crítico pra evitar leakage na validação retroativa.
console.log("1. Snapshots disponíveis em br_me_cnpj.estabelecimentos:");
const [datas] = await bq.query({
  query: `SELECT DISTINCT data FROM \`basedosdados.br_me_cnpj.estabelecimentos\` ORDER BY data DESC LIMIT 30`,
  location: "US",
});
console.log("   " + datas.map((r) => (r.data?.value ?? r.data)).join(", "));

// 2. Universo de saúde SP (CNAE 86xx) ativas, no snapshot mais recente.
const SNAP = "2025-11-09";
console.log(`\n2. Universo de saúde SP (CNAE 86xx, ativas, matriz) no snapshot ${SNAP}:`);
const [[uni]] = await bq.query({
  query: `
    SELECT COUNT(*) AS n
    FROM \`basedosdados.br_me_cnpj.estabelecimentos\`
    WHERE data = '${SNAP}'
      AND cnae_fiscal_principal LIKE '86%'
      AND sigla_uf = 'SP'
      AND situacao_cadastral = '2'
      AND identificador_matriz_filial = '1'`,
  location: "US",
});
console.log(`   ${uni.n} estabelecimentos`);

// 3. Amostra de CNAEs 86xx pra entender a granularidade (hospital vs clínica vs lab).
console.log(`\n3. Top CNAEs 86xx em SP (ativas):`);
const [cnaes] = await bq.query({
  query: `
    SELECT e.cnae_fiscal_principal, c.descricao_subclasse, COUNT(*) AS n
    FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e
    LEFT JOIN \`basedosdados.br_bd_diretorios_brasil.cnae_2\` c ON c.subclasse = e.cnae_fiscal_principal
    WHERE e.data = '${SNAP}' AND e.cnae_fiscal_principal LIKE '86%'
      AND e.sigla_uf = 'SP' AND e.situacao_cadastral = '2'
    GROUP BY 1, 2 ORDER BY n DESC LIMIT 12`,
  location: "US",
});
for (const r of cnaes) console.log(`   ${r.cnae_fiscal_principal}  ${String(r.n).padStart(6)}  ${r.descricao_subclasse ?? ""}`);
