// ITEM 4 — A LENTE DO COMPRADOR. A mineração de transições acha quem VENDE; esta acha quem COMPRA.
//
// Um sócio PJ que entrou recentemente (data_entrada > ANTIGO) no quadro de uma empresa-alvo é um
// adquirente. Agrupando os adquirentes pelo seu documento, os que aparecem em 2+ empresas do mesmo
// setor são CONSOLIDADORES ativos (roll-ups). Mapear isso destrava prever o PRÓXIMO alvo deles —
// alpha puro pro buy-side (o Sharpe).
//
//   node --env-file=.env.local scripts/consolidadores.mjs
import { BigQuery } from "@google-cloud/bigquery";
import path from "path";

const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: path.resolve(process.env.GCP_KEY_PATH),
});
const ANTIGO = "2023-06-10";
const NOVO = "2025-11-09";

const sql = `
WITH alvos AS (
  SELECT cnpj_basico,
    CASE WHEN cnae_fiscal_principal LIKE '86%' THEN 'saude' ELSE 'metalmec' END AS vertical,
    cnae_fiscal_principal AS cnae, sigla_uf AS uf
  FROM \`basedosdados.br_me_cnpj.estabelecimentos\`
  WHERE data='${NOVO}' AND sigla_uf='SP' AND identificador_matriz_filial='1'
    AND (cnae_fiscal_principal LIKE '86%' OR cnae_fiscal_principal LIKE '24%'
         OR cnae_fiscal_principal LIKE '25%' OR cnae_fiscal_principal LIKE '28%')
),
-- sócios PJ que ENTRARAM depois do snapshot antigo = aquisições recentes
entradas AS (
  SELECT s.documento AS adquirente_doc, ANY_VALUE(s.nome) AS adquirente_nome,
    s.cnpj_basico AS alvo, al.vertical, al.cnae
  FROM \`basedosdados.br_me_cnpj.socios\` s
  JOIN alvos al USING (cnpj_basico)
  WHERE s.data='${NOVO}' AND s.tipo='1'
    AND s.data_entrada_sociedade > DATE('${ANTIGO}')
    AND s.documento IS NOT NULL AND s.documento != ''
  GROUP BY s.documento, s.cnpj_basico, al.vertical, al.cnae
)
SELECT adquirente_doc, ANY_VALUE(adquirente_nome) AS nome,
  COUNT(DISTINCT alvo) AS n_alvos,
  COUNT(DISTINCT vertical) AS n_verticais,
  STRING_AGG(DISTINCT vertical) AS verticais
FROM entradas
GROUP BY adquirente_doc
HAVING n_alvos >= 2
ORDER BY n_alvos DESC
LIMIT 40`;

console.log(`Consolidadores em saúde+metalmec SP (entraram 2+ empresas entre ${ANTIGO} e ${NOVO}):\n`);
const [rows] = await bq.query({ query: sql, location: "US" });
if (rows.length === 0) {
  console.log("  Nenhum consolidador com 2+ alvos. Densidade insuficiente neste universo.");
} else {
  console.log(`  ${rows.length} consolidadores encontrados (top 40):\n`);
  for (const r of rows) {
    const nome = (r.nome || "(sem nome)").slice(0, 45).padEnd(45);
    console.log(`  ${String(r.n_alvos).padStart(3)} alvos · ${nome} · ${r.verticais}`);
  }
}
