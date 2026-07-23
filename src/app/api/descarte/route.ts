import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { listarDescartadas } from "@/lib/descarte-store";

/* Descarte de empresa no Radar.
   POST   { empresaId, motivo? } → descarta (idempotente via upsert na PK)
   DELETE { empresaId }          → restaura (o "desfazer" da UI)
   GET                           → lista as descartadas

   Escopo global: o gate é senha única, não há usuário (ver lib/gate.ts). */

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const empresaId = String((body as { empresaId?: string })?.empresaId ?? "").trim();
  if (!empresaId) return NextResponse.json({ error: "empresaId obrigatório" }, { status: 400 });

  const motivoBruto = (body as { motivo?: string })?.motivo;
  const motivo = typeof motivoBruto === "string" && motivoBruto.trim() ? motivoBruto.trim() : null;

  try {
    const supabase = createAdminClient();
    // upsert na PK: descartar duas vezes não é erro, só atualiza o motivo.
    const { error } = await supabase
      .from("empresa_descartada")
      .upsert({ empresa_id: empresaId, motivo }, { onConflict: "empresa_id" });
    if (error) throw new Error(error.message);
    return NextResponse.json({ descartada: true, empresaId });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const empresaId = String((body as { empresaId?: string })?.empresaId ?? "").trim();
  if (!empresaId) return NextResponse.json({ error: "empresaId obrigatório" }, { status: 400 });

  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("empresa_descartada")
      .delete()
      .eq("empresa_id", empresaId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ restaurada: true, empresaId });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const descartadas = await listarDescartadas(createAdminClient());
    return NextResponse.json({ descartadas });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
