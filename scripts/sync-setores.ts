/**
 * Empurra o registry de setores (src/lib/setores.json) pra tabela `setor` do banco.
 *
 *   node --experimental-strip-types --env-file=.env.local scripts/sync-setores.ts
 *   node --experimental-strip-types --env-file=.env.local scripts/sync-setores.ts --dry
 *
 * POR QUE EXISTE: as policies da migration 0012 precisam saber que "metalmec" é
 * CNAE 24/25/28, e o Postgres não lê o JSON do bundle. A tabela é ESPELHO, nunca
 * fonte: quem manda é o registry no código. Rodar isto depois de mexer em
 * setores.json faz parte de ingerir setor novo, junto com o ingest dos dados.
 *
 * `setores-sync.test.ts` falha se o espelho divergir do registry — copiar sem
 * guarda é como o id de modelo ficou preso na geração 4 em seis arquivos.
 */
import { createClient } from "@supabase/supabase-js";
import { SETORES } from "../src/lib/setores.ts";

const dry = process.argv.includes("--dry");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const linhas = SETORES.map((s) => ({ id: s.id, nome: s.nome, prefixos: s.cnaes }));

console.log(`registry tem ${linhas.length} setor(es):`);
for (const l of linhas) console.log(`  ${l.id.padEnd(12)} ${l.prefixos.join("/").padEnd(12)} ${l.nome}`);

if (dry) { console.log("\n[dry] nada gravado."); process.exit(0); }

const { error } = await supabase.from("setor").upsert(linhas, { onConflict: "id" });
if (error) { console.error("FAIL upsert:", error.message); process.exit(1); }

/* Setor removido do registry vira lixo no banco, e lixo aqui é permissão que
   continua valendo depois de o setor deixar de existir. Só apaga o que não está
   em uso: `org_setor` referencia com on delete restrict, então uma firma que
   contratou o setor bloqueia a remoção em vez de perder a permissão em silêncio. */
const ids = linhas.map((l) => l.id);
const { data: sobrando } = await supabase.from("setor").select("id").not("id", "in", `(${ids.join(",")})`);
for (const s of (sobrando ?? []) as { id: string }[]) {
  const { error: errDel } = await supabase.from("setor").delete().eq("id", s.id);
  console.log(errDel ? `  ⚠ "${s.id}" saiu do registry mas alguma firma ainda o contrata — mantido` : `  removido: ${s.id}`);
}

console.log(`\n✓ espelho sincronizado (${linhas.length} setores).`);
