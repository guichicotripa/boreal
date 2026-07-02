import { NextRequest, NextResponse } from "next/server";
import { gateToken, GATE_COOKIE } from "@/lib/gate";

export const runtime = "nodejs";

// POST { senha } — confere a senha do piloto e, se bater, seta o cookie de sessão assinado.
export async function POST(req: NextRequest) {
  const senhaCorreta = process.env.BOREAL_GATE_PASSWORD;
  if (!senhaCorreta) return NextResponse.json({ error: "gate desativado" }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const senha = String((body as { senha?: string })?.senha ?? "");
  if (senha !== senhaCorreta) return NextResponse.json({ error: "senha incorreta" }, { status: 401 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(GATE_COOKIE, await gateToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 dias
  });
  return res;
}
