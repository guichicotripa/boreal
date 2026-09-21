/**
 * Conta, no CNPJ do Brasil inteiro, quantas empresas dividem o mesmo telefone e o mesmo e-mail
 * de cada empresa da nossa base, e grava em `empresa.telefone_empresas_br` / `email_empresas_br`.
 *
 *   node --env-file=.env.local scripts/backfill-contato-nacional.mjs
 *   node --env-file=.env.local scripts/backfill-contato-nacional.mjs --tudo
 *   node --env-file=.env.local scripts/backfill-contato-nacional.mjs --estimar   # só o custo
 *
 * ── Por que não dá para responder isto com a nossa base ───────────────────────
 * Medido nas 31 empresas do piloto da Setter: 8 têm telefone exclusivo, 7 dividem com 2 a 4 e
 * **16 dividem com 5 ou mais**, uma delas com 454 empresas. Dentro das nossas 65 mil, quase todos
 * esses mesmos números parecem exclusivos, porque as outras 453 empresas não estão aqui. Base
 * pequena faz contato ruim parecer bom, e essa é exatamente a leitura que levaria a Setter a
 * gastar ligação no contador.
 *
 * ── Por que este script é separado do `backfill-contato.mjs` ──────────────────
 * Aquele é de graça e roda a cada ingest. Este custa cota de BigQuery e roda raramente. Os dois
 * gravam pela mesma função `aplica_contato`, que usa `coalesce`, então um nunca apaga o outro.
 *
 * ── UMA varredura, não uma por lote ───────────────────────────────────────────
 * A primeira versão mandava os valores em lotes de 8 mil dentro de `IN UNNEST(@tels)`, e cada
 * lote varria as colunas dos ~60 milhões de estabelecimentos outra vez: 6 varreduras para uma
 * pergunta. Isso estourou a cota gratuita em 21/09/2026.
 *
 * Aqui os nossos valores sobem antes, por LOAD JOB, que no BigQuery **não é cobrado por bytes
 * varridos**. Depois um único SELECT junta a tabela nacional com essa tabela pequena. Uma
 * varredura. O custo deixa de crescer com o tamanho da nossa base.
 *
 * ── Cota ──────────────────────────────────────────────────────────────────────
 * O projeto está em sandbox, sem billing: 1 TiB de varredura por mês, renovando no dia 1. Se a
 * consulta falhar com `quotaExceeded`, não é defeito do código, é a cota. `--estimar` diz quanto
 * a consulta vai varrer ANTES de rodar, sem gastar nada.
 */
import { BigQuery } from "@google-cloud/bigquery";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: path.resolve(__dirname, "..", process.env.GCP_KEY_PATH),
});
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const TUDO = process.argv.includes("--tudo");
const ESTIMAR = process.argv.includes("--estimar");
const LOTE_UP = 500;
const DATASET = "boreal_tmp";
const TABELA = "contatos_alvo";

const soDigitos = (t) => String(t ?? "").replace(/\D/g, "");
const normEmail = (e) => String(e ?? "").trim().toLowerCase().replace(/[.,;\s]+$/, "");

/* A junção é por valor, não por CNPJ, e é de propósito: a pergunta é "quantas empresas no Brasil
   usam ESTE número", e não "o que mais existe neste CNPJ". `COUNT(DISTINCT cnpj_basico)` conta
   empresa, não estabelecimento: uma rede com 9 filiais no mesmo telefone é UMA empresa dividindo,
   não nove. */
const SQL = `
  WITH base AS (
    SELECT cnpj_basico,
           CONCAT(COALESCE(ddd_1, ''), COALESCE(telefone_1, ''))  AS tel,
           REGEXP_REPLACE(LOWER(TRIM(email)), r'[.,;\\s]+$', '')   AS mail
      FROM \`basedosdados.br_me_cnpj.estabelecimentos\`
  ),
  alvo AS (SELECT valor, especie FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.${TABELA}\`)
  SELECT 'tel' AS especie, b.tel AS valor, COUNT(DISTINCT b.cnpj_basico) AS empresas
    FROM base b JOIN alvo a ON a.especie = 'tel' AND a.valor = b.tel
   GROUP BY b.tel
  UNION ALL
  SELECT 'mail', b.mail, COUNT(DISTINCT b.cnpj_basico)
    FROM base b JOIN alvo a ON a.especie = 'mail' AND a.valor = b.mail
   GROUP BY b.mail
`;

// ── 1. Quem precisa ────────────────────────────────────────────────────────────
const empresas = [];
for (let off = 0; ; off += 1000) {
  let q = supabase.from("empresa").select("cnpj, email, telefone").order("id").range(off, off + 999);
  if (!TUDO) q = q.is("telefone_empresas_br", null);
  const r = await q;
  if (r.error) { console.error("ERRO lendo empresa:", r.error.message); process.exit(1); }
  empresas.push(...r.data);
  process.stdout.write(`\r   lendo… ${empresas.length}`);
  if (r.data.length < 1000) break;
}
console.log(`\n   ${empresas.length} empresas.`);
if (empresas.length === 0) { console.log("Nada a fazer."); process.exit(0); }

const tels = [...new Set(empresas.map((e) => soDigitos(e.telefone)).filter(Boolean))];
const mails = [...new Set(empresas.map((e) => normEmail(e.email)).filter((x) => x.includes("@")))];
console.log(`   ${tels.length} telefones e ${mails.length} e-mails distintos.`);

