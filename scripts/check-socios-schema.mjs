// Discovery: colunas da tabela socios + como distinguir PF/PJ. Pré-requisito pra detectar
// transições societárias (M&A/sucessão) entre snapshots.
// Roda: node --env-file=.env.local scripts/check-socios-schema.mjs
import { BigQuery } from "@google-cloud/bigquery";
import path from "path";

const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: path.resolve(process.env.GCP_KEY_PATH),
});

// Amostra de sócios de uma empresa qualquer pra ver as colunas disponíveis.
const [rows] = await bq.query({
  query: `SELECT * FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='2025-11-09' LIMIT 5`,
  location: "US",
});
console.log("Colunas:", Object.keys(rows[0]).join(", "));
console.log("\nAmostra:");
for (const r of rows) console.log(JSON.stringify(r));

// Valores distintos de qualquer coluna que pareça identificar tipo de sócio (PF/PJ).
const [tipos] = await bq.query({
  query: `SELECT tipo, COUNT(*) n FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='2025-11-09' GROUP BY tipo ORDER BY n DESC LIMIT 10`,
  location: "US",
}).catch(() => [[]]);
if (tipos.length) {
  console.log("\nValores de `tipo`:");
  for (const t of tipos) console.log(`  ${t.tipo}: ${t.n}`);
}
