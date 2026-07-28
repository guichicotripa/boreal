import type { SupabaseClient } from "@supabase/supabase-js";
import type { DossierAnalise } from "./types";

/* Leitura e escrita do memo persistido (tabela empresa_memo, migration 0009).
   Espelha o research-store: mesma ideia, artefato diferente.

   Antes desta camada o memo era gerado pelo LLM e DESCARTADO — abrir a mesma
   empresa duas vezes pagava duas vezes, e o que era produzido no uso real não
   ficava. Só as 51 empresas de src/lib/dossier-cache.json eram instantâneas, e
   esse arquivo vai dentro do bundle da função, então crescer custava deploy.

   Degradação: se a migration 0009 não estiver aplicada, as duas funções falham
   em silêncio (null / false) e o fluxo volta a gerar ao vivo, que é o
   comportamento anterior. Nunca derrubam a rota. */

/** Memo já salvo desta empresa, ou null se ainda não existe. */
export async function lerMemoSalvo(
  supabase: SupabaseClient,
  empresaId: string
): Promise<{ analise: DossierAnalise; geradoEm: string; comV1: boolean } | null> {
  const { data, error } = await supabase
    .from("empresa_memo")
    .select("analise, updated_at, com_v1")
    .eq("empresa_id", empresaId)
    .limit(1);

  // error inclui "relação empresa_memo não existe" (migration não aplicada).
  if (error || !data?.length) return null;
  const row = data[0] as { analise: DossierAnalise | null; updated_at: string; com_v1: boolean | null };
  if (!row.analise) return null;
  return { analise: row.analise, geradoEm: row.updated_at, comV1: !!row.com_v1 };
}

/**
 * Grava (ou atualiza) o memo da empresa. Idempotente por empresa_id — o lote pode
 * ser re-executado sem duplicar.
 *
 * Devolve boolean em vez de lançar: falhar em GRAVAR não pode impedir a resposta
 * ao usuário, que já tem o memo em mãos. O pior caso é gerar de novo depois.
 */
export async function salvarMemo(
  supabase: SupabaseClient,
  empresaId: string,
  analise: DossierAnalise,
  modelo?: string,
  comV1 = false
): Promise<boolean> {
  const { error } = await supabase.from("empresa_memo").upsert(
    {
      empresa_id: empresaId,
      analise,
      modelo: modelo ?? null,
      // Registra se a investigação da web entrou na geração. Memo escrito sem v1
      // é bom, mas cego para assessor contratado, intenção de venda e sucessor
      // ativo — e precisa ser refeito quando o v1 daquela empresa chegar.
      com_v1: comV1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "empresa_id" }
  );
  if (error) {
    console.warn("memo não persistido (migration 0009 aplicada?):", error.message);
    return false;
  }
  return true;
}

/** Quais destes ids JÁ têm memo — para o lote pular sem uma query por empresa. */
export async function idsComMemo(
  supabase: SupabaseClient,
  empresaIds: string[]
): Promise<Set<string>> {
  if (!empresaIds.length) return new Set();
  const { data, error } = await supabase
    .from("empresa_memo")
    .select("empresa_id")
    .in("empresa_id", empresaIds);
  if (error || !data) return new Set();
  return new Set((data as { empresa_id: string }[]).map((r) => r.empresa_id));
}
