/**
 * Preenche a qualidade de contato de `empresa` com o que dá para saber SEM sair do nosso banco:
 * de quem é o e-mail, se o telefone vale discar, e o site derivado do domínio.
 *
 *   node --env-file=.env.local scripts/backfill-contato.mjs              # só quem nunca foi aferido
 *   node --env-file=.env.local scripts/backfill-contato.mjs --tudo       # recompõe a base inteira
 *
 * POR QUE EXISTE: a migration 0019 criou as colunas vazias. As 65 mil empresas que já estão na
 * base não voltariam sozinhas, e o ingest só cobre o que for ingerido daqui para frente.
 *
 * ── A metade que NÃO está aqui ────────────────────────────────────────────────
 * "Quantas empresas no Brasil dividem este mesmo telefone" é a informação que mais muda a
 * decisão, e ela não existe no nosso banco: medido nas 31 do piloto, 16 dividem o telefone com 5
 * ou mais empresas e uma delas com 454, e dentro das nossas 65 mil esse mesmo telefone PARECE
 * exclusivo. Base pequena faz contato ruim parecer bom.
 *
 * Isso mora em `scripts/backfill-contato-nacional.mjs`, separado de propósito: aquele custa cota
 * de BigQuery e este é de graça, então este pode rodar a cada ingest e aquele não. Os dois gravam
 * pela mesma função `aplica_contato`, que usa `coalesce`: rodar um não apaga o que o outro
 * escreveu.
 *
 * ── Um cuidado com o site ─────────────────────────────────────────────────────
 * Site derivado é palpite com boa base, não fato. A função só deriva de domínio próprio, nunca de
 * webmail, de contabilidade ou de domínio compartilhado: entregar o site do escritório contábil
 * parecendo o da empresa é pior que deixar vazio, porque está errado e é convincente.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { procedenciaEmail, telefoneSuspeito, siteDeEmail } from "../src/lib/contato.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const TUDO = process.argv.includes("--tudo");
const LOTE_UP = 500;   // linhas por chamada de aplica_contato

// ── 1. A lista de domínios compartilhados ──────────────────────────────────────
const arquivoLista = path.resolve(__dirname, "data", "intermediarios.json");
if (!fs.existsSync(arquivoLista)) {
  console.error(`Falta ${arquivoLista}. Rode antes: node --env-file=.env.local scripts/build-intermediarios.mjs`);
  process.exit(1);
}
const lista = JSON.parse(fs.readFileSync(arquivoLista, "utf-8"));
const COMPARTILHADOS = new Set(Object.keys(lista.dominios));
console.log(`Lista de intermediários: ${COMPARTILHADOS.size} domínios, gerada em ${lista.gerado_em}.`);

// ── 2. Quem precisa ────────────────────────────────────────────────────────────
const empresas = [];
for (let off = 0; ; off += 1000) {
  let q = supabase.from("empresa").select("cnpj, razao_social, nome_fantasia, email, telefone, site").order("id").range(off, off + 999);
  if (!TUDO) q = q.is("contato_aferido_em", null);
  const r = await q;
  if (r.error) { console.error("ERRO lendo empresa:", r.error.message); process.exit(1); }
  empresas.push(...r.data);
  process.stdout.write(`\r   lendo… ${empresas.length}`);
  if (r.data.length < 1000) break;
}
console.log(`\n   ${empresas.length} empresas para aferir.`);
if (empresas.length === 0) { console.log("Nada a fazer."); process.exit(0); }

// ── 3. Classificação local ─────────────────────────────────────────────────────
const linhas = empresas.map((e) => {
  const proc = procedenciaEmail(e.email, COMPARTILHADOS);
  return {
    cnpj: e.cnpj,
    procedencia: proc,
    site: siteDeEmail(e.email, proc, { razao_social: e.razao_social, nome_fantasia: e.nome_fantasia }),
    tel_suspeito: telefoneSuspeito(e.telefone).suspeito,
  };
});

const porProc = {};
for (const l of linhas) porProc[l.procedencia ?? "sem e-mail"] = (porProc[l.procedencia ?? "sem e-mail"] || 0) + 1;
console.log("\nProcedência do e-mail:");
for (const [k, n] of Object.entries(porProc).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(6)}  ${k}  ${(n / linhas.length * 100).toFixed(1)}%`);
}
console.log(`\nTelefone que não vale discar: ${linhas.filter((l) => l.tel_suspeito).length}`);
console.log(`Site derivado do domínio:     ${linhas.filter((l) => l.site).length}`);

// ── 4. Gravar ──────────────────────────────────────────────────────────────────
let gravadas = 0;
for (let i = 0; i < linhas.length; i += LOTE_UP) {
  const lote = linhas.slice(i, i + LOTE_UP).map((l) => ({
    cnpj: l.cnpj,
    procedencia: l.procedencia ?? "",
    site: l.site ?? "",
    tel_suspeito: l.tel_suspeito,
    // tel_br e email_br ficam de fora: quem grava os dois é o backfill nacional, e `aplica_contato`
    // usa `coalesce`, então ausência aqui preserva o que aquele escreveu.
  }));
  const { data, error } = await supabase.rpc("aplica_contato", { dados: lote });
  if (error) { console.error("\nERRO gravando:", error.message); process.exit(1); }
  gravadas += data ?? 0;
  process.stdout.write(`\r   gravando… ${gravadas}`);
}
console.log(`\n\n${gravadas} linhas atualizadas.`);
