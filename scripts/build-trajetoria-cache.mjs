// Cache de trajetória societária pros demos → clique instantâneo e confiável no Loom.
// Reconstrói o quadro societário de cada empresa em 5 snapshots (2022→2025) e detecta
// eventos (entrou/saiu/envelheceu). Mesma lógica do /api/trajetoria, mas em LOTE (1 query
// pra todos os CNPJs, muito mais barato que 1 por empresa).
//   node --env-file=.env.local scripts/build-trajetoria-cache.mjs
import { BigQuery } from "@google-cloud/bigquery";
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEMO = path.resolve(__dirname, "../src/lib/demo-cache.json");
const OUT = path.resolve(__dirname, "../src/lib/trajetoria-cache.json");

const SNAPSHOTS = ["2022-01-08", "2023-01-15", "2024-01-16", "2025-01-14", "2025-11-09"];
const FAIXA = { 9: "80+", 8: "71–80", 7: "61–70", 6: "51–60", 5: "41–50", 4: "31–40", 3: "21–30", 2: "13–20", 1: "0–12" };

// Coleta empresas únicas (id + cnpj_basico) do demo-cache.
const demo = JSON.parse(readFileSync(DEMO, "utf8"));
const empresas = new Map(); // cnpj_basico -> id
for (const resp of Object.values(demo)) {
  for (const e of resp.empresas ?? []) {
    if (!e.cnpj) continue;
    empresas.set(String(e.cnpj).slice(0, 8), e.id);
  }
}
const basicos = [...empresas.keys()];
console.log(`${basicos.length} empresas únicas no demo-cache. Consultando trajetória em lote…`);

const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID, keyFilename: path.resolve(process.env.GCP_KEY_PATH) });
const inBasicos = basicos.map((b) => `'${b}'`).join(",");
const inSnaps = SNAPSHOTS.map((d) => `'${d}'`).join(",");
const sql = `
  SELECT cnpj_basico, data, tipo, nome, SAFE_CAST(faixa_etaria AS INT64) AS faixa
  FROM \`basedosdados.br_me_cnpj.socios\`
  WHERE cnpj_basico IN (${inBasicos}) AND data IN (${inSnaps})
  ORDER BY cnpj_basico, data`;
const [rows] = await bq.query({ query: sql, location: "US" });

// Agrupa: cnpj_basico -> data -> sócios[]
const porEmpresa = new Map();
for (const r of rows) {
  const b = r.cnpj_basico;
  const d = typeof r.data === "object" && r.data ? r.data.value : r.data;
  if (!porEmpresa.has(b)) porEmpresa.set(b, new Map(SNAPSHOTS.map((s) => [s, []])));
  porEmpresa.get(b).get(d)?.push({ nome: r.nome, tipo: String(r.tipo), faixa: r.faixa ?? null });
}

function trajetoria(porData) {
  const comDados = SNAPSHOTS.filter((d) => (porData.get(d)?.length ?? 0) > 0);
  const pontos = comDados.map((d) => {
    const socios = porData.get(d);
    const faixas = socios.map((s) => s.faixa).filter((f) => f != null && f >= 1);
    return {
      ano: Number(d.slice(0, 4)),
      data: d,
      n_pf: socios.filter((s) => s.tipo === "2").length,
      n_pj: socios.filter((s) => s.tipo === "1").length,
      faixa_max: faixas.length ? FAIXA[Math.max(...faixas)] ?? null : null,
    };
  });
  const eventos = [];
  for (let i = 1; i < comDados.length; i++) {
    const antes = porData.get(comDados[i - 1]);
    const depois = porData.get(comDados[i]);
    const ano = Number(comDados[i].slice(0, 4));
    const nomesAntes = new Set(antes.map((s) => s.nome));
    const nomesDepois = new Set(depois.map((s) => s.nome));
    for (const s of depois) if (!nomesAntes.has(s.nome))
      eventos.push({ ano, tipo: "entrou", texto: `Entrou ${s.nome}${s.tipo === "1" ? " (PJ)" : s.faixa ? ` (${FAIXA[s.faixa] ?? "?"})` : ""}` });
    for (const s of antes) if (!nomesDepois.has(s.nome))
      eventos.push({ ano, tipo: "saiu", texto: `Saiu ${s.nome}` });
    for (const s of depois) {
      const a = antes.find((x) => x.nome === s.nome);
      if (a && a.faixa != null && s.faixa != null && s.faixa > a.faixa)
        eventos.push({ ano, tipo: "envelheceu", texto: `${s.nome}: ${FAIXA[a.faixa] ?? "?"} → ${FAIXA[s.faixa] ?? "?"}` });
    }
  }
  return { pontos, eventos };
}

const cache = {};
let comEvento = 0;
for (const [basico, id] of empresas) {
  const porData = porEmpresa.get(basico);
  if (!porData) continue;
  const t = trajetoria(porData);
  if (t.pontos.length === 0) continue;
  cache[id] = t;
  if (t.eventos.length > 0) comEvento++;
}

writeFileSync(OUT, JSON.stringify(cache, null, 2) + "\n", "utf8");
console.log(`✓ ${OUT}`);
console.log(`  ${Object.keys(cache).length} empresas cacheadas · ${comEvento} com eventos no período.`);
