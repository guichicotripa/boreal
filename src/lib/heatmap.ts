// Heat-map de setor — termômetro de M&A pra priorizar o INBOUND (pedido do Henrique/Setter na call
// de 25/06): quando um ativo chega, quão quente está o setor dele? Reembala sinais REAIS (deals/ano,
// densidade de transações, consolidadores ativos) numa leitura de prioridade. NÃO é dado novo — é a
// lente de priorização sobre setores.ts + consolidadores.json.

import { SETORES, type Setor } from "./setores";
import consolidadoresData from "./consolidadores.json";

export type Tier = "quente" | "morno" | "frio";

export type SetorTemperatura = Setor & {
  tier: Tier;
  intensidade: number; // 0-100 — preenchimento da barra (deals/ano normalizado)
  densidade_pct: number; // n_aquisicoes / quente * 100 — fração do estoque quente que girou na janela
  n_consolidadores: number;
};

export type Consolidador = { nome: string; n_adquiridas: number };

// Teto da barra de intensidade: saúde (~110 deals/ano) é o topo observado nos setores cobertos.
const TETO_DEALS = 120;

// consolidadores.json é, hoje, só de saúde (ver a nota do próprio arquivo). Mapa explícito por id
// pra quando entrarem outros setores; sem isso, contagem é 0.
const CONSOLIDADORES_POR_SETOR: Record<string, Consolidador[]> = {
  saude: (Array.isArray(consolidadoresData.consolidadores) ? consolidadoresData.consolidadores : [])
    .map((c) => ({ nome: c.consolidador, n_adquiridas: c.n_adquiridas }))
    .sort((a, b) => b.n_adquiridas - a.n_adquiridas),
};

// Tier pelo RITMO de M&A (deals/ano), que é o que importa pro originador: volume de oportunidade.
function tierDe(dealsAno: number): Tier {
  if (dealsAno >= 80) return "quente";
  if (dealsAno >= 20) return "morno";
  return "frio";
}

export function setoresPorTemperatura(): SetorTemperatura[] {
  return SETORES.map((s) => ({
    ...s,
    tier: tierDe(s.deals_ano),
    intensidade: Math.min(100, Math.round((s.deals_ano / TETO_DEALS) * 100)),
    densidade_pct: s.quente > 0 ? (s.n_aquisicoes / s.quente) * 100 : 0,
    n_consolidadores: (CONSOLIDADORES_POR_SETOR[s.id] ?? []).length,
  })).sort((a, b) => b.deals_ano - a.deals_ano); // mais quente primeiro
}

export function consolidadoresDoSetor(id: string): Consolidador[] {
  return CONSOLIDADORES_POR_SETOR[id] ?? [];
}

export const TIER_LABEL: Record<Tier, string> = {
  quente: "Consolidação ativa",
  morno: "Movimento moderado",
  frio: "Mercado frio",
};

export const CONSOLIDADORES_JANELA = consolidadoresData.janela;
