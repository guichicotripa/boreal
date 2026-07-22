// Ponte de navegação home/pipeline → /empresa/[id] (Fase 2).
//
// A home e o pipeline já têm o objeto Empresa completo em memória quando o usuário
// clica num card. Guardamos em sessionStorage pro paint instantâneo na página de
// destino. A página HIDRATA com os dados canônicos via GET /api/empresa/[id] quando o
// que veio é parcial (pipeline) ou nulo (link direto/refresh) — ver empresa/[id]/page.
// Esta camada é só a ponte de paint rápido; a fonte de verdade é o endpoint.

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
// A FONTE DE VERDADE do v1 é o servidor (tabela score_run, servida por /api/search e
// /api/empresa/[id] no campo `score_v1`). Este overlay cobre só a janela em que o
// servidor ainda não sabe do que acabou de acontecer: você investiga uma empresa e
// volta pra uma lista JÁ carregada. Regra de merge: v1 do servidor vence sempre; o
// overlay preenche apenas quem o servidor não trouxe.
//
// localStorage (não sessionStorage): antes o overlay morria ao fechar a aba, e a
// empresa investigada voltava exibindo o v0 — o bug que originou a persistência.

export type ScoreConhecido = { score: number; delta: number };

/** Guarda o score_v1 pós-investigação + o delta vs score_v0. */
export function storeScoreConhecido(empresaId: string, score: number, delta: number): void {
  if (!hasWindow()) return;
  try {
    localStorage.setItem(SCORE_PREFIX + empresaId, JSON.stringify({ score, delta }));
  } catch {
    // ignore
  }
}

/** Mapa { empresaId → {score, delta} } de tudo que já foi investigado neste browser. */
export function readScoresConhecidos(): Record<string, ScoreConhecido> {
  if (!hasWindow()) return {};
  const out: Record<string, ScoreConhecido> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(SCORE_PREFIX)) {
        try {
          const parsed = JSON.parse(localStorage.getItem(k) ?? "");
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
