/**
 * O que o reasoner pode e não pode escrever, e a checagem de que obedeceu.
 *
 * Existe porque o texto do reasoner fala de EMPRESAS E PESSOAS REAIS, nominalmente,
 * numa tela que o cliente lê. Na geração de 25/07/2026 saíram duas frases que não
 * podem chegar a um originador:
 *
 *   · "duplo risco senil"        — termo clínico e pejorativo sobre pessoas identificadas
 *   · "entrada suspeita 2023"    — insinua irregularidade a partir de nada além de
 *                                  uma data de entrada no quadro societário
 *
 * Nenhuma das duas é sustentada pelo dado: a base tem faixa etária e data de
 * entrada, não diagnóstico médico nem indício de ilícito. Além do risco reputacional
 * e jurídico, é o mesmo defeito de sempre em outra roupa — afirmar com confiança
 * algo que a fonte não diz.
 *
 * Duas camadas, de propósito: a instrução no prompt evita gerar, e o filtro evita
 * publicar. Prompt não é garantia; o filtro é a rede.
 */

/** Regra anexada ao system prompt do reasoner (cache e ao vivo). */
export const REGRA_LINGUAGEM =
  "REGRAS DE LINGUAGEM (obrigatórias, o texto é sobre empresas e pessoas reais e será lido por um cliente):\n" +
  "- NUNCA use termos clínicos ou pejorativos sobre a idade de alguém: nada de senil, senilidade, " +
  "decrépito, caduco, velhice, demência, doente. Idade avançada se descreve pela faixa etária e pronto.\n" +
  "- NUNCA insinue irregularidade, fraude, má-fé ou ilícito. Entrada tardia de sócio, holding no quadro " +
  "ou capital alto são fatos societários comuns — descreva o fato, não motivo oculto. Proibido: suspeito, " +
  "suspeita, fraude, laranja, irregular, manobra, esconde.\n" +
  "- NUNCA especule sobre saúde, morte ou capacidade mental de ninguém.\n" +
  "- Inferência de negócio é permitida e desejada (ex: 'entrada de holdings sugere estruturação " +
  "pré-saída'), desde que apoiada nos dados mostrados e escrita como leitura, não como acusação.";

/* Termos que não podem sair publicados. Curta e específica de propósito: lista
   grande demais começa a barrar texto legítimo (ex: "morte" aparece em razão
   social; "irregular" pode descrever intervalo de tempo). */
/* Sem `\b` no fim: no regex do JS as acentuadas não são caractere de palavra, então
   `\bm[áa]-f[ée]\b` nunca casa com "má-fé" (mesma armadilha do `\bpará\b` no
   query-parser). Cada alternativa fecha a própria fronteira onde ela faz sentido. */
const PROIBIDO =
  /\b(senil|senilidade|decr[ée]pit\w*|caduc[oa]\w*|velhice|dem[êe]ncia\b|demente\b|suspeit\w+|fraud\w+|laranja[s]?\b|m[áa]-f[ée])/i;

/** true se o texto tem termo que não pode ser publicado. */
export function violaLinguagem(texto: string): boolean {
  return PROIBIDO.test(texto);
}

export type InsightBruto = { empresa_id: string; one_liner: string; flags: string[] };

/**
 * Aplica a rede: descarta flags proibidas e, se a frase principal violar, descarta
 * o insight inteiro. Melhor a empresa aparecer sem comentário do que com comentário
 * que insinua algo sobre uma pessoa real.
 *
 * `razaoSocial` evita falso positivo do nome próprio — existe um "Colégio Augusto
 * Laranja" na base, e "laranja" é termo proibido no sentido de testa de ferro.
 */
export function filtrarInsight(
  ins: InsightBruto,
  razaoSocial?: string | null
): InsightBruto | null {
  const semNome = (t: string) => {
    if (!razaoSocial) return t;
    // Tira as palavras do nome da empresa antes de checar, para não barrar o
    // insight por causa do sobrenome de quem fundou o negócio.
    const palavras = razaoSocial.split(/\s+/).filter((p) => p.length > 3);
    return palavras.reduce((acc, p) => acc.replaceAll(new RegExp(p, "gi"), " "), t);
  };

  if (violaLinguagem(semNome(ins.one_liner))) return null;
  const flags = ins.flags.filter((f) => !violaLinguagem(semNome(f)));
  return { ...ins, flags };
}
