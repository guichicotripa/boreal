// Medição definitiva do score v1 contra o v0 — é este script que autoriza a troca.
//
// Diferente dos anteriores, aqui a fórmula é EXATAMENTE a que roda em produção: só usa colunas
// que existem na tabela `empresa` do Supabase. O eixo "tem filial" ficou de fora não por falta
// de sinal (vale ~1,3pp de recall) e sim porque o ingest não traz contagem de estabelecimentos.
//
// Três coisas são medidas:
//   1. recall@top10% no HOLDOUT, v0 vs v1 — a prova de que a troca melhora o ranking;
//   2. o mesmo dentro do PERFIL SUCESSÓRIO (sócio 61+ e empresa 25+), que é o universo real
//      do produto: antiguidade saiu do score mas continua sendo porta de entrada da tese;
//   3. SATURAÇÃO — quantas empresas empatam no score máximo. É o problema que originou toda
//      esta investigação: 226 metalmecânicas cravadas em 100 não são um ranking, são uma lista.
//
// Roda: node --env-file=.env.local scripts/validacao-score-v1.mjs
import { BigQuery } from "@google-cloud/bigquery";
import { writeFileSync, readFileSync } from "fs";
import path from "path";

const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: path.resolve(process.env.GCP_KEY_PATH),
});
const CORTE = "2023-06-10";
const NOVO = "2025-11-09";

const reg = JSON.parse(readFileSync(path.resolve("src/lib/setores.json"), "utf8"));
const likeDe = (s) => "(" + s.cnaes.map((p) => `e.cnae_fiscal_principal LIKE '${p}%'`).join(" OR ") + ")";
const caseVertical = "CASE " + reg.setores.map((s) => `WHEN ${likeDe(s)} THEN '${s.id}'`).join(" ") + " END";
const filtroCnae = "(" + reg.setores.map(likeDe).join(" OR ") + ")";

const V0 = `
  (CASE mf WHEN 9 THEN 30 WHEN 8 THEN 26 WHEN 7 THEN 20 WHEN 6 THEN 10 ELSE 0 END)
  + (CASE WHEN anos_emp >= 40 THEN 30 WHEN anos_emp >= 25 THEN 22 WHEN anos_emp >= 15 THEN 10 ELSE 0 END)
  + (CASE porte_n WHEN '5' THEN 30 WHEN '3' THEN 15 WHEN '1' THEN 5 ELSE 0 END)
  + (CASE WHEN n_pf >= 2 THEN 10 ELSE 0 END)`;

const V1 = `
  (CASE mf WHEN 9 THEN 28 WHEN 8 THEN 25 WHEN 7 THEN 19 WHEN 6 THEN 10 ELSE 0 END)
  + (CASE WHEN cap_pct >= 0.95 THEN 34 WHEN cap_pct >= 0.85 THEN 27 WHEN cap_pct >= 0.70 THEN 19
          WHEN cap_pct >= 0.50 THEN 11 ELSE 0 END)
  + (CASE WHEN menor <= 5 THEN 14 ELSE 0 END)
  + (CASE WHEN anos_ult IS NOT NULL AND anos_ult < 5 THEN 11
          WHEN anos_ult IS NOT NULL AND anos_ult < 10 THEN 6 ELSE 0 END)
  + (CASE WHEN n_pf >= 5 THEN 13 WHEN n_pf >= 2 THEN 7 ELSE 0 END)`;

