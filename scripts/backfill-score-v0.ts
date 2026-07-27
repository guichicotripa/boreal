/**
 * Materializa `empresa.score_v0` para a busca poder ORDENAR no banco antes do LIMIT.
 * Ver supabase/migrations/0008_score_v0.sql para o defeito que isto conserta.
 *
 *   node --experimental-strip-types --env-file=.env.local scripts/backfill-score-v0.ts
 *   node --experimental-strip-types --env-file=.env.local scripts/backfill-score-v0.ts --so-nulos
 *
 * RODAR DEPOIS DE TODO INGEST. Empresa nova entra com score_v0 NULL e, com
 * `nulls last`, some do topo da busca até ser calculada.
 *
 * É .ts de propósito: importa a MESMA calcScore que a aplicação usa. Os scripts
 * .mjs que replicam a fórmula (check-score-dist) já divergiram dos pesos reais —
 * uma segunda cópia da regra de score é como o número da tela e o do banco
 * deixam de ser o mesmo número.
 */
import { createClient } from "@supabase/supabase-js";
import { calcScore } from "../src/lib/scoring.ts";
import type { Empresa, Socio } from "../src/lib/types.ts";

const soNulos = process.argv.includes("--so-nulos");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const PAGINA = 1000;
const LOTE_UPDATE = 200; // ids vão na querystring do PATCH; 200 uuids ≈ 7,6 KB

type Linha = Pick<Empresa, "id" | "data_inicio_atividade" | "porte"> & {
  socio: Pick<Socio, "faixa_etaria">[] | null;
  score_v0?: number | null;
};

console.log(`Backfill de score_v0${soNulos ? " (só linhas sem score)" : " (todas as linhas)"}…`);

const linhas: Linha[] = [];
for (let from = 0; ; from += PAGINA) {
  /* `.order("id")` não é enfeite: sem ordenação explícita o Postgres não garante
     ordem estável entre páginas, então `.range()` repete linha numa página e pula
     linha em outra. Foi exatamente o que aconteceu na 1ª execução deste script —
     leu "51.033" com repetição e deixou 18.386 empresas sem score. */
  let q = supabase
    .from("empresa")
    .select("id, data_inicio_atividade, porte, score_v0, socio(faixa_etaria)")
    .order("id")
    .range(from, from + PAGINA - 1);
  if (soNulos) q = q.is("score_v0", null);

  const { data, error } = await q;
  if (error) { console.error("FAIL leitura:", error.message); process.exit(1); }
  if (!data?.length) break;
  linhas.push(...(data as unknown as Linha[]));
  process.stdout.write(`\r  lidas ${linhas.length}`);
  if (data.length < PAGINA) break;
}
console.log(`\n  ${linhas.length} empresas a pontuar`);

/* calcScore espera Empresa completa, mas só toca data_inicio_atividade, porte e
   os sócios. O cast evita carregar colunas que não entram na conta (razão social,
   cnaes secundários, raw) — em 51 mil linhas isso é a diferença entre segundos e
   dezenas de MB trafegados. */
const atualizacoes = linhas.map((l) => ({
  id: l.id,
  score_v0: calcScore(
    { data_inicio_atividade: l.data_inicio_atividade, porte: l.porte } as Empresa,
    (l.socio ?? []) as Socio[]
  ).score,
}));

const mudaram = atualizacoes.filter((a, i) => linhas[i].score_v0 !== a.score_v0);
console.log(`  ${mudaram.length} com score diferente do gravado`);

const dist: Record<string, number> = {};
for (const a of atualizacoes) {
  const faixa = a.score_v0 >= 90 ? "90+" : a.score_v0 >= 70 ? "70-89" : a.score_v0 >= 50 ? "50-69" : "<50";
  dist[faixa] = (dist[faixa] ?? 0) + 1;
}
console.log("  distribuição:", dist);

if (!mudaram.length) { console.log("\n✓ nada a atualizar."); process.exit(0); }

/* Grava com UPDATE agrupado por valor de score, não com upsert.
   Upsert não serve aqui: `cnpj` e `razao_social` são NOT NULL, e o INSERT que o
   ON CONFLICT propõe é validado contra elas — mandar só {id, score_v0} estoura a
   constraint antes de chegar no UPDATE. Incluir as duas no payload resolveria,
   mas reescreveria colunas que não têm nada a ver com esta operação.
   Como o score é inteiro de 0 a 100, existem no máximo 101 valores distintos:
   agrupar por valor transforma N updates de uma linha em ~101 updates em massa. */
const porScore = new Map<number, string[]>();
for (const a of mudaram) {
  const arr = porScore.get(a.score_v0) ?? [];
  arr.push(a.id);
  porScore.set(a.score_v0, arr);
}

let n = 0;
for (const [valor, ids] of porScore) {
  // Os ids viajam na URL do PATCH; lotes grandes estouram o limite de tamanho.
  for (let i = 0; i < ids.length; i += LOTE_UPDATE) {
    const lote = ids.slice(i, i + LOTE_UPDATE);
    const { error } = await supabase.from("empresa").update({ score_v0: valor }).in("id", lote);
    if (error) { console.error("\nFAIL update:", error.message); process.exit(2); }
    n += lote.length;
    process.stdout.write(`\r  gravadas ${n}/${mudaram.length}`);
  }
}

const { count: semScore } = await supabase
  .from("empresa").select("*", { count: "exact", head: true }).is("score_v0", null);
console.log(`\n\n✓ ${n} empresas atualizadas. Ainda sem score_v0: ${semScore}`);
