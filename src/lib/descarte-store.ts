import type { SupabaseClient } from "@supabase/supabase-js";

/* Descarte de empresa no Radar — leitura/escrita da tabela `empresa_descartada`.
   Mesmo formato do research-store: funções puras de acesso, usadas pela API e
   pela busca, pra a regra de "some da lista" viver num lugar só.

   Escopo global (o app não tem identidade de usuário — ver lib/gate.ts). */

/** Ids descartados dentro de um conjunto. Consulta indexada por id, não scan. */
export async function lerDescartadas(
  supabase: SupabaseClient,
  empresaIds: string[]
): Promise<Set<string>> {
  if (empresaIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from("empresa_descartada")
    .select("empresa_id")
    .in("empresa_id", empresaIds);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((d: { empresa_id: string }) => d.empresa_id));
}

/** Todas as descartadas, mais recentes primeiro — alimenta a visão "descartadas". */
export async function listarDescartadas(
  supabase: SupabaseClient
): Promise<{ empresa_id: string; motivo: string | null; created_at: string }[]> {
  const { data, error } = await supabase
    .from("empresa_descartada")
    .select("empresa_id, motivo, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Remove da lista as empresas descartadas. */
export function filtrarDescartadas<T extends { id: string }>(
  empresas: T[],
  descartadas: Set<string>
): T[] {
  if (descartadas.size === 0) return empresas;
  return empresas.filter((e) => !descartadas.has(e.id));
}
