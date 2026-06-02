// ITEM 4 — PREVISÃO DE PRÓXIMO ALVO. Dado um consolidador, caracteriza o "buy-box" dele (o perfil
// das empresas que já comprou: CNAE, praça, porte) e rankeia as empresas AINDA independentes que
// mais se encaixam nesse padrão — os próximos alvos prováveis. Heurística interpretável, não caixa-
// preta: match de CNAE + proximidade geográfica + porte + sinal de sucessão.
//
//   node --env-file=.env.local scripts/proximo-alvo.mjs "SKINLASER"
import { BigQuery } from "@google-cloud/bigquery";
import path from "path";

const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: path.resolve(process.env.GCP_KEY_PATH),
});
const ANTIGO = "2023-06-10";
const NOVO = "2025-11-09";
const PADRAO = (process.argv[2] || "SKINLASER").toUpperCase();

// 1. Resolve o consolidador (maior nº de alvos cujo nome casa com o padrão).
const sqlAdq = `
WITH alvos AS (
  SELECT cnpj_basico FROM \`basedosdados.br_me_cnpj.estabelecimentos\`
  WHERE data='${NOVO}' AND sigla_uf='SP' AND identificador_matriz_filial='1'
    AND (cnae_fiscal_principal LIKE '86%' OR cnae_fiscal_principal LIKE '24%'
         OR cnae_fiscal_principal LIKE '25%' OR cnae_fiscal_principal LIKE '28%')
)
SELECT s.documento AS doc, ANY_VALUE(s.nome) AS nome, COUNT(DISTINCT s.cnpj_basico) AS n
FROM \`basedosdados.br_me_cnpj.socios\` s JOIN alvos USING (cnpj_basico)
WHERE s.data='${NOVO}' AND s.tipo='1' AND s.data_entrada_sociedade > DATE('${ANTIGO}')
  AND UPPER(s.nome) LIKE '%${PADRAO}%'
GROUP BY s.documento ORDER BY n DESC LIMIT 1`;
const [[adq]] = await bq.query({ query: sqlAdq, location: "US" });
if (!adq) {
  console.log(`Nenhum consolidador casa com "${PADRAO}".`);
  process.exit(0);
}
console.log(`Consolidador: ${adq.nome} (doc ${adq.doc}) — ${adq.n} alvos já adquiridos\n`);

// 2. Buy-box: CNAEs e municípios das empresas que ele já comprou.
const sqlPerfil = `
SELECT est.cnae_fiscal_principal AS cnae, est.id_municipio AS mun, COUNT(*) AS n
FROM \`basedosdados.br_me_cnpj.socios\` s
JOIN \`basedosdados.br_me_cnpj.estabelecimentos\` est
  ON est.cnpj_basico=s.cnpj_basico AND est.data='${NOVO}' AND est.identificador_matriz_filial='1'
WHERE s.data='${NOVO}' AND s.tipo='1' AND s.documento='${adq.doc}'
  AND s.data_entrada_sociedade > DATE('${ANTIGO}')
GROUP BY cnae, mun ORDER BY n DESC`;
const [perfil] = await bq.query({ query: sqlPerfil, location: "US" });
const cnaes = [...new Set(perfil.map((p) => p.cnae))];
const muns = [...new Set(perfil.map((p) => String(p.mun)))];
console.log(`Buy-box: ${cnaes.length} CNAEs · ${muns.length} municípios · ${perfil.reduce((a, p) => a + Number(p.n), 0)} estab.`);
console.log(`  CNAEs: ${cnaes.slice(0, 6).join(", ")}${cnaes.length > 6 ? "…" : ""}\n`);

// 3. Candidatos: empresas no MESMO CNAE e MESMA praça, ainda independentes (sem sócio PJ),
//    rankeadas por encaixe no buy-box + sinal de sucessão.
const cnaeList = cnaes.map((c) => `'${c}'`).join(",");
const munList = muns.map((m) => `'${m}'`).join(",");
const sqlCand = `
WITH socinfo AS (
  SELECT cnpj_basico, MAX(SAFE_CAST(faixa_etaria AS INT64)) AS mf,
    COUNTIF(tipo='1') AS pj, COUNTIF(tipo='2') AS pf
  FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${NOVO}' GROUP BY 1
)
SELECT est.cnpj_basico, emp.razao_social, est.id_municipio AS mun, est.cnae_fiscal_principal AS cnae,
  si.mf, EXTRACT(YEAR FROM est.data_inicio_atividade) AS ano,
  (CASE si.mf WHEN 9 THEN 30 WHEN 8 THEN 26 WHEN 7 THEN 20 WHEN 6 THEN 10 ELSE 0 END)
  + (CASE WHEN 2025-EXTRACT(YEAR FROM est.data_inicio_atividade) >= 25 THEN 22
          WHEN 2025-EXTRACT(YEAR FROM est.data_inicio_atividade) >= 15 THEN 10 ELSE 0 END)
  + (CASE WHEN est.id_municipio IN (${munList}) THEN 18 ELSE 0 END)   -- mesma praça do consolidador
  AS encaixe
FROM \`basedosdados.br_me_cnpj.estabelecimentos\` est
JOIN \`basedosdados.br_me_cnpj.empresas\` emp ON emp.cnpj_basico=est.cnpj_basico AND emp.data='${NOVO}'
JOIN socinfo si ON si.cnpj_basico=est.cnpj_basico
WHERE est.data='${NOVO}' AND est.identificador_matriz_filial='1'
  AND est.cnae_fiscal_principal IN (${cnaeList})
  AND est.id_municipio IN (${munList})
  AND si.pj=0 AND si.pf>=1                 -- ainda independente (só pessoas físicas no quadro)
  AND si.mf >= 7                            -- sócio mais velho 61+ (perfil sucessório)
ORDER BY encaixe DESC, si.mf DESC LIMIT 10`;
const [cand] = await bq.query({ query: sqlCand, location: "US" });
console.log(`Próximos alvos prováveis (independentes, no buy-box, perfil sucessório):\n`);
const faixa = { 9: "80+", 8: "71-80", 7: "61-70" };
for (const c of cand) {
  const nome = (c.razao_social || "(s/ razão)").slice(0, 40).padEnd(40);
  console.log(`  encaixe ${String(c.encaixe).padStart(3)} · ${nome} · CNAE ${c.cnae} · sócio ${faixa[c.mf] ?? "?"} · desde ${c.ano}`);
}
if (cand.length === 0) console.log("  (nenhum candidato independente no buy-box — consolidação já madura)");
