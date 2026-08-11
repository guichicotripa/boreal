/**
 * PROVA de que a flag `opcao_simples` vaza o desfecho, e de qual definicao e segura.
 *
 *   node --env-file=.env.local scripts/check-vazamento-simples.mjs
 *
 * SUSPEITA: `diagnostico-porte.py` devolveu "estava no Simples no corte" com lift 0,00x e z=11,4
 * DENTRO de capital >= p85, ou seja, 7.343 empresas grandes e nenhuma aquisicao. Numero absoluto
 * assim quase nunca e descoberta.
 *
 * MECANISMO SUSPEITO: a Lei Complementar 123 proibe empresa com socio PJ de ficar no Simples.
 * Como o label de aquisicao E "entra socio PJ", toda adquirida e obrigada a sair do Simples. E a
 * tabela `br_me_cnpj.simples` NAO tem particao por data: `opcao_simples` e o estado de 2026. Entao
 * "opcao_simples = 1" significa "ainda no Simples HOJE", que e informacao pos-desfecho.
 *
 * O QUE ESTA QUERY MOSTRA: a taxa de aquisicao por (flag atual, janela da data de exclusao). Se a
 * suspeita estiver certa, as excluidas ENTRE o corte e o desfecho vao concentrar as aquisicoes, e
 * a flag atual vai separar quase perfeitamente, que e a assinatura de vazamento e nao de sinal.
 */
import { BigQuery } from "@google-cloud/bigquery";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: path.resolve(ROOT, process.env.GCP_KEY_PATH),
});

const CORTE = "2023-06-10", NOVO = "2025-11-09";
const reg = JSON.parse(readFileSync(path.resolve(ROOT, "src/lib/setores.json"), "utf8"));
const likeDe = (s) => "(" + s.cnaes.map((p) => `e.cnae_fiscal_principal LIKE '${p}%'`).join(" OR ") + ")";
const filtroCnae = "(" + reg.setores.map(likeDe).join(" OR ") + ")";

const sql = `
WITH sc AS (
  SELECT cnpj_basico, COUNTIF(tipo='2') n_pf, COUNTIF(tipo='1') n_pj
  FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${CORTE}' GROUP BY 1
),
b AS (
  SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf
  FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${NOVO}' GROUP BY 1
),
base AS (
  SELECT e.cnpj_basico, sc.n_pf, sc.n_pj, b.pf AS pf_novo, b.pj AS pj_novo,
    s.opcao_simples, s.data_exclusao_simples AS dex
  FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e
  JOIN sc ON sc.cnpj_basico = e.cnpj_basico
  LEFT JOIN b ON b.cnpj_basico = e.cnpj_basico
  LEFT JOIN \`basedosdados.br_me_cnpj.simples\` s ON s.cnpj_basico = e.cnpj_basico
  WHERE e.data='${CORTE}' AND e.identificador_matriz_filial='1'
    AND e.situacao_cadastral='2' AND ${filtroCnae}
    AND sc.n_pf >= 2 AND b.cnpj_basico IS NOT NULL
)
SELECT
  CASE WHEN opcao_simples = 1 THEN 'flag hoje: NO Simples' ELSE 'flag hoje: fora' END AS flag_atual,
  CASE WHEN dex IS NULL                  THEN 'sem data de exclusao'
       WHEN dex <  DATE('${CORTE}')      THEN 'excluida ANTES do corte'
       WHEN dex <= DATE('${NOVO}')       THEN 'excluida ENTRE corte e desfecho'
       ELSE                                   'excluida DEPOIS do desfecho' END AS janela,
  COUNT(*) AS n,
  COUNTIF(pj_novo > n_pj AND pf_novo < n_pf) AS adq,
  ROUND(100 * COUNTIF(pj_novo > n_pj AND pf_novo < n_pf) / COUNT(*), 3) AS taxa_pct
FROM base
GROUP BY 1, 2 ORDER BY 1, 2`;

const [rows] = await bq.query({ query: sql, location: "US" });
const tot = rows.reduce((s, r) => s + Number(r.n), 0);
const totA = rows.reduce((s, r) => s + Number(r.adq), 0);
console.log(`universo elegivel: ${tot.toLocaleString("pt-BR")} · aquisicoes ${totA} · taxa base ${(totA / tot * 100).toFixed(3)}%\n`);
console.log("flag_atual".padEnd(24) + "janela".padEnd(34) + "n".padStart(10) + "adq".padStart(7) + "taxa".padStart(10) + "lift".padStart(9));
console.log("-".repeat(94));
for (const r of rows) {
  const lift = (Number(r.taxa_pct) / (totA / tot * 100));
  console.log(String(r.flag_atual).padEnd(24) + String(r.janela).padEnd(34) +
    Number(r.n).toLocaleString("pt-BR").padStart(10) + String(r.adq).padStart(7) +
    (r.taxa_pct + "%").padStart(10) + (lift.toFixed(2) + "x").padStart(9));
}
