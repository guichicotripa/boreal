/**
 * Terceira passada da sondagem dos setores da Setter: o universo nos DOIS snapshots.
 *
 *   node --env-file=.env.local scripts/sonda-setores-setter-crescimento.mjs
 *
 * POR QUE ELA EXISTE: as duas primeiras passadas mediram o corte de 2023-06-10, que e a data que
 * a validacao usa pra nao espiar o desfecho. So que o mercado pet explodiu depois de 2020, entao
 * levar o numero de 2023 pra uma call de 2026 e levar um numero velho e comer a objecao obvia
 * ("esse setor cresceu muito desde entao") sem resposta. Esta query conta o mesmo recorte em
 * 2023-06-10 e em 2025-11-09, com e sem o corte de R$1 mi de capital.
 *
 * O QUE ELA REVELOU: crescimento de universo e crescimento de ATIVO COMPRAVEL sao coisas
 * diferentes. Lab veterinario cresceu 39% em numero de empresas e saiu de 9 pra 11 acima de
 * R$1 mi. Ja plano funerario ENCOLHEU 10% em universo enquanto as empresas acima de R$1 mi
 * subiram de 65 pra 84, que e a assinatura de um setor consolidando de verdade.
 */
import { BigQuery } from "@google-cloud/bigquery";
import path from "path";
const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID, keyFilename: path.resolve(".", process.env.GCP_KEY_PATH) });
const NOME = `REGEXP_REPLACE(NORMALIZE(UPPER(CONCAT(COALESCE(emp.razao_social,''),' ',COALESCE(e.nome_fantasia,''))), NFD), r'\pM','')`;
const sql = `
WITH cru AS (
  SELECT e.cnae_fiscal_principal AS cnae, ${NOME} AS nome,
    COALESCE(SAFE_CAST(emp.capital_social AS FLOAT64),0) AS capital, e.data AS d
  FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e
  JOIN \`basedosdados.br_me_cnpj.empresas\` emp ON emp.cnpj_basico=e.cnpj_basico AND emp.data=e.data
  WHERE e.data IN ('2023-06-10','2025-11-09') AND e.identificador_matriz_filial='1' AND e.situacao_cadastral='2'
    AND (e.cnae_fiscal_principal LIKE '7500%' OR e.cnae_fiscal_principal LIKE '9603%'
      OR e.cnae_fiscal_principal LIKE '65111%' OR e.cnae_fiscal_principal LIKE '6550%'
      OR e.cnae_fiscal_principal LIKE '6512%')
)
SELECT d, CASE
  WHEN cnae LIKE '7500%' AND REGEXP_CONTAINS(nome,'LABORAT|DIAGNOSTIC|PATOLOG|ANALISES CLINICAS|ANALISES VET|CITOPATOL|HEMATOLOG') THEN 'A_vet_lab'
  WHEN cnae LIKE '7500%' AND REGEXP_CONTAINS(nome,'PLANO|ASSISTENCIA|SAUDE ANIMAL|SAUDE PET|OPERADORA') THEN 'B_vet_plano'
  WHEN (cnae LIKE '6550%' OR cnae LIKE '6512%') AND REGEXP_CONTAINS(nome,'\\bPET\\b|ANIMAL|VETERINARI|\\bVET\\b') THEN 'B_plano_pet_seguro'
  WHEN cnae LIKE '7500%' THEN 'vet_outros'
  WHEN cnae LIKE '9603%' THEN 'death_care'
  WHEN cnae LIKE '65111%' THEN 'plano_funeral' END AS grupo,
  COUNT(*) n, COUNTIF(capital>=1000000) cap_1mi
FROM cru GROUP BY 1,2 HAVING grupo IS NOT NULL ORDER BY grupo, d`;
const [rows] = await bq.query({ query: sql, location: "US" });
const por = {};
for (const r of rows) { por[r.grupo] ??= {}; por[r.grupo][r.d.value ?? r.d] = r; }
console.log("grupo".padStart(22) + "2023".padStart(10) + "2025".padStart(10) + "cresc".padStart(9) + "1mi23".padStart(8) + "1mi25".padStart(8));
console.log("-".repeat(67));
for (const [g, v] of Object.entries(por)) {
  const a = v["2023-06-10"], b = v["2025-11-09"];
  if (!a || !b) { console.log(g, JSON.stringify(v)); continue; }
  const cr = ((b.n / a.n - 1) * 100).toFixed(0) + "%";
  console.log(g.padStart(22) + String(a.n).padStart(10) + String(b.n).padStart(10) + cr.padStart(9) + String(a.cap_1mi).padStart(8) + String(b.cap_1mi).padStart(8));
}
