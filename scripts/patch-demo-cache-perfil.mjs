// Fix de auditoria: o demo-cache foi gerado ANTES do flag perfil_sucessorio existir.
// Computa o flag deterministicamente (sócio 61+ E empresa 25+) e adiciona ao score de cada empresa
// cacheada — sem re-rodar busca/LLM. Idempotente.
//   node scripts/patch-demo-cache-perfil.mjs
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.resolve(__dirname, "../src/lib/demo-cache.json");
const cache = JSON.parse(readFileSync(file, "utf8"));
const ANO_ATUAL = new Date().getFullYear();

function perfilSucessorio(e) {
  const faixas = (e.socio ?? [])
    .map((s) => Number(s.faixa_etaria))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 9);
  const idoso = faixas.length > 0 && Math.max(...faixas) >= 7;
  const ano = e.data_inicio_atividade ? Number(e.data_inicio_atividade.slice(0, 4)) : NaN;
  const antiga = Number.isFinite(ano) && ANO_ATUAL - ano >= 25;
  return idoso && antiga;
}

let n = 0, comFlag = 0;
for (const resp of Object.values(cache)) {
  for (const e of resp.empresas ?? []) {
    if (e.score) {
      e.score.perfil_sucessorio = perfilSucessorio(e);
      n++;
      if (e.score.perfil_sucessorio) comFlag++;
    }
  }
}

writeFileSync(file, JSON.stringify(cache, null, 2) + "\n", "utf8");
console.log(`✓ demo-cache: ${n} empresas patchadas · ${comFlag} com perfil_sucessorio`);
