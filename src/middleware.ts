import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/* Porta de entrada do app. Duas funções, nesta ordem:
   1. renovar a sessão do Supabase (o access token dura 1h; sem esta renovação o
      usuário desloga no meio do uso, que é o bug mais chato desse tipo de auth);
   2. barrar quem não está logado.

   Substituiu o gate de senha única compartilhada. Não há mais escape hatch por
   variável de ambiente: o gate antigo passava TUDO quando BOREAL_GATE_PASSWORD
   não estava setada, e "modo aberto que depende de env" é exatamente o tipo de
   coisa que chega em produção por engano. Em dev também se entra por magic link.

   O que a middleware NÃO faz: checar se o usuário pertence a alguma firma. Isso
   custaria uma query ao banco em toda requisição. Como o login roda com
   `shouldCreateUser: false` e o convite cria o usuário e a linha em `membro`
   juntos, "autenticado sem firma" só existe se alguém mexer no banco à mão. Se
   existir, `escopoAtual()` recusa (ver lib/escopo.ts) e o único dado alcançável
   é o registro público de CNPJ. */

const PUBLICAS = ["/acesso", "/auth/callback"];

export async function middleware(request: NextRequest) {
  let resposta = NextResponse.next({ request });

  const { pathname } = request.nextUrl;

  /* Sem as variáveis do Supabase, FECHA. A versão anterior devolvia `resposta`,
     ou seja: um deploy que esquecesse de setar a env servia o app inteiro sem
     autenticação nenhuma, e nada na tela denunciaria isso. "Não derruba a
     request" é a atitude certa pra telemetria e a errada pra o portão. */
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    console.error("middleware: faltam NEXT_PUBLIC_SUPABASE_URL/ANON_KEY — negando tudo");
    return pathname.startsWith("/api/")
      ? NextResponse.json({ error: "servidor mal configurado" }, { status: 503 })
      : new NextResponse("Servidor mal configurado.", { status: 503 });
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (paraGravar) => {
        /* Dança obrigatória do @supabase/ssr: o cookie renovado precisa entrar na
           REQUEST (pra quem roda depois nesta mesma passagem já ver a sessão nova)
           E na RESPONSE (pra chegar no navegador). Gravar só num dos dois é a
           causa clássica do "desloga sozinho". */
        for (const { name, value } of paraGravar) request.cookies.set(name, value);
        resposta = NextResponse.next({ request });
        for (const { name, value, options } of paraGravar) resposta.cookies.set(name, value, options);
      },
    },
  });

  // getUser() valida o token no servidor do Supabase; getSession() só leria o
  // cookie, que é forjável. Esta chamada é o que dispara a renovação acima.
  const { data } = await supabase.auth.getUser();

  if (PUBLICAS.some((p) => pathname === p || pathname.startsWith(p + "/"))) return resposta;
  if (data.user) return resposta;

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const destino = request.nextUrl.clone();
  destino.pathname = "/acesso";
  destino.searchParams.set("next", pathname);
  return NextResponse.redirect(destino);
}

// Não intercepta assets estáticos nem imagens de OG/ícones.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|opengraph-image|.*\\.(?:svg|png|ico|txt)).*)"],
};
