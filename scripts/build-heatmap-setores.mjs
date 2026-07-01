// HEATMAP DE SETORES — métrica de atividade de M&A por (UF × divisão CNAE), BRASIL INTEIRO.
// Duas saídas:
//   1. src/lib/heatmap-setores.json — agregados (universo ativo + aquisições limpas) por UF e divisão.
//      Alimenta o mapa; o front agrega por região (ou Brasil) e normaliza a cor dentro da seleção.
//   2. scripts/data/aquisicoes-br.json — GROUND TRUTH bruto+enriquecido (cnpj, uf, div, idade, flags).
//      Fora do bundle do front. Guarda TODOS os campos → dá pra re-filtrar sem re-consultar o BigQuery.
//
// DEFINIÇÃO DE AQUISIÇÃO e as DUAS LIMPEZAS (ver diag-spe / decisions.md):
//   Sinal cru = PJ entrou E PF saiu entre os 2 snapshots do CNPJ. Esse sinal mistura M&A real com dois
//   artefatos que NÃO são venda de empresa estabelecida:
//     (A) SPE/newco — empresa jovem criada pro empreendimento (energia, construção, incorporadora).
//         Filtro: idade < 5 anos no corte → descarta.
//     (B) Reorganização de holding — a família move as cotas das PF pra própria holding/participações
//         (planejamento sucessório/tributário), não é venda. Filtro: se as ÚNICAS PJ que entraram têm
//         nome de holding/participações/patrimonial/incorporadora → descarta.
//   Universo (denominador) = só matriz ATIVA (situacao_cadastral='2'); antes contava baixada/inapta e
//   inflava o denominador em >2x, afundando a densidade de todo mundo.
//   HONESTIDADE: atividade OBSERVADA de troca de controle de empresa estabelecida; a validação do recall
//   (score) só existe nos setores cobertos (setores.json).
//   node --env-file=.env.local scripts/build-heatmap-setores.mjs
import { BigQuery } from "@google-cloud/bigquery";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";

const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: path.resolve(process.env.GCP_KEY_PATH),
});
const CORTE = "2023-06-10";
const NOVO = "2025-11-09";
const ANOS = 2.4;
const IDADE_MIN = 5; // < 5 anos no corte = newco/SPE, não empresa estabelecida sendo adquirida
// Setores em que a SPE é a forma legal DOMINANTE (patrimônio de afetação na construção/incorporadora,
// SPE-por-usina exigida na geração de energia). SÓ nesses o "só entraram holdings" é artefato com alta
// precisão. Fora deles, holding entrando costuma ser adquirente real (PE/estratégico) — não filtrar.
const SPE_SECTORS = new Set(["41", "42", "43", "68", "35"]);

// Nome de PJ entrante que denuncia reorganização de holding (não é adquirente operacional).
// Dados da Receita são ASCII maiúsculo sem acento. INCORPORAD pega SPE de incorporadora (setor F/L).
const HOLDING_RE = "PARTICIPAC|HOLDING|EMPREEND|INCORPORAD|PATRIMON|ADMINISTRACAO DE BENS|GESTAO DE BENS";

// Universo por (UF, divisão) — matriz ATIVA no snapshot novo, Brasil inteiro.
const sqlUniverso = `
SELECT sigla_uf AS uf, SUBSTR(cnae_fiscal_principal,1,2) AS div, COUNT(*) AS universo
FROM \`basedosdados.br_me_cnpj.estabelecimentos\`
WHERE data='${NOVO}' AND identificador_matriz_filial='1'
  AND situacao_cadastral='2' AND sigla_uf IS NOT NULL
GROUP BY 1,2`;

