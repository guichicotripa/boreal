/**
 * Descoberta: confirma quais tabelas de lookup existem no BigQuery (basedosdados)
 * para resolver código → nome de município, CNAE e natureza jurídica.
 * Roda: node --env-file=.env.local scripts/check-lookups.mjs
 */
import { BigQuery } from "@google-cloud/bigquery";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const { GCP_PROJECT_ID, GCP_KEY_PATH } = process.env;

const bq = new BigQuery({
  projectId: GCP_PROJECT_ID,
  keyFilename: path.resolve(ROOT, GCP_KEY_PATH),
});

async function tryQuery(label, sql) {
  try {
    const [rows] = await bq.query({ query: sql, location: "US" });
    console.log(`\n✓ ${label}`);
    console.table(rows);
    return true;
  } catch (e) {
    console.log(`\n✗ ${label}\n   ${e.message.split("\n")[0]}`);
    return false;
  }
}

// Município: id_municipio (7 díg IBGE) → nome
await tryQuery(
  "MUNICÍPIO — br_bd_diretorios_brasil.municipio",
  `SELECT id_municipio, nome FROM \`basedosdados.br_bd_diretorios_brasil.municipio\`
   WHERE id_municipio IN ('3504107','3543402','3518800') LIMIT 5`
);

// CNAE: tabela de subclasses (7 dígitos)
await tryQuery(
  "CNAE — br_bd_diretorios_brasil.cnae_2",
  `SELECT * FROM \`basedosdados.br_bd_diretorios_brasil.cnae_2\` LIMIT 3`
);

// Natureza jurídica
await tryQuery(
  "NATUREZA JURÍDICA — br_bd_diretorios_brasil.natureza_juridica",
  `SELECT * FROM \`basedosdados.br_bd_diretorios_brasil.natureza_juridica\` LIMIT 3`
);

// Dicionário interno do br_me_cnpj (fallback)
await tryQuery(
  "DICIONÁRIO — br_me_cnpj.dicionario (amostra de chaves)",
  `SELECT DISTINCT nome_coluna FROM \`basedosdados.br_me_cnpj.dicionario\` LIMIT 20`
);

console.log("\n— fim da descoberta —");
