/**
 * Move os memos de src/lib/dossier-cache.json para a tabela empresa_memo.
 *
 *   node --experimental-strip-types --env-file=.env.local scripts/importar-memos-arquivo.ts
 *
 * Uma vez só. O arquivo existia porque não havia onde persistir memo; agora há
 * (migration 0009). Enquanto os dois coexistem, /api/dossier lê o banco primeiro
 * e cai no arquivo — depois desta importação o arquivo vira redundante e pode
 * sair do bundle da função.
 *
 * Idempotente: `salvarMemo` faz upsert por empresa_id.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import path from "path";
import { salvarMemo, idsComMemo } from "../src/lib/memo-store.ts";
import type { DossierAnalise } from "../src/lib/types.ts";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const arquivo = JSON.parse(
  readFileSync(path.resolve("src/lib/dossier-cache.json"), "utf8")
) as Record<string, DossierAnalise>;

const ids = Object.keys(arquivo);
console.log(`${ids.length} memos no arquivo.`);

/* Só importa empresa que ainda existe na base: o dossier-cache tem entradas de
   ingests antigos, e empresa_memo tem FK para empresa — insert de id órfão falha. */
const existentes = new Set<string>();
for (let i = 0; i < ids.length; i += 200) {
  const { data } = await supabase.from("empresa").select("id").in("id", ids.slice(i, i + 200));
  for (const r of (data ?? []) as { id: string }[]) existentes.add(r.id);
}
const orfaos = ids.filter((id) => !existentes.has(id));
if (orfaos.length) console.log(`  ${orfaos.length} sem empresa correspondente na base — ignorados.`);

const jaTem = await idsComMemo(supabase, [...existentes]);
let novos = 0, pulados = 0, falhas = 0;
for (const id of ids) {
  if (!existentes.has(id)) continue;
  if (jaTem.has(id)) { pulados++; continue; }
  const ok = await salvarMemo(supabase, id, arquivo[id], "importado/dossier-cache.json");
  ok ? novos++ : falhas++;
}

const { count } = await supabase.from("empresa_memo").select("*", { count: "exact", head: true });
console.log(`\n✓ ${novos} importados · ${pulados} já existiam · ${falhas} falhas`);
console.log(`  empresas com memo no banco: ${count}`);