// Aquisições detectadas + enriquecidas: idade e situação da adquirida, e a natureza das PJ que entraram.
const sqlAquisicoes = `
WITH
c AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf,
        ARRAY_AGG(IF(tipo='1', nome, NULL) IGNORE NULLS) pjn
      FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${CORTE}' GROUP BY 1),
n AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf,
        ARRAY_AGG(IF(tipo='1', nome, NULL) IGNORE NULLS) pjn
      FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${NOVO}' GROUP BY 1),
cand AS (
  SELECT n.cnpj_basico, c.pjn AS pjn_c, n.pjn AS pjn_n
  FROM c JOIN n USING(cnpj_basico)
  WHERE n.pj > c.pj AND n.pf < c.pf),
-- Das PJ que estão em NOVO e não estavam no CORTE: quantas são holding vs operacionais.
flag AS (
  SELECT cnpj_basico,
    COUNTIF(NOT REGEXP_CONTAINS(nm, r'${HOLDING_RE}')) AS novos_op,
    COUNTIF(REGEXP_CONTAINS(nm, r'${HOLDING_RE}')) AS novos_hold
  FROM cand, UNNEST(pjn_n) AS nm
  WHERE nm NOT IN UNNEST(pjn_c)
  GROUP BY 1),
estC AS (SELECT cnpj_basico, sigla_uf AS uf, SUBSTR(cnae_fiscal_principal,1,2) AS div,
           2023 - EXTRACT(YEAR FROM data_inicio_atividade) AS idade
         FROM \`basedosdados.br_me_cnpj.estabelecimentos\`
         WHERE data='${CORTE}' AND identificador_matriz_filial='1'),
estN AS (SELECT cnpj_basico, situacao_cadastral AS sit
         FROM \`basedosdados.br_me_cnpj.estabelecimentos\`
         WHERE data='${NOVO}' AND identificador_matriz_filial='1')
SELECT e.uf, e.div, e.cnpj_basico, e.idade,
       COALESCE(en.sit,'?') AS sit,
       COALESCE(f.novos_op,0) AS novos_op, COALESCE(f.novos_hold,0) AS novos_hold
FROM cand
JOIN estC e USING(cnpj_basico)
LEFT JOIN estN en USING(cnpj_basico)
LEFT JOIN flag f USING(cnpj_basico)
WHERE e.uf IS NOT NULL AND e.div IS NOT NULL`;

console.log("Q1: universo (matriz ativa) por (UF, divisão)…");
const [uniRows] = await bq.query({ query: sqlUniverso, location: "US" });
console.log(`  ${uniRows.length} pares (uf, div).`);

console.log("Q2: aquisições detectadas + enriquecidas…");
const [adqRows] = await bq.query({ query: sqlAquisicoes, location: "US" });
console.log(`  ${adqRows.length} candidatas brutas.`);

// --- Classificação das candidatas ---
// newco    = idade < IDADE_MIN (SPE/empresa recém-criada)
// holding  = só entraram PJ de holding/participações (novos_op==0 && novos_hold>=1)
// limpa    = ativa no novo && !newco && !(holding E setor SPE-heavy)
// NOTA — o filtro de holding é aplicado SÓ nos SPE_SECTORS. Testado global e DESCARTADO: cortava 60-73%
//   de TODOS os setores igualmente, inclusive os validados (Máquinas 81→29), porque nome
//   "Participações/Holding" não separa a holding-da-família da holding-do-adquirente (PE/estratégico entra
//   via SPV o tempo todo). Só nos setores onde a SPE é a forma legal dominante (constr/imob/energia) o
//   sinal é preciso: lá derruba o artefato (imob 0.317→0.093, energia 0.415→0.196) sem tocar metalmec.
const classifica = (r) => {
  const idade = Number(r.idade);
  const ativa = r.sit === "2";
  const newco = idade < IDADE_MIN;
  const holding = Number(r.novos_op) === 0 && Number(r.novos_hold) >= 1;
  const speArtefato = holding && SPE_SECTORS.has(r.div);
  return { idade, ativa, newco, holding, limpa: ativa && !newco && !speArtefato };
};

