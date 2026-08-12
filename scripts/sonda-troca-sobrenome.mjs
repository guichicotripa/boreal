/**
 * A troca de dono e VENDA ou e HERANCA? O sobrenome separa.
 *
 *   node --env-file=.env.local scripts/sonda-troca-sobrenome.mjs
 *
 * CONTEXTO. `sonda-troca-de-dono.mjs` mostrou que empresa de 1 socio PF, hoje inclassificavel pelo
 * label de aquisicao, tem 14.726 trocas de identidade do dono em 292.506 empresas (5,03%), e que a
 * taxa sobe com a idade do dono (1,67x na faixa 71+). Isso seria a solucao do ponto cego estrutural
 * documentado em brain/modelo-de-score.md §13.
 *
 * SO QUE TEM UMA EXPLICACAO ALTERNATIVA QUE PRECISA MORRER PRIMEIRO: mortalidade. A taxa de obito
 * de brasileiro entre 71 e 80 anos em 2,4 anos e da mesma ordem dos 8,42% medidos. Se o label for
 * dominado por morte, o modelo aprende a prever obito e nao propensao a vender, o eixo de idade
 * "funciona" trivialmente, e o produto passa a indicar espolio pra um comprador que quer negociar
 * com quem decide. Seria a terceira vez em duas semanas que um numero bom vem de instrumento
 * quebrado (label contaminado em 02/08, flag do Simples em 11/08).
 *
 * O TESTE. Heranca quase sempre mantem sobrenome; venda quase sempre nao. Compara os TOKENS do nome
 * do dono antigo e do novo, ignorando particulas (DA/DE/DOS...) e sufixos de geracao
 * (JUNIOR/FILHO/NETO), que sao justamente o marcador de heranca e inflariam a semelhanca.
 *
 *   token em comum      -> sucessao familiar (heranca, doacao, reorganizacao)
 *   nenhum token comum  -> transacao com terceiro
 *
 * O numero que decide e o LIFT DA IDADE DENTRO DE "transacao". Se ele sobreviver ali, o eixo
 * `idade_controle` esta validado pra venda de verdade. Se so existir dentro de "heranca", o sinal
 * era mortalidade e o eixo continua sem validacao.
 *
 * Tambem devolve a faixa etaria do dono NOVO: heranca tende a passar pra alguem mais novo, entao
 * e uma segunda leitura independente sobre o mesmo corte.
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

/* Particulas e sufixos de geracao fora. JUNIOR/FILHO/NETO sao marcador de heranca, mas como TOKEN
   eles casariam entre pai e filho por si sos e inflariam "familiar" de graca. O sobrenome de
   verdade e que tem que casar. Token com menos de 4 letras cai junto (iniciais, "DR"). */
const LIXO = "'^(DA|DE|DO|DAS|DOS|E|DI|DEL|VAN|VON|JUNIOR|JR|FILHO|FILHA|NETO|NETA|SOBRINHO|SOBRINHA)$'";
const TOKENS = (col) => `ARRAY(
  SELECT t FROM UNNEST(SPLIT(REGEXP_REPLACE(NORMALIZE(UPPER(COALESCE(${col}, '')), NFD), r'\\pM', ''), ' ')) t
  WHERE LENGTH(t) >= 4 AND NOT REGEXP_CONTAINS(t, ${LIXO}))`;

