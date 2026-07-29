/* O ESPELHO EM SQL do score de src/lib/scoring.ts — um só, importado por todos os scripts.
 *
 * Existir uma cópia da fórmula em SQL é inevitável: validar contra 700 mil empresas do BigQuery
 * não cabe em TypeScript linha a linha. O que não é inevitável é existirem VÁRIAS. Cada script
 * de validação carregava a sua, e quando o score mudou de v0 para v1 todas viraram medição de
 * uma fórmula que não roda em lugar nenhum — com a página /validacao mostrando ao cliente o
 * recall de um score aposentado. Agora a cópia é uma, aqui.
 *
 * REGRA: mexeu em src/lib/scoring.ts, mexe aqui e roda scripts/validacao-score-v1.mjs.
 *
 * Contrato — quem usa precisa entregar estas colunas na CTE de origem:
 *   mf        INT64   maior faixa etária entre os sócios PF (1–9)
 *   menor     INT64   menor faixa etária entre os sócios PF (NULL se não houver PF)
 *   n_pf      INT64   quantidade de sócios PF
 *   anos_ult  INT64   anos desde a entrada de sócio mais recente (NULL se desconhecido)
 *   cap_pct   FLOAT64 percentil do capital social DENTRO do vertical (0–1)
 */

/** Pesos medidos em scripts/validacao-lift-coorte.mjs; fórmula validada em validacao-score-v1.mjs. */
export const SCORE_V1 = `
  (CASE mf WHEN 9 THEN 28 WHEN 8 THEN 25 WHEN 7 THEN 19 WHEN 6 THEN 10 ELSE 0 END)
  + (CASE WHEN cap_pct >= 0.95 THEN 34 WHEN cap_pct >= 0.85 THEN 27 WHEN cap_pct >= 0.70 THEN 19
          WHEN cap_pct >= 0.50 THEN 11 ELSE 0 END)
  + (CASE WHEN menor <= 5 THEN 14 ELSE 0 END)
  + (CASE WHEN anos_ult IS NOT NULL AND anos_ult < 5 THEN 11
          WHEN anos_ult IS NOT NULL AND anos_ult < 10 THEN 6 ELSE 0 END)
  + (CASE WHEN n_pf >= 5 THEN 13 WHEN n_pf >= 2 THEN 7 ELSE 0 END)`;

/** Fórmula anterior, mantida só para comparação A/B. Não usar como score de nada. */
export const SCORE_V0 = `
  (CASE mf WHEN 9 THEN 30 WHEN 8 THEN 26 WHEN 7 THEN 20 WHEN 6 THEN 10 ELSE 0 END)
  + (CASE WHEN anos_emp >= 40 THEN 30 WHEN anos_emp >= 25 THEN 22 WHEN anos_emp >= 15 THEN 10 ELSE 0 END)
  + (CASE porte_n WHEN '5' THEN 30 WHEN '3' THEN 15 WHEN '1' THEN 5 ELSE 0 END)
  + (CASE WHEN n_pf >= 2 THEN 10 ELSE 0 END)`;

/** Agregados de sócios num snapshot — a CTE que produz mf/menor/n_pf/ult. */
export function ctesSocios(corte) {
  return `SELECT cnpj_basico,
    MAX(SAFE_CAST(faixa_etaria AS INT64)) AS mf,
    MIN(NULLIF(SAFE_CAST(faixa_etaria AS INT64), 0)) AS menor,
    MAX(data_entrada_sociedade) AS ult,
    COUNTIF(tipo='2') AS n_pf
  FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${corte}' GROUP BY 1`;
}

/* Percentil DENTRO do vertical, nunca capital absoluto: R$ 500 mil é topo de mercado em saúde
   e irrelevante em agro, então o valor bruto transformaria o score num ranking de setor rico
   contra setor pobre. É a mesma decisão do artefato de produção (capital-percentis.json). */
export const CAP_PCT = `PERCENT_RANK() OVER (PARTITION BY vertical ORDER BY COALESCE(capital, 0))`;

/** Perfil sucessório (src/lib/scoring.ts) — porta de entrada da tese, não eixo do score. */
export const PERFIL_SUCESSORIO = `(mf >= 7 AND anos_emp >= 25)`;
