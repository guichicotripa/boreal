/**
 * Preenche `empresa.opcao_simples` e `empresa.data_exclusao_simples` a partir do BigQuery.
 *
 *   node --env-file=.env.local scripts/backfill-simples.mjs            # tudo que está NULL
 *   node --env-file=.env.local scripts/backfill-simples.mjs --tudo     # recompõe a base inteira
 *
 * POR QUE EXISTE: a migration 0015 criou as colunas vazias, e o ingest só preenche o que for
 * ingerido daqui pra frente. As ~65 mil empresas que já estão na base não voltariam sozinhas.
 *
 * SEM PARTIÇÃO POR DATA: `basedosdados.br_me_cnpj.simples` é ESTADO ATUAL, não série histórica.
 * Para filtrar a lista de hoje isso é exatamente o que se quer. Para TREINAR o score é vazamento,
 * e por isso `calibra-score.py` aborta se a coluna aparecer na matriz. Ver a 0015.
 *
 * AUSENTE NA TABELA = NUNCA OPTOU. A Receita só tem linha para quem teve alguma relação com o
 * Simples. Gravar `false` nesses casos (e não deixar NULL) é o que faz o filtro funcionar: NULL
 * passa a significar só "ainda não verificado".
 */
import { BigQuery } from "@google-cloud/bigquery";
import { createClient } from "@supabase/supabase-js";
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
const LOTE_BQ = 5000;   // cnpj_basico por consulta ao BigQuery
const LOTE_UP = 500;    // linhas por update no Supabase

console.log(TUDO ? "Recompondo a base inteira." : "Preenchendo só quem está NULL.");

// ── 1. Quem precisa ────────────────────────────────────────────────────────────
const empresas = [];
for (let off = 0; ; off += 1000) {
  let q = supabase.from("empresa").select("id,cnpj").order("id").range(off, off + 999);
  if (!TUDO) q = q.is("opcao_simples", null);
  const r = await q;
  if (r.error) { console.error("ERRO lendo empresa:", r.error.message); process.exit(1); }
  empresas.push(...r.data);
  process.stdout.write(`\r   lendo… ${empresas.length}`);
  if (r.data.length < 1000) break;
}
console.log(`\n   ${empresas.length} empresas para preencher.`);
if (empresas.length === 0) { console.log("Nada a fazer."); process.exit(0); }

/* `cnpj_basico` são os 8 primeiros dígitos: o Simples é da EMPRESA, não do estabelecimento.
   Várias filiais compartilham o mesmo básico, então o Map economiza consulta. */
const basicoDe = (cnpj) => String(cnpj).replace(/\D/g, "").slice(0, 8);
const basicos = [...new Set(empresas.map((e) => basicoDe(e.cnpj)))];
console.log(`   ${basicos.length} CNPJs básicos distintos.`);

// ── 2. BigQuery ────────────────────────────────────────────────────────────────
const noSimples = new Map(); // basico -> { optante, exclusao }
let bloco = 0;
for (let i = 0; i < basicos.length; i += LOTE_BQ) {
  const fatia = basicos.slice(i, i + LOTE_BQ);
  const [rows] = await bq.query({
    query: `SELECT cnpj_basico, opcao_simples,
                   FORMAT_DATE('%Y-%m-%d', data_exclusao_simples) AS exclusao
            FROM \`basedosdados.br_me_cnpj.simples\`
            WHERE cnpj_basico IN UNNEST(@b)`,
    params: { b: fatia },
  });
  for (const r of rows) noSimples.set(r.cnpj_basico, { optante: r.opcao_simples === 1, exclusao: r.exclusao ?? null });
  process.stdout.write(`\r   BigQuery… bloco ${++bloco}/${Math.ceil(basicos.length / LOTE_BQ)} · ${noSimples.size} com histórico de Simples`);
}
console.log();

// -- 3. Grava --------------------------------------------------------------------
/* `aplica_simples` (migration 0016) e NAO `upsert`. Upsert e INSERT ... ON CONFLICT, entao o
   payload teria que satisfazer `razao_social NOT NULL` e estoura na primeira linha. Alternativa
   sem a funcao seria um update por linha: 65 mil idas ao banco. */
let n = 0, optantes = 0, sairam = 0;
for (let i = 0; i < empresas.length; i += LOTE_UP) {
  const payload = empresas.slice(i, i + LOTE_UP).map((e) => {
    const s = noSimples.get(basicoDe(e.cnpj));
    if (s?.optante) optantes++;
    if (s?.exclusao && !s.optante) sairam++;
    return {
      cnpj: String(e.cnpj),
      // Ausente na tabela = nunca optou. `false` explicito, nao NULL: ver o cabecalho.
      opcao: s ? s.optante : false,
      exclusao: s?.exclusao ?? "",
    };
  });
  const r = await supabase.rpc("aplica_simples", { dados: payload });
  if (r.error) { console.error("ERRO no update:", r.error.message); process.exit(1); }
  n += r.data ?? 0;
  if (i % 5000 === 0) console.log(`   gravando... ${n}/${empresas.length}`);
}
console.log(`OK ${n} linhas atualizadas | ${optantes} optantes pelo Simples | ${sairam} ja sairam`);
