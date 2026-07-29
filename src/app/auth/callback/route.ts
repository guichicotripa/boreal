import { NextRequest, NextResponse } from "next/server";
import { createUserClient } from "@/lib/supabase-server";

/* Volta do magic link: troca o `code` por sessão e grava os cookies.
   É o único ponto do app onde uma sessão nasce. */

export const runtime = "nodejs";

/* `next` vem da URL, então é entrada não confiável: sem esta checagem alguém
   monta .../auth/callback?next=https://site-falso e usa o nosso domínio como
   trampolim de phishing (open redirect). Só caminho interno passa; `//host`
   também é externo, apesar de começar com barra. */
function destinoSeguro(bruto: string | null): string {
  if (!bruto || !bruto.startsWith("/") || bruto.startsWith("//")) return "/";
  return bruto;
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const destino = destinoSeguro(req.nextUrl.searchParams.get("next"));

  if (!code) return NextResponse.redirect(new URL("/acesso?erro=link", req.url));

  const supabase = await createUserClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  /* Link expirado ou já usado cai aqui. Mandar de volta pro /acesso com o motivo
     é melhor que uma tela de erro: o passo seguinte é sempre pedir outro link. */
  if (error) return NextResponse.redirect(new URL("/acesso?erro=link", req.url));

  return NextResponse.redirect(new URL(destino, req.url));
}
