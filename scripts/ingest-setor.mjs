/**
 * Ingest sector-aware: BigQuery br_me_cnpj → Supabase.
 * Aumenta cobertura sem tocar no que já foi ingerido (upsert idempotente por cnpj).
 *
 *   node --env-file=.env.local scripts/ingest-setor.mjs saude
 *   node --env-file=.env.local scripts/ingest-setor.mjs saude --uf=MG --limit=3000
 *   node --env-file=.env.local scripts/ingest-setor.mjs --cnae=41,42,43 --rotulo="construção" --uf=BR
 *
 * Mesma lógica do ingest-empresas (enrichment N0 via JOIN); o filtro CNAE vem do
 * registry (src/lib/setores.json) ou de --cnae. Ordena por risco sucessório
 * (faixa etária máx DESC) e corta no --limit.
 *
 * UF e limite eram fixos ('SP', 2000) dentro do SQL. Viraram parâmetro pra dar
 * pra preparar setor e praça novos sem editar o script — o gargalo de montar o
 * universo de um piloto é o tempo de resposta do cliente, não deve ser o código.
 */
import { BigQuery } from "@google-cloud/bigquery";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

/* Argumentos. Dois modos:
     · registry  — setor já catalogado em src/lib/setores.json
     · avulso    — --cnae=... , pra ingerir um setor QUE AINDA NÃO ESTÁ no registry
   O modo avulso existe porque o registry carrega metadado de validação (recall,
   pct_sucessão) que só sai do build-setores. Esperar por isso pra conseguir
   ingerir travaria a preparação de um piloto por dado que não é pré-requisito
   da ingestão. */
const args = process.argv.slice(2);
const flag = (nome, padrao = null) => {
  const a = args.find((x) => x.startsWith(`--${nome}=`));
  return a ? a.slice(nome.length + 3).trim() : padrao;
};
const setorId = (args.find((a) => !a.startsWith("--")) || "").trim();
const cnaeAvulso = flag("cnae");
const UF = flag("uf", "SP").toUpperCase();      // sigla, lista "MG,PR" ou "BR" (país inteiro)
const LIMIT = Number(flag("limit", "2000"));

const reg = JSON.parse(readFileSync(path.resolve(ROOT, "src/lib/setores.json"), "utf8"));

let setor;
if (cnaeAvulso) {
  setor = { id: setorId || "avulso", nome: flag("rotulo", `CNAE ${cnaeAvulso}`), cnaes: cnaeAvulso.split(",").map((c) => c.trim()).filter(Boolean) };
} else {
  if (!setorId) {
    console.error(`uso:
  node --env-file=.env.local scripts/ingest-setor.mjs <setorId> [--uf=SP] [--limit=2000]
  node --env-file=.env.local scripts/ingest-setor.mjs --cnae=41,42,43 --rotulo="construção" [--uf=MG]

  --uf     sigla (SP), lista (MG,PR) ou BR pro país inteiro. Padrão SP.
  --limit  teto por execução, ordenado por risco sucessório. Padrão 2000.
  --cnae   prefixos avulsos, pra setor fora do registry.

setores no registry: ${reg.setores.map((s) => s.id).join(", ")}`);
    process.exit(1);
  }
  setor = reg.setores.find((s) => s.id === setorId);
  if (!setor) { console.error(`setor "${setorId}" não está no registry. Opções: ${reg.setores.map((s) => s.id).join(", ")}`); process.exit(1); }
}
if (!setor.cnaes.length) { console.error("nenhum CNAE resolvido"); process.exit(1); }
if (!Number.isFinite(LIMIT) || LIMIT <= 0) { console.error(`--limit inválido: ${flag("limit")}`); process.exit(1); }

