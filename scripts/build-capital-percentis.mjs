// Gera src/lib/capital-percentis.json — os cortes de capital social por vertical.
//
// O eixo de escala do score usa PERCENTIL dentro do setor, não valor absoluto: capital social é
// nominal e a escala muda por setor, então comparar uma metalúrgica com uma clínica pelo valor
// bruto transformaria o score num ranking de setor rico contra setor pobre. A validação
// (scripts/validacao-score-v1.mjs) foi feita com percentil e é ele que tem que rodar em produção.
//
// Os cortes saem da PRÓPRIA base indexada, não do BigQuery: quem é rankeado são as empresas do
// Supabase, então o percentil tem que ser o da população rankeada. Consequência aceita: crescer
// o ingest desloca os cortes e reordena a lista. Por isso este é um artefato versionado e
// regerado de propósito, não um cálculo em runtime.
//
// Roda: node --env-file=.env.local scripts/build-capital-percentis.mjs
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, readFileSync } from "fs";
import path from "path";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const reg = JSON.parse(readFileSync(path.resolve("src/lib/setores.json"), "utf8"));

function verticalDe(cnae) {
  if (!cnae) return null;
  const c = String(cnae).replace(/\D/g, "");
  return reg.setores.find((s) => s.cnaes.some((p) => c.startsWith(p)))?.id ?? null;
}

const PAGINA = 1000;
const porVertical = new Map();
const todos = [];
for (let de = 0; ; de += PAGINA) {
  const { data, error } = await sb
    .from("empresa").select("cnae_principal, capital_social").range(de, de + PAGINA - 1);
  if (error) throw new Error(error.message);
  if (!data.length) break;
  for (const r of data) {
    const v = verticalDe(r.cnae_principal);
    const cap = Number(r.capital_social) || 0;
    todos.push(cap);
    if (!v) continue;
    if (!porVertical.has(v)) porVertical.set(v, []);
    porVertical.get(v).push(cap);
  }
  process.stdout.write(`\r  lidas ${todos.length}`);
  if (data.length < PAGINA) break;
}
console.log("");

/* Percentil pelo mesmo critério do PERCENT_RANK do BigQuery, que é o que a validação
   mediu: a posição é a do PRIMEIRO empatado. Com dezenas de milhares de capitais em
   zero, usar a posição média empurraria o corte de mediana para dentro do bloco de
   zeros e o eixo passaria a premiar empresa sem capital declarado. */
function corte(valores, p) {
  const ord = [...valores].sort((a, b) => a - b);
  return ord[Math.min(ord.length - 1, Math.floor(p * (ord.length - 1)))];
}

const verticais = {};
for (const [id, vals] of porVertical) {
  verticais[id] = {
    n: vals.length,
    p50: corte(vals, 0.5), p70: corte(vals, 0.7),
    p85: corte(vals, 0.85), p95: corte(vals, 0.95),
  };
}
// Fallback para CNAE fora dos setores cobertos (empresa indexada por busca ad-hoc).
const geral = {
  n: todos.length,
  p50: corte(todos, 0.5), p70: corte(todos, 0.7),
  p85: corte(todos, 0.85), p95: corte(todos, 0.95),
};

const artefato = {
  gerado_em: new Date().toISOString().slice(0, 10),
  fonte: "scripts/build-capital-percentis.mjs — cortes de capital social da base indexada",
  nota:
    "Cortes por vertical porque capital é nominal e a escala muda por setor. Regerar sempre " +
    "que o ingest crescer de forma relevante: os cortes se deslocam e a ordenação muda junto.",
  geral, verticais,
};
writeFileSync(path.resolve("src/lib/capital-percentis.json"), JSON.stringify(artefato, null, 2) + "\n", "utf8");

console.log(`\ncortes de capital social (R$)`);
console.log(`  vertical         n        p50         p70         p85         p95`);
for (const [id, v] of Object.entries(verticais)) {
  const f = (x) => x.toLocaleString("pt-BR").padStart(11);
  console.log(`  ${id.padEnd(10)} ${String(v.n).padStart(7)} ${f(v.p50)} ${f(v.p70)} ${f(v.p85)} ${f(v.p95)}`);
}
const f = (x) => x.toLocaleString("pt-BR").padStart(11);
console.log(`  ${"(geral)".padEnd(10)} ${String(geral.n).padStart(7)} ${f(geral.p50)} ${f(geral.p70)} ${f(geral.p85)} ${f(geral.p95)}`);
console.log(`\n✓ src/lib/capital-percentis.json`);
