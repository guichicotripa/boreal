/**
 * Ingest sector-aware: BigQuery br_me_cnpj → Supabase.
 * Aumenta cobertura sem tocar no que já foi ingerido (upsert idempotente por cnpj).
 *
 *   node --env-file=.env.local scripts/ingest-setor.mjs saude
 *   node --env-file=.env.local scripts/ingest-setor.mjs saude --uf=MG --limit=3000
 *   node --env-file=.env.local scripts/ingest-setor.mjs educacao --faixa-min=7 --limit=20000
 *   node --env-file=.env.local scripts/ingest-setor.mjs --cnae=41,42,43 --rotulo="construção" --uf=BR
 *
 * Mesma lógica do ingest-empresas (enrichment N0 via JOIN); o filtro CNAE vem do
 * registry (src/lib/setores.json) ou de --cnae. Ordena por risco sucessório
 * (faixa etária máx DESC) e corta no --limit.
 *
 * UF e limite eram fixos ('SP', 2000) dentro do SQL. Viraram parâmetro pra dar
 * pra preparar setor e praça novos sem editar o script — o gargalo de montar o
 * universo de um piloto é o tempo de resposta do cliente, não deve ser o código.
 *
 * --faixa-min existe porque cortar só por --limit ordenado por faixa DESC dá um
 * recorte que depende do tamanho do setor: com limit 2000 a base ficou 100% em
 * faixa 8-9 (71+), sem NENHUMA empresa na faixa 7 (61-70) — metade do universo
 * sucessório de fora, e o eixo de idade do score virou quase constante. Com o
 * filtro explícito o recorte é o mesmo em qualquer setor: "o universo quente".
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
// Faixa etária do sócio mais velho (1=0-12 … 7=61-70, 8=71-80, 9=80+). 7 = "quente"
// pela definição do próprio registry. null = sem filtro (comportamento antigo).
const FAIXA_MIN = flag("faixa-min") == null ? null : Number(flag("faixa-min"));
/* Idade mínima da empresa, em anos. Necessário no agro: o CNAE 01/02/03 em SP tem
   84.682 empresas com sócio 61+, mas a curva por idade cai de 51.874 (15+ anos)
   pra 1.948 (20+) — um degrau, não uma inclinação. É a formalização em massa de
   produtor rural entre 2006 e 2010. Nessa coorte a data de abertura do CNPJ não
   diz a idade do negócio, e o eixo de antiguidade do score (30 de ~100 pontos)
   mede outra coisa. Ingerir os 51 mil encheria a base de empresa que o score
   ranqueia com confiança e critério errado. */
const IDADE_MIN = flag("idade-min") == null ? null : Number(flag("idade-min"));
/* --nome: regex sobre razão social + nome fantasia, DENTRO do CNAE.
   Existe porque mandato de boutique quase nunca coincide com um CNAE. O primeiro caso real foi a
   Setter (12/08/2026) pedindo "laboratório de diagnóstico veterinário": não existe CNAE pra isso,
   os laboratórios estão dentro de 7500-1/00 junto com toda clínica de bairro. Carregar 7500 inteiro
   são 36.425 empresas e enterra as 1.661 que interessam. Todo mandato futuro vai ser um recorte
   sub-CNAE, então isto é infraestrutura, não gambiarra pro caso de hoje. */
const NOME_RX = flag("nome");

const reg = JSON.parse(readFileSync(path.resolve(ROOT, "src/lib/setores.json"), "utf8"));

