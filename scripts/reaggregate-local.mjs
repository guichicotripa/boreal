// Re-agrega heatmap-setores.json a partir do ground truth JÁ minerado (aquisicoes-br.json), sem BigQuery.
// Política corrigida: aquisição limpa = ativa (sit=2) & idade>=5. (holding fora da densidade — ver build.)
// Também imprime o ranking NACIONAL de densidade por setor pra conferir se o de-viés funcionou.
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { nomeDivisao } from "../src/lib/cnae.ts";

const IDADE_MIN = 5;
const SPE_SECTORS = new Set(["41", "42", "43", "68", "35"]);
const gt = JSON.parse(readFileSync(path.resolve("scripts/data/aquisicoes-br.json"), "utf8"));
const hm = JSON.parse(readFileSync(path.resolve("src/lib/heatmap-setores.json"), "utf8"));

const limpa = (r) =>
  r.sit === "2" &&
  Number(r.idade) >= IDADE_MIN &&
  !(SPE_SECTORS.has(r.div) && Number(r.novos_op) === 0 && Number(r.novos_hold) >= 1);

// n_aquisicoes limpas por (uf, div)
const nAdq = new Map();
let totalLimpo = 0;
for (const r of gt.aquisicoes) {
  r.limpa = limpa(r); // reescreve a flag na política corrigida
  if (!r.limpa) continue;
  const k = `${r.uf}|${r.div}`;
  nAdq.set(k, (nAdq.get(k) ?? 0) + 1);
  totalLimpo++;
}

// reescreve n_aquisicoes no heatmap (universo fica, é policy-independent)
for (const [uf, arr] of Object.entries(hm.ufs)) {
  for (const d of arr) d.n_aquisicoes = nAdq.get(`${uf}|${d.div}`) ?? 0;
}
hm.filtros.aquisicao = `ativa & idade>=${IDADE_MIN} & !holding-only em constr/imob/energia`;
writeFileSync(path.resolve("src/lib/heatmap-setores.json"), JSON.stringify(hm, null, 2) + "\n", "utf8");

gt.filtro_limpa = `sit=2 (ativa) & idade>=${IDADE_MIN} & !(holding-only em ${[...SPE_SECTORS].join("/")})`;
gt.n_limpo = totalLimpo;
writeFileSync(path.resolve("scripts/data/aquisicoes-br.json"), JSON.stringify(gt, null, 0) + "\n", "utf8");

console.log(`Total limpo (idade>=5, ativa): ${totalLimpo} de ${gt.n_bruto} brutas (${((totalLimpo / gt.n_bruto) * 100).toFixed(0)}%)`);

// Ranking nacional de densidade por divisão (só divisões com N>=30 pra não ser ruído)
const nat = new Map(); // div -> {uni, n}
for (const [, arr] of Object.entries(hm.ufs)) {
  for (const d of arr) {
    const cur = nat.get(d.div) ?? { uni: 0, n: 0 };
    cur.uni += d.universo; cur.n += d.n_aquisicoes;
    nat.set(d.div, cur);
  }
}
const rows = [...nat.entries()]
  .map(([div, v]) => ({ div, nome: nomeDivisao(div), n: v.n, uni: v.uni, dens: v.uni ? (v.n / v.uni) * 100 : 0 }))
  .filter((r) => r.n >= 30)
  .sort((a, b) => b.dens - a.dens);

console.log("\nRanking NACIONAL de densidade (n limpo>=30) — % = aquisições/universo ativo:");
console.log("div  setor                     n      universo    densidade%");
for (const r of rows.slice(0, 20)) {
  console.log(`${r.div}  ${r.nome.padEnd(24)} ${String(r.n).padStart(5)}  ${String(r.uni).padStart(10)}    ${r.dens.toFixed(3)}`);
}
