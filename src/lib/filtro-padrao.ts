/* O filtro que o originador já aplica na cabeça, virando controle da ferramenta.
 *
 * ORIGEM: áudio da Fernanda Arbage (Setter) em 24/08/2026, descrevendo como ela tria:
 *
 *   "O porte, eu nunca pego o MEI, de microempresa, ou o EPP, é muito pequeno."
 *   "De 2020 pra cima, em regra, ela é bem pequena, e aí eu não costumo olhar."
 *   "Eu NÃO descarto uma empresa por ela ter um capital social pequeno."
 *
 * Medido contra o que a plataforma tinha entregue a ela: das 624 empresas exibidas, 55 (9%)
 * sobreviviam a essa regra. Ela descartou 541 empresas à mão, uma por segundo no fim da sessão,
 * para fazer o que estas duas condições fazem numa cláusula.
 *
 * POR QUE `porte` E NÃO `capital_social`: `porte` da Receita é definido por RECEITA BRUTA
 * (LC 123/2006 — ME até R$ 360 mil/ano, EPP até R$ 4,8 milhões, DEMAIS acima). É o único proxy
 * de faturamento que a base tem, e é o que ela usa. Capital social fica de fora de propósito:
 * ela disse explicitamente que capital baixo não descarta, e o dado confirma (salvou uma empresa
 * de R$ 150 mil de capital). Capital influencia a ORDEM, não o corte.
 *
 * POR QUE É DESLIGÁVEL: `porte` é autodeclarado e desatualiza. Empresa que cresceu e não atualizou
 * o registro continua ME. Um corte silencioso que remove 94% do universo transformaria esse erro
 * de cadastro em alvo perdido sem rastro. Com o controle na tela, a escolha é dela e é visível.
 *
 * PURO DE PROPÓSITO: sem Supabase, sem request. A regra é testável sem banco, e a rota só a aplica.
 */
import type { SearchFilters } from "./types";

export type FiltroPadrao = {
  /** Valores de `empresa.porte` que passam. A base só tem ME, EPP e DEMAIS. */
  portes: string[];
  /** Fundada ATÉ este ano, inclusive. 2019 = exclui 2020 em diante. */
  maxAnoFundacao: number;
};

/**
 * Devolve os filtros com o padrão do mandato aplicado.
 *
 * `desligado` vem da tela. Mandato sem padrão devolve os filtros intactos, então rota nova ou
 * mandato novo nascem com o comportamento antigo até alguém declarar o padrão.
 *
 * Filtro que veio da consulta em linguagem natural VENCE o padrão: se o originador escreveu
 * "fundadas antes de 1990", ele está sendo mais restritivo de propósito e o padrão não pode
 * afrouxar isso para 2019.
 */
export function comFiltroPadrao(
  filtros: SearchFilters,
  padrao: FiltroPadrao | undefined,
  desligado = false
): SearchFilters {
  if (!padrao || desligado) return filtros;
  return {
    ...filtros,
    portes: padrao.portes,
    maxAnoFundacao: filtros.maxAnoFundacao ?? padrao.maxAnoFundacao,
  };
}

/** Está valendo? Serve à tela, que precisa dizer o que está ligado sem repetir a regra. */
export function filtroPadraoAtivo(padrao: FiltroPadrao | undefined, desligado = false): boolean {
  return !!padrao && !desligado;
}

const ROTULO_PORTE: Record<string, string> = {
  DEMAIS: "acima de EPP",
  EPP: "EPP ou maior",
  ME: "ME ou maior",
};

/**
 * Frase curta para o controle na tela. Descreve o que o filtro FAZ, não o nome dos campos:
 * "porte DEMAIS" não quer dizer nada para quem não lê tabela da Receita.
 */
export function descreveFiltroPadrao(padrao: FiltroPadrao): string {
  const porte = padrao.portes.length === 1 ? ROTULO_PORTE[padrao.portes[0]] : padrao.portes.join("/");
  return `porte ${porte ?? padrao.portes.join("/")} · fundada até ${padrao.maxAnoFundacao}`;
}
