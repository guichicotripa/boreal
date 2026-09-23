/* Qualificação do sócio: o código da Receita virando o que a pessoa É na empresa.
 *
 * POR QUE EXISTE: a base guarda o CÓDIGO (`22`, `49`, `5`), e ele chegava assim até o fim. A tela
 * não mostrava nada, e o dossiê mandava "qualificacao: 22" para o modelo que escreve o memo. Nas
 * 31 empresas salvas pela Setter o campo está preenchido em 100% dos 126 sócios, e é a informação
 * que diz para quem ligar: sócio-administrador decide, sócio sem poder de gestão não.
 *
 * FONTE: "Tabela de Qualificação do Quadro de Sócios e Administradores" da Receita Federal, na
 * extração mantida em https://github.com/turicas/socios-brasil (qualificacao-socio.csv). A página
 * da própria Receita que publicava a tabela redireciona para a home desde pelo menos 23/09/2026.
 * Conferido contra a base: os 7 códigos das 31 salvas (5, 8, 10, 16, 22, 30, 49) estão todos aqui.
 *
 * DESCRIÇÃO TRANSCRITA COMO A RECEITA ESCREVE. Não resumir nem "melhorar": é o texto que o
 * originador vai achar se conferir no CNPJ.biz, e divergir disso gera desconfiança do dado todo. */

export const QUALIFICACAO: Record<number, string> = {
  1: "Acionista", 2: "Acionista Controlador", 3: "Acionista Diretor", 4: "Acionista Presidente",
  5: "Administrador", 6: "Administradora de consórcio de Empresas ou Grupo de Empresas",
  7: "Comissário", 8: "Conselheiro de Administração", 9: "Curador", 10: "Diretor",
  11: "Interventor", 12: "Inventariante", 13: "Liquidante", 14: "Mãe", 15: "Pai",
  16: "Presidente", 17: "Procurador", 18: "Secretário", 19: "Síndico (Condomínio)",
  20: "Sociedade Consorciada", 21: "Sociedade Filiada", 22: "Sócio", 23: "Sócio Capitalista",
  24: "Sócio Comanditado", 25: "Sócio Comanditário", 26: "Sócio de Indústria",
  27: "Sócio Residente ou Domiciliado no Exterior", 28: "Sócio-Gerente",
  29: "Sócio ou Acionista Incapaz ou Relativamente Incapaz (exceto menor)",
  30: "Sócio ou Acionista Menor (Assistido/Representado)", 31: "Sócio Ostensivo",
  32: "Tabelião", 33: "Tesoureiro", 34: "Titular de Empresa Individual Imobiliária", 35: "Tutor",
  36: "Gerente-Delegado", 37: "Sócio Pessoa Jurídica Domiciliado no Exterior",
  38: "Sócio Pessoa Física Residente ou Domiciliado no Exterior", 39: "Diplomata", 40: "Cônsul",
  41: "Representante de Organização Internacional", 42: "Oficial de Registro", 43: "Responsável",
  44: "Sócio Participante", 45: "Sócio Investidor", 46: "Ministro de Estado das Relações Exteriores",
  47: "Sócio Pessoa Física Residente no Brasil", 48: "Sócio Pessoa Jurídica Domiciliado no Brasil",
  49: "Sócio-Administrador", 50: "Empresário", 51: "Candidato a Cargo Político Eletivo",
  52: "Sócio com Capital", 53: "Sócio sem Capital", 54: "Fundador",
  55: "Sócio Comanditado Residente no Exterior",
  56: "Sócio Comanditário Pessoa Física Residente no Exterior",
  57: "Sócio Comanditário Pessoa Jurídica Domiciliado no Exterior", 58: "Sócio Comanditário Incapaz",
  59: "Produtor Rural", 60: "Cônsul Honorário", 61: "Responsável Indigena",
  62: "Representante das Instituições Extraterritoriais", 63: "Cotas em Tesouraria",
  64: "Administrador Judicial", 65: "Titular Pessoa Física Residente ou Domiciliado no Brasil",
  66: "Titular Pessoa Física Residente ou Domiciliado no Exterior",
  67: "Titular Pessoa Física Incapaz ou Relativamente Incapaz (exceto menor)",
  68: "Titular Pessoa Física Menor (Assistido/Representado)", 69: "Beneficiário Final",
  70: "Administrador Residente ou Domiciliado no Exterior",
  71: "Conselheiro de Administração Residente ou Domiciliado no Exterior",
  72: "Diretor Residente ou Domiciliado no Exterior", 73: "Presidente Residente ou Domiciliado no Exterior",
  74: "Sócio-Administrador Residente ou Domiciliado no Exterior",
  75: "Fundador Residente ou Domiciliado no Exterior", 76: "Protetor", 77: "Vice-Presidente",
  78: "Titular Pessoa Jurídica Domiciliada no Brasil", 79: "Titular Pessoa Jurídica Domiciliada no Exterior",
};

/* Quem assina pela empresa. É a pergunta que o originador faz antes de ligar: "com quem eu falo?".
   Sócio (22) sem cargo NÃO entra: tem quota, mas não administra, e ligar para ele é ligar para quem
   vai repassar. É o motivo de esta lista existir separada do dicionário. */
const COM_GESTAO = new Set([2, 3, 4, 5, 10, 16, 28, 49, 50, 64, 65, 70, 72, 73, 74, 77]);

/* Qualificações que só existem quando a sucessão JÁ está em curso ou já está desenhada:
   - 12 Inventariante: o dono morreu e o espólio está no quadro.
   - 30 e 68 menor, 29 e 67 incapaz: herdeiro que não responde por si, representado por alguém.
   - 35 Tutor e 9 Curador: aparecem justamente para representar o menor ou o incapaz.
   Isto é SINAL PARA MOSTRAR, não eixo do score. Peso novo no score só entra pelo protocolo de
   `brain/produto/modelo-de-score.md`, com lift medido. */
const SUCESSORIAS = new Set([9, 12, 29, 30, 35, 67, 68]);

function codigo(q: string | number | null | undefined): number | null {
  if (q == null || q === "") return null;
  const n = Number(String(q).trim());
  return Number.isInteger(n) ? n : null;
}

/** Descrição da Receita, ou `null` se o código não existe. Nunca devolve o código cru: número
 *  solto na tela é pior que nada, porque parece dado e não diz nada. */
export function descreveQualificacao(q: string | number | null | undefined): string | null {
  const c = codigo(q);
  return c != null ? QUALIFICACAO[c] ?? null : null;
}

export function temGestao(q: string | number | null | undefined): boolean {
  const c = codigo(q);
  return c != null && COM_GESTAO.has(c);
}

export function qualificacaoSucessoria(q: string | number | null | undefined): boolean {
  const c = codigo(q);
  return c != null && SUCESSORIAS.has(c);
}
