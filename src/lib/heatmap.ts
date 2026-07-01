// Heat-map de setores — dados pro treemap de atividade de M&A por divisão CNAE, filtrável por região.
// Os dados vêm por UF (heatmap-setores.json); aqui agregamos pra a região escolhida (ou Brasil) e
// calculamos a cor MONOCROMÁTICA (escala de cinza) por intensidade, normalizada DENTRO da seleção.
//
// HONESTIDADE: mede atividade OBSERVADA de troca de controle (PJ-in/PF-out), já LIMPA de artefatos no
// build (só empresa ativa 5+ anos; e em construção/imobiliária/energia, sem reorganização de holding).
// A validação do score (recall) só existe nos setores cobertos — marcados com `validado`.

import raw from "./heatmap-setores.json";
import { nomeDivisao, secaoDe, DIVISOES_VALIDADAS, UF_REGIAO } from "./cnae";

const PISO_N = 15; // abaixo disso a densidade é ruído estatístico (n pequeno) → cor neutra
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
  // Escala LOG (não linear): a densidade é fortemente assimétrica à direita (mediana ~0,04% vs cauda
  // >0,5%), então linear jogaria ~90% dos setores no escuro e daria branco só pra cauda. Log espalha o
  // meio da tabela — onde estão os setores que importam — e dá contraste legível.
  const dens = base.filter((d) => d.n_aquisicoes >= PISO_N && d.densidade > 0).map((d) => Math.log(d.densidade));
  const lnMin = dens.length ? Math.min(...dens) : 0;
  const lnMax = dens.length ? Math.max(...dens) : 1;

  return base.map((d) => {
    const sec = secaoDe(d.div);
    const intensidade =
      d.n_aquisicoes < PISO_N || d.densidade <= 0 || lnMax <= lnMin
        ? 0
        : Math.max(0, Math.min(1, (Math.log(d.densidade) - lnMin) / (lnMax - lnMin)));
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

// Cor do tile — monocromático quente (cinza-quente → branco), sem verde/vermelho (risco é do score).
// O defeito antigo era o meio da tabela ficar claro demais (parecia tudo branco). Gamma 1.6 mantém o
// grosso escuro e só o TOPO acende; faixa alargada (12% quase-fundo → 94% quase-branco) dá o salto.
export function corTile(intensidade: number): string {
  const i = Math.pow(Math.max(0, Math.min(1, intensidade)), 1.6);
  const L = 12 + i * 82; // 12%..94%
  return `hsl(40 7% ${L}%)`;
}

export function corTextoTile(intensidade: number): string {
  const i = Math.pow(Math.max(0, Math.min(1, intensidade)), 1.6);
  return i > 0.5 ? "#1c1a17" : "#D8CFBC";
}

export const HEATMAP_JANELA = raw.janela;
export const HEATMAP_GERADO_EM = raw.gerado_em;
