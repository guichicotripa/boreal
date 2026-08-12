/**
 * Grava o contrato da Setter: os TRÊS mandatos do piloto, e nada dos quatro setores validados.
 *
 *   node --experimental-strip-types --env-file=.env.local scripts/contrato-setter.ts --dry
 *   node --experimental-strip-types --env-file=.env.local scripts/contrato-setter.ts
 *
 * POR QUE ISTO É UM SCRIPT E NÃO ESTÁ NA MIGRATION: `org_mandato` tem FK contra o espelho
 * `mandato`, que só é preenchido por `sync-mandatos.ts`. Semear dentro da migration daria violação
 * de chave estrangeira. E contrato é ato comercial: merece um passo explícito, com --dry, e não uma
 * linha escondida no meio de um arquivo de schema.
 *
 * O QUE MUDA NA PRÁTICA. Hoje `org_setor` e `org_mandato` estão vazias pra Setter, e vazio
 * significa "sem restrição": um originador logado lê as 1,4 milhão de empresas dos quatro setores
 * validados, tendo pago R$2.000 por três mandatos. Depois disto ele lê os CNAEs dos mandatos.
 *
 * NÃO afeta o Guilherme: `papel = 'boreal'` (staff) ignora as dimensões do contrato, por
 * `eh_staff()` na migration 0013.
 *
 * REVERTER: apagar as linhas de `org_mandato` da org devolve o estado anterior (vazio = sem
 * restrição). Nada é destrutivo aqui.
 */
import { createClient } from "@supabase/supabase-js";
import { MANDATOS } from "../src/lib/mandatos.ts";

const SETTER = "00000000-0000-0000-0000-000000000000";
const dry = process.argv.includes("--dry");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const { data: org } = await supabase.from("org").select("nome, slug").eq("id", SETTER).single();
if (!org) { console.error(`org ${SETTER} não existe.`); process.exit(1); }

/* Só contrata mandato que já está no espelho. Sem esta checagem o erro que aparece é uma violação
   de FK crua, e o motivo real (esqueceu de rodar o sync) fica escondido. */
const { data: espelho } = await supabase.from("mandato").select("id");
const noEspelho = new Set((espelho ?? []).map((r) => r.id as string));
const faltando = MANDATOS.filter((m) => !noEspelho.has(m.id)).map((m) => m.id);
if (faltando.length) {
  console.error(`espelho incompleto, falta: ${faltando.join(", ")}`);
  console.error("rode antes: node --experimental-strip-types --env-file=.env.local scripts/sync-mandatos.ts");
  process.exit(1);
}

const linhas = MANDATOS.map((m) => ({ org_id: SETTER, mandato_id: m.id }));

const { data: setoresHoje } = await supabase.from("org_setor").select("setor_id").eq("org_id", SETTER);
const { data: mandatosHoje } = await supabase.from("org_mandato").select("mandato_id").eq("org_id", SETTER);

console.log(`org: ${org.nome} (${org.slug})`);
console.log(`  antes  · setores ${JSON.stringify((setoresHoje ?? []).map((r) => r.setor_id))} · mandatos ${JSON.stringify((mandatosHoje ?? []).map((r) => r.mandato_id))}`);
console.log(`  depois · setores [] · mandatos ${JSON.stringify(MANDATOS.map((m) => m.id))}`);

if (dry) { console.log("\n[dry] nada gravado."); process.exit(0); }

const { error } = await supabase.from("org_mandato").upsert(linhas, { onConflict: "org_id,mandato_id" });
if (error) { console.error("FAIL upsert:", error.message); process.exit(1); }

console.log(`\n✓ contrato gravado: ${linhas.length} mandatos, nenhum setor do registry.`);
console.log("  a Setter deixa de enxergar saúde, agro, metalmecânica e educação.");
