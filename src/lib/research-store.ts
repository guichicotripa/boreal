import { ajusteDeSinais } from "./research.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ResearchResult, ScoreV1 } from "./types";

/* Leitura do v1 persistido (tabela score_run).
   O score_run é append-only: uma linha por investigação, histórico versionado.
   "O v1 de uma empresa" = a linha MAIS RECENTE dela. Estas funções centralizam essa
   regra pra busca, página da empresa e research não divergirem.

   Duas leituras com dependências diferentes, de propósito:
   - `lerScoresV1` usa só colunas que existem desde a migration 0001 → o reposicionamento
     da lista funciona RETROATIVAMENTE, com tudo que já foi investigado até hoje.
   - `lerResearchSalvo` depende da coluna `research` (migration 0006) → é o cache que
     evita re-rodar o agente. Antes da migration ele degrada: devolve null e reinvestiga. */

type ScoreRunRow = {
  empresa_id: string;
  score: number;
  created_at: string;
  sinais: { tipo: string }[] | null;
};

/** O que a busca precisa saber de uma investigação para ranquear e exibir. */
export type V1Lido = { score: number; investigado_em: string; ajuste_bruto: number };

/**
 * Persiste uma investigação no score_run. Um caminho só para a rota (sob demanda,
 * API) e o lote (assinatura) — a escrita tem duas sutilezas que não podem divergir
 * entre eles:
 *
 * 1. O payload `research` depende da migration 0006. Se a coluna não existir, o
 *    insert INTEIRO falha e nem o número do v1 fica salvo — pior que antes. Então
 *    tenta completo e, se a coluna faltar, regrava só o essencial.
 * 2. `persistido` e `payloadSalvo` são coisas diferentes: sem persistido a lista
 *    não reordena; sem payloadSalvo o agente precisa rodar de novo na próxima
 *    abertura (o número sobreviveu, a investigação não).
 */
export async function salvarResearch(
  supabase: SupabaseClient,
  empresaId: string,
  research: ResearchResult,
  breakdown: unknown,
  modelo: string
): Promise<{ persistido: boolean; payloadSalvo: boolean }> {
  const base = {
    empresa_id: empresaId,
    score: research.score_v1,
    breakdown: breakdown ?? null,
    sinais: research.sinais,
    model: modelo,
  };

  let { error } = await supabase.from("score_run").insert({ ...base, research });
  let payloadSalvo = !error;
  if (error) {
    console.warn("insert com `research` falhou (migration 0006 aplicada?):", error.message);
    ({ error } = await supabase.from("score_run").insert(base));
    payloadSalvo = false;
  }
  if (error) console.error("score_run insert falhou (investigação não persistida):", error.message);

  return { persistido: !error, payloadSalvo };
}

/** Investigação completa já salva desta empresa, ou null se nunca foi investigada. */
export async function lerResearchSalvo(
  supabase: SupabaseClient,
  empresaId: string
): Promise<{ research: ResearchResult; investigadoEm: string } | null> {
  const { data, error } = await supabase
    .from("score_run")
    .select("research, created_at")
    .eq("empresa_id", empresaId)
    .not("research", "is", null) // pula runs antigos, que só guardaram o número
    .order("created_at", { ascending: false })
    .limit(1);

  // error aqui inclui "coluna research não existe" (migration 0006 não aplicada):
  // devolver null faz o fluxo reinvestigar, que é o comportamento anterior.
  if (error || !data?.length) return null;

  const row = data[0] as { research: ResearchResult | null; created_at: string };
  if (!row.research) return null;

  return { research: row.research, investigadoEm: row.created_at };
}

/**
 * Mapa { empresaId → score/quando } do v1 mais recente de cada empresa da lista.
 * Uma query só (índice empresa_id, created_at desc); dedupe do lado do servidor.
 * O `delta` NÃO vem do banco: é derivado contra o v0 no momento da leitura — o v0 é
 * determinístico e pode ter mudado (heurística nova, sócio envelheceu), então recalcular
 * é mais correto do que confiar num delta congelado no dia da investigação.
 */
