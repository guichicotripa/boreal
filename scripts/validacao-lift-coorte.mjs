// Lift CONDICIONAL — a pergunta que o lift marginal não responde.
//
// scripts/validacao-lift.mjs mede lift no universo inteiro: "esta feature aparece mais nas
// adquiridas?". Serviu pra escolher os 4 eixos do v0. Mas ela não responde o problema que o
// produto tem hoje: dentro da COORTE ALTA (onde os 4 eixos já estão no teto e centenas de
// empresas empatam), sobra sinal de registro que o score não olha?
//
// É uma medição diferente, não um refinamento. Uma feature pode ter lift marginal alto só
// porque é proxy do que o score já usa (porte, idade, antiguidade) — nesse caso ela some
// quando se condiciona. E o contrário também: feature sem lift marginal pode discriminar
// dentro da coorte. Só a medição condicional distingue "eixo novo" de "eixo redundante".
//
// COORTE = score_v0 >= 80. Não é score = 100 porque lá só há 28 aquisições no ground truth,
// e com n=28 qualquer prevalência tem erro-padrão maior que o efeito que se quer medir.
// Universo NACIONAL (o lift marginal era só SP): o filtro de UF não faz partition pruning,
// então nacional custa os mesmos bytes e triplica o n de aquisições.
//
// Roda: node --env-file=.env.local scripts/validacao-lift-coorte.mjs
import { BigQuery } from "@google-cloud/bigquery";
import { writeFileSync, readFileSync } from "fs";
import path from "path";

const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: path.resolve(process.env.GCP_KEY_PATH),
});

const CORTE = "2023-06-10"; // features medidas ANTES do deal (zero lookahead)
const NOVO = "2025-11-09";  // snapshot que revela quem foi adquirido
const PISO_COORTE = 80;

const reg = JSON.parse(readFileSync(path.resolve("src/lib/setores.json"), "utf8"));
const filtroCnae =
  "(" +
  reg.setores.map((s) => "(" + s.cnaes.map((p) => `e.cnae_fiscal_principal LIKE '${p}%'`).join(" OR ") + ")").join(" OR ") +
  ")";

/* Features candidatas. Todas são de REGISTRO: custo zero, disponíveis pro universo inteiro
   no mesmo instante da busca. É esse o critério de entrada — se precisasse de LLM já seria
   trabalho do v1, e a pergunta aqui é justamente o que dá pra saber sem gastar inferência. */
const FEATURES = [
  ["Quadro mexeu nos últimos 5 anos", "f_mexeu_5"],
  ["Quadro parado 10+ anos", "f_parado_10"],
  ["Quadro parado 20+ anos", "f_parado_20"],
  ["Sem sócio até 50 anos (sem sucessor aparente)", "f_sem_sucessor"],
  ["Tem sócio até 50 anos (sucessor aparente)", "f_com_sucessor"],
  ["2+ sócios na faixa 80+", "f_dois_octogenarios"],
  ["Quadro com 5+ sócios PF", "f_cinco_socios"],
  ["Tem sócio PJ no quadro", "f_tem_pj"],
  ["Sociedade anônima", "f_sa"],
  ["Tem filial (2+ estabelecimentos)", "f_tem_filial"],
  ["Capital social acima da mediana da coorte", "f_capital_alto"],
];

