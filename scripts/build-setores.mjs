// SETOR COMO 1ª CLASSE — valida os 3 setores e escreve src/lib/setores.json (a fundação do framework).
// Por setor (SP, leakage-free): universo, quente (perfil sucessório), recall@top10% (score em 2023 vs
// aquisições até 2025, decil DENTRO do setor) e deals/ano. O número decide a LENTE: recall alto =
// sucessão (o score prevê quem vende); recall baixo = o jogo é outro (consolidação).
//   node --env-file=.env.local scripts/build-setores.mjs
import { BigQuery } from "@google-cloud/bigquery";
import { SCORE_V1, ctesSocios, CAP_PCT } from "./lib/score-sql.mjs";
import { writeFileSync, readFileSync, existsSync } from "fs";
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
  // Agro: vertical que a Setter sinalizou querer (wiki/entities/setter-investimentos).
  // 01 agricultura/pecuária · 02 produção florestal · 03 pesca e aquicultura.
  { id: "agro", nome: "Agropecuária", cnaes: ["01", "02", "03"] },
];

/* O bloco `nacional` de cada setor NÃO é produzido aqui — quem escreve é
   validacao-nacional.mjs, depois. Sem este merge, rodar build-setores pra
   acrescentar um setor apagaria em silêncio a validação nacional dos outros
   (e a página /validacao passaria a mostrar só o recorte de SP sem avisar). */
const DESTINO = path.resolve("src/lib/setores.json");
const anterior = existsSync(DESTINO) ? JSON.parse(readFileSync(DESTINO, "utf8")) : { setores: [] };
const nacionalPorId = Object.fromEntries(
  (anterior.setores ?? []).filter((s) => s.nacional).map((s) => [s.id, s.nacional])
);

function likeClause(prefixes, col = "e.cnae_fiscal_principal") {
  return "(" + prefixes.map((p) => `${col} LIKE '${p}%'`).join(" OR ") + ")";
}