const sql = `
WITH a AS (
  SELECT cnpj_basico,
    ANY_VALUE(documento) AS doc, ANY_VALUE(nome) AS nome,
    ANY_VALUE(NULLIF(SAFE_CAST(faixa_etaria AS INT64), 0)) AS mf
  FROM \`basedosdados.br_me_cnpj.socios\`
  WHERE data='${CORTE}' AND tipo='2' GROUP BY 1 HAVING COUNT(*) = 1
),
b AS (
  SELECT cnpj_basico,
    COUNTIF(tipo='2') AS n_pf,
    ANY_VALUE(IF(tipo='2', documento, NULL)) AS doc,
    ANY_VALUE(IF(tipo='2', nome, NULL)) AS nome,
    ANY_VALUE(IF(tipo='2', NULLIF(SAFE_CAST(faixa_etaria AS INT64), 0), NULL)) AS mf
  FROM \`basedosdados.br_me_cnpj.socios\`
  WHERE data='${NOVO}' GROUP BY 1 HAVING COUNTIF(tipo='2') = 1
),
troca AS (
  SELECT
    a.mf AS mf_antigo, b.mf AS mf_novo,
    DATE_DIFF(DATE('${CORTE}'), e.data_inicio_atividade, YEAR) AS anos_emp,
    a.doc != b.doc AS trocou,
    ARRAY_LENGTH(ARRAY(SELECT t FROM UNNEST(${TOKENS("a.nome")}) t
                       WHERE t IN UNNEST(${TOKENS("b.nome")}))) AS tokens_comuns
  FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e
  JOIN a ON a.cnpj_basico = e.cnpj_basico
  JOIN b ON b.cnpj_basico = e.cnpj_basico
  WHERE e.data='${CORTE}' AND e.identificador_matriz_filial='1'
    AND e.situacao_cadastral='2' AND ${filtroCnae}
)
SELECT
  CASE WHEN mf_antigo >= 8 THEN '71+' WHEN mf_antigo = 7 THEN '61-70'
       WHEN mf_antigo = 6 THEN '51-60' WHEN mf_antigo IS NULL THEN 'sem idade'
       ELSE 'ate 50' END AS faixa_dono,
  COUNT(*) AS n,
  COUNTIF(trocou) AS trocou,
  COUNTIF(trocou AND tokens_comuns = 0) AS transacao,
  COUNTIF(trocou AND tokens_comuns > 0) AS familiar,
  COUNTIF(trocou AND tokens_comuns = 0 AND anos_emp >= 25) AS transacao_25mais,
  ROUND(AVG(IF(trocou AND tokens_comuns > 0, mf_novo, NULL)), 2) AS mf_novo_familiar,
  ROUND(AVG(IF(trocou AND tokens_comuns = 0, mf_novo, NULL)), 2) AS mf_novo_transacao
FROM troca GROUP BY 1 ORDER BY n DESC`;

const [rows] = await bq.query({ query: sql, location: "US" });
const soma = (k) => rows.reduce((s, r) => s + Number(r[k]), 0);
const [tot, totT, totX, totF] = ["n", "trocou", "transacao", "familiar"].map(soma);

console.log(`empresas de 1 socio PF, presentes nos dois snapshots: ${tot.toLocaleString("pt-BR")}`);
console.log(`trocaram de dono: ${totT.toLocaleString("pt-BR")} (${(totT / tot * 100).toFixed(2)}%)`);
console.log(`  · transacao (nenhum sobrenome em comum): ${totX.toLocaleString("pt-BR")} (${(totX / totT * 100).toFixed(0)}% das trocas)`);
console.log(`  · familiar  (sobrenome em comum):        ${totF.toLocaleString("pt-BR")} (${(totF / totT * 100).toFixed(0)}% das trocas)\n`);

const n = (v) => Number(v).toLocaleString("pt-BR");
const bx = totX / tot, bf = totF / tot;
console.log("faixa do dono".padEnd(13) + "n".padStart(9) + "transacao".padStart(11) + "taxa".padStart(8) + "lift".padStart(7)
  + "familiar".padStart(10) + "taxa".padStart(8) + "lift".padStart(7) + "idade novo dono".padStart(18));
console.log("-".repeat(91));
for (const r of rows) {
  const tx = Number(r.transacao) / Number(r.n), tf = Number(r.familiar) / Number(r.n);
  console.log(String(r.faixa_dono).padEnd(13) + n(r.n).padStart(9) + n(r.transacao).padStart(11) +
    (tx * 100).toFixed(2).padStart(7) + "%" + (tx / bx).toFixed(2).padStart(6) + "x" +
    n(r.familiar).padStart(10) + (tf * 100).toFixed(2).padStart(7) + "%" + (tf / bf).toFixed(2).padStart(6) + "x" +
    `  trans ${r.mf_novo_transacao ?? "-"} / fam ${r.mf_novo_familiar ?? "-"}`.padStart(18));
}
console.log("\nfaixa etaria: 6=51-60 · 7=61-70 · 8=71-80 · 9=80+");
console.log("Leitura: se o lift de TRANSACAO subir com a idade do dono, o eixo idade_controle esta");
console.log("validado pra venda de verdade. Se so FAMILIAR subir, o sinal era mortalidade.");