// Comparativo de políticas por setor-chave (verificação/transparência).
const KEY = { "35": "Eletric/gas", "68": "Imobiliaria", "64": "Fin.serv", "41": "Constr", "66": "Aux.fin", "24": "Metalurg", "25": "Prod.metal", "28": "Maquinas", "86": "Saude", "85": "Educacao", "62": "TI", "47": "Varejo" };
const cmp = {};
for (const r of adqRows) {
  if (!KEY[r.div]) continue;
  const c = classifica(r);
  const k = (cmp[r.div] ??= { bruto: 0, ativa: 0, semNewco: 0, limpa: 0 });
  k.bruto++;
  if (c.ativa) k.ativa++;
  if (c.ativa && !c.newco) k.semNewco++;
  if (c.limpa) k.limpa++;
}
console.log("\nSetor          bruto  +ativa  +semNewco  +limpa   (limpa/bruto)");
for (const div of Object.keys(KEY)) {
  const k = cmp[div]; if (!k) continue;
  const pct = ((k.limpa / k.bruto) * 100).toFixed(0);
  console.log(`${KEY[div].padEnd(12)} ${String(k.bruto).padStart(6)} ${String(k.ativa).padStart(6)} ${String(k.semNewco).padStart(9)} ${String(k.limpa).padStart(7)}   ${pct.padStart(3)}%`);
}

// n_adq LIMPO por (uf, div)
const nAdq = new Map();
let totalLimpo = 0, totalBruto = adqRows.length;
const groundTruth = [];
for (const r of adqRows) {
  const c = classifica(r);
  groundTruth.push({
    cnpj_basico: r.cnpj_basico, uf: r.uf, div: r.div,
    idade: c.idade, sit: r.sit, novos_op: Number(r.novos_op), novos_hold: Number(r.novos_hold),
    limpa: c.limpa,
  });
  if (!c.limpa) continue;
  const key = `${r.uf}|${r.div}`;
  nAdq.set(key, (nAdq.get(key) ?? 0) + 1);
  totalLimpo++;
}

// Agregados por UF: [{div, universo, n_aquisicoes(limpas)}]
const ufs = {};
for (const r of uniRows) {
  const universo = Number(r.universo);
  if (universo < 50) continue; // corta caudas minúsculas por UF
  const n = nAdq.get(`${r.uf}|${r.div}`) ?? 0;
  (ufs[r.uf] ??= []).push({ div: r.div, universo, n_aquisicoes: n });
}

const totalUf = Object.keys(ufs).length;
console.log(`\n${totalUf} UFs · ${totalLimpo} aquisições LIMPAS (de ${totalBruto} brutas, ${((totalLimpo / totalBruto) * 100).toFixed(0)}%)`);
const spTot = (ufs["SP"] ?? []).reduce((a, s) => a + s.n_aquisicoes, 0);
console.log(`SP: ${spTot} aquisições limpas`);

writeFileSync(
  path.resolve("src/lib/heatmap-setores.json"),
  JSON.stringify({
    gerado_em: new Date().toISOString().slice(0, 10),
    janela: { de: CORTE, ate: NOVO },
    filtros: { universo: "matriz ativa (situacao=2)", aquisicao: `ativa & idade>=${IDADE_MIN} & !holding-only em constr/imob/energia` },
    ufs,
  }, null, 2) + "\n",
  "utf8",
);
console.log("✓ src/lib/heatmap-setores.json (universo ativo + aquisições limpas)");

// Ground truth enriquecido (todos os campos) — fora do bundle do front, re-filtrável sem BigQuery.
mkdirSync(path.resolve("scripts/data"), { recursive: true });
writeFileSync(
  path.resolve("scripts/data/aquisicoes-br.json"),
  JSON.stringify({
    gerado_em: new Date().toISOString().slice(0, 10),
    janela: { de: CORTE, ate: NOVO },
    definicao: "PJ entrou E PF saiu entre os 2 snapshots do CNPJ; enriquecido com idade/situacao/natureza das PJ entrantes",
    filtro_limpa: `sit=2 (ativa) & idade>=${IDADE_MIN} & !(holding-only em ${[...SPE_SECTORS].join("/")})`,
    n_bruto: totalBruto, n_limpo: totalLimpo,
    aquisicoes: groundTruth,
  }, null, 0) + "\n",
  "utf8",
);
console.log(`✓ scripts/data/aquisicoes-br.json (ground truth, ${totalBruto} brutas / ${totalLimpo} limpas)`);