const sql = `
WITH sc AS (
  SELECT cnpj_basico,
    MAX(SAFE_CAST(faixa_etaria AS INT64)) AS mf,
    MIN(NULLIF(SAFE_CAST(faixa_etaria AS INT64), 0)) AS menor,
    MAX(data_entrada_sociedade) AS ult,
    COUNTIF(tipo='2') AS n_pf,
    COUNTIF(tipo='1') AS n_pj,
    COUNTIF(SAFE_CAST(faixa_etaria AS INT64) = 9) AS n_f9
  FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${CORTE}' GROUP BY 1
),
est AS (
  SELECT cnpj_basico, COUNT(*) AS n_estab
  FROM \`basedosdados.br_me_cnpj.estabelecimentos\` WHERE data='${CORTE}' GROUP BY 1
),
base AS (
  SELECT e.cnpj_basico,
    -- score v0 replicado de src/lib/scoring.ts (mesma tabela do validacao-snapshot)
    (CASE sc.mf WHEN 9 THEN 30 WHEN 8 THEN 26 WHEN 7 THEN 20 WHEN 6 THEN 10 ELSE 0 END)
    + (CASE WHEN 2023-EXTRACT(YEAR FROM e.data_inicio_atividade) >= 40 THEN 30
            WHEN 2023-EXTRACT(YEAR FROM e.data_inicio_atividade) >= 25 THEN 22
            WHEN 2023-EXTRACT(YEAR FROM e.data_inicio_atividade) >= 15 THEN 10 ELSE 0 END)
    + (CASE WHEN REGEXP_REPLACE(emp.porte,'^0','')='5' THEN 30
            WHEN REGEXP_REPLACE(emp.porte,'^0','')='3' THEN 15
            WHEN REGEXP_REPLACE(emp.porte,'^0','')='1' THEN 5 ELSE 0 END)
    + (CASE WHEN sc.n_pf >= 2 THEN 10 ELSE 0 END) AS score,
    DATE_DIFF(DATE('${CORTE}'), sc.ult, YEAR) AS anos_ult,
    sc.menor, sc.n_pf, sc.n_pj, sc.n_f9,
    SAFE_CAST(emp.capital_social AS FLOAT64) AS capital,
    SAFE_CAST(emp.natureza_juridica AS INT64) AS nat,
    est.n_estab
  FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e
  JOIN \`basedosdados.br_me_cnpj.empresas\` emp
    ON emp.cnpj_basico=e.cnpj_basico AND emp.data='${CORTE}'
  LEFT JOIN sc ON sc.cnpj_basico=e.cnpj_basico
  LEFT JOIN est ON est.cnpj_basico=e.cnpj_basico
  WHERE e.data='${CORTE}' AND e.identificador_matriz_filial='1'
    AND e.situacao_cadastral='2' AND ${filtroCnae}
),
coorte AS (SELECT * FROM base WHERE score >= ${PISO_COORTE}),
mediana AS (SELECT APPROX_QUANTILES(capital, 2)[OFFSET(1)] AS cap_med FROM coorte WHERE capital > 0),
feat AS (
  SELECT c.cnpj_basico, c.score,
    (c.anos_ult IS NOT NULL AND c.anos_ult < 5)   AS f_mexeu_5,
    (c.anos_ult IS NOT NULL AND c.anos_ult >= 10) AS f_parado_10,
    (c.anos_ult IS NOT NULL AND c.anos_ult >= 20) AS f_parado_20,
    (c.menor IS NOT NULL AND c.menor >= 6) AS f_sem_sucessor,
    (c.menor IS NOT NULL AND c.menor <= 5) AS f_com_sucessor,
    (c.n_f9 >= 2)     AS f_dois_octogenarios,
    (c.n_pf >= 5)     AS f_cinco_socios,
    (c.n_pj >= 1)     AS f_tem_pj,
    (c.nat IN (2046, 2054)) AS f_sa,
    (c.n_estab >= 2)  AS f_tem_filial,
    (c.capital > m.cap_med) AS f_capital_alto
  FROM coorte c CROSS JOIN mediana m
),
a AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${CORTE}' GROUP BY 1),
b AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${NOVO}' GROUP BY 1),
adq AS (SELECT a.cnpj_basico FROM a JOIN b USING(cnpj_basico) WHERE b.pj>a.pj AND b.pf<a.pf)
SELECT grupo, COUNT(*) AS n,
  ${FEATURES.map(([, k]) => `ROUND(COUNTIF(${k})/COUNT(*)*100,1) AS ${k}`).join(",\n  ")}
FROM (
  SELECT *, 'universo' AS grupo FROM feat
  UNION ALL
  SELECT *, 'adquiridas' AS grupo FROM feat WHERE cnpj_basico IN (SELECT cnpj_basico FROM adq)
)
GROUP BY grupo ORDER BY grupo`;

