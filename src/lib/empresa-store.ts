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
const SCORE_PREFIX = "boreal:score:";
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

// ── Overlay de score conhecido ───────────────────────────────────────────────
// A investigação (score_v1) acontece na página da empresa, mas a home lista o
// score_v0 da busca. Persistimos o melhor score conhecido por empresa (com o delta
// vs v0) para que a home (e qualquer tela) reflita a investigação ao voltar e sinalize
// que a empresa já foi investigada. Ponte client-side até existir um GET
// /api/empresa/[id] que sirva o score canônico (handoff Guilherme).

export type ScoreConhecido = { score: number; delta: number };

/** Guarda o score_v1 pós-investigação + o delta vs score_v0. */
export function storeScoreConhecido(empresaId: string, score: number, delta: number): void {
  if (!hasWindow()) return;
  try {
    sessionStorage.setItem(SCORE_PREFIX + empresaId, JSON.stringify({ score, delta }));
  } catch {
    // ignore
  }
}

/** Mapa { empresaId → {score, delta} } de tudo que já foi investigado nesta sessão. */
export function readScoresConhecidos(): Record<string, ScoreConhecido> {
  if (!hasWindow()) return {};
  const out: Record<string, ScoreConhecido> = {};
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(SCORE_PREFIX)) {
        try {
          const parsed = JSON.parse(sessionStorage.getItem(k) ?? "");
          if (parsed && typeof parsed.score === "number" && typeof parsed.delta === "number") {
            out[k.slice(SCORE_PREFIX.length)] = { score: parsed.score, delta: parsed.delta };
          }
        } catch {
          // entrada malformada — ignora
        }
      }
    }
  } catch {
    // ignore
  }
  return out;
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