export async function lerScoresV1(
  supabase: SupabaseClient,
  empresaIds: string[]
): Promise<Record<string, V1Lido>> {
  if (empresaIds.length === 0) return {};

  const { data, error } = await supabase
    .from("score_run")
    .select("empresa_id, score, created_at, sinais")
    .in("empresa_id", empresaIds)
    .order("created_at", { ascending: false });

  if (error || !data) return {};

  const out: Record<string, V1Lido> = {};
  for (const row of data as ScoreRunRow[]) {
    // Ordenado desc: a primeira ocorrência de cada empresa já é a mais recente.
    if (out[row.empresa_id]) continue;
    out[row.empresa_id] = {
      score: row.score,
      investigado_em: row.created_at,
      /* O ajuste é RECALCULADO da lista de sinais, não lido de um campo gravado.
         Dois motivos: mudar um peso reordena a lista sozinho, sem backfill; e o
         valor sobrevive ao teto de 100, que é justamente o problema que ele
         resolve (ver desempate em aplicarV1). */
      ajuste_bruto: ajusteDeSinais(row.sinais ?? []),
    };
  }
  return out;
}

/**
 * Ids de todas as empresas que já têm investigação salva. É o "já feito" dos dois
 * lotes: o de research pula quem está aqui, o de memo prioriza quem está aqui.
 * Pagina com `.order` explícito — sem ordenação estável o `.range()` repete linha
 * numa página e pula em outra (foi assim que o backfill de score_v0 deixou 18.386
 * empresas de fora).
 */
export async function idsComResearch(supabase: SupabaseClient): Promise<Set<string>> {
  const ids = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("score_run")
      .select("empresa_id")
      .not("research", "is", null)
      .order("empresa_id")
      .range(from, from + 999);
    if (error || !data?.length) break;
    for (const r of data as { empresa_id: string }[]) ids.add(r.empresa_id);
    if (data.length < 1000) break;
  }
  return ids;
}

type ComScore = { id: string; score?: { score: number } | null; score_v1?: ScoreV1 };

/** Aplica o v1 salvo sobre uma lista de empresas e reordena pelo score efetivo. */
export function aplicarV1<T extends ComScore>(
  empresas: T[],
  v1PorEmpresa: Record<string, V1Lido>
): T[] {
  for (const e of empresas) {
    const v1 = v1PorEmpresa[e.id];
    if (!v1) continue;
    e.score_v1 = {
      score: v1.score,
      delta: v1.score - (e.score?.score ?? v1.score), // v1 vs v0 recalculado agora
      investigado_em: v1.investigado_em,
      ajuste_bruto: v1.ajuste_bruto,
    };
  }
  /* Desempate pelo ajuste BRUTO, e não é detalhe: o score para em 100, a evidência
     não. Medido em 30/07/2026 num lote de metalmecânica, ajustes de +12, +12, +18,
     +24, +30 e +30 viraram todos o mesmo +3 depois do teto. A CSN tinha quatro
     menções públicas a venda, mais sucessor familiar, mais C-suite externo, e ficava
     indistinguível de quem tinha um único sinal. Quem tem mais evidência de transição
     sobe, mesmo que a tela mostre 100 nos dois. */
  return [...empresas].sort((a, b) => {
    const d = scoreEfetivo(b) - scoreEfetivo(a);
    return d !== 0 ? d : (b.score_v1?.ajuste_bruto ?? 0) - (a.score_v1?.ajuste_bruto ?? 0);
  });
}

/** Score que vale pra ranquear e exibir: o v1 investigado quando existe, senão o v0. */
export function scoreEfetivo(e: ComScore): number {
  return e.score_v1?.score ?? e.score?.score ?? 0;
}
