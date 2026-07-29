"use client";

/* Cliente Supabase do navegador. Existe por um motivo só: pedir o magic link e
 * finalizar a sessão. O resto do app não fala com o Supabase pelo browser — as
 * telas leem pelas rotas de API, que rodam no servidor.
 *
 * Precisa ser o `createBrowserClient` do @supabase/ssr, não o do supabase-js: só
 * este grava a sessão em COOKIE. O de supabase-js grava em localStorage, que o
 * servidor não enxerga, e aí middleware, Server Components e rotas continuariam
 * achando que ninguém está logado.
 */
import { createBrowserClient } from "@supabase/ssr";

export function supabaseNoBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("Faltando NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createBrowserClient(url, anon);
}