const comum = `
WITH sc AS (
  SELECT cnpj_basico,
    MAX(SAFE_CAST(faixa_etaria AS INT64)) AS mf,
    MIN(NULLIF(SAFE_CAST(faixa_etaria AS INT64), 0)) AS menor,
    MAX(data_entrada_sociedade) AS ult,
    COUNTIF(tipo='2') AS n_pf
  FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${CORTE}' GROUP BY 1
),
base AS (
  SELECT e.cnpj_basico, ${caseVertical} AS vertical, sc.mf, sc.menor, sc.n_pf,
    DATE_DIFF(DATE('${CORTE}'), sc.ult, YEAR) AS anos_ult,
    2023 - EXTRACT(YEAR FROM e.data_inicio_atividade) AS anos_emp,
    REGEXP_REPLACE(emp.porte, '^0', '') AS porte_n,
    SAFE_CAST(emp.capital_social AS FLOAT64) AS capital,
    MOD(ABS(FARM_FINGERPRINT(e.cnpj_basico)), 2) AS metade
  FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e
  JOIN \`basedosdados.br_me_cnpj.empresas\` emp
    ON emp.cnpj_basico=e.cnpj_basico AND emp.data='${CORTE}'
  LEFT JOIN sc ON sc.cnpj_basico=e.cnpj_basico
  WHERE e.data='${CORTE}' AND e.identificador_matriz_filial='1'
    AND e.situacao_cadastral='2' AND ${filtroCnae}
),
comcap AS (
  SELECT *, PERCENT_RANK() OVER (PARTITION BY vertical ORDER BY COALESCE(capital, 0)) AS cap_pct FROM base
),
scored AS (
  SELECT cnpj_basico, vertical, metade, (mf >= 7 AND anos_emp >= 25) AS no_perfil,
    (${V0}) AS s_v0, (${V1}) AS s_v1 FROM comcap
),
a AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${CORTE}' GROUP BY 1),
b AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${NOVO}' GROUP BY 1),
adq AS (SELECT a.cnpj_basico FROM a JOIN b USING(cnpj_basico) WHERE b.pj>a.pj AND b.pf<a.pf)`;

/* (1) e (2): recall com o decil calculado dentro do vertical e da metade. O universo do
   segundo bloco é só quem passa no perfil sucessório — é o ranking que o originador vê. */
const sqlRecall = `${comum},
ranked AS (
  SELECT cnpj_basico, vertical, metade, no_perfil,
    NTILE(10) OVER (PARTITION BY vertical, metade ORDER BY s_v0 DESC, cnpj_basico) AS d_v0,
    NTILE(10) OVER (PARTITION BY vertical, metade ORDER BY s_v1 DESC, cnpj_basico) AS d_v1
  FROM scored
),
ranked_perfil AS (
  SELECT cnpj_basico, vertical, metade,
    NTILE(10) OVER (PARTITION BY vertical, metade ORDER BY s_v0 DESC, cnpj_basico) AS d_v0,
    NTILE(10) OVER (PARTITION BY vertical, metade ORDER BY s_v1 DESC, cnpj_basico) AS d_v1
  FROM scored WHERE no_perfil
)
SELECT 'universo' AS recorte, r.metade, r.vertical, COUNT(*) AS n_adq,
  ROUND(COUNTIF(r.d_v0=1)/COUNT(*)*100,1) AS v0, ROUND(COUNTIF(r.d_v1=1)/COUNT(*)*100,1) AS v1
FROM adq JOIN ranked r USING(cnpj_basico) GROUP BY 1,2,3
UNION ALL
SELECT 'perfil' AS recorte, r.metade, r.vertical, COUNT(*) AS n_adq,
  ROUND(COUNTIF(r.d_v0=1)/COUNT(*)*100,1) AS v0, ROUND(COUNTIF(r.d_v1=1)/COUNT(*)*100,1) AS v1
FROM adq JOIN ranked_perfil r USING(cnpj_basico) GROUP BY 1,2,3
ORDER BY recorte, metade, vertical`;

/* (3): saturação. Não é métrica de acurácia, é de USABILIDADE — score que empata
   centenas de empresas no teto não ordena nada, mesmo que o recall seja ótimo. */
const sqlSaturacao = `${comum}
SELECT vertical,
  COUNT(*) AS n,
  COUNT(DISTINCT s_v0) AS valores_v0, COUNT(DISTINCT s_v1) AS valores_v1,
  COUNTIF(s_v0 = 100) AS teto_v0, COUNTIF(s_v1 = 100) AS teto_v1,
  MAX(cnt_v0) AS maior_empate_v0, MAX(cnt_v1) AS maior_empate_v1
FROM (
  SELECT s.*, COUNT(*) OVER (PARTITION BY vertical, s_v0) AS cnt_v0,
              COUNT(*) OVER (PARTITION BY vertical, s_v1) AS cnt_v1
  FROM scored s
) GROUP BY vertical ORDER BY vertical`;

const [[rec], [sat]] = await Promise.all([
  bq.query({ query: sqlRecall, location: "US" }),
  bq.query({ query: sqlSaturacao, location: "US" }),
]);

