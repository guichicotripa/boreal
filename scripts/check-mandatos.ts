/**
 * Os filtros de mandato selecionam exatamente as empresas ingeridas?
 *
 *   node --experimental-strip-types --env-file=.env.local scripts/check-mandatos.ts
 *
 * O `filtroOr` monta `and(cnae, or(nomes))` aninhado dentro de um `.or()` do PostgREST, sintaxe
 * que ou funciona ou falha em silencio devolvendo o CNAE inteiro. Um mandato que devolve demais
 * nao quebra a tela: entrega uma lista errada com cara de certa, que e o pior modo de falhar num
 * produto de originacao. Este script compara o retorno com a contagem da ingestao.
 *
 * Rodar depois de mexer em src/lib/mandatos.ts ou de reingerir qualquer recorte.
 */
import { createClient } from "@supabase/supabase-js";
import { MANDATOS, filtroOr } from "../src/lib/mandatos.ts";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
for (const m of MANDATOS) {
  const f = filtroOr(m);
  const { count, error } = await sb.from("empresa").select("id", { count: "exact", head: true }).or(f);
  console.log(`${m.nome.padEnd(26)} esperado ${String(m.empresas).padStart(6)} · retornou ${error ? "ERRO: " + error.message : String(count).padStart(6)}`);
  if (error) console.log("   filtro:", f);
}
// Sobreposição: foco A e foco B devem ser conjuntos quase disjuntos.
const [a, b] = [MANDATOS[0], MANDATOS[1]];
const ids = async (m: typeof a) => new Set(((await sb.from("empresa").select("id").or(filtroOr(m)).limit(5000)).data ?? []).map((r: {id: string}) => r.id));
const [sa, sbb] = [await ids(a), await ids(b)];
let inter = 0; for (const x of sa) if (sbb.has(x)) inter++;
console.log(`\nfoco A ${sa.size} · foco B ${sbb.size} · sobreposicao ${inter}`);