let setor;
if (cnaeAvulso) {
  setor = { id: setorId || "avulso", nome: flag("rotulo", `CNAE ${cnaeAvulso}`), cnaes: cnaeAvulso.split(",").map((c) => c.trim()).filter(Boolean) };
} else {
  if (!setorId) {
    console.error(`uso:
  node --env-file=.env.local scripts/ingest-setor.mjs <setorId> [--uf=SP] [--limit=2000]
  node --env-file=.env.local scripts/ingest-setor.mjs --cnae=41,42,43 --rotulo="construção" [--uf=MG]

  --uf         sigla (SP), lista (MG,PR) ou BR pro país inteiro. Padrão SP.
  --limit      teto por execução, ordenado por risco sucessório. Padrão 2000.
  --cnae       prefixos avulsos, pra setor fora do registry.
  --faixa-min  faixa etária do sócio mais velho (7 = 61+, a definição de "quente").
  --idade-min  idade mínima da empresa em anos (necessário no agro, ver comentário).
  --nome       regex sobre razão social + nome fantasia, pra recorte de mandato dentro do CNAE.

setores no registry: ${reg.setores.map((s) => s.id).join(", ")}`);
    process.exit(1);
  }
  setor = reg.setores.find((s) => s.id === setorId);
  if (!setor) { console.error(`setor "${setorId}" não está no registry. Opções: ${reg.setores.map((s) => s.id).join(", ")}`); process.exit(1); }
}
if (!setor.cnaes.length) { console.error("nenhum CNAE resolvido"); process.exit(1); }
if (!Number.isFinite(LIMIT) || LIMIT <= 0) { console.error(`--limit inválido: ${flag("limit")}`); process.exit(1); }
if (FAIXA_MIN != null && (!Number.isInteger(FAIXA_MIN) || FAIXA_MIN < 1 || FAIXA_MIN > 9)) {
  console.error(`--faixa-min inválido: ${flag("faixa-min")} (esperado inteiro 1–9)`); process.exit(1);
}
if (IDADE_MIN != null && (!Number.isInteger(IDADE_MIN) || IDADE_MIN < 0)) {
  console.error(`--idade-min inválido: ${flag("idade-min")} (esperado inteiro >= 0)`); process.exit(1);
}

