/**
 * Quarta passada da sondagem dos setores da Setter: DISTRIBUICAO GEOGRAFICA do ativo comprável.
 *
 *   node --env-file=.env.local scripts/sonda-setores-setter-uf.mjs
 *
 * As tres primeiras passadas ja eram nacionais (nenhuma tinha filtro de UF; `universo_sp` era so
 * uma coluna a parte). O que faltava era a pergunta da PRACA, que e um dos itens abertos do
 * contrato: nao adianta saber que existem 392 empresas acima de R$1 mi em death care se elas
 * estiverem espalhadas em 27 estados, porque boutique trabalha praca.
 *
 * Usa o snapshot ATUAL (2025-11-09), nao o corte de validacao, porque aqui a pergunta e onde estao
 * os alvos hoje e nao previsao sem lookahead.
 */
import { BigQuery } from "@google-cloud/bigquery";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: path.resolve(__dirname, "..", process.env.GCP_KEY_PATH),
});

const SNAP = "2025-11-09";
const NOME = `REGEXP_REPLACE(NORMALIZE(UPPER(CONCAT(COALESCE(emp.razao_social,''),' ',COALESCE(e.nome_fantasia,''))), NFD), r'\\pM','')`;

const sql = `
WITH sc AS (
  SELECT cnpj_basico, MAX(NULLIF(SAFE_CAST(faixa_etaria AS INT64),0)) AS mf
  FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${SNAP}' GROUP BY 1
),
cru AS (
  SELECT e.sigla_uf AS uf, e.cnae_fiscal_principal AS cnae, ${NOME} AS nome,
    COALESCE(SAFE_CAST(emp.capital_social AS FLOAT64),0) AS capital,
    COALESCE(sc.mf,0) AS mf,
    DATE_DIFF(DATE('${SNAP}'), e.data_inicio_atividade, YEAR) AS anos_emp
  FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e
  JOIN \`basedosdados.br_me_cnpj.empresas\` emp ON emp.cnpj_basico=e.cnpj_basico AND emp.data=e.data
  LEFT JOIN sc ON sc.cnpj_basico=e.cnpj_basico
  WHERE e.data='${SNAP}' AND e.identificador_matriz_filial='1' AND e.situacao_cadastral='2'
    AND (e.cnae_fiscal_principal LIKE '7500%' OR e.cnae_fiscal_principal LIKE '9603%'
      OR e.cnae_fiscal_principal LIKE '65111%' OR e.cnae_fiscal_principal LIKE '6550%'
      OR e.cnae_fiscal_principal LIKE '6512%')
),
base AS (
  SELECT *, CASE
    WHEN cnae LIKE '7500%' AND REGEXP_CONTAINS(nome,'LABORAT|DIAGNOSTIC|PATOLOG|ANALISES CLINICAS|ANALISES VET|CITOPATOL|HEMATOLOG') THEN 'A_vet_lab'
    WHEN cnae LIKE '7500%' AND REGEXP_CONTAINS(nome,'PLANO|ASSISTENCIA|SAUDE ANIMAL|SAUDE PET|OPERADORA') THEN 'B_vet_plano'
    WHEN (cnae LIKE '6550%' OR cnae LIKE '6512%') AND REGEXP_CONTAINS(nome,'\\\\bPET\\\\b|ANIMAL|VETERINARI|\\\\bVET\\\\b') THEN 'B_plano_pet'
    WHEN cnae LIKE '9603%' OR cnae LIKE '65111%' THEN 'death_care'
    WHEN cnae LIKE '7500%' THEN 'vet_outros' END AS grupo
  FROM cru
)
SELECT grupo, uf,
  COUNT(*) AS n,
  COUNTIF(capital >= 1000000) AS cap_1mi,
  COUNTIF(capital >= 1000000 AND mf >= 7 AND anos_emp >= 25) AS cap_1mi_perfil
FROM base WHERE grupo IS NOT NULL
GROUP BY 1,2 ORDER BY grupo, cap_1mi DESC`;

const [rows] = await bq.query({ query: sql, location: "US" });

const por = {};
for (const r of rows) (por[r.grupo] ??= []).push(r);

for (const g of ["death_care", "A_vet_lab", "B_vet_plano", "B_plano_pet", "vet_outros"]) {
  const lista = (por[g] ?? []).sort((a, b) => b.cap_1mi - a.cap_1mi || b.n - a.n);
  const tot = lista.reduce((s, r) => s + Number(r.n), 0);
  const tot1 = lista.reduce((s, r) => s + Number(r.cap_1mi), 0);
  const totP = lista.reduce((s, r) => s + Number(r.cap_1mi_perfil), 0);
  console.log(`\n=== ${g}   BR: ${tot.toLocaleString("pt-BR")} empresas · ${tot1} acima de R$1mi · ${totP} destas no perfil`);
  console.log("   uf" + "n".padStart(10) + ">=1mi".padStart(8) + ">=1mi+perfil".padStart(14) + "  % do 1mi BR");
  let acc = 0;
  for (const r of lista.slice(0, 8)) {
    acc += Number(r.cap_1mi);
    const pct = tot1 ? ((Number(r.cap_1mi) / tot1) * 100).toFixed(0) + "%" : "-";
    console.log(`   ${r.uf.padEnd(2)}` + String(r.n).padStart(10) + String(r.cap_1mi).padStart(8) + String(r.cap_1mi_perfil).padStart(14) + pct.padStart(14));
  }
  if (tot1) console.log(`   top 8 concentram ${((acc / tot1) * 100).toFixed(0)}% das empresas acima de R$1mi`);
}
