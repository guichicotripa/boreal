/**
 * Extrai UMA VEZ a matriz de features + label de aquisicao pro loop de calibracao.
 *
 *   node --env-file=.env.local scripts/extrai-matriz-score.mjs
 *   node --env-file=.env.local scripts/extrai-matriz-score.mjs --saida=scripts/data/matriz.tsv
 *
 * POR QUE EXTRAIR EM VEZ DE ITERAR NO BIGQUERY: calibrar exige milhares de avaliacoes
 * de variantes de peso. Cada uma no BigQuery e uma varredura das tabelas de CNPJ, o que
 * torna a busca lenta e cara o suficiente pra ninguem rodar. Com a matriz local o loop
 * roda em numpy em milissegundos, e o BigQuery e tocado exatamente uma vez.
 *
 * O QUE ENTRA NA MATRIZ: so feature que o RUNTIME consegue calcular a partir das tabelas
 * `empresa` e `socio` do Supabase. Ajustar peso em cima de algo que a producao nao enxerga
 * produz um score bonito no papel e inimplementavel. A unica excecao e `n_estab` (numero de
 * estabelecimentos), extraido de proposito pra medir QUANTO ele valeria: ele tem lift 1,97x
 * (z=9,9) mas nao esta na tabela `empresa` hoje, entao entra como evidencia pra decidir se
 * vale mudar o ingest, e nao como eixo candidato.
 *
 * ZERO LOOKAHEAD: features lidas no snapshot de corte, aquisicoes detectadas no snapshot
 * seguinte. A metade do holdout ja vem marcada pela mesma regra de hash da validacao
 * existente (MOD(ABS(FARM_FINGERPRINT(cnpj)), 2)), pra que "holdout" signifique a mesma
 * coisa aqui e em scripts/validacao-score-v1.mjs.
 */
import { BigQuery } from "@google-cloud/bigquery";
import { createWriteStream, readFileSync, mkdirSync } from "fs";
import { createGzip } from "zlib";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const flag = (n, p = null) => {
  const a = args.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3).trim() : p;
};

const CORTE = flag("corte", "2023-06-10");
const NOVO = flag("novo", "2025-11-09");
const SAIDA = path.resolve(ROOT, flag("saida", "scripts/data/matriz-score.tsv.gz"));

const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: path.resolve(ROOT, process.env.GCP_KEY_PATH),
});

const reg = JSON.parse(readFileSync(path.resolve(ROOT, "src/lib/setores.json"), "utf8"));
const likeDe = (s) => "(" + s.cnaes.map((p) => `e.cnae_fiscal_principal LIKE '${p}%'`).join(" OR ") + ")";
const caseVertical = "CASE " + reg.setores.map((s) => `WHEN ${likeDe(s)} THEN '${s.id}'`).join(" ") + " END";
const filtroCnae = "(" + reg.setores.map(likeDe).join(" OR ") + ")";

/* cap_pct e PERCENT_RANK dentro do vertical, igual a producao usa percentil do setor.
   Diferenca conhecida e aceita: em producao os cortes saem da base indexada no Supabase
   (capital-percentis.json) e aqui saem do universo nacional do BigQuery. Pra MEDIR poder
   discriminante o universo e a referencia certa; o artefato de producao continua sendo
   regerado por build-capital-percentis.mjs. */
