// Gera o ARTEFATO de validação que o produto exibe (src/lib/validacao.json).
//
// Mede o recall@top10% do score retroativamente, SEM LEAKAGE: rankeia o universo com os dados
// disponíveis no snapshot de 2023-06 (CORTE) e checa quantas das aquisições que aconteceram DEPOIS
// (detectadas como transição PJ-entra/PF-sai até 2025-11, NOVO) caíram no top decil — 12+ meses
// antes do deal. Ground truth = mineração do próprio CNPJ (não imprensa, não boutique).
// Decil calculado DENTRO de cada vertical (o Relay rankeia empresas do mesmo setor entre si).
//
// O número que sai daqui é o que aparece na página /validacao. NÃO hardcodar no produto —
// rodar este script regenera o JSON com a data da medição.
//   node --env-file=.env.local scripts/validacao-snapshot.mjs
import { BigQuery } from "@google-cloud/bigquery";
import { SCORE_V1, ctesSocios, CAP_PCT } from "./lib/score-sql.mjs";
import { writeFileSync, readFileSync } from "fs";
import path from "path";

const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: path.resolve(process.env.GCP_KEY_PATH),
});
const CORTE = "2023-06-10"; // score pré-deal (sem leakage)
const NOVO = "2025-11-09"; // snapshot atual (detecta o que mudou)

/* Verticais e CNAEs vêm do registry. Antes eram dois setores escritos à mão num
   CASE, então a página de prova ficou mostrando 2 de 4 setores — e um recall que
   discordava do setores.json para os mesmos setores. */
const reg = JSON.parse(readFileSync(path.resolve("src/lib/setores.json"), "utf8"));
const likeDe = (s, col = "e.cnae_fiscal_principal") =>
  "(" + s.cnaes.map((p) => `${col} LIKE '${p}%'`).join(" OR ") + ")";
const caseVertical =
  "CASE " + reg.setores.map((s) => `WHEN ${likeDe(s)} THEN '${s.id}'`).join(" ") + " END";
const filtroCnae = "(" + reg.setores.map((s) => likeDe(s)).join(" OR ") + ")";

const sql = `
WITH sc AS (${ctesSocios(CORTE)}),
universo AS (
  SELECT e.cnpj_basico, ${caseVertical} AS vertical,
    sc.mf, sc.menor, sc.n_pf,
    DATE_DIFF(DATE('${CORTE}'), sc.ult, YEAR) AS anos_ult,
    SAFE_CAST(emp.capital_social AS FLOAT64) AS capital
  FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e
  JOIN \`basedosdados.br_me_cnpj.empresas\` emp ON emp.cnpj_basico=e.cnpj_basico AND emp.data='${CORTE}'
  LEFT JOIN sc ON sc.cnpj_basico=e.cnpj_basico
  -- ATIVA no corte + desempate no NTILE: as mesmas correcoes do build-setores,
  -- para este artefato e o registry pararem de discordar sobre o mesmo setor.
  WHERE e.data='${CORTE}' AND e.sigla_uf='SP' AND e.identificador_matriz_filial='1'
    AND e.situacao_cadastral='2' AND ${filtroCnae}
),
scored AS (SELECT *, ${SCORE_V1} AS score FROM (SELECT *, ${CAP_PCT} AS cap_pct FROM universo)),
ranked AS (
  SELECT cnpj_basico, vertical,
    NTILE(10) OVER (PARTITION BY vertical ORDER BY score DESC, cnpj_basico) AS decil
  FROM scored
),
univ AS (SELECT vertical, COUNT(*) AS n_univ FROM scored GROUP BY 1),
a AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${CORTE}' GROUP BY 1),
b AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${NOVO}' GROUP BY 1),
adq AS (SELECT a.cnpj_basico FROM a JOIN b USING(cnpj_basico) WHERE b.pj>a.pj AND b.pf<a.pf)
SELECT r.vertical, u.n_univ AS universo, COUNT(*) AS n_adq,
  ROUND(COUNTIF(r.decil=1)/COUNT(*)*100,0) AS top10,
  ROUND(COUNTIF(r.decil<=2)/COUNT(*)*100,0) AS top20,
  ROUND(COUNTIF(r.decil<=3)/COUNT(*)*100,0) AS top30,
  ROUND(AVG(r.decil),2) AS decil_medio
FROM adq JOIN ranked r USING(cnpj_basico) JOIN univ u ON u.vertical=r.vertical
GROUP BY r.vertical, u.n_univ
ORDER BY r.vertical`;

console.log("Rodando validação retroativa por vertical...");
const [rows] = await bq.query({ query: sql, location: "US" });

const verticais = rows.map((r) => ({
  vertical: r.vertical,
  universo: Number(r.universo),
  n_aquisicoes: Number(r.n_adq),
  recall_top10: Number(r.top10),
  recall_top20: Number(r.top20),
  recall_top30: Number(r.top30),
  decil_medio: Number(r.decil_medio),
  lift_top10: Number((r.top10 / 10).toFixed(1)), // vs. 10% esperado por acaso
}));

const artefato = {
  gerado_em: new Date().toISOString().slice(0, 10),
  janela: { corte: CORTE, novo: NOVO, anos: 2.4 },
  metodologia:
    "Ground truth minerado das transições do próprio CNPJ (sócio PJ entra + sócio PF sai = " +
    "assinatura de aquisição) entre dois snapshots da Receita Federal. O score é calculado com " +
    "os dados de 2023-06, ANTES das aquisições — zero lookahead bias. Mede-se quantas das " +
    "aquisições reais o ranking colocou no top 10% do seu vertical. Aleatório = 10%.",
  verticais,
};

const out = path.resolve("src/lib/validacao.json");
writeFileSync(out, JSON.stringify(artefato, null, 2) + "\n", "utf8");
console.log(`\n✓ ${out} gerado em ${artefato.gerado_em}`);
for (const v of verticais) {
  console.log(
    `  [${v.vertical}] recall@top10% = ${v.recall_top10}% (${v.lift_top10}× vs acaso) · ` +
      `N=${v.n_aquisicoes} · decil médio ${v.decil_medio}`
  );
}
