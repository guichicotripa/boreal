// Ponte de navegação home/pipeline → /empresa/[id] (Fase 2).
//
// A home e o pipeline já têm o objeto Empresa completo em memória quando o usuário
// clica num card. Em vez de re-buscar no servidor (não existe GET /api/empresa/[id]
// ainda — handoff do Guilherme), guardamos o objeto em sessionStorage e a página da
// empresa lê de lá. Quando o endpoint existir, troca-se `readEmpresa` por um fetch
// sem mexer na página. Esta é a ÚNICA camada que conhece o mecanismo — por isso é
// trivial de substituir.

import type { Empresa } from "./types";

const EMPRESA_PREFIX = "boreal:empresa:";
const ORIGIN_KEY = "boreal:empresa-origin";

export type Origin = "busca" | "pipeline";

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

/** Guarda a empresa (clique no card) para a página de destino ler. */
export function storeEmpresa(e: Empresa): void {
  if (!hasWindow()) return;
  try {
    sessionStorage.setItem(EMPRESA_PREFIX + e.id, JSON.stringify(e));
  } catch {
    // sessionStorage cheio/indisponível — a página cai no fallback "não encontrada".
  }
}

/** Lê a empresa guardada. null quando o usuário chegou por link direto / refresh. */
export function readEmpresa(id: string): Empresa | null {
  if (!hasWindow()) return null;
  try {
    const raw = sessionStorage.getItem(EMPRESA_PREFIX + id);
    return raw ? (JSON.parse(raw) as Empresa) : null;
  } catch {
    return null;
  }
}

/** Registra de onde o usuário veio, para o link "voltar" apontar certo. */
export function storeOrigin(origin: Origin): void {
  if (!hasWindow()) return;
  try {
    sessionStorage.setItem(ORIGIN_KEY, origin);
  } catch {
    // ignore
  }
}

export function readOrigin(): Origin {
  if (!hasWindow()) return "busca";
  try {
    return sessionStorage.getItem(ORIGIN_KEY) === "pipeline" ? "pipeline" : "busca";
  } catch {
    return "busca";
  }
}