const [rows] = await bq.query({ query: sql, location: "US" });
const u = rows.find((r) => r.grupo === "universo");
const adq = rows.find((r) => r.grupo === "adquiridas");

/* Erro-padrão da diferença de proporções. Sem isto o script vira gerador de falso
   positivo: com n de adquiridas na casa das centenas, um lift de 1,4 pode ser
   inteiramente ruído amostral, e adicionar eixo por ruído piora o ranking. */
function significante(pu, pa, nu, na) {
  const [qu, qa] = [pu / 100, pa / 100];
  const se = Math.sqrt((qu * (1 - qu)) / nu + (qa * (1 - qa)) / na);
  return se > 0 ? Math.abs(qa - qu) / se : 0;
}

const features = FEATURES.map(([nome, key]) => {
  const pu = Number(u[key]), pa = Number(adq[key]);
  const lift = pu > 0 ? Number((pa / pu).toFixed(2)) : 0;
  const z = significante(pu, pa, Number(u.n), Number(adq.n));
  return {
    nome, universo_pct: pu, adquiridas_pct: pa, lift, z: Number(z.toFixed(2)),
    // "forte" exige as DUAS coisas: efeito grande e n suficiente pra crer nele.
    sinal: z >= 2 && lift >= 1.3 ? "forte" : z >= 2 && lift <= 0.77 ? "negativo" : "ruído",
  };
}).sort((a, b) => b.lift - a.lift);

console.log(`Lift CONDICIONAL — coorte score_v0 >= ${PISO_COORTE}`);
console.log(`universo ${Number(u.n).toLocaleString("pt-BR")} · adquiridas ${adq.n}\n`);
console.log(`  feature                                          coorte  adquir.   LIFT      z`);
for (const f of features) {
  const flag = f.sinal === "forte" ? " ★" : f.sinal === "negativo" ? " ↓" : "";
  console.log(
    `  ${f.nome.padEnd(46)} ${String(f.universo_pct).padStart(5)}%  ${String(f.adquiridas_pct).padStart(6)}%  ` +
    `${f.lift.toFixed(2)}x  ${f.z.toFixed(2).padStart(5)}${flag}`
  );
}
console.log(`\n★ = lift >= 1,3 E z >= 2 (efeito grande e não-ruído) · ↓ = sinal negativo`);
console.log(`z < 2 = a diferença cabe dentro do erro amostral; NÃO vira eixo.`);

const artefato = {
  gerado_em: new Date().toISOString().slice(0, 10),
  fonte: `scripts/validacao-lift-coorte.mjs — lift dentro da coorte score_v0 >= ${PISO_COORTE}`,
  piso_coorte: PISO_COORTE,
  n_coorte: Number(u.n),
  n_adquiridas: Number(adq.n),
  metodologia:
    `Lift marginal (src/lib/lift.json) responde "esta feature aparece mais nas adquiridas do que ` +
    `no universo?" e foi o que escolheu os 4 eixos do v0. Este artefato responde outra pergunta: ` +
    `DENTRO da coorte que o score já elegeu (v0 >= ${PISO_COORTE}, onde as empresas empatam), ` +
    `sobra sinal de registro que o score não olha? Feature que só era proxy dos eixos existentes ` +
    `perde o lift aqui. Universo nacional, empresa ativa no corte, features medidas em ` +
    `${CORTE} e aquisições detectadas até ${NOVO} — zero lookahead. Cada feature traz o z da ` +
    `diferença de proporções: lift sem z >= 2 é ruído amostral e não vira eixo.`,
  features,
};
writeFileSync(path.resolve("src/lib/lift-coorte.json"), JSON.stringify(artefato, null, 2) + "\n", "utf8");
console.log(`\n✓ src/lib/lift-coorte.json`);