async function umSetor(s) {
  const cnaeFiltro = likeClause(s.cnaes);
  // universo + score (mesmos pesos da validação) + decil dentro do setor; recall vs aquisições; quente
  const sql = `
  WITH sc AS (${ctesSocios(CORTE)}),
  socN AS (
    SELECT cnpj_basico, MAX(SAFE_CAST(faixa_etaria AS INT64)) AS mf, COUNTIF(tipo='1') AS pj, COUNTIF(tipo='2') AS pf
    FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${NOVO}' GROUP BY 1
  ),
  bruto AS (
    SELECT e.cnpj_basico,
      sc.mf AS mf, sc.menor, sc.n_pf,
      DATE_DIFF(DATE('${CORTE}'), sc.ult, YEAR) AS anos_ult,
      SAFE_CAST(emp.capital_social AS FLOAT64) AS capital,
      -- vertical constante: esta query roda um setor por vez, e o PARTITION BY do
      -- CAP_PCT (compartilhado) precisa de uma coluna com esse nome.
      '${s.id}' AS vertical,
      (2023-EXTRACT(YEAR FROM e.data_inicio_atividade)) AS idade
    FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e
    JOIN \`basedosdados.br_me_cnpj.empresas\` emp ON emp.cnpj_basico=e.cnpj_basico AND emp.data='${CORTE}'
    LEFT JOIN sc ON sc.cnpj_basico=e.cnpj_basico
    -- situacao_cadastral='2' (ATIVA): empresa já baixada ou inapta no corte nunca
    -- foi prospect, e contá-la infla o universo e desloca as fronteiras do decil.
    -- O build-heatmap já tinha feito esta correção no denominador dele; aqui não
    -- tinha sido feita, então /setores e o TAM publicavam número 2-3x maior.
    WHERE e.data='${CORTE}' AND e.sigla_uf='SP' AND e.identificador_matriz_filial='1'
      AND e.situacao_cadastral='2' AND ${cnaeFiltro}
  ),
  universo AS (
    SELECT *, ${SCORE_V1} AS score FROM (SELECT *, ${CAP_PCT} AS cap_pct FROM bruto)
  ),
  -- Desempate por cnpj_basico: NTILE sobre score com empate distribui as empresas
  -- empatadas de forma arbitrária, e a mesma execução dava recall diferente entre
  -- rodadas (metalmec oscilou 67%/66%). Um número de validação tem que ser
  -- reproduzível, senão não dá pra saber se mudou porque o dado mudou.
  ranked AS (SELECT cnpj_basico, mf, idade, NTILE(10) OVER (ORDER BY score DESC, cnpj_basico) AS decil FROM universo),
  a AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${CORTE}' GROUP BY 1),
  b AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${NOVO}' GROUP BY 1),
  adq AS (SELECT a.cnpj_basico FROM a JOIN b USING(cnpj_basico) WHERE b.pj>a.pj AND b.pf<a.pf),
  -- quente: ATIVA e ainda independente (só PF) em ${NOVO}, sócio 61+, 25+ anos
  quente AS (
    SELECT COUNT(*) n FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e2
    JOIN socN s2 ON s2.cnpj_basico=e2.cnpj_basico
    WHERE e2.data='${NOVO}' AND e2.sigla_uf='SP' AND e2.identificador_matriz_filial='1'
      AND e2.situacao_cadastral='2' AND ${likeClause(s.cnaes, "e2.cnae_fiscal_principal")}
      AND s2.pj=0 AND s2.pf>=1 AND s2.mf>=7 AND (2025-EXTRACT(YEAR FROM e2.data_inicio_atividade))>=25
  ),
  adqRank AS (SELECT r.* FROM adq JOIN ranked r USING(cnpj_basico))
  SELECT
    (SELECT COUNT(*) FROM universo) AS universo,
    (SELECT n FROM quente) AS quente,
    (SELECT COUNT(*) FROM adqRank) AS n_adq,
    (SELECT COUNTIF(decil=1) FROM adqRank) AS top10,
    -- subset SUCESSÃO: alvo era sócio 61+ E empresa 25+ no corte (onde a lente de sucessão vale)
    (SELECT COUNT(*) FROM adqRank WHERE mf>=7 AND idade>=25) AS n_adq_suc,
    (SELECT COUNTIF(decil=1) FROM adqRank WHERE mf>=7 AND idade>=25) AS top10_suc`;
  const [[r]] = await bq.query({ query: sql, location: "US" });
  const universo = Number(r.universo), quente = Number(r.quente);
  const nAdq = Number(r.n_adq), top10 = Number(r.top10);
  const nSuc = Number(r.n_adq_suc), top10Suc = Number(r.top10_suc);
  return {
    id: s.id, nome: s.nome, cnaes: s.cnaes,
    universo, quente,
    n_aquisicoes: nAdq,
    recall_top10: nAdq > 0 ? Math.round((top10 / nAdq) * 100) : null,
    n_aquisicoes_sucessao: nSuc,
    recall_sucessao: nSuc > 0 ? Math.round((top10Suc / nSuc) * 100) : null,
    deals_ano: Math.round(nAdq / ANOS),
  };
}

const setores = [];
for (const s of SETORES) {
  const r = await umSetor(s);
  if (nacionalPorId[r.id]) r.nacional = nacionalPorId[r.id];
  setores.push(r);
  console.log(`[${r.id}] universo ${r.universo} · quente ${r.quente} · recall geral ${r.recall_top10}% (N=${r.n_aquisicoes}) · recall sucessão ${r.recall_sucessao}% (N=${r.n_aquisicoes_sucessao}) · ~${r.deals_ano}/ano`);
}

const semNacional = setores.filter((s) => !s.nacional).map((s) => s.id);
if (semNacional.length) {
  console.log(`\n⚠ sem validação nacional: ${semNacional.join(", ")} — rode validacao-nacional.mjs`);
}

writeFileSync(
  DESTINO,
  JSON.stringify({
    gerado_em: new Date().toISOString().slice(0, 10),
    janela: { de: CORTE, ate: NOVO },
    uf: "SP",
    ...(anterior.nacional_gerado_em ? { nacional_gerado_em: anterior.nacional_gerado_em } : {}),
    setores,
  }, null, 2) + "\n",
  "utf8"
);
console.log("\n✓ src/lib/setores.json");
