// Diagnóstico: distribuição do score v0 nas 2000 empresas. Replica scoring.ts.
// Roda: node scripts/check-score-dist.mjs
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8").split("\n").reduce((a, l) => {
  const i = l.indexOf("="); if (i > 0) a[l.slice(0, i).trim()] = l.slice(i + 1).trim(); return a;
}, {});
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

function scoreIdade(socios) {
  const f = socios.map((s) => Number(s.faixa_etaria)).filter((n) => n >= 1 && n <= 9);
  if (!f.length) return 0;
  const max = Math.max(...f);
  return { 9: 40, 8: 35, 7: 25, 6: 12 }[max] ?? 0;
}
function scoreAntiguidade(d) {
  if (!d) return 0; const ano = Number(d.slice(0, 4)); if (!ano) return 0;
  const a = 2026 - ano; return a >= 40 ? 30 : a >= 25 ? 22 : a >= 15 ? 12 : 0;
}
function scoreEstab(socios) {
  const ds = socios.map((s) => s.data_entrada_sociedade).filter(Boolean).map((d) => new Date(d).getTime());
  if (!ds.length) return 10;
  const anos = (Date.now() - Math.max(...ds)) / (1000 * 60 * 60 * 24 * 365.25);
  return anos > 10 ? 20 : anos >= 5 ? 12 : anos >= 2 ? 5 : 0;
}
function scorePorte(p) {
  if (!p) return 0; p = p.toUpperCase();
  return p.includes("DEMAIS") ? 10 : p === "EPP" ? 6 : p === "ME" ? 2 : 0;
}

const empresas = [];
for (let from = 0; ; from += 1000) {
  const { data } = await sb.from("empresa")
    .select("data_inicio_atividade,porte,socio(faixa_etaria,data_entrada_sociedade)")
    .range(from, from + 999);
  empresas.push(...data);
  if (data.length < 1000) break;
}

const scores = empresas.map((e) => {
  const s = e.socio ?? [];
  return scoreIdade(s) + scoreAntiguidade(e.data_inicio_atividade) + scoreEstab(s) + scorePorte(e.porte);
});

const buckets = { "0-49": 0, "50-69": 0, "70-89": 0, "90-99": 0, "100": 0 };
for (const s of scores) {
  if (s === 100) buckets["100"]++;
  else if (s >= 90) buckets["90-99"]++;
  else if (s >= 70) buckets["70-89"]++;
  else if (s >= 50) buckets["50-69"]++;
  else buckets["0-49"]++;
}

console.log(`Total: ${scores.length} empresas\n`);
for (const [k, v] of Object.entries(buckets)) {
  const pct = ((v / scores.length) * 100).toFixed(1);
  console.log(`  ${k.padEnd(7)} ${String(v).padStart(4)}  ${"█".repeat(Math.round(pct / 2))} ${pct}%`);
}
console.log(`\nscore=100: ${buckets["100"]} (${((buckets["100"]/scores.length)*100).toFixed(1)}%)`);
