/**
 * O label de aquisicao e cego pra empresa de socio unico. Trocar a IDENTIDADE do socio resolve?
 *
 *   node --env-file=.env.local scripts/sonda-troca-de-dono.mjs
 *
 * O label de hoje e "entra socio PJ e sai socio PF" entre dois snapshots. Ele exige que SOBRE
 * alguem no quadro, entao empresa de 1 socio PF e estruturalmente inclassificavel: sair de 1 pra 0
 * acontece 1 vez em 292 mil (medido em 02/08/2026, brain/modelo-de-score.md §13). Sao 292 mil
 * empresas no denominador que nunca podem contar como acerto perdido, e e justamente o perfil que
 * a tese de sucessao mais quer prever.
 *
 * HIPOTESE: a venda de uma empresa de dono unico nao aparece como QUEDA na contagem de socios,
 * aparece como TROCA de identidade. O dono sai e outro entra, e a contagem fica em 1 o tempo todo.
 * A tabela `socios` tem `documento` (CPF mascarado), entao da pra comparar conjuntos e nao so
 * contagens.
 *
 * O QUE A QUERY MEDE, so em empresas com exatamente 1 socio PF no corte:
 *   · quantas trocaram o documento do socio unico
 *   · quantas mantiveram
 *   · o mesmo, cruzado com a faixa etaria do dono no corte, que e o teste que o label atual nao
 *     consegue fazer: se troca de dono sobe com a idade do dono, o eixo `idade_controle` volta a
 *     ter como ser validado.
 */
import { BigQuery } from "@google-cloud/bigquery";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID, keyFilename: path.resolve(ROOT, process.env.GCP_KEY_PATH) });

const CORTE = "2023-06-10", NOVO = "2025-11-09";
const reg = JSON.parse(readFileSync(path.resolve(ROOT, "src/lib/setores.json"), "utf8"));
const likeDe = (s) => "(" + s.cnaes.map((p) => `e.cnae_fiscal_principal LIKE '${p}%'`).join(" OR ") + ")";
const filtroCnae = "(" + reg.setores.map(likeDe).join(" OR ") + ")";

const sql = `
WITH a AS (
  SELECT cnpj_basico,
    COUNTIF(tipo='2') AS n_pf,
    ANY_VALUE(IF(tipo='2', documento, NULL)) AS doc_pf,
    MAX(NULLIF(SAFE_CAST(faixa_etaria AS INT64),0)) AS mf
  FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${CORTE}' GROUP BY 1
),
b AS (
  SELECT cnpj_basico,
    COUNTIF(tipo='2') AS n_pf,
    COUNTIF(tipo='1') AS n_pj,
    ARRAY_AGG(IF(tipo='2', documento, NULL) IGNORE NULLS) AS docs_pf
  FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${NOVO}' GROUP BY 1
),
base AS (
  SELECT e.cnpj_basico, a.n_pf, a.doc_pf, a.mf, b.n_pf AS pf_novo, b.n_pj AS pj_novo, b.docs_pf,
    DATE_DIFF(DATE('${CORTE}'), e.data_inicio_atividade, YEAR) AS anos_emp
  FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e
  JOIN a ON a.cnpj_basico = e.cnpj_basico
  JOIN b ON b.cnpj_basico = e.cnpj_basico
  WHERE e.data='${CORTE}' AND e.identificador_matriz_filial='1'
    AND e.situacao_cadastral='2' AND ${filtroCnae}
    AND a.n_pf = 1
)
SELECT
  CASE WHEN mf >= 8 THEN '71+' WHEN mf = 7 THEN '61-70' WHEN mf = 6 THEN '51-60'
       WHEN mf IS NULL THEN 'sem idade' ELSE 'ate 50' END AS faixa_dono,
  COUNT(*) AS n,
  COUNTIF(pf_novo = 1 AND doc_pf NOT IN UNNEST(docs_pf)) AS trocou_dono,
  COUNTIF(pf_novo = 1 AND doc_pf IN UNNEST(docs_pf))     AS mesmo_dono,
  COUNTIF(pj_novo > 0)                                    AS entrou_pj,
  COUNTIF(pf_novo = 0)                                    AS zerou_pf,
  COUNTIF(anos_emp >= 25)                                 AS empresa_25mais
FROM base GROUP BY 1 ORDER BY n DESC`;

const [rows] = await bq.query({ query: sql, location: "US" });
const tot = rows.reduce((s, r) => s + Number(r.n), 0);
const totT = rows.reduce((s, r) => s + Number(r.trocou_dono), 0);
console.log(`empresas com EXATAMENTE 1 socio PF no corte: ${tot.toLocaleString("pt-BR")}`);
console.log(`trocaram de dono ate o desfecho: ${totT.toLocaleString("pt-BR")} (${(totT/tot*100).toFixed(2)}%)`);
console.log(`\n(pra comparar: o label atual detecta 1.610 aquisicoes em 1,46 mi de empresas, 0,11%)\n`);
const n = (v) => Number(v).toLocaleString("pt-BR");
console.log("faixa do dono".padEnd(14) + "n".padStart(10) + "trocou".padStart(9) + "taxa".padStart(9) + "lift".padStart(8) + "zerou PF".padStart(10) + "entrou PJ".padStart(11));
console.log("-".repeat(71));
const base = totT / tot;
for (const r of rows) {
  const taxa = Number(r.trocou_dono) / Number(r.n);
  console.log(String(r.faixa_dono).padEnd(14) + n(r.n).padStart(10) + n(r.trocou_dono).padStart(9) +
    (taxa*100).toFixed(2).padStart(8) + "%" + (taxa/base).toFixed(2).padStart(7) + "x" +
    n(r.zerou_pf).padStart(10) + n(r.entrou_pj).padStart(11));
}
