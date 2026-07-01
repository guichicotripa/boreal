// DIAGNÓSTICO (descartável): a idade das empresas "adquiridas" por setor testa a hipótese SPE.
// SPE/holding é jovem (criada pro empreendimento); M&A real é de empresa madura.
import { BigQuery } from "@google-cloud/bigquery";
import path from "path";
const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID, keyFilename: path.resolve(process.env.GCP_KEY_PATH) });
const CORTE = "2023-06-10", NOVO = "2025-11-09";
const sql = `
WITH
a AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${CORTE}' GROUP BY 1),
b AS (SELECT cnpj_basico, COUNTIF(tipo='1') pj, COUNTIF(tipo='2') pf FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${NOVO}' GROUP BY 1),
adq AS (SELECT a.cnpj_basico FROM a JOIN b USING(cnpj_basico) WHERE b.pj>a.pj AND b.pf<a.pf),
est AS (SELECT cnpj_basico, SUBSTR(cnae_fiscal_principal,1,2) div,
        (2023-EXTRACT(YEAR FROM data_inicio_atividade)) idade
        FROM \`basedosdados.br_me_cnpj.estabelecimentos\` WHERE data='${CORTE}' AND identificador_matriz_filial='1')
SELECT e.div, COUNT(*) n, ROUND(AVG(e.idade),1) idade_media,
  ROUND(COUNTIF(e.idade < 5)/COUNT(*)*100,1) pct_jovem_lt5,
  ROUND(COUNTIF(e.idade >= 25)/COUNT(*)*100,1) pct_madura_25plus
FROM adq JOIN est e USING(cnpj_basico)
WHERE e.div IN ('35','68','64','41','66','24','25','28','86','85','62','47')
GROUP BY 1 ORDER BY n DESC`;
const [rows] = await bq.query({ query: sql, location: "US" });
const N = { "35": "Eletric/gas", "68": "Imobiliaria", "64": "Fin.serv", "41": "Constr", "66": "Aux.fin", "24": "Metalurg", "25": "Prod.metal", "28": "Maquinas", "86": "Saude", "85": "Educacao", "62": "TI", "47": "Varejo" };
console.log("div  setor         n     idade_med  %jovem<5  %madura25+");
for (const r of rows) console.log(`${r.div}  ${(N[r.div] || "").padEnd(12)} ${String(r.n).padStart(5)}   ${String(r.idade_media).padStart(5)}     ${String(r.pct_jovem_lt5).padStart(5)}    ${String(r.pct_madura_25plus).padStart(5)}`);
