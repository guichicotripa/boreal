// Heat-map de setores — dados pro treemap de atividade de M&A por divisão CNAE, filtrável por região.
// Os dados vêm por UF (heatmap-setores.json); aqui agregamos pra a região escolhida (ou Brasil) e
// calculamos a cor MONOCROMÁTICA (escala de cinza) por intensidade, normalizada DENTRO da seleção.
//
// HONESTIDADE: mede atividade OBSERVADA de M&A (aquisições PJ-in/PF-out), consistente pra todos os
// setores. A validação do score (recall) só existe nos 3 cobertos — marcados com `validado`.

import raw from "./heatmap-setores.json";
import { nomeDivisao, secaoDe, DIVISOES_VALIDADAS, UF_REGIAO } from "./cnae";

const PISO_N = 10; // abaixo disso a densidade é ruído estatístico → cor neutra
const MIN_TILE = 8; // abaixo disso o tile vira sliver ilegível — omitido (exceto setores validados)
const ANOS = 2.4;

type DivRaw = { div: string; universo: number; n_aquisicoes: number };
const UFS = raw.ufs as Record<string, DivRaw[]>;

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

export type GrupoSecao = {
  secaoSigla: string;
  secaoNome: string;
  value: number;
  itens: (DivisaoHeat & { value: number })[];
};

// Soma universo + aquisições por divisão nas UFs da região ("BR" = todas).
function agregaRegiao(regiao: string): Map<string, { universo: number; n_adq: number }> {
  const acc = new Map<string, { universo: number; n_adq: number }>();
  for (const [uf, arr] of Object.entries(UFS)) {
    if (regiao !== "BR" && UF_REGIAO[uf] !== regiao) continue;
    for (const d of arr) {
      const cur = acc.get(d.div) ?? { universo: 0, n_adq: 0 };
      cur.universo += d.universo;
      cur.n_adq += d.n_aquisicoes;
      acc.set(d.div, cur);
    }
  }
  return acc;
}

export function divisoesDaRegiao(regiao: string): DivisaoHeat[] {
  const agg = agregaRegiao(regiao);
  const base = [...agg.entries()].map(([div, v]) => ({
    div,
    universo: v.universo,
    n_aquisicoes: v.n_adq,
    deals_ano: Math.round((v.n_adq / ANOS) * 10) / 10,
    densidade: v.universo > 0 ? v.n_adq / v.universo : 0,
  }));

  // Normaliza a densidade só entre as divisões com sinal (N>=piso) NESTA região.
  const dens = base.filter((d) => d.n_aquisicoes >= PISO_N).map((d) => d.densidade);
  const dMin = dens.length ? Math.min(...dens) : 0;
  const dMax = dens.length ? Math.max(...dens) : 1;

  return base.map((d) => {
    const sec = secaoDe(d.div);
    const intensidade =
      d.n_aquisicoes < PISO_N || dMax <= dMin ? 0 : Math.max(0, Math.min(1, (d.densidade - dMin) / (dMax - dMin)));
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
      intensidade,
    };
  });
}

// Agrupa por seção econômica; peso = nº de aquisições. Omite divisões pequenas (exceto validadas).
export function gruposPorSecao(regiao: string): GrupoSecao[] {
  const porSecao = new Map<string, GrupoSecao>();
  for (const d of divisoesDaRegiao(regiao)) {
    if (d.n_aquisicoes < MIN_TILE && !d.validado) continue;
    if (d.n_aquisicoes <= 0) continue;
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

export function totalAquisicoes(regiao: string): number {
  return divisoesDaRegiao(regiao).reduce((a, d) => a + d.n_aquisicoes, 0);
}

// Cor do tile — cinza levemente quente (combina com smoky/bone). Mais claro = mais denso/quente.
// Sem verde/vermelho: cor de risco segue reservada a score (regra do brand).
export function corTile(intensidade: number): string {
  const L = 19 + intensidade * 60; // 19%..79%
  return `hsl(40 6% ${L}%)`;
}

export function corTextoTile(intensidade: number): string {
  return intensidade > 0.52 ? "#1c1a17" : "#D8CFBC";
}

export const HEATMAP_JANELA = raw.janela;
export const HEATMAP_GERADO_EM = raw.gerado_em;
