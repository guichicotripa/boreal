import { NextRequest, NextResponse } from "next/server";
import { createUserClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

const TIPOS = ["ligacao", "email", "reuniao", "whatsapp", "nota"] as const;
type Tipo = (typeof TIPOS)[number];

// GET ?oportunidade_id=... — log de toques de uma oportunidade (mais recente primeiro).
export async function GET(req: NextRequest) {
  const opId = req.nextUrl.searchParams.get("oportunidade_id");
  if (!opId) return NextResponse.json({ error: "oportunidade_id vazio" }, { status: 400 });

  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("interacao")
    .select("id, oportunidade_id, tipo, descricao, autor, criado_em")
    .eq("oportunidade_id", opId)
    .order("criado_em", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ interacoes: data ?? [] });
}

// POST — registra um toque.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const b = body as { oportunidade_id?: string; tipo?: string; descricao?: string; autor?: string };
  const opId = String(b?.oportunidade_id ?? "").trim();
  const descricao = String(b?.descricao ?? "").trim();
  if (!opId) return NextResponse.json({ error: "oportunidade_id vazio" }, { status: 400 });
  if (!descricao) return NextResponse.json({ error: "descrição vazia" }, { status: 400 });
  const tipo: Tipo = TIPOS.includes(b?.tipo as Tipo) ? (b!.tipo as Tipo) : "nota";

  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("interacao")
    .insert({ oportunidade_id: opId, tipo, descricao, autor: b?.autor ? String(b.autor) : null })
    .select("id, oportunidade_id, tipo, descricao, autor, criado_em")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ interacao: data });
}

// DELETE ?id=... — remove um toque.
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id vazio" }, { status: 400 });

  const supabase = await createUserClient();
  const { error } = await supabase.from("interacao").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
