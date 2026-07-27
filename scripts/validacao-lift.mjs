// Análise de lift: quais features discriminam quem foi adquirido? Compara a prevalência de
// cada característica no universo vs nas empresas adquiridas. Lift = prevalência_adquiridas /
// prevalência_universo. Lift > 1 = a feature tem sinal positivo. Guia a recalibração do score.
// Roda: node --env-file=.env.local scripts/validacao-lift.mjs
import { writeFileSync } from "fs";
import { BigQuery } from "@google-cloud/bigquery";
import path from "path";

const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: path.resolve(process.env.GCP_KEY_PATH),
});

const CORTE = "2023-06-10";
const NOVO = "2025-11-09";

const sql = `
WITH socios_corte AS (
  SELECT cnpj_basico,
    MAX(SAFE_CAST(faixa_etaria AS INT64)) AS mf,
    MIN(SAFE_CAST(NULLIF(faixa_etaria,'0') AS INT64)) AS menor_faixa,
    MAX(data_entrada_sociedade) AS ult,
    COUNTIF(tipo='2') AS n_pf
  FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${CORTE}' GROUP BY 1
),
feat AS (
  SELECT e.cnpj_basico,
    (sc.mf >= 7) AS idade_61mais,
    (sc.mf >= 8) AS idade_71mais,
    (2023 - EXTRACT(YEAR FROM e.data_inicio_atividade) >= 40) AS antiga_40,
    (2023 - EXTRACT(YEAR FROM e.data_inicio_atividade) >= 25) AS antiga_25,
    (DATE_DIFF(DATE('${CORTE}'), sc.ult, YEAR) > 10) AS estagnado_10,
    (sc.mf >= 7 AND sc.menor_faixa >= 6) AS sem_renovacao,   -- velho E nenhum sócio < 51 anos
    (sc.n_pf = 1) AS unico_socio_pf,
    (REGEXP_REPLACE(emp.porte,'^0','')='5') AS porte_demais
  FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e
  JOIN \`basedosdados.br_me_cnpj.empresas\` emp ON emp.cnpj_basico=e.cnpj_basico AND emp.data='${CORTE}'
  LEFT JOIN socios_corte sc ON sc.cnpj_basico=e.cnpj_basico
  -- ATIVA no corte: mesma correção do resto da validação. Empresa já baixada no
  -- universo dilui a frequência-base de cada sinal e distorce o lift medido.
  WHERE e.data='${CORTE}' AND e.sigla_uf='SP' AND e.identificador_matriz_filial='1'
    AND e.situacao_cadastral='2'
    AND (e.cnae_fiscal_principal LIKE '86%' OR e.cnae_fiscal_principal LIKE '24%'
         OR e.cnae_fiscal_principal LIKE '25%' OR e.cnae_fiscal_principal LIKE '28%')
),
a AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${CORTE}' GROUP BY 1),
b AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${NOVO}' GROUP BY 1),
adq AS (SELECT a.cnpj_basico FROM a JOIN b USING(cnpj_basico) WHERE b.pj>a.pj AND b.pf<a.pf)
SELECT
  grupo,
  COUNT(*) AS n,
  ROUND(COUNTIF(idade_61mais)/COUNT(*)*100,1) AS p_idade61,
  ROUND(COUNTIF(idade_71mais)/COUNT(*)*100,1) AS p_idade71,
  ROUND(COUNTIF(antiga_40)/COUNT(*)*100,1) AS p_antiga40,
  ROUND(COUNTIF(estagnado_10)/COUNT(*)*100,1) AS p_estagnado,
  ROUND(COUNTIF(sem_renovacao)/COUNT(*)*100,1) AS p_sem_renov,
  ROUND(COUNTIF(unico_socio_pf)/COUNT(*)*100,1) AS p_unico,
  ROUND(COUNTIF(porte_demais)/COUNT(*)*100,1) AS p_demais
FROM (
  SELECT *, 'universo' AS grupo FROM feat
  UNION ALL
  SELECT *, 'adquiridas' AS grupo FROM feat WHERE cnpj_basico IN (SELECT cnpj_basico FROM adq)
)
GROUP BY grupo ORDER BY grupo`;

const [rows] = await bq.query({ query: sql, location: "US" });
const u = rows.find(r => r.grupo === "universo");
const adq = rows.find(r => r.grupo === "adquiridas");

/* Rótulos como aparecem na página (/validacao lê src/lib/lift.json). Antes este
   script só imprimia no terminal e o JSON era transcrito à mão — ou seja, os
   números da página só mudavam se alguém lembrasse de copiá-los de novo. */
const feats = [
  ["Sócio 61+", "p_idade61"], ["Sócio 71+", "p_idade71"], ["Empresa 40+ anos", "p_antiga40"],
  ["Quadro estagnado 10+ anos", "p_estagnado"], ["Sócio velho sem renovação", "p_sem_renov"],
  ["Único sócio PF", "p_unico"], ["Porte (médio/grande)", "p_demais"],
];
console.log(`Lift das features — universo (${u.n}) vs adquiridas (${adq.n})\n`);
console.log(`  feature                universo   adquiridas   LIFT`);
for (const [label, key] of feats) {
  const pu = Number(u[key]), pa = Number(adq[key]);
  const lift = pu > 0 ? (pa / pu) : 0;
  const flag = lift >= 1.3 ? " ★" : lift < 0.9 ? " ↓" : "";
  console.log(`  ${label.padEnd(22)} ${String(pu).padStart(5)}%    ${String(pa).padStart(6)}%    ${lift.toFixed(2)}x${flag}`);
}
console.log(`\n★ = sinal forte (lift ≥ 1,3) · ↓ = sinal negativo (feature reduz chance)`);

const features = feats
  .map(([nome, key]) => {
    const pu = Number(u[key]), pa = Number(adq[key]);
    const lift = pu > 0 ? Number((pa / pu).toFixed(2)) : 0;
    return {
      nome, universo_pct: pu, adquiridas_pct: pa, lift,
      sinal: lift >= 1.3 ? "forte" : lift < 0.9 ? "negativo" : "fraco",
    };
  })
  .sort((a, b) => b.lift - a.lift);

const artefato = {
  gerado_em: new Date().toISOString().slice(0, 10),
  fonte: `scripts/validacao-lift.mjs — lift de cada feature no universo (${Number(u.n).toLocaleString("pt-BR")}) vs aquisições reais (${adq.n})`,
  n_universo: Number(u.n),
  n_adquiridas: Number(adq.n),
  nota:
    "Os pesos do score não são chutados: cada feature foi medida contra aquisições reais " +
    "(lift = quanto ela aparece mais nas adquiridas do que no universo). O dado corrigiu a " +
    "intuição: 'quadro estagnado' e 'sócio único' não sustentaram sinal e saíram. Universo " +
    "restrito a empresa ATIVA no corte — contar baixada dilui a frequência-base e distorce o lift.",
  features,
};
writeFileSync(path.resolve("src/lib/lift.json"), JSON.stringify(artefato, null, 2) + "\n", "utf8");
console.log(`\n✓ src/lib/lift.json`);
