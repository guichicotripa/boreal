// MEMO 10/10, item #1 — PRECEDENTES de M&A por setor, da nossa própria mina (não fabricado).
// Para cada divisão CNAE (24/25/28 metalmec, 86 saúde) em SP: nº de aquisições reais na janela,
// compradores ativos (PJ que entrou em 2+ alvos, com nome) e exemplos de empresas adquiridas.
// O dossiê de uma empresa puxa daqui pelo CNAE dela — é o bloco de "comps/precedentes" honesto.
//   node --env-file=.env.local scripts/build-precedentes-cache.mjs
import { BigQuery } from "@google-cloud/bigquery";
import { writeFileSync } from "fs";
import path from "path";

const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: path.resolve(process.env.GCP_KEY_PATH),
});
const T0 = "2023-06-10";
const NOVO = "2025-11-09";

const DIVISOES = [
  { div: "24", setor: "Metalurgia", grupo: "metalmec" },
  { div: "25", setor: "Produtos de metal", grupo: "metalmec" },
  { div: "28", setor: "Máquinas e equipamentos", grupo: "metalmec" },
  { div: "86", setor: "Saúde", grupo: "saude" },
];

function titulo(s) {
  return (s || "").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

async function umaDivisao(d) {
  // alvos = empresas adquiridas (PJ entrou + PF saiu) na divisão, SP, na janela
  const sqlDeals = `
  WITH univ AS (
    SELECT e.cnpj_basico, emp.razao_social
    FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e
    JOIN \`basedosdados.br_me_cnpj.empresas\` emp ON emp.cnpj_basico=e.cnpj_basico AND emp.data='${NOVO}'
    WHERE e.data='${NOVO}' AND e.sigla_uf='SP' AND e.identificador_matriz_filial='1'
      AND e.cnae_fiscal_principal LIKE '${d.div}%'
  ),
  a AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${T0}' GROUP BY 1),
  b AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${NOVO}' GROUP BY 1),
  adq AS (SELECT a.cnpj_basico FROM a JOIN b USING(cnpj_basico) WHERE b.pj>a.pj AND b.pf<a.pf)
  SELECT u.razao_social FROM adq JOIN univ u USING(cnpj_basico) LIMIT 200`;
  const [dealsRows] = await bq.query({ query: sqlDeals, location: "US" });
  const n_deals = dealsRows.length;
  const exemplos = dealsRows.slice(0, 4).map((r) => titulo(r.razao_social));

  // compradores ativos: PJ que entrou em 2+ alvos da divisão
  const sqlComp = `
  WITH alvos AS (
    SELECT cnpj_basico FROM \`basedosdados.br_me_cnpj.estabelecimentos\`
    WHERE data='${NOVO}' AND sigla_uf='SP' AND identificador_matriz_filial='1' AND cnae_fiscal_principal LIKE '${d.div}%'
  )
  SELECT ANY_VALUE(s.nome) AS nome, COUNT(DISTINCT s.cnpj_basico) AS n
  FROM \`basedosdados.br_me_cnpj.socios\` s JOIN alvos USING (cnpj_basico)
  WHERE s.data='${NOVO}' AND s.tipo='1' AND s.data_entrada_sociedade > DATE('${T0}')
    AND s.documento IS NOT NULL AND s.documento != ''
  GROUP BY s.documento HAVING n >= 2 ORDER BY n DESC LIMIT 5`;
  const [compRows] = await bq.query({ query: sqlComp, location: "US" });
  const compradores = compRows.map((r) => ({ nome: titulo(r.nome), n: Number(r.n) }));

  return {
    setor: d.setor,
    grupo: d.grupo,
    n_deals,
    exemplos,
    compradores,
    // padrão: se há comprador com 2+ alvos, é consolidação; senão, aquisições pontuais
    padrao: compradores.length > 0 ? "consolidacao" : "pontual",
  };
}

const divisoes = {};
for (const d of DIVISOES) {
  const r = await umaDivisao(d);
  divisoes[d.div] = r;
  console.log(`[${d.div} ${d.setor}] ${r.n_deals} deals · ${r.compradores.length} consolidadores · padrão ${r.padrao}`);
}

const artefato = {
  gerado_em: new Date().toISOString().slice(0, 10),
  janela: { de: T0, ate: NOVO },
  uf: "SP",
  nota: "Precedentes minerados das transições do CNPJ (PJ entrou + PF saiu). Compradores = PJ que entrou em 2+ empresas do setor. Dado real, não estimativa.",
  divisoes,
};
const out = path.resolve("src/lib/precedentes.json");
writeFileSync(out, JSON.stringify(artefato, null, 2) + "\n", "utf8");
console.log(`\n✓ ${out}`);
