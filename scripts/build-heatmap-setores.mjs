// HEATMAP DE SETORES — métrica de atividade de M&A para TODAS as divisões CNAE (não só os 3 validados).
// Por divisão CNAE (2 díg, SP): universo de empresas + aquisições detectadas (mesma definição do ground
// truth: PJ entrou E PF saiu entre os 2 snapshots) → deals/ano + densidade (fração do estoque que girou).
// HONESTIDADE: isto é atividade OBSERVADA de M&A, consistente pra todos os setores. A VALIDAÇÃO do score
// (recall) só existe nos 3 setores cobertos (setores.json) — não afirmar predição fora deles.
//   node --env-file=.env.local scripts/build-heatmap-setores.mjs
import { BigQuery } from "@google-cloud/bigquery";
import { writeFileSync } from "fs";
import path from "path";

const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: path.resolve(process.env.GCP_KEY_PATH),
});
const CORTE = "2023-06-10";
const NOVO = "2025-11-09";
const ANOS = 2.4;

// Universo por divisão (empresas matriz ativas SP no snapshot novo) + aquisições detectadas
// (PJ entrou E PF saiu entre corte e novo), agregadas pela divisão CNAE da empresa no corte.
const sql = `
WITH
a AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf
      FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${CORTE}' GROUP BY 1),
b AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf
      FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${NOVO}' GROUP BY 1),
adq AS (SELECT a.cnpj_basico FROM a JOIN b USING(cnpj_basico) WHERE b.pj>a.pj AND b.pf<a.pf),
estC AS (SELECT cnpj_basico, SUBSTR(cnae_fiscal_principal,1,2) AS div
         FROM \`basedosdados.br_me_cnpj.estabelecimentos\`
         WHERE data='${CORTE}' AND sigla_uf='SP' AND identificador_matriz_filial='1'),
estN AS (SELECT SUBSTR(cnae_fiscal_principal,1,2) AS div, COUNT(*) AS universo
         FROM \`basedosdados.br_me_cnpj.estabelecimentos\`
         WHERE data='${NOVO}' AND sigla_uf='SP' AND identificador_matriz_filial='1' GROUP BY 1),
deals AS (SELECT e.div, COUNT(*) AS n_adq FROM adq JOIN estC e USING(cnpj_basico) GROUP BY 1)
SELECT estN.div AS div, estN.universo AS universo, COALESCE(deals.n_adq,0) AS n_adq
FROM estN LEFT JOIN deals USING(div)
WHERE estN.div IS NOT NULL
ORDER BY estN.universo DESC`;

console.log("Rodando query agregada por divisão CNAE (SP)…");
const [rows] = await bq.query({ query: sql, location: "US" });

const divisoes = rows
  .map((r) => {
    const universo = Number(r.universo);
    const n = Number(r.n_adq);
    return {
      div: r.div,
      universo,
      n_aquisicoes: n,
      deals_ano: Math.round((n / ANOS) * 10) / 10,
      densidade: universo > 0 ? n / universo : 0, // fração do estoque que girou na janela
    };
  })
  .filter((s) => s.universo >= 100); // corta divisões minúsculas (ruído visual no treemap)

const totalUniverso = divisoes.reduce((a, s) => a + s.universo, 0);
const totalDeals = divisoes.reduce((a, s) => a + s.n_aquisicoes, 0);
console.log(`${divisoes.length} divisões · universo total ${totalUniverso.toLocaleString("pt-BR")} · ${totalDeals} aquisições`);
console.log("Top 8 por densidade:");
[...divisoes].sort((a, b) => b.densidade - a.densidade).slice(0, 8)
  .forEach((s) => console.log(`  CNAE ${s.div}: ${s.universo} emp · ${s.n_aquisicoes} adq · ${(s.densidade * 100).toFixed(2)}% · ${s.deals_ano}/ano`));

writeFileSync(
  path.resolve("src/lib/heatmap-setores.json"),
  JSON.stringify({ gerado_em: new Date().toISOString().slice(0, 10), janela: { de: CORTE, ate: NOVO }, uf: "SP", divisoes }, null, 2) + "\n",
  "utf8",
);
console.log("\n✓ src/lib/heatmap-setores.json");
