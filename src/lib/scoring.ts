// Boreal — succession risk scoring (heurística determinística, sem LLM).
//
// PESOS v1 — MEDIDOS, não escolhidos. Cada eixo vem de scripts/validacao-lift-coorte.mjs (lift
// dentro da coorte alta) e a fórmula inteira foi comparada contra a anterior em
// scripts/validacao-score-v1.mjs, com metade da base em holdout. Números em
// src/lib/lift-coorte.json e src/lib/validacao-v1.json.
//
// O v1 CONTRARIA a tese ingênua de sucessão, e essa é a razão de ele existir. A intuição diz
// "dono velho, sem herdeiro, quadro congelado, essa precisa vender". As aquisições reais dizem o
// contrário, e com folga:
//   · sócio de até 50 anos no quadro (herdeiro aparente)  lift 2,14x  → PREMIA, não castiga
//   · quadro que se mexeu nos últimos 5 anos              lift 2,22x  → movimento é sinal
//   · quadro parado 10+ anos                              lift 0,60x  → estagnação é ANTI-sinal
//   · 2+ sócios na faixa 80+                              lift 0,50x  → mais octogenário, menos deal
// Faz sentido depois de visto: o octogenário sozinho num quadro parado há 20 anos não vende, ele
// fica. Quem transaciona é quem JÁ está administrando uma transição, e tem escala que justifique.
//
// O que saiu do score, e por quê:
//   · ANTIGUIDADE — tinha o maior lift MARGINAL de todos (4,39x) e ainda assim tirá-la MELHOROU o
//     recall no holdout (+1,9pp). Empresa antiga também é empresa grande, e o eixo de capital já
//     captura isso. Ela não sumiu do produto: virou porta de entrada (perfilSucessorio), que é o
//     papel que o dado diz que ela tem — define o universo, não ordena dentro dele.
//   · PORTE — 3 baldes grosseiros, substituído por capital em percentil (lift 3,80x, o mais forte
//     da coorte). Sozinha, essa troca vale +19,6pp de recall.
//
// Eixo conhecido que NÃO entrou: nº de estabelecimentos (vale ~1,3pp) — o ingest não traz
// contagem de filiais. Entra quando trouxer.
//
// Números nunca moram neste comentário: src/lib/lift-coorte.json e src/lib/validacao-v1.json são
// as fontes. Comentário que repete número é comentário que vai mentir.

import type { Empresa, Socio } from "./types";
import percentis from "./capital-percentis.json" with { type: "json" };
import { setorPorCnae } from "./setores.ts";

export type ScoreBreakdown = {
  escala_capital: number;       // 0–34
  idade_controle: number;       // 0–28
  sucessor_aparente: number;    // 0–14
  quadro_plural: number;        // 0–13
  movimento_societario: number; // 0–11
};

export type ScoreResult = {
  score: number;            // 0–100
  breakdown: ScoreBreakdown;
  sinais: string[];         // bullets human-readable, ordenados por força
  // Score por lentes: o score de sucessão SÓ valida quando a empresa está no perfil
  // sucessório (sócio 61+ E empresa 25+). Fora dele, o deal provável é consolidação — baixa confiança.
  perfil_sucessorio: boolean;
};

// Onde a lente de sucessão é confiável: sócio 61+ (faixa≥7) E empresa com 25+ anos.
// Antiguidade vive AQUI desde o v1: ela filtra bem e ordena mal.
export function perfilSucessorio(empresa: Empresa, socios: Socio[] = empresa.socio ?? []): boolean {
  const faixas = faixasPF(socios);
  const idoso = faixas.length > 0 && Math.max(...faixas) >= 7;
  const ano = empresa.data_inicio_atividade ? Number(empresa.data_inicio_atividade.slice(0, 4)) : NaN;
  const antiga = Number.isFinite(ano) && new Date().getFullYear() - ano >= 25;
  return idoso && antiga;
}

// Sócios pessoa física têm faixa etária 1–9; PJ / não-aplicável têm 0 ou null.
function faixasPF(socios: Socio[]): number[] {
  return socios
    .map((s) => Number(s.faixa_etaria))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 9);
}

// ── 1. Escala via capital social (max 34) — lift 3,80x, o eixo mais forte ────
// Percentil DENTRO do setor: R$ 500 mil é topo de mercado em saúde e irrelevante em agro.
function scoreEscala(empresa: Empresa): { pts: number; sinal: string | null } {
  const capital = Number(empresa.capital_social);
  if (!Number.isFinite(capital) || capital <= 0) return { pts: 0, sinal: null };

  const setor = setorPorCnae(empresa.cnae_principal);
  const cortes = (setor && (percentis.verticais as Record<string, typeof percentis.geral>)[setor.id])
    ?? percentis.geral;

  // Estritamente maior: com dezenas de milhares de capitais idênticos (0, 1.000, 10.000),
  // `>=` faria o bloco inteiro de empatados saltar a faixa de uma vez.
  const [pts, faixa] =
    capital > cortes.p95 ? [34, "5% maiores"] :
    capital > cortes.p85 ? [27, "15% maiores"] :
    capital > cortes.p70 ? [19, "30% maiores"] :
    capital > cortes.p50 ? [11, "metade maior"] : [0, null];

  if (pts === 0) return { pts: 0, sinal: null };
  const emReais = capital.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  return { pts, sinal: `Capital ${emReais} — entre os ${faixa} do setor` };
}

