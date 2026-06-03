// BLINDAGEM — backtest out-of-sample da previsão de próximo alvo. Pergunta do juiz técnico:
// "você validou essa previsão?". Resposta:
//   - T0=2023-06 → T1=2024-06: define quem é consolidador (PJ entrou em 2+ empresas) e seu buy-box.
//   - Em T1, lista os alvos previstos: independentes (só PF) no buy-box, com perfil sucessório.
//   - T1 → T2=2025-11: mede quantos desses previstos foram DE FATO adquiridos. Sem leakage (a
//     previsão só usa dado <= T1).
//   - Compara com a taxa-base (aquisição de QUALQUER independente do setor no mesmo período).
//   node --env-file=.env.local scripts/backtest-consolidadores.mjs
import { BigQuery } from "@google-cloud/bigquery";
import { writeFileSync } from "fs";
import path from "path";

const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: path.resolve(process.env.GCP_KEY_PATH),
});
const T0 = "2023-06-10";
const T1 = "2024-06-09";
const T2 = "2025-11-09";

const sql = `
WITH saude AS (
  SELECT cnpj_basico, cnae_fiscal_principal AS cnae, id_municipio AS mun
  FROM \`basedosdados.br_me_cnpj.estabelecimentos\`
  WHERE data='${T1}' AND sigla_uf='SP' AND identificador_matriz_filial='1' AND cnae_fiscal_principal LIKE '86%'
),
-- consolidadores ativos T0->T1 (PJ entrou em 2+ empresas de saude) e seus alvos iniciais
cons AS (
  SELECT s.documento AS doc, s.cnpj_basico AS alvo
  FROM \`basedosdados.br_me_cnpj.socios\` s JOIN saude sa USING (cnpj_basico)
  WHERE s.data='${T1}' AND s.tipo='1' AND s.data_entrada_sociedade > DATE('${T0}') AND s.data_entrada_sociedade <= DATE('${T1}')
    AND s.documento IS NOT NULL AND s.documento != ''
),
cons_ativos AS (SELECT doc FROM cons GROUP BY doc HAVING COUNT(DISTINCT alvo) >= 2),
-- buy-box = CNAEs+munis dos alvos iniciais desses consolidadores
buybox AS (
  SELECT DISTINCT sa.cnae, sa.mun
  FROM cons c JOIN cons_ativos USING (doc) JOIN saude sa ON sa.cnpj_basico=c.alvo
),
-- quadro societario em T1 (pra achar independentes) e idade
soc1 AS (
  SELECT cnpj_basico, MAX(SAFE_CAST(faixa_etaria AS INT64)) AS mf, COUNTIF(tipo='1') AS pj, COUNTIF(tipo='2') AS pf
  FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${T1}' GROUP BY 1
),
-- ALVOS PREVISTOS em T1: independentes, no buy-box, perfil sucessório (mf>=7)
previstos AS (
  SELECT DISTINCT sa.cnpj_basico
  FROM saude sa JOIN buybox b ON b.cnae=sa.cnae AND b.mun=sa.mun JOIN soc1 s ON s.cnpj_basico=sa.cnpj_basico
  WHERE s.pj=0 AND s.pf>=1 AND s.mf>=7
),
-- universo-base: TODOS os independentes de saude em T1 (pro base rate)
base AS (
  SELECT sa.cnpj_basico FROM saude sa JOIN soc1 s ON s.cnpj_basico=sa.cnpj_basico WHERE s.pj=0 AND s.pf>=1
),
-- aquisicoes T1->T2 (PJ entrou depois de T1)
soc2 AS (SELECT cnpj_basico, COUNTIF(tipo='1') AS pj FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${T2}' GROUP BY 1),
adq AS (SELECT b.cnpj_basico FROM base b JOIN soc1 s1 USING(cnpj_basico) JOIN soc2 s2 USING(cnpj_basico) WHERE s2.pj > s1.pj)
SELECT
  (SELECT COUNT(*) FROM previstos) AS n_previstos,
  (SELECT COUNT(*) FROM previstos p JOIN adq USING(cnpj_basico)) AS previstos_adquiridos,
  (SELECT COUNT(*) FROM base) AS n_base,
  (SELECT COUNT(*) FROM adq) AS base_adquiridos`;

console.log("Backtest out-of-sample do /consolidadores (T1=2024-06 prevê, T2=2025-11 confere)...\n");
const [[r]] = await bq.query({ query: sql, location: "US" });
const nPrev = Number(r.n_previstos), prevAdq = Number(r.previstos_adquiridos);
const nBase = Number(r.n_base), baseAdq = Number(r.base_adquiridos);
const hitPrev = (prevAdq / nPrev) * 100;
const hitBase = (baseAdq / nBase) * 100;
const lift = hitPrev / hitBase;

console.log(`  Alvos previstos (T1): ${nPrev}`);
console.log(`  Previstos adquiridos até T2: ${prevAdq}  →  taxa ${hitPrev.toFixed(1)}%`);
console.log(`  Taxa-base (qualquer independente de saúde): ${baseAdq}/${nBase} = ${hitBase.toFixed(1)}%`);
console.log(`  LIFT: ${lift.toFixed(1)}× vs. acaso\n`);

const out = path.resolve("src/lib/backtest-consolidadores.json");
writeFileSync(out, JSON.stringify({
  gerado_em: new Date().toISOString().slice(0, 10),
  janela: { previsao: T1, outcome: T2 },
  n_previstos: nPrev, previstos_adquiridos: prevAdq, taxa_previstos: Number(hitPrev.toFixed(1)),
  n_base: nBase, base_adquiridos: baseAdq, taxa_base: Number(hitBase.toFixed(1)),
  lift: Number(lift.toFixed(1)),
}, null, 2) + "\n", "utf8");
console.log(`✓ ${out}`);
