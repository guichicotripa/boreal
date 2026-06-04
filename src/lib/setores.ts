// SETOR COMO 1ª CLASSE — registry dos setores que o Boreal cobre. Casa as métricas VALIDADAS
// (src/lib/setores.json, geradas por scripts/build-setores.mjs) com a config de cada setor:
// a LENTE (sucessão = prever quem vende; consolidação = prever quem os roll-ups compram) e o
// STATUS derivado do recall vs o gate do Relay (≥40 valida, 25–40 itera, <25 o jogo é outro).
// Aumentar cobertura = adicionar setor aqui + rodar a validação. Nunca knob de peso manual.

import setoresData from "./setores.json";

export type Lente = "sucessao" | "consolidacao";
export type StatusSetor = "validado" | "itera" | "consolidacao";

export type SetorMetricas = {
  id: string;
  nome: string;
  cnaes: string[];
  universo: number;
  quente: number;
  n_aquisicoes: number;
  recall_top10: number | null;
  deals_ano: number;
};

export type Setor = SetorMetricas & {
  lente: Lente;
  descricao: string;
  status: StatusSetor;
};

// Config por setor (hand-set, baseado no que o dado mostrou — não é knob de peso).
const CONFIG: Record<string, { lente: Lente; descricao: string }> = {
  metalmec: {
    lente: "sucessao",
    descricao:
      "Sucessão clássica: donos envelhecendo, sem sucessor. O score prevê quem vai vender — e " +
      "valida forte (70%).",
  },
  saude: {
    lente: "consolidacao",
    descricao:
      "Consolidação: roll-ups comprando dezenas de clínicas. O score de sucessão NÃO prevê (17%) — " +
      "o jogo é outro. A lente certa é o próximo alvo dos consolidadores.",
  },
  educacao: {
    lente: "sucessao",
    descricao:
      "Escolas familiares. O score de sucessão tem sinal (26%), mas moderado e com amostra pequena — " +
      "itera. Mercado-alvo do Relay (foco NE; aqui medido em SP).",
  },
};

// Gate do Relay: ≥40 valida · 25–40 itera · <25 o score de sucessão não serve (consolidação).
function statusDe(recall: number | null): StatusSetor {
  if (recall == null) return "itera";
  if (recall >= 40) return "validado";
  if (recall >= 25) return "itera";
  return "consolidacao";
}

export const SETORES: Setor[] = (setoresData.setores as SetorMetricas[]).map((m) => ({
  ...m,
  lente: CONFIG[m.id]?.lente ?? "sucessao",
  descricao: CONFIG[m.id]?.descricao ?? "",
  status: statusDe(m.recall_top10),
}));

export function setorPorId(id: string): Setor | null {
  return SETORES.find((s) => s.id === id) ?? null;
}

export const SETORES_GERADO_EM = setoresData.gerado_em;
