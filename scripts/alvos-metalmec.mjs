// ALVOS METALMECÂNICA — lista de prospecção por recorte geográfico, score v1.
//
// Gera o "mapa de setor" que vai como isca para sócio de boutique de M&A
// (ver memory/projects/boreal.md, seção "Frente comercial", 03/08/2026).
// Entrega DOIS blocos: agregados (o número que vai na mensagem) e o top N nomeado
// (a prova). A regra comercial é mandar o agregado + 3 nomes, nunca a lista.
//
// Uso:
//   node --env-file=.env.local scripts/alvos-metalmec.mjs --uf=PR,SC,RS --rotulo="Sul (Zaxo)"
//   node --env-file=.env.local scripts/alvos-metalmec.mjs --uf=SP        --rotulo="SP (Fairplay)"
//   node --env-file=.env.local scripts/alvos-metalmec.mjs --porte=5      --rotulo="Brasil, porte DEMAIS (Oporto)"
//
// Flags: --uf=XX,YY (omitir = Brasil inteiro) · --porte=5|3|1 (opcional) · --top=N (default 20)
//        --json=caminho (opcional, salva o resultado bruto)

import { BigQuery } from "@google-cloud/bigquery";
import { SCORE_V1, CAP_PCT } from "./lib/score-sql.mjs";
import { writeFileSync } from "fs";
import path from "path";

const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: path.resolve(process.env.GCP_KEY_PATH),
});

// Snapshot mais recente. A validação usa o par corte/novo para ser leakage-free;
// aqui o objetivo é prospectar, então o que vale é o estado de hoje.
const SNAP = "2025-11-09";
const ANO = 2025;

// 24 metalurgia · 25 produtos de metal (exceto máquinas) · 28 máquinas e equipamentos.
// Mesmos prefixos da validação (src/lib/setores.json), não mexer sem revalidar.
const CNAES = ["24", "25", "28"];

const FAIXA = { 1: "0-12", 2: "13-20", 3: "21-30", 4: "31-40", 5: "41-50", 6: "51-60", 7: "61-70", 8: "71-80", 9: "80+" };
const PORTE = { "1": "ME", "3": "EPP", "5": "DEMAIS" };

const arg = (n, d = null) => {
  const m = process.argv.find((a) => a.startsWith(`--${n}=`));
  return m ? m.split("=").slice(1).join("=") : d;
};
const ufs = arg("uf") ? arg("uf").split(",").map((u) => u.trim().toUpperCase()) : null;
const porte = arg("porte");
const top = Number(arg("top", 20));
const rotulo = arg("rotulo", ufs ? ufs.join("/") : "Brasil");
const destinoJson = arg("json");

const cnaeFiltro = "(" + CNAES.map((p) => `e.cnae_fiscal_principal LIKE '${p}%'`).join(" OR ") + ")";
const ufFiltro = ufs ? `AND e.sigla_uf IN (${ufs.map((u) => `'${u}'`).join(",")})` : "";
const porteFiltro = porte ? `AND REGEXP_REPLACE(emp.porte,'^0','') = '${porte}'` : "";

