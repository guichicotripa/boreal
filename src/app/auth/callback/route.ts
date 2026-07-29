import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createUserClient } from "@/lib/supabase-server";

/* Volta do magic link: vira sessão e grava os cookies. Único ponto do app onde
   uma sessão nasce.

   Aceita as DUAS formas que o Supabase manda, e não é preciosismo:

   `token_hash` — o caminho que funciona na vida real. O link do email é de uso
     único, e provedor de email PRÉ-CARREGA link pra escanear: o Gmail consumiu o
     primeiro link deste projeto antes de qualquer humano clicar, e o clique
     legítimo chegou com "otp_expired". `verifyOtp` não depende de estado guardado
     no navegador, então sobrevive a isso.

   `code` — fluxo PKCE, usado quando o login começa e termina no mesmo navegador.
     Mais estrito (o código fica preso ao navegador que pediu), então continua
     aceito para quem cai nele. */

export const runtime = "nodejs";

/* `next` vem da URL, então é entrada não confiável: sem esta checagem alguém
   monta .../auth/callback?next=https://site-falso e usa o nosso domínio como
   trampolim de phishing (open redirect). Só caminho interno passa; `//host`
   também é externo, apesar de começar com barra. */
function destinoSeguro(bruto: string | null): string {
  if (!bruto || !bruto.startsWith("/") || bruto.startsWith("//")) return "/";
  return bruto;
}

const TIPOS_OTP = ["magiclink", "signup", "invite", "recovery", "email_change", "email"];

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const destino = destinoSeguro(params.get("next"));
  const erro = () => NextResponse.redirect(new URL("/acesso?erro=link", req.url));

  const supabase = await createUserClient();
  const tokenHash = params.get("token_hash");
  const code = params.get("code");

  if (tokenHash) {
    // `type` vem da URL: só valores conhecidos passam, senão é entrada crua no SDK.
    const tipo = params.get("type") ?? "magiclink";
    if (!TIPOS_OTP.includes(tipo)) return erro();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: tipo as EmailOtpType,
    });
    if (error) return erro();
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return erro();
  } else {
    return erro();
  }

  /* Link expirado, já usado ou adulterado cai no /acesso com o motivo. É melhor
     que uma tela de erro: o passo seguinte é sempre pedir outro link. */
  return NextResponse.redirect(new URL(destino, req.url));
}
