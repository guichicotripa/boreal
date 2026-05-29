/**
 * Pré-computa os resultados das queries-demo e salva em src/lib/demo-cache.json.
 * A rota /api/search serve esses resultados instantaneamente (demo do Loom sem espera).
 *
 * Pré-requisito: dev server rodando em localhost:3000.
 * Roda: node scripts/build-demo-cache.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../src/lib/demo-cache.json");

// As queries que aparecem como chips de exemplo na home (devem casar exatamente).
const QUERIES = [
  "metalmecânica no interior de SP com sócios acima de 60 anos",
  "fabricantes de máquinas e equipamentos fundados antes de 1990",
  "fabricantes de máquinas no interior de SP",
];

// MESMA normalização da rota (lib/search) — lowercase, sem acento, espaços colapsados.
function normalizeQuery(q) {
  return q
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const cache = {};
for (const q of QUERIES) {
  process.stdout.write(`Computando: "${q}" … `);
  const start = Date.now();
  const r = await fetch("http://localhost:3000/api/search?fresh=1", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: q }),
  });
  if (!r.ok) {
    console.error(`FALHOU (${r.status})`);
    process.exit(1);
  }
  const data = await r.json();
  // Remove a flag de runtime; o cache guarda o payload limpo.
  delete data.cached;
  cache[normalizeQuery(q)] = data;
  console.log(`${((Date.now() - start) / 1000).toFixed(1)}s · ${data.count} empresas · ${data.reasonedCount ?? 0} com insight`);
}

fs.writeFileSync(OUT, JSON.stringify(cache, null, 2));
console.log(`\n✓ Cache salvo em ${path.relative(process.cwd(), OUT)} (${QUERIES.length} queries)`);