// ── 2. Idade do controle (max 28) ────────────────────────────────────────────
// Só a faixa mais velha conta. Ter VÁRIOS octogenários tem lift 0,50x, então acumular
// idade não pode acumular ponto — o eixo mede "o controle está em idade de transferir",
// não "quantos velhos tem no quadro".
function scoreIdadeControle(socios: Socio[]): { pts: number; sinal: string | null } {
  const faixas = faixasPF(socios);
  if (faixas.length === 0) return { pts: 0, sinal: null };
  const max = Math.max(...faixas);
  const table: Record<number, number> = { 9: 28, 8: 25, 7: 19, 6: 10 };
  const pts = table[max] ?? 0;
  if (pts === 0) return { pts: 0, sinal: null };
  const labels: Record<number, string> = { 9: "80+", 8: "71–80", 7: "61–70", 6: "51–60" };
  return { pts, sinal: `Sócio mais velho na faixa ${labels[max]} anos` };
}

// ── 3. Sucessor aparente (max 14) — lift 2,14x, POSITIVO ─────────────────────
// O eixo mais contraintuitivo do score. Herdeiro no quadro não trava a venda, ele é quem
// a conduz: negocia, organiza, e frequentemente é quem decide sair. Ausência de gente nova
// (lift 0,58x) é que marca a empresa que encolhe até fechar em vez de ser vendida.
function scoreSucessorAparente(socios: Socio[]): { pts: number; sinal: string | null } {
  const faixas = faixasPF(socios);
  if (faixas.length === 0) return { pts: 0, sinal: null };
  const menor = Math.min(...faixas);
  if (menor > 5) return { pts: 0, sinal: "Nenhum sócio até 50 anos (perfil que tende a encerrar, não vender)" };
  return { pts: 14, sinal: "Sócio de até 50 anos no quadro (geração seguinte presente)" };
}

// ── 4. Quadro plural (max 13) — 5+ sócios tem lift 2,45x ─────────────────────
function scoreQuadroPlural(socios: Socio[]): { pts: number; sinal: string | null } {
  const nPF = faixasPF(socios).length;
  if (nPF >= 5) return { pts: 13, sinal: `Quadro com ${nPF} sócios` };
  if (nPF >= 2) return { pts: 7, sinal: `Quadro com ${nPF} sócios` };
  if (nPF === 1) return { pts: 0, sinal: "Sócio único (perfil menos transacionável)" };
  return { pts: 0, sinal: null };
}

// ── 5. Movimento societário (max 11) — lift 2,22x ────────────────────────────
// Quadro que mexeu recentemente é quadro vivo. Parado 10+ anos tem lift 0,60x: a empresa
// que não mudou nada em uma década também não vai mudar de dono.
function scoreMovimento(socios: Socio[]): { pts: number; sinal: string | null } {
  const anos = socios
    .map((s) => (s.data_entrada_sociedade ? Number(s.data_entrada_sociedade.slice(0, 4)) : NaN))
    .filter((n) => Number.isFinite(n) && n > 1900);
  if (anos.length === 0) return { pts: 0, sinal: null };
  const decorridos = new Date().getFullYear() - Math.max(...anos);
  if (decorridos < 5) return { pts: 11, sinal: `Quadro mexeu há ${decorridos} ano(s)` };
  if (decorridos < 10) return { pts: 6, sinal: `Quadro mexeu há ${decorridos} anos` };
  return { pts: 0, sinal: `Quadro parado há ${decorridos} anos` };
}

// ── Agregador ─────────────────────────────────────────────────────────────────
export function calcScore(empresa: Empresa, socios: Socio[] = empresa.socio ?? []): ScoreResult {
  const escala    = scoreEscala(empresa);
  const idade     = scoreIdadeControle(socios);
  const sucessor  = scoreSucessorAparente(socios);
  const plural    = scoreQuadroPlural(socios);
  const movimento = scoreMovimento(socios);

  const breakdown: ScoreBreakdown = {
    escala_capital:       escala.pts,
    idade_controle:       idade.pts,
    sucessor_aparente:    sucessor.pts,
    quadro_plural:        plural.pts,
    movimento_societario: movimento.pts,
  };

  const score = escala.pts + idade.pts + sucessor.pts + plural.pts + movimento.pts;

  const sinais = [
    { pts: escala.pts,    sinal: escala.sinal },
    { pts: idade.pts,     sinal: idade.sinal },
    { pts: sucessor.pts,  sinal: sucessor.sinal },
    { pts: plural.pts,    sinal: plural.sinal },
    { pts: movimento.pts, sinal: movimento.sinal },
  ]
    .filter((x) => x.sinal !== null)
    .sort((a, b) => b.pts - a.pts)
    .map((x) => x.sinal as string);

  return { score, breakdown, sinais, perfil_sucessorio: perfilSucessorio(empresa, socios) };
}

// ── Helper de classificação (cor/label na UI) ────────────────────────────────
export function scoreTier(score: number): "alto" | "medio" | "baixo" {
  if (score >= 70) return "alto";
  if (score >= 50) return "medio";
  return "baixo";
}

/** Rótulo e teto de cada eixo — a UI lia isto de listas próprias e elas divergiam do score. */
export const EIXOS: { key: keyof ScoreBreakdown; label: string; max: number }[] = [
  { key: "escala_capital",       label: "Escala (capital no setor)", max: 34 },
  { key: "idade_controle",       label: "Idade do controle",         max: 28 },
  { key: "sucessor_aparente",    label: "Sucessor aparente",         max: 14 },
  { key: "quadro_plural",        label: "Quadro plural",             max: 13 },
  { key: "movimento_societario", label: "Movimento societário",      max: 11 },
];
