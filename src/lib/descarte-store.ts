import type { SupabaseClient } from "@supabase/supabase-js";

/* Descarte de empresa no Radar — leitura/escrita da tabela `empresa_descartada`.
   Mesmo formato do research-store: funções puras de acesso, usadas pela API e
   pela busca, pra a regra de "some da lista" viver num lugar só.

   Toda função exige `escopoId` (ver lib/escopo.ts). É obrigatório de propósito:
   um parâmetro opcional viraria call-site sem escopo, que é exatamente a dívida
   que a coluna existe pra evitar. Hoje o valor é sempre o mesmo — o parâmetro
   documenta a intenção, não produz isolamento. */

/** Ids descartados dentro de um conjunto, no escopo dado. Indexado pela PK. */
export async function lerDescartadas(
  supabase: SupabaseClient,
  escopoId: string,
  empresaIds: string[]
): Promise<Set<string>> {
  if (empresaIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from("empresa_descartada")
    .select("empresa_id")
    .eq("escopo_id", escopoId)
    .in("empresa_id", empresaIds);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((d: { empresa_id: string }) => d.empresa_id));
}

/** Todas as descartadas do escopo, mais recentes primeiro. */
export async function listarDescartadas(
  supabase: SupabaseClient,
  escopoId: string
): Promise<{ empresa_id: string; motivo: string | null; created_at: string }[]> {
  const { data, error } = await supabase
    .from("empresa_descartada")
    .select("empresa_id, motivo, created_at")
    .eq("escopo_id", escopoId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Descarta (idempotente: descartar de novo só atualiza o motivo). */
export async function descartar(
  supabase: SupabaseClient,
  escopoId: string,
  empresaId: string,
  motivo: string | null
): Promise<void> {
  const { error } = await supabase
    .from("empresa_descartada")
    .upsert(
      { escopo_id: escopoId, empresa_id: empresaId, motivo },
      { onConflict: "escopo_id,empresa_id" }
    );
  if (error) throw new Error(error.message);
}

/** Restaura (o "desfazer" da UI). */
export async function restaurar(
  supabase: SupabaseClient,
  escopoId: string,
  empresaId: string
): Promise<void> {
  const { error } = await supabase
    .from("empresa_descartada")
    .delete()
    .eq("escopo_id", escopoId)
    .eq("empresa_id", empresaId);
  if (error) throw new Error(error.message);
}

/** Remove da lista as empresas descartadas. */
export function filtrarDescartadas<T extends { id: string }>(
  empresas: T[],
  descartadas: Set<string>
): T[] {
  if (descartadas.size === 0) return empresas;
  return empresas.filter((e) => !descartadas.has(e.id));
}
