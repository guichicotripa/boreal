/**
 * Descobre, no CNPJ nacional, quais domínios de e-mail são de INTERMEDIÁRIO, e grava
 * `scripts/data/intermediarios.json`.
 *
 *   node --env-file=.env.local scripts/build-intermediarios.mjs
 *   node --env-file=.env.local scripts/build-intermediarios.mjs --min=50
 *
 * POR QUE EXISTE, dado que `src/lib/contato.ts` já classifica por regex: a regex acha quem SE
 * DECLARA contabilidade no nome do domínio (`rissicontabilidade.com.br`, `jcpcontabil.com.br`).
 * Ela não acha quem não se declara, e esses são os maiores. Medido na nossa base de 65 mil:
 * `laparo.com.br` aparece em 315 empresas, `maismei.com.br` em 70, `netsite.com.br` em 95,
 * `zdauditoria.com.br` em 65, e nenhum casa com a regex.
 *
 * A REGRA É REPETIÇÃO, NÃO NOME. Um domínio próprio de empresa aparece em uma empresa, ou em
 * poucas quando há grupo. Um domínio que atende centenas de CNPJs sem relação entre si é um
 * prestador de serviço. Isso não depende de o nome dizer nada.
 *
 * NACIONAL, NÃO A NOSSA BASE. Nossas 65 mil são uma fatia setorial: um contador regional de
 * clínicas veterinárias aparece muito ali e quase nada no Brasil, e um contador enorme pode ter
 * só 3 clientes no nosso recorte. Contar no nacional é a única leitura honesta.
 *
 * O QUE ISTO NÃO É: lista negra. Contato de contabilidade não é contato ruim, é contato de
 * gatekeeper, e às vezes é o melhor caminho para sucessão. Quem decide o que fazer com a
 * informação é quem liga. Ver o cabeçalho de `src/lib/contato.ts`.
 */
import { BigQuery } from "@google-cloud/bigquery";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: path.resolve(__dirname, "..", process.env.GCP_KEY_PATH),
});

const arg = (n, p) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1] ?? p;
const MIN = Number(arg("min", "25"));   // empresas no Brasil para o domínio virar intermediário
const TETO = Number(arg("teto", "4000")); // quantos domínios guardar

/* `email` no estabelecimento vem sujo: espaço, ponto final, maiúscula, e as vezes dois e-mails
   no mesmo campo. Corta no primeiro "@", tira o lixo do fim e minúsculo. Fazer isso no SQL evita
   trazer 60 milhões de linhas para cá. */
const SQL = `
  WITH dom AS (
    SELECT
      REGEXP_REPLACE(LOWER(TRIM(SPLIT(email, '@')[SAFE_OFFSET(1)])), r'[.,;\s]+$', '') AS dominio,
      cnpj_basico
    FROM \`basedosdados.br_me_cnpj.estabelecimentos\`
    WHERE email IS NOT NULL AND email != '' AND STRPOS(email, '@') > 0
  )
  SELECT dominio, COUNT(DISTINCT cnpj_basico) AS empresas
  FROM dom
  WHERE dominio IS NOT NULL
    AND dominio != ''
    AND REGEXP_CONTAINS(dominio, r'^[a-z0-9][a-z0-9.\-]*\.[a-z]{2,}$')
  GROUP BY dominio
  HAVING empresas >= @min
  ORDER BY empresas DESC
  LIMIT @teto
`;

console.log(`Contando domínios de e-mail no CNPJ nacional (mínimo ${MIN} empresas)…`);
const [linhas] = await bq.query({ query: SQL, params: { min: MIN, teto: TETO } });
console.log(`   ${linhas.length} domínios acima do corte.`);

const saida = {
  gerado_em: new Date().toISOString().slice(0, 10),
  fonte: "basedosdados.br_me_cnpj.estabelecimentos",
  minimo_empresas: MIN,
  observacao:
    "Domínio de e-mail que atende muitos CNPJs sem relação entre si. Inclui contabilidade, " +
    "abertura de empresa, agência e provedor de hospedagem. Nao inclui webmail, que ja e tratado " +
    "em src/lib/contato.ts.",
  dominios: Object.fromEntries(linhas.map((l) => [l.dominio, Number(l.empresas)])),
};

const destino = path.resolve(__dirname, "data", "intermediarios.json");
fs.mkdirSync(path.dirname(destino), { recursive: true });
fs.writeFileSync(destino, JSON.stringify(saida, null, 2) + "\n");
console.log(`Gravado em ${destino}`);
console.log("\n20 maiores:");
for (const l of linhas.slice(0, 20)) console.log(`  ${String(l.empresas).padStart(7)}  ${l.dominio}`);
