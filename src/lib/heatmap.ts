// Heat-map de setores — dados pro treemap de atividade de M&A por divisão CNAE (pedido Setter:
// termômetro pra priorizar o inbound). Junta a métrica minerada (heatmap-setores.json) com os
// nomes/seções CNAE e calcula a cor MONOCROMÁTICA (escala de cinza) por intensidade.
//
// HONESTIDADE: mede atividade OBSERVADA de M&A (aquisições PJ-in/PF-out), consistente pra todos os
// setores. A validação do score (recall) só existe nos 3 cobertos — marcados com `validado`.

import raw from "./heatmap-setores.json";
import { nomeDivisao, secaoDe, DIVISOES_VALIDADAS } from "./cnae";

const PISO_N = 10; // abaixo disso a densidade é ruído estatístico → cor neutra (sem afirmar temperatura)
const MIN_TILE = 5; // divisões com menos aquisições viram tiles ilegíveis — omitidas do treemap

type DivRaw = { div: string; universo: number; n_aquisicoes: number; deals_ano: number; densidade: number };

export type DivisaoHeat = {
  div: string;
  nome: string;
  secaoSigla: string;
  secaoNome: string;
  universo: number;
  n_aquisicoes: number;
  deals_ano: number;
  densidade: number;
  validado: boolean;
  intensidade: number; // 0..1 — 0 = neutro/frio (ou sinal insuficiente), 1 = mais denso
};

const divisoesRaw = raw.divisoes as DivRaw[];

// Normaliza a densidade só entre as divisões com sinal (N>=piso), pra a cor não ser
// enganada por divisões minúsculas com 1-2 aquisições.
const comSinal = divisoesRaw.filter((d) => d.n_aquisicoes >= PISO_N);
const densidades = comSinal.map((d) => d.densidade);
const dMin = densidades.length ? Math.min(...densidades) : 0;
const dMax = densidades.length ? Math.max(...densidades) : 1;

function intensidadeDe(d: DivRaw): number {
  if (d.n_aquisicoes < PISO_N || dMax <= dMin) return 0;
  return Math.max(0, Math.min(1, (d.densidade - dMin) / (dMax - dMin)));
}

export const DIVISOES: DivisaoHeat[] = divisoesRaw.map((d) => {
  const sec = secaoDe(d.div);
  return {
    div: d.div,
    nome: nomeDivisao(d.div),
    secaoSigla: sec.sigla,
    secaoNome: sec.nome,
    universo: d.universo,
    n_aquisicoes: d.n_aquisicoes,
    deals_ano: d.deals_ano,
    densidade: d.densidade,
    validado: DIVISOES_VALIDADAS.has(d.div),
    intensidade: intensidadeDe(d),
  };
});

// Cor do tile — cinza levemente quente (combina com o smoky/bone do brand). Mais claro = mais
// denso/quente. Sem verde/vermelho: cor de risco segue reservada a score (regra do brand).
export function corTile(intensidade: number): string {
  const L = 19 + intensidade * 60; // 19%..79%
  return `hsl(40 6% ${L}%)`;
}

// Texto legível sobre o tile: escuro em tile claro, bone em tile escuro.
export function corTextoTile(intensidade: number): string {
  return intensidade > 0.52 ? "#1c1a17" : "#D8CFBC";
}

export type GrupoSecao = {
  secaoSigla: string;
  secaoNome: string;
  value: number;
  itens: (DivisaoHeat & { value: number })[];
};

// Agrupa as divisões (com aquisições suficientes) por seção econômica; peso = nº de aquisições.
export function gruposPorSecao(): GrupoSecao[] {
  const porSecao = new Map<string, GrupoSecao>();
  for (const d of DIVISOES) {
    if (d.n_aquisicoes < MIN_TILE) continue;
    let g = porSecao.get(d.secaoSigla);
    if (!g) {
      g = { secaoSigla: d.secaoSigla, secaoNome: d.secaoNome, value: 0, itens: [] };
      porSecao.set(d.secaoSigla, g);
    }
    g.value += d.n_aquisicoes;
    g.itens.push({ ...d, value: d.n_aquisicoes });
  }
  const grupos = [...porSecao.values()];
  grupos.forEach((g) => g.itens.sort((a, b) => b.value - a.value));
  return grupos.sort((a, b) => b.value - a.value);
}

export const HEATMAP_JANELA = raw.janela;
export const HEATMAP_GERADO_EM = raw.gerado_em;
