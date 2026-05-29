/**
 * Enrichment Nível 0 — resolve códigos → nomes legíveis nas 2000 empresas existentes.
 * Roda: node --env-file=.env.local scripts/enrich-empresas.mjs
 *
 * Resolve (lendo do payload bruto em `raw`, então é idempotente):
 *  - id_municipio (IBGE)        → municipio (nome da cidade)
 *  - cnae_fiscal_principal      → cnae_principal_desc (descrição da subclasse)
 *  - natureza_juridica (código) → natureza_juridica (descrição)
 *  - cnaes_secundarios          → adiciona descrição a cada código
 *
 * Os códigos originais ficam preservados em `raw` — nada se perde.
 * A mesma lógica de lookup deve migrar para o ingest (dados novos já nascem resolvidos).
 */
import { BigQuery } from "@google-cloud/bigquery";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const {
  GCP_PROJECT_ID, GCP_KEY_PATH,
  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

const bq = new BigQuery({
  projectId: GCP_PROJECT_ID,
  keyFilename: path.resolve(ROOT, GCP_KEY_PATH),
});
const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function chunks(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// ── 1. Carrega os mapas de lookup do BigQuery (uma vez, pra memória) ────────────
console.log("1/4  Carregando tabelas de lookup do BigQuery…");

const [municipios] = await bq.query({
  query: `SELECT id_municipio, nome FROM \`basedosdados.br_bd_diretorios_brasil.municipio\``,
  location: "US",
});
const mapMunicipio = Object.fromEntries(municipios.map((r) => [r.id_municipio, r.nome]));

const [cnaes] = await bq.query({
  query: `SELECT subclasse, descricao_subclasse FROM \`basedosdados.br_bd_diretorios_brasil.cnae_2\``,
  location: "US",
});
const mapCnae = Object.fromEntries(cnaes.map((r) => [r.subclasse, r.descricao_subclasse]));

const [naturezas] = await bq.query({
  query: `SELECT id_natureza_juridica, descricao FROM \`basedosdados.br_bd_diretorios_brasil.natureza_juridica\``,
  location: "US",
});
const mapNatureza = Object.fromEntries(naturezas.map((r) => [r.id_natureza_juridica, r.descricao]));

console.log(`   → ${Object.keys(mapMunicipio).length} municípios, ${Object.keys(mapCnae).length} CNAEs, ${Object.keys(mapNatureza).length} naturezas`);

// ── 2. Lê as empresas (id + raw) do Supabase — paginado (limite de 1000/página) ──
console.log("2/4  Lendo empresas do Supabase…");
const empresas = [];
const PAGE = 1000;
for (let from = 0; ; from += PAGE) {
  const { data, error: readErr } = await supabase
    .from("empresa")
    .select("id, raw")
    .range(from, from + PAGE - 1);
  if (readErr) { console.error("FAIL read:", readErr.message); process.exit(1); }
  empresas.push(...data);
  if (data.length < PAGE) break;
}
console.log(`   → ${empresas.length} empresas`);

// ── 3. Resolve cada empresa a partir do raw ─────────────────────────────────────
console.log("3/4  Resolvendo códigos → nomes…");

function resolveCnaesSecundarios(rawCsv) {
  if (!rawCsv) return null;
  const codes = String(rawCsv).split(",").map((c) => c.trim()).filter(Boolean);
  if (codes.length === 0) return null;
  return codes.map((codigo) => ({ codigo, descricao: mapCnae[codigo] ?? null }));
}

const updates = empresas.map((e) => {
  const raw = e.raw ?? {};
  return {
    id: e.id,
    municipio: mapMunicipio[raw.id_municipio] ?? raw.id_municipio ?? null,
    cnae_principal_desc: mapCnae[raw.cnae_fiscal_principal] ?? null,
    natureza_juridica: mapNatureza[raw.natureza_juridica] ?? raw.natureza_juridica ?? null,
    cnaes_secundarios: resolveCnaesSecundarios(raw.cnae_fiscal_secundaria),
  };
});

// Quantos resolveram de fato (telemetria honesta)
const okMun = updates.filter((u) => u.municipio && !/^\d+$/.test(u.municipio)).length;
const okCnae = updates.filter((u) => u.cnae_principal_desc).length;
const okNat = updates.filter((u) => u.natureza_juridica && !/^\d+$/.test(u.natureza_juridica)).length;
console.log(`   → município: ${okMun}/${updates.length} · cnae: ${okCnae}/${updates.length} · natureza: ${okNat}/${updates.length}`);

// ── 4. Aplica os UPDATEs (em paralelo, chunks de 50) ────────────────────────────
console.log("4/4  Atualizando Supabase…");
let done = 0;
for (const batch of chunks(updates, 50)) {
  await Promise.all(
    batch.map((u) =>
      supabase
        .from("empresa")
        .update({
          municipio: u.municipio,
          cnae_principal_desc: u.cnae_principal_desc,
          natureza_juridica: u.natureza_juridica,
          cnaes_secundarios: u.cnaes_secundarios,
        })
        .eq("id", u.id)
    )
  );
  done += batch.length;
  process.stdout.write(`\r   → ${done}/${updates.length}`);
}
console.log();

console.log(`\n✓ Enrichment concluído. ${updates.length} empresas resolvidas.`);
