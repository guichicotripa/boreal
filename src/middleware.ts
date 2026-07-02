import { NextRequest, NextResponse } from "next/server";
import { gateToken, GATE_COOKIE } from "@/lib/gate";

// Gate de acesso: privatiza o app quando BOREAL_GATE_PASSWORD está setada. Sem ela, passa tudo.
const PUBLICAS = ["/acesso", "/api/acesso"];

export async function middleware(req: NextRequest) {
  if (!process.env.BOREAL_GATE_PASSWORD) return NextResponse.next(); // gate desligado

  const { pathname } = req.nextUrl;
  if (PUBLICAS.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();

  const cookie = req.cookies.get(GATE_COOKIE)?.value;
  if (cookie && cookie === (await gateToken())) return NextResponse.next();

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/acesso";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

// Não intercepta assets estáticos nem imagens de OG/ícones.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|opengraph-image|.*\\.(?:svg|png|ico|txt)).*)"],
};
