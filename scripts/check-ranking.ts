/**
 * Confere se a busca devolve o TOPO do setor ou uma amostra qualquer dele.
 *
 *   node --experimental-strip-types --env-file=.env.local scripts/check-ranking.ts
 *
 * Compara, por setor: as 50 empresas que a query da busca devolve (mesmos filtros,
 * mesma ordenação, mesmo limite) contra o top-50 real, obtido pontuando o setor
 * inteiro. "50/50" = a busca acerta o topo. Número baixo = está ranqueando uma
 * amostra arbitrária e apresentando como shortlist priorizada.
 *
 * Existe porque esse defeito é invisível na tela: o resultado vem ordenado, com
 * score plausível em cada linha, e parece uma resposta certa. Antes da migration
 * 0008 dava 0/50 em saúde. Rodar depois de todo ingest e de todo backfill.
 */
import { createClient } from "@supabase/supabase-js";
import { calcScore } from "../src/lib/scoring.ts";
import { SETORES } from "../src/lib/setores.ts";
import type { Empresa, Socio } from "../src/lib/types.ts";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const SELECT = "id, data_inicio_atividade, porte, score_v0, socio(faixa_etaria)";
type Linha = Pick<Empresa, "id" | "data_inicio_atividade" | "porte"> & {
  score_v0: number | null;
  socio: Pick<Socio, "faixa_etaria">[] | null;
};

const pontuar = (l: Linha) =>
  calcScore(
    { data_inicio_atividade: l.data_inicio_atividade, porte: l.porte } as Empresa,
    (l.socio ?? []) as Socio[]
  ).score;

const media = (ns: number[]) => (ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : 0);

let falhou = false;

for (const setor of SETORES) {
  const orClause = setor.cnaes.map((p) => `cnae_principal.like.${p}*`).join(",");

  // (a) O que a busca devolve — mesma ordenação e mesmo limite da rota.
  const { data: daBusca, error: e1 } = await supabase
    .from("empresa").select(SELECT).or(orClause)
    .order("score_v0", { ascending: false, nullsFirst: false })
    .limit(50);
  if (e1) { console.error(`${setor.id}: ${e1.message}`); falhou = true; continue; }

  // (b) O setor inteiro, pontuado na mão — a referência.
  const todas: Linha[] = [];
  for (let from = 0; ; from += 1000) {
    // `.order("id")`: sem ordenação explícita o `.range()` repete e pula linha
    // entre páginas, e a referência do teste sairia errada.
    const { data, error } = await supabase.from("empresa").select(SELECT).or(orClause).order("id").range(from, from + 999);
    if (error) { console.error(`${setor.id}: ${error.message}`); falhou = true; break; }
    if (!data?.length) break;
    todas.push(...(data as unknown as Linha[]));
    if (data.length < 1000) break;
  }
  if (!todas.length) { console.log(`${setor.nome}: sem empresas ingeridas`); continue; }

  const ordenadas = todas.map((l) => ({ id: l.id, s: pontuar(l) })).sort((a, b) => b.s - a.s);
  const top50 = ordenadas.slice(0, 50);
  const corte = top50[top50.length - 1].s;
  /* Empatar no score do corte é acerto: com muitas empresas em 100 pontos, QUAL
     das empatadas entra é arbitrário e não deveria contar como erro. O que o
     teste tem que pegar é a busca devolver linha ABAIXO do corte. */
  const acertos = (daBusca as unknown as Linha[]).filter((l) => pontuar(l) >= corte).length;

  const sBusca = (daBusca as unknown as Linha[]).map(pontuar);
  const ok = acertos === 50;
  if (!ok) falhou = true;
  console.log(
    `${ok ? "✓" : "✗"} ${setor.nome.padEnd(16)} ${String(todas.length).padStart(6)} empresas · ` +
    `busca média ${media(sBusca).toFixed(1)} · topo real média ${media(top50.map((t) => t.s)).toFixed(1)} · ` +
    `no topo ${acertos}/50 (corte ${corte})`
  );

  const semScore = todas.filter((l) => l.score_v0 == null).length;
  if (semScore) console.log(`   ⚠ ${semScore} sem score_v0 — rode scripts/backfill-score-v0.ts`);
}

process.exit(falhou ? 1 : 0);
