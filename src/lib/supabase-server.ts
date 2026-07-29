/* Clientes Supabase que carregam a SESSÃO do usuário — server-only.
 *
 * Arquivo separado de `supabase.ts` de propósito: aqui importamos `next/headers`,
 * que só existe dentro do runtime do Next. Os scripts de lote importam
 * `supabase.ts` e quebrariam se o import de headers viesse junto.
 *
 * A diferença que importa:
 *   createAdminClient()  → service_role, IGNORA RLS. Pipeline, ingestão, lotes.
 *   createUserClient()   → JWT do usuário logado, RLS VALE. Todo request do app.
 *
 * Enquanto as rotas usavam createAdminClient, as policies da migration 0011 não
 * fariam efeito nenhum: a service_role passa por cima delas por definição. É por
 * isso que trocar o cliente e escrever as policies são a mesma tarefa, não duas.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function credenciais() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("Faltando NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return { url, anon };
}

/**
 * Cliente do usuário da requisição atual. Usa a chave anon mais o JWT da sessão,
 * então o Postgres enxerga `auth.uid()` e aplica as policies.
 */
export async function createUserClient() {
  const { url, anon } = credenciais();
  const cookieStore = await cookies();

  return createServerClient(url, anon, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (paraGravar) => {
        /* Server Component não pode gravar cookie e o Next lança se tentarmos.
           Ignorar é seguro AQUI porque o middleware roda antes de toda request e
           já renovou a sessão; este setAll só perde a gravação de um refresh que
           o middleware faria de novo no próximo request. Engolir exceção sem
           explicar seria bug escondido, por isso o comentário. */
        try {
          for (const { name, value, options } of paraGravar) cookieStore.set(name, value, options);
        } catch {
          // chamado de um Server Component: ver acima.
        }
      },
    },
  });
}
