// #3 TAM — pra um VC (Monica). Funil REAL do universo (sem inventar R$ por empresa): quantas empresas
// existem, quantas são familiares/independentes, quantas têm perfil sucessório quente — e quantas
// transacionam por ano (da mina). O número que importa é o GAP de liquidez: muito alvo quente, pouca
// transação = mercado grande e ilíquido por falta de originação. Monetização fica como sensibilidade
// explícita na página, não como número fabricado aqui.
//   node --env-file=.env.local scripts/build-tam-cache.mjs
import { BigQuery } from "@google-cloud/bigquery";
import { writeFileSync, readFileSync } from "fs";
import path from "path";

const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: path.resolve(process.env.GCP_KEY_PATH),
});
const T0 = "2023-06-10";
const NOVO = "2025-11-09";
const ANOS = 2.4;

/* Verticais derivadas do registry, não copiadas à mão: esta lista já tinha ficado
   pra trás (sem agro), e o TAM é a base da conta de receita mostrada ao cliente. */
const reg = JSON.parse(readFileSync(path.resolve("src/lib/setores.json"), "utf8"));
const VERTICAIS = reg.setores.map((s) => ({
  id: s.id,
  nome: `${s.nome} · SP`,
  like: "(" + s.cnaes.map((p) => `e.cnae_fiscal_principal LIKE '${p}%'`).join(" OR ") + ")",
}));

async function funil(v) {
  const sql = `
  WITH soc AS (
    SELECT cnpj_basico, MAX(SAFE_CAST(faixa_etaria AS INT64)) AS mf,
      COUNTIF(tipo='1') AS pj, COUNTIF(tipo='2') AS pf
    FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${NOVO}' GROUP BY 1
  ),
  univ AS (
    SELECT e.cnpj_basico, EXTRACT(YEAR FROM e.data_inicio_atividade) AS ano, s.mf, s.pj, s.pf
    FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e
    LEFT JOIN soc s ON s.cnpj_basico=e.cnpj_basico
    -- ATIVA: sem isto o funil contava empresa baixada/inapta como alvo, e o
    -- "quente" (que vira quente_total → deals potenciais → R$/ano no /mercado)
    -- saía 2-3x maior do que o mercado endereçável de verdade.
    WHERE e.data='${NOVO}' AND e.sigla_uf='SP' AND e.identificador_matriz_filial='1'
      AND e.situacao_cadastral='2' AND ${v.like}
  ),
  -- aquisições no periodo (da mina)
  a AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${T0}' GROUP BY 1),
  b AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${NOVO}' GROUP BY 1),
  adq AS (SELECT a.cnpj_basico FROM a JOIN b USING(cnpj_basico) WHERE b.pj>a.pj AND b.pf<a.pf)
  SELECT
    COUNT(*) AS total,
    COUNTIF(pj=0 AND pf>=1) AS independentes,
    COUNTIF(pj=0 AND pf>=1 AND mf>=7 AND (2025-ano)>=25) AS quente,
    (SELECT COUNT(*) FROM adq JOIN univ USING(cnpj_basico)) AS deals
  FROM univ`;
  const [[r]] = await bq.query({ query: sql, location: "US" });
  return {
    id: v.id, nome: v.nome,
    total: Number(r.total),
    independentes: Number(r.independentes),
    quente: Number(r.quente),
    deals_periodo: Number(r.deals),
    deals_ano: Math.round(Number(r.deals) / ANOS),
  };
}

const verticais = [];
for (const v of VERTICAIS) {
  const f = await funil(v);
  verticais.push(f);
  console.log(`[${f.id}] total ${f.total} · indep ${f.independentes} · quente ${f.quente} · ~${f.deals_ano} deals/ano`);
}

const quenteTotal = verticais.reduce((a, v) => a + v.quente, 0);
const dealsAnoTotal = verticais.reduce((a, v) => a + v.deals_ano, 0);

const artefato = {
  gerado_em: new Date().toISOString().slice(0, 10),
  janela: { de: T0, ate: NOVO, anos: ANOS },
  verticais,
  quente_total: quenteTotal,
  deals_ano_total: dealsAnoTotal,
  // liquidez: % do universo quente que transaciona por ano
  giro_anual_pct: Number(((dealsAnoTotal / quenteTotal) * 100).toFixed(2)),
  nota:
    "Universo quente = empresa independente (só sócios PF), sócio 61+ e 25+ anos de operação. " +
    "Deals/ano = transações reais detectadas na mina do CNPJ. O gap entre os dois é a iliquidez que " +
    "originação ativa destrava. Valores em R$ na página são sensibilidade ilustrativa, não dado por empresa.",
};
const out = path.resolve("src/lib/tam.json");
writeFileSync(out, JSON.stringify(artefato, null, 2) + "\n", "utf8");
console.log(`\n✓ ${out} — quente ${quenteTotal}, ~${dealsAnoTotal} deals/ano, giro ${artefato.giro_anual_pct}%`);
