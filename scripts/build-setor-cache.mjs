// Pré-computa o browse de cada setor (com reasoner) e salva em src/lib/setor-cache.json.
// Assim "buscar neste setor" é instantâneo no demo (saúde/educação ficam como o metalmec, que já
// é cacheado). Mesmo padrão do build-research-cache: bate no dev server local.
// Pré-requisito: dev server em localhost:3000. Roda: node scripts/build-setor-cache.mjs
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const reg = JSON.parse(readFileSync(path.resolve(ROOT, "src/lib/setores.json"), "utf8"));

const porSetor = {};
for (const s of reg.setores) {
  process.stdout.write(`  ${s.id}… `);
  const r = await fetch("http://localhost:3000/api/search?fresh=1", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ setor: s.id }),
  });
  const data = await r.json();
  if (!r.ok) {
    console.log(`FALHOU: ${data.error}`);
    continue;
  }
  // não guarda o flag `cached`; ele é setado na hora de servir
  delete data.cached;
  porSetor[s.id] = data;
  console.log(`${data.count} empresas · ${data.reasonedCount ?? 0} com insight`);
}

writeFileSync(
  path.resolve(ROOT, "src/lib/setor-cache.json"),
  JSON.stringify({ gerado_em: new Date().toISOString().slice(0, 10), porSetor }, null, 2) + "\n",
  "utf8"
);
console.log(`\n✓ src/lib/setor-cache.json — ${Object.keys(porSetor).length} setores`);
