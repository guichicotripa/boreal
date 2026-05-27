/**
 * Ingest pipeline: BigQuery br_me_cnpj → Supabase (empresa + socio).
 * Roda: node --env-file=.env.local scripts/ingest-empresas.mjs
 *
 * Fluxo:
 *  1. Query BQ: 2000 sedes (matriz), CNAE 24/25/28, SP (sem capital), ativas,
 *     ordenadas por faixa_etaria máxima dos sócios DESC (risco sucessório primeiro).
 *  2. Segunda query BQ: todos os sócios dessas 2000 empresas de uma vez (IN).
 *  3. Upsert em lote no Supabase: empresa (batch 100) → socio (batch 100).
 */

import { BigQuery } from "@google-cloud/bigquery";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";

// ── Setup ─────────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const {
  GCP_PROJECT_ID,
  GCP_KEY_PATH,
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

if (!GCP_PROJECT_ID || !GCP_KEY_PATH || !NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("FAIL: variáveis de ambiente faltando. Verifique .env.local.");
  process.exit(1);
}

const bq = new BigQuery({
  projectId: GCP_PROJECT_ID,
  keyFilename: path.resolve(ROOT, GCP_KEY_PATH),
});

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SNAPSHOT = "2025-11-09";
const BATCH = 100;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extrai string de um campo DATE do BigQuery (retorna {value: "YYYY-MM-DD"} ou null). */
function bqDate(field) {
  if (!field) return null;
  return typeof field === "object" ? field.value : field;
}

/** Mapeia código de porte da Receita Federal para texto legível. */
function mapPorte(code) {
  const map = { "0": "NAO INFORMADO", "1": "ME", "3": "EPP", "5": "DEMAIS" };
  if (!code) return null;
  // BD às vezes guarda sem zero à esquerda ('5'), às vezes com ('05')
  const key = String(code).replace(/^0/, "") || "0";
  return map[key] ?? code;
}

/** Parseia cnae_fiscal_secundaria (string CSV) em array [{codigo}]. */
function parseCnaesSecundarios(raw) {
  if (!raw) return null;
  const codes = String(raw)
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  if (codes.length === 0) return null;
  return codes.map((codigo) => ({ codigo }));
}

