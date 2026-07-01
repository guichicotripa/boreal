// HEATMAP DE SETORES — métrica de atividade de M&A por (UF × divisão CNAE), BRASIL INTEIRO.
// Duas saídas:
//   1. src/lib/heatmap-setores.json — agregados (universo + aquisições) por UF e divisão. Alimenta o
//      mapa; o front agrega por região (ou Brasil) e normaliza a cor dentro da seleção.
//   2. scripts/data/aquisicoes-br.json — GROUND TRUTH: a lista das aquisições detectadas (cnpj_basico,
//      uf, div). Fora do bundle do front. Reservado pra validação futura do score por setor/região.
//
// Aquisição = mesma definição do ground truth: PJ entrou E PF saiu entre os 2 snapshots do CNPJ.
// HONESTIDADE: atividade OBSERVADA, consistente pra todos os setores; a validação do recall só existe
// nos 3 cobertos (setores.json).
//   node --env-file=.env.local scripts/build-heatmap-setores.mjs
import { BigQuery } from "@google-cloud/bigquery";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";

const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: path.resolve(process.env.GCP_KEY_PATH),
});
const CORTE = "2023-06-10";
const NOVO = "2025-11-09";
const ANOS = 2.4;

// Universo por (UF, divisão) — empresas matriz ativas no snapshot novo, Brasil inteiro.
const sqlUniverso = `
SELECT sigla_uf AS uf, SUBSTR(cnae_fiscal_principal,1,2) AS div, COUNT(*) AS universo
FROM \`basedosdados.br_me_cnpj.estabelecimentos\`
WHERE data='${NOVO}' AND identificador_matriz_filial='1' AND sigla_uf IS NOT NULL
GROUP BY 1,2`;

// Aquisições detectadas (lista) — PJ entra + PF sai, com a UF/divisão da empresa no corte.
const sqlAquisicoes = `
WITH
a AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf
      FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${CORTE}' GROUP BY 1),
b AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf
      FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${NOVO}' GROUP BY 1),
adq AS (SELECT a.cnpj_basico FROM a JOIN b USING(cnpj_basico) WHERE b.pj>a.pj AND b.pf<a.pf),
estC AS (SELECT cnpj_basico, sigla_uf AS uf, SUBSTR(cnae_fiscal_principal,1,2) AS div
         FROM \`basedosdados.br_me_cnpj.estabelecimentos\`
         WHERE data='${CORTE}' AND identificador_matriz_filial='1')
SELECT e.uf, e.div, e.cnpj_basico
FROM adq JOIN estC e USING(cnpj_basico)
WHERE e.uf IS NOT NULL AND e.div IS NOT NULL`;

console.log("Q1: universo por (UF, divisão), Brasil…");
const [uniRows] = await bq.query({ query: sqlUniverso, location: "US" });
console.log(`  ${uniRows.length} pares (uf, div).`);

console.log("Q2: aquisições detectadas, Brasil…");
const [adqRows] = await bq.query({ query: sqlAquisicoes, location: "US" });
console.log(`  ${adqRows.length} aquisições.`);

// n_adq por (uf, div)
const nAdq = new Map(); // `${uf}|${div}` -> count
for (const r of adqRows) {
  const k = `${r.uf}|${r.div}`;
  nAdq.set(k, (nAdq.get(k) ?? 0) + 1);
}

// Agregados por UF: [{div, universo, n_aquisicoes, deals_ano, densidade}]
const ufs = {};
for (const r of uniRows) {
  const universo = Number(r.universo);
  if (universo < 50) continue; // corta caudas minúsculas por UF
  const n = nAdq.get(`${r.uf}|${r.div}`) ?? 0;
  // Só universo + aquisições; deals/ano e densidade são derivados no front (recalculados por região).
  (ufs[r.uf] ??= []).push({ div: r.div, universo, n_aquisicoes: n });
}

const totalAdq = adqRows.length;
const totalUf = Object.keys(ufs).length;
console.log(`\n${totalUf} UFs · ${totalAdq} aquisições Brasil`);
// sanity: SP deals totais
const spTot = (ufs["SP"] ?? []).reduce((a, s) => a + s.n_aquisicoes, 0);
console.log(`SP: ${spTot} aquisições (era ~4395 no build só-SP)`);

writeFileSync(
  path.resolve("src/lib/heatmap-setores.json"),
  JSON.stringify({ gerado_em: new Date().toISOString().slice(0, 10), janela: { de: CORTE, ate: NOVO }, ufs }, null, 2) + "\n",
  "utf8",
);
console.log("✓ src/lib/heatmap-setores.json (agregados por UF)");

// Ground truth pra validação futura — fora do bundle do front.
mkdirSync(path.resolve("scripts/data"), { recursive: true });
writeFileSync(
  path.resolve("scripts/data/aquisicoes-br.json"),
  JSON.stringify(
    {
      gerado_em: new Date().toISOString().slice(0, 10),
      janela: { de: CORTE, ate: NOVO },
      definicao: "PJ entrou E PF saiu entre os 2 snapshots do CNPJ (aquisição detectada)",
      n: totalAdq,
      aquisicoes: adqRows.map((r) => ({ cnpj_basico: r.cnpj_basico, uf: r.uf, div: r.div })),
    },
    null,
    0,
  ) + "\n",
  "utf8",
);
console.log(`✓ scripts/data/aquisicoes-br.json (ground truth, ${totalAdq} aquisições)`);
