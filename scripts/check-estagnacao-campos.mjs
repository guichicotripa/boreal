/**
 * `capital_social` e `porte` acompanham a empresa, ou sao congelados no registro?
 *
 *   node --env-file=.env.local scripts/check-estagnacao-campos.mjs
 *
 * Compara o valor dos dois campos no snapshot de 2023-06-10 e no de 2025-11-09, nos 4 verticais
 * ingeridos. Existe porque `escala_capital` vale 34 dos 100 pontos do score v0 e e o eixo mais
 * forte dele, e `src/lib/dossier.ts` ja proibia o LLM de usar capital como tamanho pelo motivo
 * oposto. Um dos dois estava errado.
 *
 * RESULTADO (11/08/2026): porte identico em 99,0% e capital identico em 96,8%. Ou seja, os DOIS
 * sao praticamente congelados, e `porte` e ate mais estatico que capital. A justificativa de que
 * porte seria melhor "porque a empresa e obrigada a manter" NAO se sustenta. O que sustenta o
 * porte como eixo e o lift medido e o ganho no holdout, nao frescor. Direcao, porem, faz sentido:
 * 9.549 empresas subiram de ME contra 1.361 que cairam pra ME.
 */
import { BigQuery } from "@google-cloud/bigquery";
import path from "path";
const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID, keyFilename: path.resolve(".", process.env.GCP_KEY_PATH) });
const sql = `
WITH a AS (SELECT cnpj_basico, porte, capital_social FROM \`basedosdados.br_me_cnpj.empresas\` WHERE data='2023-06-10'),
     b AS (SELECT cnpj_basico, porte, capital_social FROM \`basedosdados.br_me_cnpj.empresas\` WHERE data='2025-11-09'),
     e AS (SELECT DISTINCT cnpj_basico FROM \`basedosdados.br_me_cnpj.estabelecimentos\`
           WHERE data='2023-06-10' AND identificador_matriz_filial='1' AND situacao_cadastral='2'
             AND (cnae_fiscal_principal LIKE '24%' OR cnae_fiscal_principal LIKE '25%' OR cnae_fiscal_principal LIKE '28%'
               OR cnae_fiscal_principal LIKE '86%' OR cnae_fiscal_principal LIKE '851%' OR cnae_fiscal_principal LIKE '852%'
               OR cnae_fiscal_principal LIKE '01%' OR cnae_fiscal_principal LIKE '02%' OR cnae_fiscal_principal LIKE '03%'))
SELECT COUNT(*) n,
  ROUND(100*COUNTIF(a.porte = b.porte)/COUNT(*),1) pct_porte_igual,
  ROUND(100*COUNTIF(a.capital_social = b.capital_social)/COUNT(*),1) pct_capital_igual,
  COUNTIF(a.porte='1' AND b.porte!='1') subiu_de_ME,
  COUNTIF(a.porte!='1' AND b.porte='1') caiu_para_ME
FROM e JOIN a USING(cnpj_basico) JOIN b USING(cnpj_basico)`;
const [r] = await bq.query({ query: sql, location: "US" });
console.log(JSON.stringify(r[0], null, 2));
