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

/* Config por setor (hand-set, baseado no que o dado mostrou — não é knob de peso).
   `descricao` recebe as métricas do setor em vez de repetir os números em texto:
   a de educação dizia "88% de acerto" e ficou mentindo quando a validação passou
   a excluir empresa baixada do universo e o número virou 100%. Número que aparece
   em dois lugares é número que vai divergir. */
const CONFIG: Record<string, { lente: Lente; descricao: (m: SetorMetricas & { pct: number }) => string }> = {
  metalmec: {
    lente: "sucessao",
    descricao: (m) =>
      `Setor de sucessão: ~${m.pct}% do M&A é venda por sucessão, e o score acerta ${m.recall_sucessao}% dessas. ` +
      `Sinal mais forte da cobertura atual.`,
  },
  saude: {
    lente: "consolidacao",
    descricao: (m) =>
      `Setor de consolidação: só ~${m.pct}% do M&A é sucessão; o restante é roll-up de clínicas. Nessas poucas, o ` +
      `score acerta ${m.recall_sucessao}%, mas a dinâmica do setor é identificar o próximo alvo dos consolidadores, não quem vende.`,
  },
  educacao: {
    lente: "sucessao",
    descricao: (m) =>
      `Misto: ~${m.pct}% do M&A é venda de escola familiar, com ${m.recall_sucessao}% de acerto do score nessas vendas; ` +
      `o restante é consolidação, grupos como SEB e Inspira. Aplicamos a lente de sucessão no perfil familiar. ` +
      `Dados de SP; expansão para outras regiões em andamento.`,
  },
  agro: {
    lente: "consolidacao",
    descricao: (m) =>
      `Cobertura parcial. O acerto medido é alto, e a ressalva vale mais que o número: em SP são só ` +
      `N=${m.n_aquisicoes_sucessao} vendas de sucessão, pequeno demais para tratar ${m.recall_sucessao}% ` +
      `como validado — no Brasil inteiro, com N=${m.nacional?.n_aquisicoes_sucessao}, o acerto é ` +
      `${m.nacional?.recall_sucessao}%, e é esse o número a citar. ` +
      "O problema antigo do setor deixou de existir com o score v1: a data de abertura do CNPJ não mede a idade do " +
      "negócio no agro (entre 2006 e 2010 houve formalização em massa de produtor rural, e a curva mostra o degrau), " +
      "e antiguidade valia 30 dos 100 pontos do v0. O v1 não pontua antiguidade — capital social em percentil do setor " +
      "faz o trabalho, e é justamente no agro que a troca rende mais, porque separa agronegócio de CNPJ de produtor. " +
      "Continuamos indexando só o corte pré-formalização (20+ anos) por conservadorismo do universo.",
  },
};

// O score de sucessão valida em TODOS os setores. O que muda é o JOGO do setor: quanto do M&A é
// sucessão (onde prevemos) vs consolidação (onde não — e nem fingimos).
// Status reflete o jogo, não o score: muita sucessão = setor de sucessão; pouca = consolidação.
function statusDe(pctSucessao: number): StatusSetor {
  if (pctSucessao >= 40) return "validado"; // setor majoritariamente de sucessão
  if (pctSucessao >= 20) return "itera"; // misto
  return "consolidacao"; // M&A é quase todo consolidação
}

const METRICAS = setoresData.setores as SetorMetricas[];

export const SETORES: Setor[] = METRICAS.map((m) => {
  const pct = m.n_aquisicoes > 0 ? Math.round((m.n_aquisicoes_sucessao / m.n_aquisicoes) * 100) : 0;
  return {
    ...m,
    lente: CONFIG[m.id]?.lente ?? "sucessao",
    descricao: CONFIG[m.id]?.descricao({ ...m, pct }) ?? "",
    pct_sucessao: pct,
    status: statusDe(pct),
  };
});

/** Faixa de acerto nas vendas de sucessão entre os setores cobertos, ex "97–100%". */
export const FAIXA_RECALL_SUCESSAO = (() => {
  const rs = METRICAS.map((m) => m.recall_sucessao).filter((r): r is number => r != null);
  if (!rs.length) return "—";
  const min = Math.min(...rs), max = Math.max(...rs);
  return min === max ? `${min}%` : `${min}–${max}%`;
})();

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
