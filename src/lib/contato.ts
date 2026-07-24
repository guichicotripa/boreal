/* Procedência do contato — de quem é esse e-mail, de verdade.

   O e-mail que vem do registro da Receita é o do RESPONSÁVEL PELO CADASTRO, que
   em empresa familiar frequentemente é o escritório de contabilidade. Medido na
   base: ~19% são de contabilidade e ~44% são webmail. Mostrar os três como
   "Contato" faz o originador mandar a abordagem pro contador achando que é o dono.

   Os três casos pedem tratamento DIFERENTE, e nenhum é "ruim":
     · contabilidade → intermediário; o contador costuma ser gatekeeper e às vezes
       é o melhor caminho pra sucessão, mas não é o decisor. Tem que ser explícito.
     · pessoal       → webmail do sócio. Em empresa familiar isso é linha DIRETA,
       muitas vezes o melhor contato que existe. Não é defeito.
     · empresa       → domínio próprio, canal institucional. */

export type ProcedenciaEmail = "contabilidade" | "pessoal" | "empresa";

// Provedores de webmail comuns no Brasil.
const WEBMAIL = new Set([
  "gmail.com", "hotmail.com", "hotmail.com.br", "outlook.com", "outlook.com.br",
  "yahoo.com", "yahoo.com.br", "uol.com.br", "bol.com.br", "terra.com.br",
  "ig.com.br", "live.com", "msn.com", "globo.com", "r7.com", "superig.com.br",
  "zipmail.com.br", "globomail.com", "oi.com.br", "itelefonica.com.br",
  // Variantes que aparecem na base sem o .br ou fora do padrão.
  "uol.com", "gmail.com.br", "icloud.com", "me.com", "aol.com",
  "protonmail.com", "proton.me", "yandex.com",
]);
// Sobra ~0,1% com domínio digitado errado no cadastro da Receita ("gmail.comr",
// "hotmail.om"). Não vale corrigir por fuzzy: o risco de falso positivo em
// domínio real de empresa é maior que o ganho.

// Escritório contábil / assessoria. Casa no domínio E na parte local
// (contato@pmecontabil.com.br cai pelo domínio; contabilidade@empresa.com pela local).
const CONTABIL = /contab|contador|contadoria|assessor|escritorio|escritório|conta[dt]il/i;

export function procedenciaEmail(email: string | null | undefined): ProcedenciaEmail | null {
  if (!email) return null;
  const limpo = email.trim().toLowerCase();
  // Normaliza o domínio: o dado da Receita traz lixo como "gmail.com." (ponto
  // final), que sem isto escapa da lista de webmail e vira "institucional".
  const dominio = (limpo.split("@")[1] ?? "").replace(/[.\s]+$/, "");
  if (!dominio) return null;
  if (CONTABIL.test(limpo)) return "contabilidade";
  if (WEBMAIL.has(dominio)) return "pessoal";
  return "empresa";
}

/** Rótulo curto pra UI. Descritivo, não valorativo — os três são úteis, de formas diferentes. */
export const PROCEDENCIA_LABEL: Record<ProcedenciaEmail, string> = {
  contabilidade: "contabilidade",
  pessoal: "pessoal",
  empresa: "institucional",
};

/** Explicação no hover — é aqui que o originador entende o que fazer com o contato. */
export const PROCEDENCIA_TITULO: Record<ProcedenciaEmail, string> = {
  // Vale pros dois casos que aparecem na base: escritório contábil externo
  // (pmecontabil.com.br) e departamento contábil no domínio próprio
  // (contabilidade@empresa.com.br). Nos dois é gatekeeper, não decisor.
  contabilidade:
    "Endereço de contabilidade, do escritório externo ou do departamento. Costuma ser gatekeeper: caminho pro sócio, mas não é o decisor.",
  pessoal:
    "Webmail pessoal do responsável pelo cadastro. Em empresa familiar costuma ser linha direta com o sócio.",
  empresa:
    "Domínio próprio da empresa. Canal institucional, pode cair em secretaria ou caixa genérica.",
};