const { GCP_PROJECT_ID, GCP_KEY_PATH, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const bq = new BigQuery({ projectId: GCP_PROJECT_ID, keyFilename: path.resolve(ROOT, GCP_KEY_PATH) });
const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const SNAPSHOT = "2025-11-09";
const BATCH = 100;
// Sócios são ~4x as empresas: com lote de 100 um setor de 30k vira 1.285 idas ao
// Supabase, e qualquer soluço no meio derruba a execução inteira. 500 corta pra ~257.
const BATCH_SOCIO = 500;

/* Uma falha transitória de rede no lote 350 de 1.285 não pode custar a ingestão
   inteira. Erro que persiste depois das tentativas continua sendo fatal — o que
   não pode acontecer é o script achar que terminou com metade dos dados dentro. */
async function comRetry(rotulo, fn, tentativas = 4) {
  for (let i = 1; ; i++) {
    const { error } = await fn();
    if (!error) return;
    if (i >= tentativas) { console.error(`\nFAIL ${rotulo} após ${tentativas} tentativas:`, error.message); process.exit(3); }
    const espera = 500 * 2 ** (i - 1);
    console.error(`\n   ⚠ ${rotulo} falhou (${error.message}); tentativa ${i + 1}/${tentativas} em ${espera}ms`);
    await new Promise((r) => setTimeout(r, espera));
  }
}
const cnaeFiltro = "(" + setor.cnaes.map((p) => `e.cnae_fiscal_principal LIKE '${p}%'`).join(" OR ") + ")";

// UF: "BR" tira o recorte (país inteiro); lista vira IN. Era 'SP' fixo no SQL,
// o que impedia preparar praça fora de São Paulo sem editar o script.
const ufs = UF === "BR" ? [] : UF.split(",").map((u) => u.trim()).filter(Boolean);
const ufFiltro = ufs.length ? `AND e.sigla_uf IN (${ufs.map((u) => `'${u}'`).join(",")})` : "";

// HAVING (não WHERE): max_faixa_etaria é agregado sobre os sócios da empresa.
const faixaFiltro = FAIXA_MIN != null ? `HAVING max_faixa_etaria >= ${FAIXA_MIN}` : "";
// Idade é coluna da própria empresa, então cabe no WHERE (mais barato que HAVING).
const idadeFiltro = IDADE_MIN != null
  ? `AND (2025 - EXTRACT(YEAR FROM e.data_inicio_atividade)) >= ${IDADE_MIN}`
  : "";

/* NORMALIZE(NFD) separa a letra do acento e o REGEXP_REPLACE joga fora a marca, então 'Análises'
   vira 'ANALISES' e um padrão só casa as duas grafias. Sem isso, procurar 'DIAGNOSTICO' perde
   'DIAGNÓSTICO', que é como a maioria escreve. */
const nomeFiltro = NOME_RX
  ? `AND REGEXP_CONTAINS(REGEXP_REPLACE(NORMALIZE(UPPER(CONCAT(
       COALESCE(emp.razao_social, ''), ' ', COALESCE(e.nome_fantasia, ''))), NFD), r'\\pM', ''),
       r'${NOME_RX.replace(/'/g, "")}')`
  : "";

/* Quanto o BigQuery cobrou. O dry-run não estima nas tabelas do basedosdados
   (row-level security zera a projeção) e o INFORMATION_SCHEMA.JOBS está fechado
   pra esta service account, então a única medida honesta é a do job executado.
   Free tier = 1 TB/mês; sem este número o custo de aumentar cobertura é chute. */
let bytesCobrados = 0;
async function consulta(query) {
  const [job] = await bq.createQueryJob({ query, location: "US" });
  const [rows] = await job.getQueryResults();
  const [meta] = await job.getMetadata();
  bytesCobrados += Number(meta.statistics?.query?.totalBytesBilled ?? 0);
  return rows;
}
const emGB = (b) => (b / 1024 ** 3).toFixed(2);

function bqDate(f) { return !f ? null : typeof f === "object" ? f.value : f; }
function mapPorte(code) { const m = { "0": "NAO INFORMADO", "1": "ME", "3": "EPP", "5": "DEMAIS" }; if (!code) return null; return m[String(code).replace(/^0/, "") || "0"] ?? code; }
function parseCnaesSec(raw, map = {}) { if (!raw) return null; const c = String(raw).split(",").map((x) => x.trim()).filter(Boolean); return c.length ? c.map((codigo) => ({ codigo, descricao: map[codigo] ?? null })) : null; }
function chunks(a, n) { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; }

const recorte = [
  NOME_RX ? `nome ~ /${NOME_RX}/` : null,
  FAIXA_MIN != null ? `sócio faixa ${FAIXA_MIN}+` : null,
  IDADE_MIN != null ? `empresa ${IDADE_MIN}+ anos` : null,
  FAIXA_MIN != null || IDADE_MIN != null ? `teto ${LIMIT}` : `top ${LIMIT} por risco sucessório`,
].filter(Boolean).join(" · ");
console.log(`Setor "${setor.nome}" (CNAE ${setor.cnaes.join("/")}) · ${ufs.length ? ufs.join("/") : "BR"} · ${recorte}\n`);
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
  WHERE e.data = '${SNAPSHOT}' AND ${cnaeFiltro} ${ufFiltro} ${idadeFiltro} ${nomeFiltro}
    AND e.situacao_cadastral = '2' AND e.identificador_matriz_filial = '1'
  GROUP BY e.cnpj, e.cnpj_basico, emp.razao_social, e.nome_fantasia, e.cnae_fiscal_principal,
    cnae.descricao_subclasse, e.cnae_fiscal_secundaria, e.data_inicio_atividade, e.sigla_uf,
    e.id_municipio, mun.nome, e.email, telefone, emp.natureza_juridica, nat.descricao, emp.capital_social, emp.porte
  ${faixaFiltro}
  ORDER BY max_faixa_etaria DESC NULLS LAST LIMIT ${LIMIT}`;
// --dry: imprime o SQL e sai. Serve pra conferir o recorte (CNAE/UF/limite) sem
// gastar cota do BigQuery — a query varre a base inteira do CNPJ.
if (args.includes("--dry")) {
  console.log(empresasSql);
  console.log(`\n[dry] CNAE=${setor.cnaes.join(",")} · UF=${ufs.length ? ufs.join(",") : "BR (sem recorte)"} · LIMIT=${LIMIT}` +
    (FAIXA_MIN != null ? ` · faixa>=${FAIXA_MIN}` : "") +
    (IDADE_MIN != null ? ` · idade>=${IDADE_MIN}` : ""));
  process.exit(0);
}

const bqEmpresas = await consulta(empresasSql);
console.log(`   → ${bqEmpresas.length} empresas  [${emGB(bytesCobrados)} GB]`);
if (bqEmpresas.length === LIMIT) {
  console.log(`   ⚠ bateu no teto (--limit=${LIMIT}); há mais empresas no recorte`);
}

const cnaeRows = await consulta(`SELECT subclasse, descricao_subclasse FROM \`basedosdados.br_bd_diretorios_brasil.cnae_2\``);
const cnaeMap = Object.fromEntries(cnaeRows.map((r) => [r.subclasse, r.descricao_subclasse]));

