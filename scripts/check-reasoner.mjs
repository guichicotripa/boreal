// Smoke test do reasoner: roda uma busca real e imprime score + insights.
const res = await fetch("http://localhost:3000/api/search", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query: "fabricantes de máquinas no interior de SP" }),
});
const d = await res.json();
console.log("---");
console.log(`reasoned: ${d.reasoned}  reasonedCount: ${d.reasonedCount}  total: ${d.count}`);
console.log(`filters: ${JSON.stringify(d.filters)}`);
console.log("---");
for (const e of d.empresas.slice(0, 8)) {
  console.log(`\n[${e.score?.score ?? "?"}] ${e.razao_social.slice(0, 65)}`);
  if (e.insight?.one_liner) {
    console.log(`  → "${e.insight.one_liner}"`);
    console.log(`  flags: ${e.insight.flags.join(" · ")}`);
  } else {
    console.log("  → (sem insight)");
  }
}