const { GCP_PROJECT_ID, GCP_KEY_PATH, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const bq = new BigQuery({ projectId: GCP_PROJECT_ID, keyFilename: path.resolve(ROOT, GCP_KEY_PATH) });
const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const SNAPSHOT = "2025-11-09";
const BATCH = 100;
const cnaeFiltro = "(" + setor.cnaes.map((p) => `e.cnae_fiscal_principal LIKE '${p}%'`).join(" OR ") + ")";

// UF: "BR" tira o recorte (país inteiro); lista vira IN. Era 'SP' fixo no SQL,
// o que impedia preparar praça fora de São Paulo sem editar o script.
const ufs = UF === "BR" ? [] : UF.split(",").map((u) => u.trim()).filter(Boolean);
const ufFiltro = ufs.length ? `AND e.sigla_uf IN (${ufs.map((u) => `'${u}'`).join(",")})` : "";

function bqDate(f) { return !f ? null : typeof f === "object" ? f.value : f; }
function mapPorte(code) { const m = { "0": "NAO INFORMADO", "1": "ME", "3": "EPP", "5": "DEMAIS" }; if (!code) return null; return m[String(code).replace(/^0/, "") || "0"] ?? code; }
function parseCnaesSec(raw, map = {}) { if (!raw) return null; const c = String(raw).split(",").map((x) => x.trim()).filter(Boolean); return c.length ? c.map((codigo) => ({ codigo, descricao: map[codigo] ?? null })) : null; }
function chunks(a, n) { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; }

console.log(`Setor "${setor.nome}" (CNAE ${setor.cnaes.join("/")}) · ${ufs.length ? ufs.join("/") : "BR"} · top ${LIMIT} por risco sucessório\n`);
console.log("1/4  Empresas no BigQuery…");
const empresasSql = `
  SELECT e.cnpj, e.cnpj_basico, emp.razao_social, e.nome_fantasia, e.cnae_fiscal_principal,
    cnae.descricao_subclasse AS cnae_principal_desc, e.cnae_fiscal_secundaria, e.data_inicio_atividade,
    e.sigla_uf, e.id_municipio, mun.nome AS municipio_nome, e.email,
    CONCAT(COALESCE(e.ddd_1, ''), COALESCE(e.telefone_1, '')) AS telefone,
    emp.natureza_juridica, nat.descricao AS natureza_juridica_desc, emp.capital_social, emp.porte,
    MAX(SAFE_CAST(s.faixa_etaria AS INT64)) AS max_faixa_etaria
  FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e
  JOIN \`basedosdados.br_me_cnpj.empresas\` emp ON emp.cnpj_basico = e.cnpj_basico AND emp.data = '${SNAPSHOT}'
  LEFT JOIN \`basedosdados.br_me_cnpj.socios\` s ON s.cnpj_basico = e.cnpj_basico AND s.data = '${SNAPSHOT}'
  LEFT JOIN \`basedosdados.br_bd_diretorios_brasil.municipio\` mun ON mun.id_municipio = e.id_municipio
  LEFT JOIN \`basedosdados.br_bd_diretorios_brasil.cnae_2\` cnae ON cnae.subclasse = e.cnae_fiscal_principal
  LEFT JOIN \`basedosdados.br_bd_diretorios_brasil.natureza_juridica\` nat ON nat.id_natureza_juridica = emp.natureza_juridica
  WHERE e.data = '${SNAPSHOT}' AND ${cnaeFiltro} ${ufFiltro}
    AND e.situacao_cadastral = '2' AND e.identificador_matriz_filial = '1'
  GROUP BY e.cnpj, e.cnpj_basico, emp.razao_social, e.nome_fantasia, e.cnae_fiscal_principal,
    cnae.descricao_subclasse, e.cnae_fiscal_secundaria, e.data_inicio_atividade, e.sigla_uf,
    e.id_municipio, mun.nome, e.email, telefone, emp.natureza_juridica, nat.descricao, emp.capital_social, emp.porte
  ORDER BY max_faixa_etaria DESC NULLS LAST LIMIT ${LIMIT}`;
// --dry: imprime o SQL e sai. Serve pra conferir o recorte (CNAE/UF/limite) sem
// gastar cota do BigQuery — a query varre a base inteira do CNPJ.
if (args.includes("--dry")) {
  console.log(empresasSql);
  console.log(`\n[dry] CNAE=${setor.cnaes.join(",")} · UF=${ufs.length ? ufs.join(",") : "BR (sem recorte)"} · LIMIT=${LIMIT}`);
  process.exit(0);
}

const [bqEmpresas] = await bq.query({ query: empresasSql, location: "US" });
console.log(`   → ${bqEmpresas.length} empresas`);

const [cnaeRows] = await bq.query({ query: `SELECT subclasse, descricao_subclasse FROM \`basedosdados.br_bd_diretorios_brasil.cnae_2\``, location: "US" });
const cnaeMap = Object.fromEntries(cnaeRows.map((r) => [r.subclasse, r.descricao_subclasse]));

console.log("2/4  Sócios no BigQuery…");
const basicos = [...new Set(bqEmpresas.map((r) => r.cnpj_basico))];
const socioRows = [];
for (const block of chunks(basicos, 500)) {
  const inList = block.map((c) => `'${c}'`).join(",");
  const [rows] = await bq.query({ query: `SELECT cnpj_basico, nome, documento, qualificacao, data_entrada_sociedade, faixa_etaria FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${SNAPSHOT}' AND cnpj_basico IN (${inList})`, location: "US" });
  socioRows.push(...rows);
}
console.log(`   → ${socioRows.length} sócios`);
const sociosByBasico = {};
for (const s of socioRows) { (sociosByBasico[s.cnpj_basico] ??= []).push(s); }

console.log("3/4  Upsert empresas no Supabase…");
const empresaPayloads = bqEmpresas.map((r) => ({
  cnpj: String(r.cnpj), razao_social: r.razao_social, nome_fantasia: r.nome_fantasia || null,
  cnae_principal: r.cnae_fiscal_principal || null, cnae_principal_desc: r.cnae_principal_desc || null,
  cnaes_secundarios: parseCnaesSec(r.cnae_fiscal_secundaria, cnaeMap),
  natureza_juridica: r.natureza_juridica_desc || r.natureza_juridica || null,
  capital_social: r.capital_social ?? null, porte: mapPorte(r.porte), situacao_cadastral: "ATIVA",
  data_inicio_atividade: bqDate(r.data_inicio_atividade), municipio: r.municipio_nome || r.id_municipio || null,
  uf: r.sigla_uf || null, telefone: r.telefone || null, email: r.email || null, raw: r, updated_at: new Date().toISOString(),
}));
let n = 0;
for (const batch of chunks(empresaPayloads, BATCH)) {
  const { error } = await supabase.from("empresa").upsert(batch, { onConflict: "cnpj" });
  if (error) { console.error("FAIL upsert empresa:", error.message); process.exit(3); }
  n += batch.length; process.stdout.write(`\r   → ${n}/${empresaPayloads.length}`);
}
console.log();

console.log("4/4  Sócios no Supabase…");
const cnpjToId = {};
for (const batch of chunks(empresaPayloads.map((e) => e.cnpj), BATCH)) {
  const { data, error } = await supabase.from("empresa").select("id, cnpj").in("cnpj", batch);
  if (error) { console.error("FAIL select empresa:", error.message); process.exit(4); }
  for (const row of data) cnpjToId[row.cnpj] = row.id;
}
const socioPayloads = [];
for (const emp of bqEmpresas) {
  const id = cnpjToId[String(emp.cnpj)]; if (!id) continue;
  for (const s of sociosByBasico[emp.cnpj_basico] ?? []) {
    socioPayloads.push({ empresa_id: id, nome: s.nome, cpf_cnpj_mascarado: s.documento || null, qualificacao: s.qualificacao || null, faixa_etaria: s.faixa_etaria ? String(s.faixa_etaria) : null, data_entrada_sociedade: bqDate(s.data_entrada_sociedade) });
  }
}
const empresaIds = [...new Set(socioPayloads.map((s) => s.empresa_id))];
for (const batch of chunks(empresaIds, BATCH)) {
  const { error } = await supabase.from("socio").delete().in("empresa_id", batch);
  if (error) { console.error("FAIL delete socios:", error.message); process.exit(5); }
}
let ns = 0;
for (const batch of chunks(socioPayloads, BATCH)) {
  const { error } = await supabase.from("socio").insert(batch);
  if (error) { console.error("FAIL insert socio:", error.message); process.exit(6); }
  ns += batch.length; process.stdout.write(`\r   → ${ns}/${socioPayloads.length}`);
}
console.log(`\n\n✓ ${setor.nome}: ${n} empresas, ${ns} sócios ingeridos.`);
