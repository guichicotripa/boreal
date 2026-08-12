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
-- A tabela \`simples\` NAO tem particao por data: ela e estado atual, de 2026.
--
-- SO EXISTE UMA FEATURE SEGURA AQUI, e a primeira versao deste bloco errou nas outras duas.
-- A Lei Complementar 123 proibe empresa com socio PJ de ficar no Simples. Como o label de
-- aquisicao E "entra socio PJ", toda adquirida foi obrigada a sair do Simples. Entao qualquer
-- feature que dependa de a empresa AINDA estar no Simples, ou de a data de exclusao ser nula,
-- le o desfecho. Medido em check-vazamento-simples.mjs: 137.328 empresas com a flag atual ligada
-- e sem data de exclusao tiveram 28 aquisicoes contra as ~490 esperadas, lift 0,06x. Isso nao e
-- previsao, e consequencia.
--
-- O que sobra e o que olha so pro passado do corte:
--   saiu_simples = data_exclusao_simples < CORTE. A empresa ja tinha estourado o teto de receita
--                  (R$4,8 mi) ANTES da foto, o que e fato conhecido na data do corte. Lift
--                  medido: 2,15x no universo elegivel.
-- Limitacao conhecida: a tabela guarda so a ultima opcao e a ultima exclusao, entao empresa que
-- saiu e voltou aparece so com o ultimo par. E caso de borda, nao corrige aqui.
simp AS (
  SELECT cnpj_basico,
    IF(data_exclusao_simples IS NOT NULL AND data_exclusao_simples < DATE('${CORTE}'), 1, 0) AS saiu_simples
  FROM \`basedosdados.br_me_cnpj.simples\`
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
    COALESCE(est.n_estab, 1)                                     AS n_estab,
    -- porte da Receita no corte: 1=ME, 3=EPP, 5=DEMAIS. 0 quando ausente.
    COALESCE(SAFE_CAST(emp.porte AS INT64), 0)                   AS porte,
    COALESCE(simp.saiu_simples, 0)                               AS saiu_simples
  FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e
  JOIN \`basedosdados.br_me_cnpj.empresas\` emp
    ON emp.cnpj_basico = e.cnpj_basico AND emp.data = '${CORTE}'
  LEFT JOIN sc   ON sc.cnpj_basico   = e.cnpj_basico
  LEFT JOIN est  ON est.cnpj_basico  = e.cnpj_basico
  LEFT JOIN simp ON simp.cnpj_basico = e.cnpj_basico
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
--
-- Alem da CONTAGEM, guardamos os DOCUMENTOS e os TOKENS DE NOME dos socios PF nos dois snapshots.
-- Motivo: o label "entra PJ e sai PF" e cego pra empresa de socio unico, que sao 292 mil no
-- universo e o caso central da tese sucessoria (§13 do modelo-de-score). Sair de 1 socio PF pra 0
-- nao acontece; o que acontece e TROCAR a identidade do dono, e isso so se ve comparando conjuntos
-- e nao contagens. Medido em 12/08/2026: 14.726 trocas em 279 mil empresas de dono unico, contra
-- 1.610 aquisicoes do label antigo em toda a base.
--
-- E preciso separar VENDA de HERANCA, senao o modelo aprende mortalidade: na faixa 71+ a taxa de
-- obito em 2,4 anos e da mesma ordem da taxa de troca. Heranca mantem sobrenome, venda nao. Os
-- tokens de nome (sem particulas e sem sufixo de geracao, que sao o proprio marcador de heranca e
-- inflariam a semelhanca) permitem a separacao localmente, sem voltar ao BigQuery.
tok AS (
  SELECT cnpj_basico, data, documento,
    ARRAY(SELECT t FROM UNNEST(SPLIT(REGEXP_REPLACE(NORMALIZE(UPPER(COALESCE(nome,'')), NFD), r'\pM',''), ' ')) t
          WHERE LENGTH(t) >= 4
            AND NOT REGEXP_CONTAINS(t, '^(DA|DE|DO|DAS|DOS|DI|DEL|VAN|VON|JUNIOR|FILHO|FILHA|NETO|NETA|SOBRINHO|SOBRINHA)$')) AS toks
  FROM \`basedosdados.br_me_cnpj.socios\`
  WHERE data IN ('${CORTE}', '${NOVO}') AND tipo = '2'
),
ta AS (SELECT cnpj_basico, ARRAY_AGG(documento) docs, ARRAY_CONCAT_AGG(toks) toks FROM tok WHERE data='${CORTE}' GROUP BY 1),
tb AS (SELECT cnpj_basico, ARRAY_AGG(documento) docs, ARRAY_CONCAT_AGG(toks) toks FROM tok WHERE data='${NOVO}'  GROUP BY 1),
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
  IF(b.cnpj_basico IS NULL, -1, b.pj) AS pj_novo,
  c.porte, c.saiu_simples,
  -- Socios PF do corte que NAO estao no desfecho, e do desfecho que NAO estavam no corte.
  -- Com n_pf=1 nos dois lados e saiu=entrou=1, isso e exatamente "trocou de dono".
  COALESCE(ARRAY_LENGTH(ARRAY(SELECT d FROM UNNEST(ta.docs) d WHERE d NOT IN UNNEST(tb.docs))), 0) AS pf_saiu,
  COALESCE(ARRAY_LENGTH(ARRAY(SELECT d FROM UNNEST(tb.docs) d WHERE d NOT IN UNNEST(ta.docs))), 0) AS pf_entrou,
  -- 1 = algum socio NOVO compartilha sobrenome com algum ANTIGO. Proxy de heranca.
  IF(ARRAY_LENGTH(ARRAY(SELECT t FROM UNNEST(tb.toks) t WHERE t IN UNNEST(ta.toks))) > 0, 1, 0) AS nome_em_comum,
  -- Desempate ESTAVEL, derivado do proprio CNPJ. Sem isto o calibra-score.py sorteava o
  -- desempate por POSICAO da linha, e o BigQuery nao garante ordem entre extracoes: a mesma
  -- matriz reextraida dava recall diferente (31,74% e 31,86% no mesmo baseline, em 02/08 e
  -- 11/08). O score tem ~60 valores distintos pra 200 mil empresas, entao a fronteira do decil
  -- cai dentro de um bloco enorme de empates e quem entra depende so do desempate.
  MOD(ABS(FARM_FINGERPRINT(c.cnpj_basico)), 1000000) / 1000000.0 AS desempate
FROM comcap c
LEFT JOIN b  ON b.cnpj_basico  = c.cnpj_basico
LEFT JOIN ta ON ta.cnpj_basico = c.cnpj_basico
LEFT JOIN tb ON tb.cnpj_basico = c.cnpj_basico`;

// Colunas novas vao no FIM de proposito: calibra-score.py e diagnostico-label.py leem por nome
// via mapa do header, entao acrescentar no fim nao quebra nenhum dos dois.
const COLS = ["vertical","metade","mf","menor","n_pf","n_pj","anos_ult","anos_emp","cap_pct","n_estab","pf_novo","pj_novo",
              "porte","saiu_simples","pf_saiu","pf_entrou","nome_em_comum","desempate"];

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
        row.porte, row.saiu_simples, row.pf_saiu, row.pf_entrou, row.nome_em_comum, row.desempate,
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
