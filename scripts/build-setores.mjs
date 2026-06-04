// SETOR COMO 1ª CLASSE — valida os 3 setores e escreve src/lib/setores.json (a fundação do framework).
// Por setor (SP, leakage-free): universo, quente (perfil sucessório), recall@top10% (score em 2023 vs
// aquisições até 2025, decil DENTRO do setor) e deals/ano. O número decide a LENTE: recall alto =
// sucessão (o score prevê quem vende); recall baixo = o jogo é outro (consolidação).
//   node --env-file=.env.local scripts/build-setores.mjs
import { BigQuery } from "@google-cloud/bigquery";
import { writeFileSync } from "fs";
import path from "path";

const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: path.resolve(process.env.GCP_KEY_PATH),
});
const CORTE = "2023-06-10";
const NOVO = "2025-11-09";
const ANOS = 2.4;

// id, nome, prefixos CNAE (LIKE)
const SETORES = [
  { id: "metalmec", nome: "Metalmecânica", cnaes: ["24", "25", "28"] },
  { id: "saude", nome: "Saúde", cnaes: ["86"] },
  { id: "educacao", nome: "Educação básica", cnaes: ["851", "852"] },
];

function likeClause(prefixes, col = "e.cnae_fiscal_principal") {
  return "(" + prefixes.map((p) => `${col} LIKE '${p}%'`).join(" OR ") + ")";
}

async function umSetor(s) {
  const cnaeFiltro = likeClause(s.cnaes);
  // universo + score (mesmos pesos da validação) + decil dentro do setor; recall vs aquisições; quente
  const sql = `
  WITH sc AS (
    SELECT cnpj_basico, MAX(SAFE_CAST(faixa_etaria AS INT64)) AS mf, COUNTIF(tipo='2') AS n_pf
    FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${CORTE}' GROUP BY 1
  ),
  socN AS (
    SELECT cnpj_basico, MAX(SAFE_CAST(faixa_etaria AS INT64)) AS mf, COUNTIF(tipo='1') AS pj, COUNTIF(tipo='2') AS pf
    FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${NOVO}' GROUP BY 1
  ),
  universo AS (
    SELECT e.cnpj_basico,
      (CASE sc.mf WHEN 9 THEN 30 WHEN 8 THEN 26 WHEN 7 THEN 20 WHEN 6 THEN 10 ELSE 0 END)
      + (CASE WHEN 2023-EXTRACT(YEAR FROM e.data_inicio_atividade) >= 40 THEN 30
              WHEN 2023-EXTRACT(YEAR FROM e.data_inicio_atividade) >= 25 THEN 22
              WHEN 2023-EXTRACT(YEAR FROM e.data_inicio_atividade) >= 15 THEN 10 ELSE 0 END)
      + (CASE WHEN REGEXP_REPLACE(emp.porte,'^0','')='5' THEN 30
              WHEN REGEXP_REPLACE(emp.porte,'^0','')='3' THEN 15
              WHEN REGEXP_REPLACE(emp.porte,'^0','')='1' THEN 5 ELSE 0 END)
      + (CASE WHEN sc.n_pf >= 2 THEN 10 ELSE 0 END) AS score
    FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e
    JOIN \`basedosdados.br_me_cnpj.empresas\` emp ON emp.cnpj_basico=e.cnpj_basico AND emp.data='${CORTE}'
    LEFT JOIN sc ON sc.cnpj_basico=e.cnpj_basico
    WHERE e.data='${CORTE}' AND e.sigla_uf='SP' AND e.identificador_matriz_filial='1' AND ${cnaeFiltro}
  ),
  ranked AS (SELECT cnpj_basico, NTILE(10) OVER (ORDER BY score DESC) AS decil FROM universo),
  a AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${CORTE}' GROUP BY 1),
  b AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${NOVO}' GROUP BY 1),
  adq AS (SELECT a.cnpj_basico FROM a JOIN b USING(cnpj_basico) WHERE b.pj>a.pj AND b.pf<a.pf),
  -- quente: ainda independente (só PF) em ${NOVO}, sócio 61+, 25+ anos
  quente AS (
    SELECT COUNT(*) n FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e2
    JOIN socN s2 ON s2.cnpj_basico=e2.cnpj_basico
    WHERE e2.data='${NOVO}' AND e2.sigla_uf='SP' AND e2.identificador_matriz_filial='1' AND ${likeClause(s.cnaes, "e2.cnae_fiscal_principal")}
      AND s2.pj=0 AND s2.pf>=1 AND s2.mf>=7 AND (2025-EXTRACT(YEAR FROM e2.data_inicio_atividade))>=25
  )
  SELECT
    (SELECT COUNT(*) FROM universo) AS universo,
    (SELECT n FROM quente) AS quente,
    (SELECT COUNT(*) FROM adq JOIN universo USING(cnpj_basico)) AS n_adq,
    (SELECT COUNTIF(r.decil=1) FROM adq JOIN ranked r USING(cnpj_basico)) AS top10`;
  const [[r]] = await bq.query({ query: sql, location: "US" });
  const universo = Number(r.universo), quente = Number(r.quente), nAdq = Number(r.n_adq), top10 = Number(r.top10);
  const recall = nAdq > 0 ? Math.round((top10 / nAdq) * 100) : null;
  return {
    id: s.id, nome: s.nome, cnaes: s.cnaes,
    universo, quente,
    n_aquisicoes: nAdq,
    recall_top10: recall,
    deals_ano: Math.round(nAdq / ANOS),
  };
}

const setores = [];
for (const s of SETORES) {
  const r = await umSetor(s);
  setores.push(r);
  console.log(`[${r.id}] universo ${r.universo} · quente ${r.quente} · ${r.n_aquisicoes} aquisições · recall@top10% ${r.recall_top10}% · ~${r.deals_ano}/ano`);
}

writeFileSync(
  path.resolve("src/lib/setores.json"),
  JSON.stringify({ gerado_em: new Date().toISOString().slice(0, 10), janela: { de: CORTE, ate: NOVO }, uf: "SP", setores }, null, 2) + "\n",
  "utf8"
);
console.log("\n✓ src/lib/setores.json");
