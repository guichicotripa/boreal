/**
 * Empurra os mandatos (src/lib/mandatos.ts) pra tabela-espelho `mandato` do banco.
 *
 *   node --experimental-strip-types --env-file=.env.local scripts/sync-mandatos.ts
 *   node --experimental-strip-types --env-file=.env.local scripts/sync-mandatos.ts --dry
 *
 * POR QUE EXISTE: irmão de `sync-setores.ts`. As policies da migration 0014 precisam saber que
 * "death-care" é CNAE 9603/65111, e o Postgres não lê o bundle. A tabela é ESPELHO, nunca fonte.
 *
 * O QUE NÃO VAI JUNTO: o filtro de NOME do mandato. A policy é regex de prefixo de CNAE e nome não
 * cabe ali. Consequência declarada em `prefixosDe()` — o contrato protege no nível do CNAE, a tela
 * recorta no nível do mandato.
 *
 * `mandatos-sync.test.ts` falha se o espelho divergir do código.
 */
import { createClient } from "@supabase/supabase-js";
import { MANDATOS, prefixosDe } from "../src/lib/mandatos.ts";

const dry = process.argv.includes("--dry");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const linhas = MANDATOS.map((m) => ({ id: m.id, nome: m.nome, prefixos: prefixosDe(m) }));

console.log(`código tem ${linhas.length} mandato(s):`);
for (const l of linhas) console.log(`  ${l.id.padEnd(18)} ${l.prefixos.join("/").padEnd(16)} ${l.nome}`);

if (dry) { console.log("\n[dry] nada gravado."); process.exit(0); }

const { error } = await supabase.from("mandato").upsert(linhas, { onConflict: "id" });
if (error) { console.error("FAIL upsert:", error.message); process.exit(1); }

/* Mandato removido do código vira lixo no banco, e lixo aqui é permissão que continua valendo
   depois de o mandato deixar de existir. `org_mandato` referencia com on delete restrict, então
   uma firma que o contrata bloqueia a remoção em vez de perder a permissão em silêncio. */
const ids = linhas.map((l) => l.id);
const { data: sobrando } = await supabase.from("mandato").select("id").not("id", "in", `(${ids.join(",")})`);
for (const s of (sobrando ?? []) as { id: string }[]) {
  const { error: errDel } = await supabase.from("mandato").delete().eq("id", s.id);
  console.log(errDel ? `  ⚠ "${s.id}" saiu do código mas alguma firma ainda o contrata — mantido` : `  removido: ${s.id}`);
}

console.log(`\n✓ espelho sincronizado (${linhas.length} mandatos).`);