const sql = `
WITH soc AS (
  -- Espelha ctesSocios() de lib/score-sql.mjs, mais n_pj: o filtro de "ainda
  -- independente" (nenhum sócio PJ no quadro) não é insumo do score, é da tese —
  -- empresa que já tem PJ no quadro ou já vendeu, ou já é holding de família.
  SELECT cnpj_basico,
    MAX(SAFE_CAST(faixa_etaria AS INT64)) AS mf,
    MIN(NULLIF(SAFE_CAST(faixa_etaria AS INT64), 0)) AS menor,
    MAX(data_entrada_sociedade) AS ult,
    COUNTIF(tipo='2') AS n_pf,
    COUNTIF(tipo='1') AS n_pj
  FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${SNAP}' GROUP BY 1
),
bruto AS (
  SELECT
    e.cnpj_basico, emp.razao_social, e.id_municipio, e.sigla_uf,
    e.cnae_fiscal_principal AS cnae,
    REGEXP_REPLACE(emp.porte,'^0','') AS porte_n,
    soc.mf, soc.menor, soc.n_pf, soc.n_pj,
    DATE_DIFF(DATE('${SNAP}'), soc.ult, YEAR) AS anos_ult,
    SAFE_CAST(emp.capital_social AS FLOAT64) AS capital,
    'metalmec' AS vertical,
    (${ANO} - EXTRACT(YEAR FROM e.data_inicio_atividade)) AS idade_emp
  FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e
  JOIN \`basedosdados.br_me_cnpj.empresas\` emp
    ON emp.cnpj_basico = e.cnpj_basico AND emp.data = '${SNAP}'
  JOIN soc ON soc.cnpj_basico = e.cnpj_basico
  WHERE e.data = '${SNAP}'
    AND e.identificador_matriz_filial = '1'   -- matriz, não filial (senão conta a mesma empresa N vezes)
    AND e.situacao_cadastral = '2'            -- ATIVA. Baixada/inapta nunca foi prospect
    AND emp.natureza_juridica LIKE '2%'       -- entidades empresariais (fora MEI/associação/órgão público)
    AND ${cnaeFiltro}
    ${ufFiltro}
    ${porteFiltro}
),
-- cap_pct é percentil DENTRO do recorte rodado, não do Brasil. Numa lista regional
-- é o que interessa comercialmente ("está no topo do capital do setor na praça dele").
-- Se quiser comparar recortes entre si, rode sem --uf e filtre depois.
universo AS (
  SELECT *, ${SCORE_V1} AS score
  FROM (SELECT *, ${CAP_PCT} AS cap_pct FROM bruto)
),
-- PERFIL SUCESSÓRIO: a porta de entrada da tese, não um eixo do score.
-- sócio 61+ (mf>=7) · empresa 25+ anos · só sócio PF · ainda independente.
alvos AS (
  SELECT * FROM universo
  WHERE mf >= 7 AND idade_emp >= 25 AND n_pf >= 1 AND n_pj = 0
)
SELECT
  (SELECT COUNT(*) FROM universo) AS universo,
  (SELECT COUNT(*) FROM alvos)    AS alvos,
  (SELECT ARRAY_AGG(STRUCT(mf, n) ORDER BY mf DESC)
     FROM (SELECT mf, COUNT(*) n FROM alvos GROUP BY 1))            AS por_faixa,
  (SELECT ARRAY_AGG(STRUCT(porte_n, n) ORDER BY porte_n DESC)
     FROM (SELECT porte_n, COUNT(*) n FROM alvos GROUP BY 1))       AS por_porte,
  (SELECT ARRAY_AGG(STRUCT(sigla_uf, n) ORDER BY n DESC)
     FROM (SELECT sigla_uf, COUNT(*) n FROM alvos GROUP BY 1))      AS por_uf,
  (SELECT ARRAY_AGG(STRUCT(cnae2, n) ORDER BY n DESC)
     FROM (SELECT SUBSTR(cnae,1,2) cnae2, COUNT(*) n FROM alvos GROUP BY 1)) AS por_cnae,
  (SELECT ARRAY_AGG(STRUCT(faixa, n) ORDER BY faixa DESC)
     FROM (SELECT CASE WHEN idade_emp >= 40 THEN '40+'
                       WHEN idade_emp >= 30 THEN '30-39' ELSE '25-29' END AS faixa,
                  COUNT(*) n FROM alvos GROUP BY 1))                AS por_idade,
  (SELECT ARRAY_AGG(STRUCT(razao_social, municipio, sigla_uf, mf, idade_emp, n_pf, porte_n, score)
                    ORDER BY score DESC, idade_emp DESC LIMIT ${top})
     FROM (
       SELECT a.razao_social, COALESCE(m.nome, a.id_municipio) AS municipio,
              a.sigla_uf, a.mf, a.idade_emp, a.n_pf, a.porte_n, a.score
       FROM alvos a
       LEFT JOIN \`basedosdados.br_bd_diretorios_brasil.municipio\` m
         ON m.id_municipio_rf = a.id_municipio
     ))                                                             AS topo`;

const [[r]] = await bq.query({ query: sql, location: "US" });

const pct = (n) => `${Math.round((Number(n) / Number(r.alvos)) * 100)}%`;
const linha = (arr, chave, mapa) =>
  arr.map((x) => `${mapa ? mapa[String(x[chave])] ?? x[chave] : x[chave]} ${Number(x.n)} (${pct(x.n)})`).join(" · ");

console.log(`\nMETALMECÂNICA — ${rotulo}`);
console.log(`CNAE ${CNAES.join("/")} · snapshot ${SNAP} · score v1\n`);
console.log(`Universo (ativas, matriz, empresariais): ${Number(r.universo).toLocaleString("pt-BR")}`);
console.log(`ALVOS com perfil sucessório:            ${Number(r.alvos).toLocaleString("pt-BR")}`);
console.log(`  criterio: sócio 61+ · empresa 25+ anos · só sócio PF · nenhum sócio PJ no quadro\n`);
console.log(`Faixa etária do sócio mais velho: ${linha(r.por_faixa, "mf", FAIXA)}`);
console.log(`Idade da empresa:                 ${linha(r.por_idade, "faixa")}`);
console.log(`Porte:                            ${linha(r.por_porte, "porte_n", PORTE)}`);
console.log(`CNAE:                             ${linha(r.por_cnae, "cnae2")}`);
if (r.por_uf.length > 1) console.log(`UF:                               ${linha(r.por_uf, "sigla_uf")}`);

console.log(`\nTop ${top} por score (a PROVA — mandar no máximo 3):\n`);
for (const t of r.topo) {
  console.log(
    `[${String(t.score).padStart(3)}] ${String(t.razao_social).slice(0, 42).padEnd(42)} ` +
    `${String(t.municipio).slice(0, 16).padEnd(16)} ${t.sigla_uf}  ` +
    `sócio ${FAIXA[String(t.mf)]}, ${t.idade_emp}a, ${t.n_pf} sócio(s), ${PORTE[String(t.porte_n)] ?? t.porte_n}`
  );
}

if (destinoJson) {
  writeFileSync(destinoJson, JSON.stringify({ rotulo, snapshot: SNAP, cnaes: CNAES, ...r }, null, 2));
  console.log(`\n→ ${destinoJson}`);
}
