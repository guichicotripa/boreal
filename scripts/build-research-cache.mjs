// Pré-investiga o top 3 de cada query-demo e salva em src/lib/research-cache.json.
// Assim o clique "Investigar com IA" é instantâneo nos demos do Loom.
// Pré-requisito: dev server em localhost:3000. Roda: node scripts/build-research-cache.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEMO = path.resolve(__dirname, "../src/lib/demo-cache.json");
const OUT = path.resolve(__dirname, "../src/lib/research-cache.json");

const demoCache = JSON.parse(fs.readFileSync(DEMO, "utf8"));

// Coleta os top 3 empresaIds de cada query (dedupe — PRENSA aparece em várias).
const ids = new Map(); // id -> razao_social
for (const resp of Object.values(demoCache)) {
  for (const e of (resp.empresas ?? []).slice(0, 3)) {
    if (!ids.has(e.id)) ids.set(e.id, e.razao_social);
  }
}
console.log(`${ids.size} empresas únicas no top 3 dos demos\n`);

const cache = {};
let i = 0;
for (const [id, nome] of ids) {
  i++;
  process.stdout.write(`[${i}/${ids.size}] ${nome.slice(0, 35)} … `);
  const start = Date.now();
  const r = await fetch("http://localhost:3000/api/research?fresh=1", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ empresaId: id }),
  });
  const d = await r.json();
  if (!r.ok || d.error) {
    console.log(`FALHOU (${d.error ?? r.status})`);
    continue;
  }
  cache[id] = d.research;
  const res = d.research;
  console.log(`${((Date.now() - start) / 1000).toFixed(0)}s · v${res.score_v0}→${res.score_v1} · ${res.sinais.length} sinais`);
}

fs.writeFileSync(OUT, JSON.stringify(cache, null, 2));
console.log(`\n✓ Cache de research salvo: ${Object.keys(cache).length} empresas em ${path.relative(process.cwd(), OUT)}`);