console.log("2/4  Sócios no BigQuery…");
const basicos = [...new Set(bqEmpresas.map((r) => r.cnpj_basico))];
const socioRows = [];
const blocos = chunks(basicos, 500);
let iBloco = 0;
for (const block of blocos) {
  const inList = block.map((c) => `'${c}'`).join(",");
  const rows = await consulta(`SELECT cnpj_basico, nome, documento, qualificacao, data_entrada_sociedade, faixa_etaria FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${SNAPSHOT}' AND cnpj_basico IN (${inList})`);
  socioRows.push(...rows);
  process.stdout.write(`\r   → bloco ${++iBloco}/${blocos.length} · ${socioRows.length} sócios · ${emGB(bytesCobrados)} GB`);
}
console.log(`\n   → ${socioRows.length} sócios  [acumulado ${emGB(bytesCobrados)} GB]`);
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
  await comRetry("upsert empresa", () => supabase.from("empresa").upsert(batch, { onConflict: "cnpj" }));
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
for (const batch of chunks(empresaIds, BATCH_SOCIO)) {
  await comRetry("delete socios", () => supabase.from("socio").delete().in("empresa_id", batch));
}
let ns = 0;
for (const batch of chunks(socioPayloads, BATCH_SOCIO)) {
  await comRetry("insert socio", () => supabase.from("socio").insert(batch));
  ns += batch.length; process.stdout.write(`\r   → ${ns}/${socioPayloads.length}`);
}

/* PORTÃO DE INTEGRIDADE. Uma execução anterior morreu no meio deste passo e
   deixou 23.859 empresas sem NENHUM sócio — o que é pior que não ter ingerido:
   sem sócio o eixo de idade do score vale 0, então a empresa afunda no ranking e
   a tela mostra o quadro societário vazio, com cara de dado que não existe.
   O script não pode dizer "✓" sem conferir o que ficou gravado. */
console.log("\n\nConferindo integridade…");
const cnpjs = empresaPayloads.map((e) => e.cnpj);
let semSocio = 0;
for (const batch of chunks(cnpjs, BATCH_SOCIO)) {
  const { data, error } = await supabase.from("empresa").select("cnpj, socio(id)").in("cnpj", batch);
  if (error) { console.error("FAIL conferência:", error.message); process.exit(7); }
  for (const e of data) if (!e.socio?.length) semSocio++;
}
// Sem sócio PF no registro da Receita é legítimo (ex: filial de grupo, natureza
// jurídica sem quadro societário). O que denuncia execução truncada é a MASSA.
/* O portão era `> 10%` fixo, calibrado no perfil dos setores antigos, e teria abortado uma
   ingestão CORRETA de funerária ou veterinária: Empresário Individual e Produtor Rural PF não têm
   quadro societário por definição legal, e medido em 12/08/2026 eles fazem 44,4% das empresas dos
   4 setores ingeridos (mais de 69% em agro). O critério certo não é número mágico, é comparar com
   o ESPERADO: o script já sabe, do próprio BigQuery, quais empresas do lote têm sócio. Se o
   Supabase reproduz essa taxa, está íntegro; se está muito acima, truncou. */
const semSocioNoBq = bqEmpresas.filter((e) => !(sociosByBasico[e.cnpj_basico] ?? []).length).length;
const pctEsperado = (semSocioNoBq / bqEmpresas.length) * 100;
const pctSem = (semSocio / cnpjs.length) * 100;
console.log(`  sem nenhum sócio no Supabase: ${semSocio}/${cnpjs.length} (${pctSem.toFixed(1)}%)`);
console.log(`  sem nenhum sócio no BigQuery: ${semSocioNoBq}/${bqEmpresas.length} (${pctEsperado.toFixed(1)}%)  ← o esperado`);
if (pctSem > pctEsperado + 5) {
  console.error(`\n✗ ${setor.nome}: ${pctSem.toFixed(1)}% sem sócio contra ${pctEsperado.toFixed(1)}% esperados — execução provavelmente truncada. Rode de novo.`);
  process.exit(8);
}

console.log(`\n✓ ${setor.nome}: ${n} empresas, ${ns} sócios ingeridos.`);
console.log(`  BigQuery cobrou ${emGB(bytesCobrados)} GB nesta execução (free tier = 1024 GB/mês).`);
