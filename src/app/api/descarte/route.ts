import { NextRequest, NextResponse } from "next/server";
import { createUserClient } from "@/lib/supabase-server";
import { escopoAtual } from "@/lib/escopo";
import { descartar, restaurar, listarDescartadasDetalhado } from "@/lib/descarte-store";
import { registrarDescartou } from "@/lib/evento";

/* Descarte de empresa no Radar.
   POST   { empresaId, motivo? } → descarta (idempotente)
   DELETE { empresaId }          → restaura (o "desfazer" da UI)
   GET                           → lista as descartadas do escopo

   O escopo vem de `escopoAtual()`, NUNCA do corpo da requisição: escopo enviado
   pelo cliente é escopo forjável. Hoje é constante (ver lib/escopo.ts). */

export const runtime = "nodejs";

// Extrai e valida o empresaId do corpo — mesmo contrato no POST e no DELETE.
async function lerEmpresaId(req: NextRequest): Promise<
  { ok: true; empresaId: string; motivo: string | null } | { ok: false; resp: NextResponse }
> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { ok: false, resp: NextResponse.json({ error: "JSON inválido" }, { status: 400 }) };
  }
  const empresaId = String((body as { empresaId?: string })?.empresaId ?? "").trim();
  if (!empresaId) {
    return { ok: false, resp: NextResponse.json({ error: "empresaId obrigatório" }, { status: 400 }) };
  }
  const bruto = (body as { motivo?: string })?.motivo;
  const motivo = typeof bruto === "string" && bruto.trim() ? bruto.trim() : null;
  return { ok: true, empresaId, motivo };
}

export async function POST(req: NextRequest) {
  const lido = await lerEmpresaId(req);
  if (!lido.ok) return lido.resp;
  try {
    const supabase = await createUserClient();
    await descartar(supabase, await escopoAtual(), lido.empresaId, lido.motivo);
    /* Rotulo NEGATIVO, o mais escasso e o mais informativo: o motivo escrito a
       mao diz o que a heuristica nao enxerga. Uma lista com muito descarte pelo
       mesmo motivo e um eixo faltando no score. */
    await registrarDescartou(supabase, lido.empresaId, lido.motivo);
    return NextResponse.json({ descartada: true, empresaId: lido.empresaId });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const lido = await lerEmpresaId(req);
  if (!lido.ok) return lido.resp;
  try {
    await restaurar(await createUserClient(), await escopoAtual(), lido.empresaId);
    return NextResponse.json({ restaurada: true, empresaId: lido.empresaId });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const descartadas = await listarDescartadasDetalhado(await createUserClient(), await escopoAtual());
    return NextResponse.json({ descartadas, total: descartadas.length });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
