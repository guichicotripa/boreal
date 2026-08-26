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
  /* Tira os optantes pelo Simples Nacional.
   *
   * Fernanda apontou o furo em 26/08/2026: "tem algumas empresas que têm porte DEMAIS, porém são
   * optantes pelo Simples, ou seja, faturam menos de R$ 4,8 MM. Não fazem sentido para nós." Ela
   * conferia uma por uma no CNPJ.biz. Medido no mesmo dia: 28% do universo qualificado do Foco A,
   * 35% do Foco B, 13% do death care.
   *
   * Não é redundante com `portes`: são as duas metades da MESMA pergunta (a empresa fatura acima
   * de R$ 4,8 milhões?). `porte = DEMAIS` diz que a Receita a classificou acima do teto; a opção
   * pelo Simples diz que ela declara estar abaixo. Quando os dois discordam, o Simples vence,
   * porque é opção ativa e anual, e o porte é herdado de cadastro que ninguém atualiza. */
  excluirSimples?: boolean;
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
    excluirSimples: padrao.excluirSimples ?? false,
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
  const partes = [`porte ${porte ?? padrao.portes.join("/")}`, `fundada até ${padrao.maxAnoFundacao}`];
  // "fora do Simples" e não "opcao_simples = false": o rótulo tem que dizer o efeito pra quem opera.
  if (padrao.excluirSimples) partes.push("fora do Simples");
  return partes.join(" · ");
}

/* ── O regime tributário como FATO na tela ────────────────────────────────────
 *
 * Não basta filtrar: a informação é do originador, não só do filtro. Ela conferia isso a mão no
 * CNPJ.biz, então mostrar na linha economiza a ida mesmo quando o corte está desligado.
 *
 * Três estados, e o do meio é o mais valioso e o mais fácil de vender errado:
 *
 *   optante         fatura < R$ 4,8 MM/ano. É o que o corte tira.
 *   saiu em AAAA    deixou o Simples naquele ano. DUAS causas OPOSTAS: estourou o teto de receita
 *                   (cresceu, é alvo) OU entrou sócio PJ, que a LC 123 proíbe (foi adquirida).
 *                   Também pode ser débito tributário, CNAE vedado ou opção própria.
 *                   Por isso o rótulo diz "saiu do Simples" e NUNCA "fatura mais de R$ 4,8 MM":
 *                   é sinal, não prova, e a diferença importa numa tela de cliente.
 *   fora            nunca optou. Lucro Real ou Presumido desde sempre.
 */
export type Regime = { rotulo: string; tom: "negativo" | "positivo" | "neutro" } | null;

export function regimeTributario(e: {
  opcao_simples?: boolean | null;
  data_exclusao_simples?: string | null;
}): Regime {
  // NULL não é "não é optante": é "ainda não verificado". Inventar um rótulo aqui seria pior que
  // não mostrar nada, porque a tela passaria a afirmar algo que o banco não sabe.
  if (e.opcao_simples == null) return null;
  if (e.opcao_simples) return { rotulo: "Simples Nacional", tom: "negativo" };
  const ano = e.data_exclusao_simples?.slice(0, 4);
  if (ano) return { rotulo: `Saiu do Simples em ${ano}`, tom: "positivo" };
  return { rotulo: "Fora do Simples", tom: "neutro" };
}
