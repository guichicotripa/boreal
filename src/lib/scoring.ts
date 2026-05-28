// Boreal — succession risk scoring (heurística determinística, sem LLM).
//
// Score 0–100. Quatro dimensões somáveis. Nenhum dado é inventado —
// só faz aritmética sobre os campos que vêm da Receita Federal.
//
// Pesos foram escolhidos com base na tese: idade do sócio é o sinal mais forte,
// seguido por antiguidade da empresa (lock-in geracional), estabilidade societária
// (ausência de transição) e porte (sweet spot pro middle market M&A).

import type { Empresa, Socio } from "./types";

export type ScoreBreakdown = {
  idade_socios: number;        // 0–40
  antiguidade_empresa: number; // 0–30
  estabilidade_quadro: number; // 0–20
  porte_relevancia: number;    // 0–10
};

export type ScoreResult = {
  score: number;            // 0–100
  breakdown: ScoreBreakdown;
  sinais: string[];         // bullets human-readable, ordenados por força
};

// ── 1. Idade do sócio mais velho (max 40) ────────────────────────────────────
// Receita publica faixas, não idade exata. Faixa 9 = 80+ é o pico do risco
// sucessório (fundador no fim da vida produtiva, decisão de venda mais provável).
function scoreIdadeSocios(socios: Socio[]): { pts: number; sinal: string | null } {
  const faixas = socios
    .map((s) => Number(s.faixa_etaria))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 9);

  if (faixas.length === 0) return { pts: 0, sinal: null };

  const max = Math.max(...faixas);
  const table: Record<number, number> = { 9: 40, 8: 35, 7: 25, 6: 12, 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  const pts = table[max] ?? 0;

  const labels: Record<number, string> = {
    9: "80+", 8: "71–80", 7: "61–70", 6: "51–60", 5: "41–50",
  };
  if (pts === 0) return { pts: 0, sinal: null };

  const qtdNaFaixa = faixas.filter((f) => f === max).length;
  const sinal =
    qtdNaFaixa > 1
      ? `${qtdNaFaixa} sócios na faixa ${labels[max]} anos`
      : `Sócio mais velho na faixa ${labels[max]} anos`;
  return { pts, sinal };
}

// ── 2. Antiguidade da empresa (max 30) ───────────────────────────────────────
// Empresa antiga = mais provável de ter chegado ao limite geracional sem sucessor.
// Usa data_inicio_atividade. Referência: hoje (2026).
function scoreAntiguidade(dataInicio: string | null): { pts: number; sinal: string | null } {
  if (!dataInicio) return { pts: 0, sinal: null };
  const ano = Number(dataInicio.slice(0, 4));
  if (!Number.isFinite(ano)) return { pts: 0, sinal: null };

  const anos = 2026 - ano;
  if (anos >= 40) return { pts: 30, sinal: `Fundada em ${ano} (${anos} anos de operação)` };
  if (anos >= 25) return { pts: 22, sinal: `Fundada em ${ano} (${anos} anos de operação)` };
  if (anos >= 15) return { pts: 12, sinal: `Fundada em ${ano}` };
  return { pts: 0, sinal: null };
}

// ── 3. Estabilidade do quadro societário (max 20) ────────────────────────────
// Olha a entrada mais RECENTE de qualquer sócio. Se foi há muito tempo, o quadro
// está congelado — sinal forte de que não há plano de sucessão em andamento.
function scoreEstabilidade(socios: Socio[]): { pts: number; sinal: string | null } {
  const datas = socios
    .map((s) => s.data_entrada_sociedade)
    .filter((d): d is string => Boolean(d))
    .map((d) => new Date(d).getTime())
    .filter((t) => Number.isFinite(t));

  if (datas.length === 0) return { pts: 10, sinal: null }; // neutro

  const maisRecente = Math.max(...datas);
  const anosDesde = (Date.now() - maisRecente) / (1000 * 60 * 60 * 24 * 365.25);
  const ano = new Date(maisRecente).getFullYear();

  if (anosDesde > 10) return { pts: 20, sinal: `Quadro societário inalterado desde ${ano}` };
  if (anosDesde >= 5)  return { pts: 12, sinal: `Última mudança societária em ${ano}` };
  if (anosDesde >= 2)  return { pts: 5,  sinal: null };
  return { pts: 0, sinal: `Mudança societária recente em ${ano}` };
}

// ── 4. Porte / relevância pro middle market (max 10) ─────────────────────────
// DEMAIS = não-ME-nem-EPP = empresa maior, sweet spot do M&A.
function scorePorte(porte: string | null): { pts: number; sinal: string | null } {
  if (!porte) return { pts: 0, sinal: null };
  const p = porte.toUpperCase();
  if (p === "DEMAIS" || p.includes("DEMAIS")) return { pts: 10, sinal: "Porte relevante (não-ME/EPP)" };
  if (p === "EPP")                            return { pts: 6,  sinal: null };
  if (p === "ME")                             return { pts: 2,  sinal: null };
  return { pts: 0, sinal: null };
}

// ── Agregador ─────────────────────────────────────────────────────────────────
export function calcScore(empresa: Empresa, socios: Socio[] = empresa.socio ?? []): ScoreResult {
  const idade        = scoreIdadeSocios(socios);
  const antiguidade  = scoreAntiguidade(empresa.data_inicio_atividade);
  const estabilidade = scoreEstabilidade(socios);
  const porte        = scorePorte(empresa.porte);

  const breakdown: ScoreBreakdown = {
    idade_socios:        idade.pts,
    antiguidade_empresa: antiguidade.pts,
    estabilidade_quadro: estabilidade.pts,
    porte_relevancia:    porte.pts,
  };

  const score = idade.pts + antiguidade.pts + estabilidade.pts + porte.pts;

  // Sinais ordenados pela força do componente (maior peso → primeiro).
  const sinais = [
    { pts: idade.pts,        sinal: idade.sinal },
    { pts: antiguidade.pts,  sinal: antiguidade.sinal },
    { pts: estabilidade.pts, sinal: estabilidade.sinal },
    { pts: porte.pts,        sinal: porte.sinal },
  ]
    .filter((x) => x.sinal !== null)
    .sort((a, b) => b.pts - a.pts)
    .map((x) => x.sinal as string);

  return { score, breakdown, sinais };
}

// ── Helper de classificação (pra cor/label na UI) ────────────────────────────
export function scoreTier(score: number): "alto" | "medio" | "baixo" {
  if (score >= 70) return "alto";
  if (score >= 50) return "medio";
  return "baixo";
}
