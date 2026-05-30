// Fase B/C da validação retroativa: mede o hit rate do score v0 contra deals reais de saúde.
//
// Para cada empresa adquirida (ground truth), pega o snapshot ~12 meses ANTES do deal (sem leakage),
// calcula o score v0 de TODO o universo de saúde SP nesse snapshot (em SQL, no BigQuery), e vê em
// que decil a empresa-alvo caiu. Hit rate = % dos alvos no top decil (e top 3 decis).
//
// Replica scoring.ts em SQL. Roda: node --env-file=.env.local scripts/validacao-retroativa.mjs
import { BigQuery } from "@google-cloud/bigquery";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: path.resolve(ROOT, process.env.GCP_KEY_PATH),
});

// Snapshots disponíveis (BigQuery histórico começa em 2023-06). Para um deal, usa-se o snapshot
// mais próximo de ~12 meses antes do anúncio.
//
// ALVOS: preencher após o matching nome→CNPJ (scripts/alvos-validacao.json).
// Formato: [{ cnpj_basico: "12345678", razao: "...", deal_ano: 2024, snapshot: "2023-09-15" }]
import { readFileSync } from "fs";
let alvos = [];
try {
  alvos = JSON.parse(readFileSync(path.resolve(__dirname, "alvos-validacao.json"), "utf8"));
} catch {
  console.log("⚠ scripts/alvos-validacao.json ainda não existe — preencher após o matching nome→CNPJ.");
  process.exit(0);
}

// Score v0 em SQL com RECONSTRUÇÃO TEMPORAL: usa o snapshot ATUAL (2025-11-09) mas reconstrói
// o quadro societário na data de corte filtrando sócios por data_entrada <= corte. Isso:
//   (1) não precisa de snapshot histórico → destrava QUALQUER ano de deal;
//   (2) remove o comprador (entrou na data do deal) → recupera o quadro pré-aquisição (anti-leakage).
// Limitação honesta: sócios que saíram antes de hoje não aparecem (viés de sobrevivência); faixa
// etária é a atual (aproxima a idade na data de corte, erro ≤1 bracket pra deals recentes).
const SNAP_ATUAL = "2025-11-09";

function queryScorePercentil(corteDate, cutYear) {
  return `
  WITH socios_agg AS (
    SELECT cnpj_basico,
           MAX(SAFE_CAST(faixa_etaria AS INT64)) AS max_faixa,
           MAX(data_entrada_sociedade) AS ultima_entrada
    FROM \`basedosdados.br_me_cnpj.socios\`
    WHERE data = '${SNAP_ATUAL}'
      AND data_entrada_sociedade <= DATE('${corteDate}')   -- reconstrução: quadro na data de corte
    GROUP BY cnpj_basico
  ),
  base AS (
    SELECT e.cnpj_basico, emp.razao_social,
           EXTRACT(YEAR FROM e.data_inicio_atividade) AS ano_fund,
           emp.porte, sa.max_faixa, sa.ultima_entrada
    FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e
    JOIN \`basedosdados.br_me_cnpj.empresas\` emp
      ON emp.cnpj_basico = e.cnpj_basico AND emp.data = '${SNAP_ATUAL}'
    LEFT JOIN socios_agg sa ON sa.cnpj_basico = e.cnpj_basico
    WHERE e.data = '${SNAP_ATUAL}'
      AND e.cnae_fiscal_principal LIKE '86%'
      AND e.sigla_uf = 'SP'
      AND e.identificador_matriz_filial = '1'
      AND e.data_inicio_atividade <= DATE('${corteDate}')  -- empresa já existia na data de corte
  ),
  scored AS (
    SELECT cnpj_basico, razao_social,
      (CASE max_faixa WHEN 9 THEN 40 WHEN 8 THEN 35 WHEN 7 THEN 25 WHEN 6 THEN 12 ELSE 0 END)
      + (CASE WHEN ${cutYear} - ano_fund >= 40 THEN 30
              WHEN ${cutYear} - ano_fund >= 25 THEN 22
              WHEN ${cutYear} - ano_fund >= 15 THEN 12 ELSE 0 END)
      + (CASE WHEN ultima_entrada IS NULL THEN 10
              WHEN DATE_DIFF(DATE('${corteDate}'), ultima_entrada, YEAR) > 10 THEN 20
              WHEN DATE_DIFF(DATE('${corteDate}'), ultima_entrada, YEAR) >= 5 THEN 12
              WHEN DATE_DIFF(DATE('${corteDate}'), ultima_entrada, YEAR) >= 2 THEN 5 ELSE 0 END)
      + (CASE WHEN REGEXP_REPLACE(porte, '^0', '') = '5' THEN 10
              WHEN REGEXP_REPLACE(porte, '^0', '') = '3' THEN 6
              WHEN REGEXP_REPLACE(porte, '^0', '') = '1' THEN 2 ELSE 0 END) AS score
    FROM base
  ),
  ranked AS (
    SELECT cnpj_basico, razao_social, score,
           NTILE(10) OVER (ORDER BY score DESC) AS decil,
           PERCENT_RANK() OVER (ORDER BY score) AS pct
    FROM scored
  )
  SELECT cnpj_basico, razao_social, score, decil, pct,
         (SELECT COUNT(*) FROM scored) AS universo
  FROM ranked
  WHERE cnpj_basico = @alvo`;
}

console.log(`Validação retroativa — ${alvos.length} alvos\n`);
let topDecil = 0, top3 = 0, ok = 0;

for (const a of alvos) {
  const cutYear = a.deal_ano - 1;
  const corteDate = `${cutYear}-06-30`; // ~12 meses antes do deal (meio do ano anterior)
  const [rows] = await bq.query({
    query: queryScorePercentil(corteDate, cutYear),
    params: { alvo: a.cnpj_basico },
    location: "US",
  });
  if (!rows.length) {
    console.log(`  ✗ ${a.razao} — não localizada / sem dados na data de corte ${corteDate}`);
    continue;
  }
  const r = rows[0];
  ok++;
  if (r.decil === 1) topDecil++;
  if (r.decil <= 3) top3++;
  const pctTop = ((1 - r.pct) * 100).toFixed(1);
  console.log(`  ${r.decil === 1 ? "🎯" : r.decil <= 3 ? "✓" : "·"} ${a.razao}`);
  console.log(`     score ${r.score} · decil ${r.decil}/10 · top ${pctTop}% de ${r.universo}`);
}

console.log(`\n=== HIT RATE ===`);
console.log(`Alvos localizados: ${ok}/${alvos.length}`);
console.log(`No TOP DECIL (top 10%): ${topDecil}/${ok} (${ok ? ((topDecil / ok) * 100).toFixed(0) : 0}%)`);
console.log(`No TOP 30%:            ${top3}/${ok} (${ok ? ((top3 / ok) * 100).toFixed(0) : 0}%)`);
