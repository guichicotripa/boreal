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
    emp.porte AS porte,
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
-- Corte de tamanho passou a ser porte = 5 (DEMAIS), e nao mais capital >= R$1 mi. Motivo medido em
-- sonda-proxy-tamanho.mjs: o capital social e identico entre 2023 e 2025 em 91% a 95% das empresas,
-- e o corte de R$1 mi descartava 716 das 962 empresas DEMAIS de death care. O campo porte tem
-- consequencia tributaria, entao a empresa e obrigada a manter, e ele sobe com a idade da empresa
-- como um proxy de tamanho de verdade. Capital fica na saida so como coluna de comparacao.
-- (comentario em -- e nao em bloco: crase dentro de template literal do JS quebra a string)
SELECT grupo, uf,
  COUNT(*) AS n,
  COUNTIF(porte = '5') AS demais,
  COUNTIF(porte = '5' AND mf >= 7 AND anos_emp >= 25) AS demais_perfil,
  COUNTIF(capital >= 1000000) AS cap_1mi
FROM base WHERE grupo IS NOT NULL
GROUP BY 1,2 ORDER BY grupo, demais DESC`;

const [rows] = await bq.query({ query: sql, location: "US" });

const por = {};
for (const r of rows) (por[r.grupo] ??= []).push(r);

for (const g of ["death_care", "A_vet_lab", "B_vet_plano", "B_plano_pet", "vet_outros"]) {
  const lista = (por[g] ?? []).sort((a, b) => b.demais - a.demais || b.n - a.n);
  const tot = lista.reduce((s, r) => s + Number(r.n), 0);
  const totD = lista.reduce((s, r) => s + Number(r.demais), 0);
  const totP = lista.reduce((s, r) => s + Number(r.demais_perfil), 0);
  const tot1 = lista.reduce((s, r) => s + Number(r.cap_1mi), 0);
  console.log(`\n=== ${g}   BR: ${tot.toLocaleString("pt-BR")} empresas · ${totD} porte DEMAIS · ${totP} destas no perfil · (${tot1} pelo corte antigo de R$1mi)`);
  console.log("   uf" + "n".padStart(10) + "DEMAIS".padStart(9) + "DEMAIS+perfil".padStart(15) + ">=1mi".padStart(8) + "  % do DEMAIS BR");
  let acc = 0;
  for (const r of lista.slice(0, 8)) {
    acc += Number(r.demais);
    const pct = totD ? ((Number(r.demais) / totD) * 100).toFixed(0) + "%" : "-";
    console.log(`   ${r.uf.padEnd(2)}` + String(r.n).padStart(10) + String(r.demais).padStart(9) +
      String(r.demais_perfil).padStart(15) + String(r.cap_1mi).padStart(8) + pct.padStart(17));
  }
  if (totD) console.log(`   top 8 concentram ${((acc / totD) * 100).toFixed(0)}% das DEMAIS`);
}
