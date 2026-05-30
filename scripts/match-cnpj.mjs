// Ponte entre ground truth e validação: pra cada empresa adquirida (nome), busca candidatos
// de CNPJ no BigQuery (universo de saúde SP). Output pra revisão manual antes de validar.
// Roda: node --env-file=.env.local scripts/match-cnpj.mjs
import { BigQuery } from "@google-cloud/bigquery";
import path from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: path.resolve(ROOT, process.env.GCP_KEY_PATH),
});

const SNAP = "2025-11-09"; // snapshot atual só pra localizar o CNPJ (matching, não scoring)
const STOP = new Set([
  "hospital", "clinica", "clínica", "laboratorio", "laboratório", "instituto", "centro",
  "medico", "médico", "medica", "médica", "saude", "saúde", "ltda", "sa", "s", "a", "de", "da",
  "do", "e", "diagnostico", "diagnóstico", "oncologia", "analises", "análises", "clinicas",
]);

const { deals } = JSON.parse(
  readFileSync(path.resolve(__dirname, "ground-truth-saude-recente.json"), "utf8")
);

function keywords(nome) {
  return nome
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

console.log(`Matching ${deals.length} deals → CNPJ no BigQuery\n`);

for (const d of deals) {
  const kws = keywords(d.adquirida);
  if (kws.length === 0) {
    console.log(`\n■ ${d.adquirida} (${d.ano}) — sem keyword útil, pular`);
    continue;
  }
  // Razão social contém TODAS as keywords principais (até 2 primeiras pra não ser restritivo demais)
  const conds = kws.slice(0, 2).map((k) => `LOWER(emp.razao_social) LIKE '%${k}%'`).join(" AND ");
  const [rows] = await bq.query({
    query: `
      SELECT DISTINCT e.cnpj_basico, emp.razao_social, e.id_municipio
      FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e
      JOIN \`basedosdados.br_me_cnpj.empresas\` emp
        ON emp.cnpj_basico = e.cnpj_basico AND emp.data = '${SNAP}'
      WHERE e.data = '${SNAP}' AND e.sigla_uf = 'SP'
        AND e.cnae_fiscal_principal LIKE '86%'
        AND ${conds}
      LIMIT 6`,
    location: "US",
  });
  console.log(`\n■ ${d.adquirida} (${d.ano}, ${d.cidade}) — keywords: [${kws.slice(0, 2).join(", ")}]`);
  if (rows.length === 0) {
    console.log(`   (nenhum candidato — pode ter sido baixada após o deal, ou nome muito diferente)`);
  } else {
    for (const r of rows) console.log(`   ${r.cnpj_basico}  ${r.razao_social}`);
  }
}
console.log(`\n→ Revisar candidatos, montar scripts/alvos-validacao.json com os confirmados.`);
