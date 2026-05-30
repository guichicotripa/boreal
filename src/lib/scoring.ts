// Boreal — succession risk scoring (heurística determinística, sem LLM).
//
// PESOS v0.1 — CALIBRADOS POR VALIDAÇÃO RETROATIVA contra 340 aquisições reais (mineração de
// transições do CNPJ; ver segundo-cerebro/wiki/synthesis/relay-data-moat.md). A análise de lift
// mostrou que:
//   - porte e antiguidade são tão preditivos de aquisição quanto idade (lift ~2,4-2,6x);
//   - "estabilidade/estagnação" tinha lift NEGATIVO (0,81x) — REMOVIDA (o v0 premiava errado);
//   - empresa de sócio único quase nunca é adquirida → quadro plural ganha bônus.
// Resultado: top decil de aquisições reais subiu de 17% (v0) para 28% (v0.1).

import type { Empresa, Socio } from "./types";

export type ScoreBreakdown = {
  idade_socios: number;        // 0–30
  antiguidade_empresa: number; // 0–30
  porte_relevancia: number;    // 0–30
  quadro_plural: number;       // 0–10
};

export type ScoreResult = {
  score: number;            // 0–100
  breakdown: ScoreBreakdown;
  sinais: string[];         // bullets human-readable, ordenados por força
};

// Sócios pessoa física têm faixa etária 1–9; PJ / não-aplicável têm 0 ou null.
function faixasPF(socios: Socio[]): number[] {
  return socios
    .map((s) => Number(s.faixa_etaria))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 9);
}

// ── 1. Idade do sócio mais velho (max 30) — lift 2,2–2,4x ────────────────────
function scoreIdadeSocios(socios: Socio[]): { pts: number; sinal: string | null } {
  const faixas = faixasPF(socios);
  if (faixas.length === 0) return { pts: 0, sinal: null };
  const max = Math.max(...faixas);
  const table: Record<number, number> = { 9: 30, 8: 26, 7: 20, 6: 10, 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  const pts = table[max] ?? 0;
  if (pts === 0) return { pts: 0, sinal: null };
  const labels: Record<number, string> = { 9: "80+", 8: "71–80", 7: "61–70", 6: "51–60" };
  const qtd = faixas.filter((f) => f === max).length;
  const sinal = qtd > 1
    ? `${qtd} sócios na faixa ${labels[max]} anos`
    : `Sócio mais velho na faixa ${labels[max]} anos`;
  return { pts, sinal };
}

// ── 2. Antiguidade da empresa (max 30) — lift 2,56x (o mais forte) ───────────
function scoreAntiguidade(dataInicio: string | null): { pts: number; sinal: string | null } {
  if (!dataInicio) return { pts: 0, sinal: null };
  const ano = Number(dataInicio.slice(0, 4));
  if (!Number.isFinite(ano)) return { pts: 0, sinal: null };
  const anos = 2026 - ano;
  if (anos >= 40) return { pts: 30, sinal: `Fundada em ${ano} (${anos} anos de operação)` };
  if (anos >= 25) return { pts: 22, sinal: `Fundada em ${ano} (${anos} anos de operação)` };
  if (anos >= 15) return { pts: 10, sinal: `Fundada em ${ano}` };
  return { pts: 0, sinal: null };
}

// ── 3. Porte / relevância (max 30) — lift 2,38x; era subaproveitado no v0 ─────
function scorePorte(porte: string | null): { pts: number; sinal: string | null } {
  if (!porte) return { pts: 0, sinal: null };
  const p = porte.toUpperCase();
  if (p === "DEMAIS" || p.includes("DEMAIS")) return { pts: 30, sinal: "Porte relevante (não-ME/EPP)" };
  if (p === "EPP") return { pts: 15, sinal: "Porte EPP" };
  if (p === "ME") return { pts: 5, sinal: null };
  return { pts: 0, sinal: null };
}

// ── 4. Quadro plural (max 10) — sócio único tem lift ~0 (quase nunca adquirido) ─
function scoreQuadroPlural(socios: Socio[]): { pts: number; sinal: string | null } {
  const nPF = faixasPF(socios).length;
  if (nPF >= 2) return { pts: 10, sinal: `Quadro com ${nPF} sócios` };
  if (nPF === 1) return { pts: 0, sinal: "Sócio único (perfil menos transacionável)" };
  return { pts: 0, sinal: null };
}

// ── Agregador ─────────────────────────────────────────────────────────────────
export function calcScore(empresa: Empresa, socios: Socio[] = empresa.socio ?? []): ScoreResult {
  const idade       = scoreIdadeSocios(socios);
  const antiguidade = scoreAntiguidade(empresa.data_inicio_atividade);
  const porte       = scorePorte(empresa.porte);
  const plural      = scoreQuadroPlural(socios);

  const breakdown: ScoreBreakdown = {
    idade_socios:        idade.pts,
    antiguidade_empresa: antiguidade.pts,
    porte_relevancia:    porte.pts,
    quadro_plural:       plural.pts,
  };

  const score = idade.pts + antiguidade.pts + porte.pts + plural.pts;

  const sinais = [
    { pts: idade.pts,       sinal: idade.sinal },
    { pts: antiguidade.pts, sinal: antiguidade.sinal },
    { pts: porte.pts,       sinal: porte.sinal },
    { pts: plural.pts,      sinal: plural.sinal },
  ]
    .filter((x) => x.sinal !== null)
    .sort((a, b) => b.pts - a.pts)
    .map((x) => x.sinal as string);

  return { score, breakdown, sinais };
}

// ── Helper de classificação (cor/label na UI) ────────────────────────────────
export function scoreTier(score: number): "alto" | "medio" | "baixo" {
  if (score >= 70) return "alto";
  if (score >= 50) return "medio";
  return "baixo";
}
