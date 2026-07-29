// ROBUSTEZ: a validação por setor roda em SP (amostra pequena, ex. educação N=8 de sucessão).
// Aqui roda BRASIL INTEIRO (sem filtro de UF) pra ver se o recall nas vendas de sucessão (88–100%)
// se sustenta com N maior. NÃO altera o app (que segue SP); é check de confiança pro pitch.
//   node --env-file=.env.local scripts/validacao-nacional.mjs
import { BigQuery } from "@google-cloud/bigquery";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reg = JSON.parse(readFileSync(path.resolve(__dirname, "../src/lib/setores.json"), "utf8"));
const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID, keyFilename: path.resolve(process.env.GCP_KEY_PATH) });
const CORTE = "2023-06-10", NOVO = "2025-11-09";

function likeClause(prefixes, col = "e.cnae_fiscal_principal") {
  return "(" + prefixes.map((p) => `${col} LIKE '${p}%'`).join(" OR ") + ")";
}

async function umSetor(s) {
  const cnaeFiltro = likeClause(s.cnaes);
  const sql = `
  WITH sc AS (
    SELECT cnpj_basico, MAX(SAFE_CAST(faixa_etaria AS INT64)) AS mf, COUNTIF(tipo='2') AS n_pf
    FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${CORTE}' GROUP BY 1
  ),
  universo AS (
    SELECT e.cnpj_basico, sc.mf AS mf, (2023-EXTRACT(YEAR FROM e.data_inicio_atividade)) AS idade,
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
    -- ATIVA no corte e desempate no NTILE: as mesmas duas correções do
    -- build-setores. Sem elas o número nacional não é comparável com o de SP,
    -- que é justamente o papel deste script.
    WHERE e.data='${CORTE}' AND e.identificador_matriz_filial='1'
      AND e.situacao_cadastral='2' AND ${cnaeFiltro}
  ),
  ranked AS (SELECT cnpj_basico, mf, idade, NTILE(10) OVER (ORDER BY score DESC, cnpj_basico) AS decil FROM universo),
  a AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${CORTE}' GROUP BY 1),
  b AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${NOVO}' GROUP BY 1),
  adq AS (SELECT a.cnpj_basico FROM a JOIN b USING(cnpj_basico) WHERE b.pj>a.pj AND b.pf<a.pf),
  adqRank AS (SELECT r.* FROM adq JOIN ranked r USING(cnpj_basico))
  SELECT
    (SELECT COUNT(*) FROM universo) AS universo,
    (SELECT COUNT(*) FROM adqRank) AS n_adq,
    (SELECT COUNTIF(decil=1) FROM adqRank) AS top10,
    (SELECT COUNT(*) FROM adqRank WHERE mf>=7 AND idade>=25) AS n_suc,
    (SELECT COUNTIF(decil=1) FROM adqRank WHERE mf>=7 AND idade>=25) AS top10_suc`;
  const [[r]] = await bq.query({ query: sql, location: "US" });
  const nAdq = Number(r.n_adq), top10 = Number(r.top10), nSuc = Number(r.n_suc), top10Suc = Number(r.top10_suc);
  return {
    id: s.id, nome: s.nome, universo: Number(r.universo),
    n_adq: nAdq, recall_geral: nAdq ? Math.round(top10 / nAdq * 100) : null,
    n_suc: nSuc, recall_suc: nSuc ? Math.round(top10Suc / nSuc * 100) : null,
  };
}

console.log("Validação BRASIL INTEIRO (sem filtro de UF) — robustez do recall por lente:\n");
console.log("setor       | universo  | N geral | recall geral | N sucessão | recall sucessão");
console.log("------------|-----------|---------|--------------|------------|----------------");
const byId = {};
for (const s of reg.setores) {
  const r = await umSetor(s);
  byId[r.id] = r;
  console.log(
    `${r.id.padEnd(11)} | ${String(r.universo).padStart(9)} | ${String(r.n_adq).padStart(7)} | ` +
    `${(r.recall_geral + "%").padStart(12)} | ${String(r.n_suc).padStart(10)} | ${(r.recall_suc + "%").padStart(15)}`
  );
}

// Persiste o bloco `nacional` por setor no setores.json (robustez visível na página, sem mexer no SP).
for (const s of reg.setores) {
  const r = byId[s.id];
  s.nacional = { universo: r.universo, n_aquisicoes: r.n_adq, recall_top10: r.recall_geral, n_aquisicoes_sucessao: r.n_suc, recall_sucessao: r.recall_suc };
}
reg.nacional_gerado_em = new Date().toISOString().slice(0, 10);
const { writeFileSync } = await import("fs");
writeFileSync(path.resolve(__dirname, "../src/lib/setores.json"), JSON.stringify(reg, null, 2) + "\n", "utf8");
console.log("\n✓ setores.json atualizado com o bloco `nacional` por setor.");