function bloco(recorte, metade, titulo) {
  const rs = rec.filter((r) => r.recorte === recorte && Number(r.metade) === metade);
  if (!rs.length) return null;
  const total = rs.reduce((a, r) => a + Number(r.n_adq), 0);
  const agg = (k) => rs.reduce((a, r) => a + (Number(r[k]) / 100) * Number(r.n_adq), 0) / total * 100;
  console.log(`\n=== ${titulo} ===`);
  console.log(`  vertical      N        v0        v1     delta`);
  for (const r of rs) {
    const d = Number(r.v1) - Number(r.v0);
    console.log(`  ${r.vertical.padEnd(10)} ${String(r.n_adq).padStart(4)}  ${(Number(r.v0).toFixed(1)+"%").padStart(8)}  ${(Number(r.v1).toFixed(1)+"%").padStart(8)}  ${(d>=0?"+":"")+d.toFixed(1)+"pp"}`);
  }
  const [v0, v1] = [agg("v0"), agg("v1")];
  console.log(`  ${"GERAL".padEnd(10)} ${String(total).padStart(4)}  ${(v0.toFixed(1)+"%").padStart(8)}  ${(v1.toFixed(1)+"%").padStart(8)}  ${(v1-v0>=0?"+":"")+(v1-v0).toFixed(1)+"pp"}`);
  console.log(`  ${"lift".padEnd(10)} ${"".padStart(4)}  ${((v0/10).toFixed(1)+"x").padStart(8)}  ${((v1/10).toFixed(1)+"x").padStart(8)}`);
  return { n: total, v0: Number(v0.toFixed(1)), v1: Number(v1.toFixed(1)) };
}

bloco("universo", 0, "UNIVERSO — desenvolvimento");
const univHold = bloco("universo", 1, "UNIVERSO — HOLDOUT (número que vale)");
bloco("perfil", 0, "PERFIL SUCESSÓRIO — desenvolvimento");
const perfHold = bloco("perfil", 1, "PERFIL SUCESSÓRIO — HOLDOUT (o ranking que o originador vê)");

console.log(`\n=== SATURAÇÃO — o problema que originou a investigação ===`);
console.log(`  vertical    universo   valores distintos      empatadas no teto     maior empate`);
console.log(`                             v0      v1           v0       v1          v0      v1`);
for (const s of sat) {
  console.log(
    `  ${s.vertical.padEnd(10)} ${String(Number(s.n).toLocaleString("pt-BR")).padStart(8)}   ` +
    `${String(s.valores_v0).padStart(6)}  ${String(s.valores_v1).padStart(6)}   ` +
    `${String(s.teto_v0).padStart(8)} ${String(s.teto_v1).padStart(8)}   ` +
    `${String(s.maior_empate_v0).padStart(9)} ${String(s.maior_empate_v1).padStart(7)}`
  );
}

const artefato = {
  gerado_em: new Date().toISOString().slice(0, 10),
  fonte: "scripts/validacao-score-v1.mjs",
  janela: { corte: CORTE, novo: NOVO },
  metodologia:
    "Troca do score v0 pelo v1, medida contra aquisições reais mineradas do próprio CNPJ " +
    "(sócio PJ entra + sócio PF sai) entre os dois snapshots. Features lidas em " +
    `${CORTE}, aquisições detectadas até ${NOVO}: zero lookahead. Metade das empresas ` +
    "(hash do CNPJ) é holdout e é dela que sai o número reportado. O recorte 'perfil' " +
    "rankeia só quem passa na tese (sócio 61+ e empresa 25+), que é o universo do produto.",
  holdout_universo: univHold,
  holdout_perfil: perfHold,
  saturacao: sat.map((s) => ({
    vertical: s.vertical, universo: Number(s.n),
    valores_distintos_v0: Number(s.valores_v0), valores_distintos_v1: Number(s.valores_v1),
    no_teto_v0: Number(s.teto_v0), no_teto_v1: Number(s.teto_v1),
    maior_empate_v0: Number(s.maior_empate_v0), maior_empate_v1: Number(s.maior_empate_v1),
  })),
};
writeFileSync(path.resolve("src/lib/validacao-v1.json"), JSON.stringify(artefato, null, 2) + "\n", "utf8");
console.log(`\n✓ src/lib/validacao-v1.json`);