const sql = `
WITH sc AS (
  SELECT cnpj_basico,
    MAX(NULLIF(SAFE_CAST(faixa_etaria AS INT64), 0))  AS mf,
    MIN(NULLIF(SAFE_CAST(faixa_etaria AS INT64), 0))  AS menor,
    MAX(data_entrada_sociedade)                        AS ult,
    COUNTIF(tipo = '2')                                AS n_pf,
    COUNTIF(tipo = '1')                                AS n_pj
  FROM \`basedosdados.br_me_cnpj.socios\` WHERE data = '${CORTE}' GROUP BY 1
),
est AS (
  SELECT cnpj_basico, COUNT(*) AS n_estab
  FROM \`basedosdados.br_me_cnpj.estabelecimentos\` WHERE data = '${CORTE}' GROUP BY 1
),
base AS (
  SELECT
    e.cnpj_basico,
    ${caseVertical}                                              AS vertical,
    MOD(ABS(FARM_FINGERPRINT(e.cnpj_basico)), 2)                 AS metade,
    COALESCE(sc.mf, 0)                                           AS mf,
    COALESCE(sc.menor, 0)                                        AS menor,
    COALESCE(sc.n_pf, 0)                                         AS n_pf,
    COALESCE(sc.n_pj, 0)                                         AS n_pj,
    DATE_DIFF(DATE('${CORTE}'), sc.ult, YEAR)                    AS anos_ult,
    DATE_DIFF(DATE('${CORTE}'), e.data_inicio_atividade, YEAR)   AS anos_emp,
    SAFE_CAST(emp.capital_social AS FLOAT64)                     AS capital,
    COALESCE(est.n_estab, 1)                                     AS n_estab
  FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e
  JOIN \`basedosdados.br_me_cnpj.empresas\` emp
    ON emp.cnpj_basico = e.cnpj_basico AND emp.data = '${CORTE}'
  LEFT JOIN sc  ON sc.cnpj_basico  = e.cnpj_basico
  LEFT JOIN est ON est.cnpj_basico = e.cnpj_basico
  WHERE e.data = '${CORTE}'
    AND e.identificador_matriz_filial = '1'
    AND e.situacao_cadastral = '2'
    AND ${filtroCnae}
),
comcap AS (
  SELECT *, PERCENT_RANK() OVER (PARTITION BY vertical ORDER BY COALESCE(capital, 0)) AS cap_pct
  FROM base
),
-- Quadro societario no snapshot de DESFECHO. A contagem do corte ja veio do CTE sc.
b AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf
      FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${NOVO}' GROUP BY 1)
-- NAO gravamos o label pronto, e sim a CONTAGEM DE SOCIOS nos dois snapshots.
-- O label "aquisicao" e uma definicao, nao um dado, e a primeira rodada de calibracao
-- mostrou que a definicao vaza: com "entra PJ e sai PF", uma empresa de 5 socios tem
-- cinco chances de alguem sair e uma de 1 socio precisa que aquele exato saia, entao o
-- otimizador aprende a contar socios. Guardando os contadores crus, qualquer definicao
-- alternativa e testavel localmente, sem voltar ao BigQuery.
SELECT
  c.vertical, c.metade, c.mf, c.menor, c.n_pf, c.n_pj,
  c.anos_ult, c.anos_emp, ROUND(c.cap_pct, 6) AS cap_pct, c.n_estab,
  IF(b.cnpj_basico IS NULL, -1, b.pf) AS pf_novo,
  IF(b.cnpj_basico IS NULL, -1, b.pj) AS pj_novo
FROM comcap c
LEFT JOIN b ON b.cnpj_basico = c.cnpj_basico`;

const COLS = ["vertical","metade","mf","menor","n_pf","n_pj","anos_ult","anos_emp","cap_pct","n_estab","pf_novo","pj_novo"];

mkdirSync(path.dirname(SAIDA), { recursive: true });
const gz = createGzip({ level: 6 });
const out = createWriteStream(SAIDA);
gz.pipe(out);
gz.write(COLS.join("\t") + "\n");

console.log(`corte ${CORTE} → desfecho ${NOVO}`);
console.log(`verticais: ${reg.setores.map((s) => s.id).join(", ")}`);
console.log("consultando o BigQuery (stream)...");

let n = 0, nAdq = 0;
const t0 = Date.now();

await new Promise((resolve, reject) => {
  const stream = bq.createQueryStream({ query: sql, location: "US" });
  stream
    .on("error", reject)
    .on("data", (row) => {
      // anos_ult vem null quando a empresa nao tem socio com data de entrada:
      // -1 marca "sem informacao" sem colidir com "entrou este ano" (0).
      const linha = [
        row.vertical, row.metade, row.mf, row.menor, row.n_pf, row.n_pj,
        row.anos_ult == null ? -1 : row.anos_ult,
        row.anos_emp == null ? -1 : row.anos_emp,
        row.cap_pct, row.n_estab, row.pf_novo, row.pj_novo,
      ].join("\t");
      n += 1;
      if (Number(row.pj_novo) > Number(row.n_pj) && Number(row.pf_novo) < Number(row.n_pf)) nAdq += 1;
      // Contrapressao de verdade: se o gzip encheu o buffer, para de puxar linha do
      // BigQuery ate ele drenar. Sem isto, milhoes de linhas se acumulam em memoria.
      if (!gz.write(linha + "\n")) {
        stream.pause();
        gz.once("drain", () => stream.resume());
      }
      if (n % 200000 === 0) console.log(`  ${n.toLocaleString("pt-BR")} linhas...`);
    })
    .on("end", resolve);
});

gz.end();
await new Promise((r) => out.on("close", r));

const seg = ((Date.now() - t0) / 1000).toFixed(0);
console.log(`\nok: ${SAIDA}`);
console.log(`  ${n.toLocaleString("pt-BR")} empresas, ${nAdq.toLocaleString("pt-BR")} aquisicoes (def. basica) (${(nAdq / n * 100).toFixed(2)}%), ${seg}s`);
