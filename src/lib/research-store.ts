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
};

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
): Promise<Record<string, { score: number; investigado_em: string }>> {
  if (empresaIds.length === 0) return {};

  const { data, error } = await supabase
    .from("score_run")
    .select("empresa_id, score, created_at")
    .in("empresa_id", empresaIds)
    .order("created_at", { ascending: false });

  if (error || !data) return {};

  const out: Record<string, { score: number; investigado_em: string }> = {};
  for (const row of data as ScoreRunRow[]) {
    // Ordenado desc: a primeira ocorrência de cada empresa já é a mais recente.
    if (out[row.empresa_id]) continue;
    out[row.empresa_id] = { score: row.score, investigado_em: row.created_at };
  }
  return out;
}

type ComScore = { id: string; score?: { score: number } | null; score_v1?: ScoreV1 };

/** Aplica o v1 salvo sobre uma lista de empresas e reordena pelo score efetivo. */
export function aplicarV1<T extends ComScore>(
  empresas: T[],
  v1PorEmpresa: Record<string, { score: number; investigado_em: string }>
): T[] {
  for (const e of empresas) {
    const v1 = v1PorEmpresa[e.id];
    if (!v1) continue;
    e.score_v1 = {
      score: v1.score,
      delta: v1.score - (e.score?.score ?? v1.score), // v1 vs v0 recalculado agora
      investigado_em: v1.investigado_em,
    };
  }
  return [...empresas].sort((a, b) => scoreEfetivo(b) - scoreEfetivo(a));
}

/** Score que vale pra ranquear e exibir: o v1 investigado quando existe, senão o v0. */
export function scoreEfetivo(e: ComScore): number {
  return e.score_v1?.score ?? e.score?.score ?? 0;
}
