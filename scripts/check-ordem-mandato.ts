/**
 * A lista que o cliente vê é mesmo o topo do mandato, ou são 50 empresas quaisquer?
 *
 *   node --experimental-strip-types --env-file=.env.local scripts/check-ordem-mandato.ts
 *
 * A busca ordena por `empresa.score_v0` (coluna materializada) ANTES do LIMIT, e a tela mostra o
 * score recalculado em runtime. Se a coluna estiver NULA, `nulls last` empata TODAS as linhas e a
 * ordem vira o desempate `id`, que é UUID: a "shortlist priorizada" passa a ser uma amostra
 * aleatória, reordenada entre si. É o defeito de 25/07/2026 (ver o comentário em search/route.ts),
 * e ele volta em todo universo ingerido sem rodar o backfill.
 *
 * Compara, por mandato: as 50 que a API devolve hoje contra as 50 melhores de verdade.
 */
import { createClient } from "@supabase/supabase-js";
import { MANDATOS, filtroOr } from "../src/lib/mandatos.ts";
import { calcScore } from "../src/lib/scoring.ts";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const SEL = "id,razao_social,cnae_principal,capital_social,data_inicio_atividade,score_v0,socio(faixa_etaria,data_entrada_sociedade)";
const s = (e: any) => calcScore(e, e.socio ?? []).score;

for (const m of MANDATOS) {
  // (a) exatamente o que a rota faz
  const { data: api } = await sb.from("empresa").select(SEL).or(filtroOr(m))
    .order("score_v0", { ascending: false, nullsFirst: false }).order("id").range(0, 49);

  // (b) o universo inteiro, pontuado localmente
  const todas: any[] = [];
  /* `.order("id")` no laco de paginacao NAO e enfeite: sem ordenacao explicita o Postgres nao
     garante ordem estavel entre paginas, e `.range()` passa a repetir linha numa pagina e pular
     linha em outra. Medido em 12/08/2026: a coleta "completa" trazia 1.671 linhas do mandato e
     perdia 31 das 32 empresas com score >= 70. Este script existe pra auditar a lista do cliente;
     auditor com amostragem quebrada produz numero errado com cara de medicao. */
  for (let f = 0; ; f += 1000) {
    const { data } = await sb.from("empresa").select(SEL).or(filtroOr(m)).order("id").range(f, f + 999);
    todas.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const topo = [...todas].sort((a, b) => s(b) - s(a)).slice(0, 50);

  const media = (xs: any[]) => (xs.reduce((t, e) => t + s(e), 0) / xs.length).toFixed(1);
  const zeros = (api ?? []).filter((e: any) => s(e) === 0).length;
  const corte = s(topo[49]);          // score da 50ª melhor
  const pior = Math.min(...(api ?? []).map(s));
  const empatados = todas.filter((e) => s(e) >= corte).length;

  /* NÃO comparar por sobreposição de ids. O score satura no topo (aqui, mais de 50 empresas
     empatadas no corte), então existem vários "top 50" igualmente corretos e a interseção mede o
     critério de desempate, não a qualidade da lista. Em 12/08 essa métrica ruim marcou 23/50 numa
     página que estava perfeita. O certo é: toda linha da página tem score >= o corte real? */
  const ok = pior >= corte;
  console.log(`\n${m.nome}  (${todas.length.toLocaleString("pt-BR")} empresas)`);
  console.log(`  API hoje ....... score médio ${media(api ?? [])} · ${zeros} com score 0 · pior da página ${pior}`);
  console.log(`  topo real ...... score médio ${media(topo)} · melhor ${s(topo[0])} · corte (50ª) ${corte}`);
  console.log(`  ${ok ? "OK" : "FALHA"} ......... ${empatados} empresas empatadas no corte ou acima; pior da página ${pior} ${ok ? ">=" : "<"} corte ${corte}`);
}
