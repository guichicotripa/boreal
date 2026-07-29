/* Identidade da requisição atual — server-only.
 *
 * Uma pergunta, um lugar: "quem está pedindo isto, e de que firma?". Antes a
 * resposta era "não dá pra saber", porque o gate era senha única compartilhada.
 *
 * Tudo aqui é memoizado por request com `cache()` do React: `escopoAtual()` é
 * chamada mais de uma vez na mesma rota (a /api/search chama em dois pontos), e
 * sem isso cada chamada viraria uma ida ao banco pra buscar a mesma linha.
 */
import { cache } from "react";
import { createUserClient } from "./supabase-server";

export type Membro = {
  userId: string;
  orgId: string;
  nome: string | null;
  papel: string;
  email: string | null;
};

/** Usuário autenticado, ou null. Usa getUser() (valida no servidor do Supabase). */
export const usuarioAtual = cache(async () => {
  const supabase = await createUserClient();
  /* getUser() e NÃO getSession(): getSession lê o cookie e confia nele, o que é
     forjável do lado do cliente. getUser valida o JWT contra o Supabase. Em
     código de servidor que decide acesso, a diferença é de segurança. */
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
});

/** Vínculo do usuário com a firma. null se não está logado OU não foi convidado. */
export const membroAtual = cache(async (): Promise<Membro | null> => {
  const user = await usuarioAtual();
  if (!user) return null;

  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("membro")
    .select("user_id, org_id, nome, papel")
    .eq("user_id", user.id)
    .maybeSingle();

  /* Sem linha em `membro` = autenticou no Supabase mas ninguém o convidou pra uma
     firma. Não é erro de sistema, é acesso não concedido: quem chamar decide o
     que fazer (a middleware manda pra tela de acesso). O convite é ato
     administrativo, feito por script com service_role — não há auto-cadastro. */
  if (error || !data) return null;

  return {
    userId: data.user_id,
    orgId: data.org_id,
    nome: data.nome,
    papel: data.papel,
    email: user.email ?? null,
  };
});