// ── 2. Subir os alvos (load job, não cobrado por varredura) ────────────────────
const dataset = bq.dataset(DATASET);
const [existe] = await dataset.exists();
if (!existe) {
  await dataset.create({ location: "US" });
  console.log(`   dataset ${DATASET} criado.`);
}
/* LOAD JOB a partir de arquivo, e não `table.insert()`. `insert()` usa a API de streaming, que o
   tier gratuito recusa com "Streaming insert is not allowed in the free tier". Load job é aceito
   e, o que importa aqui, **não é cobrado por bytes**: é ele que torna a subida dos alvos de graça
   e deixa o custo todo na única consulta. */
const ndjson = [
  ...tels.map((v) => ({ especie: "tel", valor: v })),
  ...mails.map((v) => ({ especie: "mail", valor: v })),
].map((l) => JSON.stringify(l) + "\n").join("");

const arquivoAlvos = path.join(os.tmpdir(), `boreal-contatos-alvo-${process.pid}.ndjson`);
fs.writeFileSync(arquivoAlvos, ndjson);
try {
  await dataset.table(TABELA).load(arquivoAlvos, {
    sourceFormat: "NEWLINE_DELIMITED_JSON",
    schema: { fields: [{ name: "especie", type: "STRING" }, { name: "valor", type: "STRING" }] },
    writeDisposition: "WRITE_TRUNCATE",
    autodetect: false,
  });
} finally {
  fs.rmSync(arquivoAlvos, { force: true });
}
const nAlvos = tels.length + mails.length;
console.log(`   ${nAlvos} alvos carregados em ${DATASET}.${TABELA}.`);

// ── 3. Estimar, e parar se for só isso ─────────────────────────────────────────
const [jobSeco] = await bq.createQueryJob({ query: SQL, dryRun: true });
/* O total vem aninhado em `statistics.query` para consulta; o campo de primeiro nível existe
   em outros tipos de job e vem vazio aqui. */
const est = jobSeco.metadata?.statistics ?? {};
const bytes = Number(est.query?.totalBytesProcessed ?? est.totalBytesProcessed ?? 0);
if (bytes > 0) console.log(`\nA consulta vai varrer ${(bytes / 1e9).toFixed(2)} GB.`);
else console.log("\nNão consegui estimar a varredura (o dry run não devolveu o total).");
if (ESTIMAR) { console.log("--estimar: parando aqui, sem gastar cota."); process.exit(0); }

// ── 4. Uma varredura ───────────────────────────────────────────────────────────
console.log("Consultando o CNPJ nacional…");
let rows;
try {
  [rows] = await bq.query({ query: SQL });
} catch (e) {
  const cota = /quota/i.test(String(e?.message));
  console.error(`\nERRO na consulta: ${e?.message}`);
  if (cota) {
    console.error(
      "\nIsto é a cota gratuita do BigQuery (1 TiB por mês, projeto em sandbox), não um defeito.\n" +
      "Ou espera o dia 1, ou habilita billing no projeto. O `backfill-contato.mjs` continua\n" +
      "funcionando sem isto, e o que já estava gravado aqui foi preservado.",
    );
  }
  process.exit(1);
}
const contaTel = new Map();
const contaMail = new Map();
for (const r of rows) (r.especie === "tel" ? contaTel : contaMail).set(r.valor, Number(r.empresas));
console.log(`   ${contaTel.size} telefones e ${contaMail.size} e-mails encontrados no nacional.`);

// ── 5. Gravar ──────────────────────────────────────────────────────────────────
const linhas = empresas.map((e) => {
  const t = soDigitos(e.telefone);
  const m = normEmail(e.email);
  /* Ausente no nacional não é 0: é "não bateu com nada", o que acontece com número formatado
     diferente na origem. `null` é honesto; 0 diria que ninguém usa o número, e é mentira. */
  return {
    cnpj: e.cnpj,
    procedencia: "",
    site: "",
    tel_suspeito: null,
    tel_br: t && contaTel.has(t) ? String(contaTel.get(t)) : "",
    email_br: m && contaMail.has(m) ? String(contaMail.get(m)) : "",
  };
});

const faixas = { "1 (exclusivo)": 0, "2 a 4": 0, "5 a 9": 0, "10 a 49": 0, "50 ou mais": 0 };
let comTel = 0;
for (const l of linhas) {
  if (!l.tel_br) continue;
  comTel++;
  const n = Number(l.tel_br);
  if (n <= 1) faixas["1 (exclusivo)"]++;
  else if (n <= 4) faixas["2 a 4"]++;
  else if (n <= 9) faixas["5 a 9"]++;
  else if (n <= 49) faixas["10 a 49"]++;
  else faixas["50 ou mais"]++;
}
console.log("\nTelefone, quantas empresas dividem (BRASIL):");
for (const [f, n] of Object.entries(faixas)) {
  console.log(`  ${f.padEnd(14)} ${String(n).padStart(6)}  ${(n / (comTel || 1) * 100).toFixed(1)}%`);
}

let gravadas = 0;
for (let i = 0; i < linhas.length; i += LOTE_UP) {
  const { data, error } = await supabase.rpc("aplica_contato", { dados: linhas.slice(i, i + LOTE_UP) });
  if (error) { console.error("\nERRO gravando:", error.message); process.exit(1); }
  gravadas += data ?? 0;
  process.stdout.write(`\r   gravando… ${gravadas}`);
}
console.log(`\n\n${gravadas} linhas atualizadas.`);