/** Divide um array em chunks de tamanho n. */
function chunks(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// ── 1. Query BigQuery: empresas ───────────────────────────────────────────────
console.log("1/4  Buscando empresas no BigQuery…");

const empresasSql = `
  SELECT
    e.cnpj,
    e.cnpj_basico,
    emp.razao_social,
    e.nome_fantasia,
    e.cnae_fiscal_principal,
    e.cnae_fiscal_secundaria,
    e.data_inicio_atividade,
    e.sigla_uf,
    e.id_municipio,
    e.email,
    CONCAT(COALESCE(e.ddd_1, ''), COALESCE(e.telefone_1, '')) AS telefone,
    emp.natureza_juridica,
    emp.capital_social,
    emp.porte,
    MAX(SAFE_CAST(s.faixa_etaria AS INT64)) AS max_faixa_etaria
  FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e
  JOIN \`basedosdados.br_me_cnpj.empresas\` emp
    ON emp.cnpj_basico = e.cnpj_basico
   AND emp.data = '${SNAPSHOT}'
  LEFT JOIN \`basedosdados.br_me_cnpj.socios\` s
    ON s.cnpj_basico = e.cnpj_basico
   AND s.data = '${SNAPSHOT}'
  WHERE
    e.data = '${SNAPSHOT}'
    AND (
      e.cnae_fiscal_principal LIKE '24%'
      OR e.cnae_fiscal_principal LIKE '25%'
      OR e.cnae_fiscal_principal LIKE '28%'
    )
    AND e.sigla_uf = 'SP'
    AND e.situacao_cadastral = '2'
    AND e.identificador_matriz_filial = '1'
    AND e.id_municipio != '3550308'    -- exclui São Paulo capital
  GROUP BY
    e.cnpj, e.cnpj_basico, emp.razao_social, e.nome_fantasia,
    e.cnae_fiscal_principal, e.cnae_fiscal_secundaria, e.data_inicio_atividade,
    e.sigla_uf, e.id_municipio, e.email, telefone,
    emp.natureza_juridica, emp.capital_social, emp.porte
  ORDER BY max_faixa_etaria DESC NULLS LAST
  LIMIT 2000
`;

const [bqEmpresas] = await bq.query({ query: empresasSql, location: "US" });
console.log(`   → ${bqEmpresas.length} empresas retornadas`);

// ── 2. Query BigQuery: sócios ─────────────────────────────────────────────────
console.log("2/4  Buscando sócios no BigQuery…");

const cnpjsBasicos = [...new Set(bqEmpresas.map((r) => r.cnpj_basico))];
// BigQuery suporta IN com até ~10k valores; dividimos em blocos de 500 para segurança
const socioRows = [];
for (const block of chunks(cnpjsBasicos, 500)) {
  const inList = block.map((c) => `'${c}'`).join(",");
  const [rows] = await bq.query({
    query: `
      SELECT
        cnpj_basico,
        nome,
        documento,
        qualificacao,
        data_entrada_sociedade,
        faixa_etaria
      FROM \`basedosdados.br_me_cnpj.socios\`
      WHERE data = '${SNAPSHOT}'
        AND cnpj_basico IN (${inList})
    `,
    location: "US",
  });
  socioRows.push(...rows);
}
console.log(`   → ${socioRows.length} sócios retornados`);

// Indexa sócios por cnpj_basico para lookup rápido
const sociosByBasico = {};
for (const s of socioRows) {
  if (!sociosByBasico[s.cnpj_basico]) sociosByBasico[s.cnpj_basico] = [];
  sociosByBasico[s.cnpj_basico].push(s);
}

// ── 3. Upsert empresas no Supabase ────────────────────────────────────────────
console.log("3/4  Inserindo empresas no Supabase…");

const empresaPayloads = bqEmpresas.map((r) => ({
  cnpj:                  String(r.cnpj),
  razao_social:          r.razao_social,
  nome_fantasia:         r.nome_fantasia || null,
  cnae_principal:        r.cnae_fiscal_principal || null,
  cnae_principal_desc:   null,                                  // enriquece na Semana 2
  cnaes_secundarios:     parseCnaesSecundarios(r.cnae_fiscal_secundaria),
  natureza_juridica:     r.natureza_juridica || null,
  capital_social:        r.capital_social ?? null,
  porte:                 mapPorte(r.porte),
  situacao_cadastral:    "ATIVA",
  data_inicio_atividade: bqDate(r.data_inicio_atividade),
  municipio:             r.id_municipio || null,                 // código IBGE — resolve na Semana 2
  uf:                    r.sigla_uf || null,
  telefone:              r.telefone || null,
  email:                 r.email || null,
  raw:                   r,
  updated_at:            new Date().toISOString(),
}));

let empresasInseridas = 0;
for (const batch of chunks(empresaPayloads, BATCH)) {
  const { error } = await supabase
    .from("empresa")
    .upsert(batch, { onConflict: "cnpj" });
  if (error) {
    console.error("FAIL upsert empresa:", error.message);
    process.exit(3);
  }
  empresasInseridas += batch.length;
  process.stdout.write(`\r   → ${empresasInseridas}/${empresaPayloads.length} empresas`);
}
console.log();

// ── 4. Busca IDs das empresas + upsert sócios ─────────────────────────────────
console.log("4/4  Inserindo sócios no Supabase…");

// Busca empresa_id por CNPJ (batch de 100 para não estourar URL)
const cnpjToId = {};
for (const batch of chunks(empresaPayloads.map((e) => e.cnpj), BATCH)) {
  const { data, error } = await supabase
    .from("empresa")
    .select("id, cnpj")
    .in("cnpj", batch);
  if (error) {
    console.error("FAIL select empresa:", error.message);
    process.exit(4);
  }
  for (const row of data) cnpjToId[row.cnpj] = row.id;
}
console.log(`   → ${Object.keys(cnpjToId).length} IDs resolvidos`);

// Monta payloads de sócios
const socioPayloads = [];
for (const emp of bqEmpresas) {
  const empresaId = cnpjToId[String(emp.cnpj)];
  if (!empresaId) continue;
  const socios = sociosByBasico[emp.cnpj_basico] ?? [];
  for (const s of socios) {
    socioPayloads.push({
      empresa_id:            empresaId,
      nome:                  s.nome,
      cpf_cnpj_mascarado:    s.documento || null,
      qualificacao:          s.qualificacao || null,
      faixa_etaria:          s.faixa_etaria ? String(s.faixa_etaria) : null,
      data_entrada_sociedade: bqDate(s.data_entrada_sociedade),
    });
  }
}
console.log(`   → ${socioPayloads.length} sócios a inserir`);

// Deleta sócios anteriores das empresas que vamos reinserir (evita duplicata)
const empresaIds = [...new Set(socioPayloads.map((s) => s.empresa_id))];
for (const batch of chunks(empresaIds, BATCH)) {
  const { error } = await supabase.from("socio").delete().in("empresa_id", batch);
  if (error) {
    console.error("FAIL delete socios:", error.message);
    process.exit(5);
  }
}

// Insere sócios em lote
let sociosInseridos = 0;
for (const batch of chunks(socioPayloads, BATCH)) {
  const { error } = await supabase.from("socio").insert(batch);
  if (error) {
    console.error("FAIL insert socio:", error.message);
    process.exit(6);
  }
  sociosInseridos += batch.length;
  process.stdout.write(`\r   → ${sociosInseridos}/${socioPayloads.length} sócios`);
}
console.log();

console.log(`
✓ Ingest concluído.
  Empresas: ${empresasInseridas}
  Sócios:   ${sociosInseridos}
`);
