// SETOR COMO 1ª CLASSE — registry dos setores que o Boreal cobre. Casa as métricas VALIDADAS
// (src/lib/setores.json, geradas por scripts/build-setores.mjs) com a config de cada setor:
// a LENTE (sucessão = prever quem vende; consolidação = prever quem os roll-ups compram) e o
// STATUS derivado do recall vs o gate do Relay (≥40 valida, 25–40 itera, <25 o jogo é outro).
// Aumentar cobertura = adicionar setor aqui + rodar a validação. Nunca knob de peso manual.

// `with { type: "json" }`: exigido pelo runner nativo do Node (npm test), que
// importa este módulo pela cadeia do query-parser. O bundler do Next aceita.
import setoresData from "./setores.json" with { type: "json" };

export type Lente = "sucessao" | "consolidacao";
export type StatusSetor = "validado" | "itera" | "consolidacao";

export type SetorMetricas = {
  id: string;
  nome: string;
  cnaes: string[];
  universo: number;
  quente: number;
  n_aquisicoes: number;
  recall_top10: number | null;       // recall geral (mistura sucessão + consolidação)
  n_aquisicoes_sucessao: number;
  recall_sucessao: number | null;    // recall nas vendas de SUCESSÃO (onde a lente vale) — a métrica honesta
  deals_ano: number;
  // Robustez: o mesmo recall medido BRASIL INTEIRO (N maior). Confirma que o número de SP se sustenta.
  nacional?: {
    universo: number;
    n_aquisicoes: number;
    recall_top10: number | null;
    n_aquisicoes_sucessao: number;
    recall_sucessao: number | null;
  };
};

export type Setor = SetorMetricas & {
  lente: Lente;
  descricao: string;
  status: StatusSetor;
  pct_sucessao: number;              // % do M&A do setor que é sucessão (o resto é consolidação)
};

// Config por setor (hand-set, baseado no que o dado mostrou — não é knob de peso).
const CONFIG: Record<string, { lente: Lente; descricao: string }> = {
  metalmec: {
    lente: "sucessao",
    descricao:
      "Setor de sucessão: ~metade do M&A é venda por sucessão, e o score acerta 97% dessas. Sinal mais forte da cobertura atual.",
  },
  saude: {
    lente: "consolidacao",
    descricao:
      "Setor de consolidação: só ~8% do M&A é sucessão; o restante é roll-up de clínicas. Nessas poucas, o " +
      "score acerta 100%, mas a dinâmica do setor é identificar o próximo alvo dos consolidadores, não quem vende.",
  },
  educacao: {
    lente: "sucessao",
    descricao:
      "Misto: ~30% do M&A é venda de escola familiar, com 88% de acerto do score nessas vendas; o restante é consolidação, " +
      "grupos como SEB e Inspira. Aplicamos a lente de sucessão no perfil familiar. Dados de SP; expansão para outras regiões em andamento.",
  },
  agro: {
    lente: "consolidacao",
    descricao:
      "Cobertura parcial e a mais frágil das quatro. Duas ressalvas que valem mais que o número: " +
      "(1) N=12 vendas de sucessão medidas é pequeno demais para tratar 100% como validado — leia como indício, não prova; " +
      "(2) a data de abertura do CNPJ não mede a idade do negócio no agro. Entre 2006 e 2010 houve formalização em massa de " +
      "produtor rural, e a curva mostra o degrau: 51.874 empresas com sócio 61+ têm 15+ anos de CNPJ, mas só 1.948 têm 20+. " +
      "Como antiguidade vale 30 dos ~100 pontos do score, ele mede outra coisa nessa coorte. Por isso indexamos só o corte " +
      "pré-formalização (20+ anos), que é onde a data significa o que o score assume.",
  },
};

// O score de sucessão valida em TODOS os setores (88–100% nas vendas de sucessão). O que muda é o
// JOGO do setor: quanto do M&A é sucessão (onde prevemos) vs consolidação (onde não — e nem fingimos).
// Status reflete o jogo, não o score: muita sucessão = setor de sucessão; pouca = consolidação.
function statusDe(pctSucessao: number): StatusSetor {
  if (pctSucessao >= 40) return "validado"; // setor majoritariamente de sucessão
  if (pctSucessao >= 20) return "itera"; // misto
  return "consolidacao"; // M&A é quase todo consolidação
}

export const SETORES: Setor[] = (setoresData.setores as SetorMetricas[]).map((m) => {
  const pct = m.n_aquisicoes > 0 ? Math.round((m.n_aquisicoes_sucessao / m.n_aquisicoes) * 100) : 0;
  return {
    ...m,
    lente: CONFIG[m.id]?.lente ?? "sucessao",
    descricao: CONFIG[m.id]?.descricao ?? "",
    pct_sucessao: pct,
    status: statusDe(pct),
  };
});

export function setorPorId(id: string): Setor | null {
  return SETORES.find((s) => s.id === id) ?? null;
}

// Mapeia um CNAE (código completo, ex "2511700") ao setor coberto, por prefixo.
// Os prefixos não colidem (metalmec 24/25/28 · saúde 86 · educação 851/852).
export function setorPorCnae(cnae: string | null | undefined): Setor | null {
  if (!cnae) return null;
  const c = String(cnae).replace(/\D/g, "");
  return SETORES.find((s) => s.cnaes.some((p) => c.startsWith(p))) ?? null;
}

export const SETORES_GERADO_EM = setoresData.gerado_em;
