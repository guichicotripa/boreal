import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";

const ESTAGIOS = ["a_analisar", "qualificada", "apresentada", "descartada"] as const;
type Estagio = (typeof ESTAGIOS)[number];

// GET — lista a watchlist com os dados da empresa (pra montar o pipeline na UI).
export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("oportunidade")
    .select(
      `id, estagio, notas, created_at,
       empresa:empresa_id (
         id, cnpj, razao_social, nome_fantasia, cnae_principal_desc,
         municipio, uf, capital_social, porte, telefone, email
       )`
    )
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ oportunidades: data ?? [] });
}

// POST — salva uma empresa na watchlist (idempotente por empresa_id).
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const empresaId = String((body as { empresaId?: string })?.empresaId ?? "").trim();
  if (!empresaId) return NextResponse.json({ error: "empresaId vazio" }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("oportunidade")
    .upsert({ empresa_id: empresaId, updated_at: new Date().toISOString() }, { onConflict: "empresa_id" })
    .select("id, estagio")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ oportunidade: data });
}

// PATCH — move o estágio ou atualiza notas.
export async function PATCH(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const b = body as { id?: string; estagio?: string; notas?: string };
  const id = String(b?.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "id vazio" }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (b.estagio !== undefined) {
    if (!ESTAGIOS.includes(b.estagio as Estagio)) {
      return NextResponse.json({ error: "estágio inválido" }, { status: 400 });
    }
    patch.estagio = b.estagio;
  }
  if (b.notas !== undefined) patch.notas = String(b.notas);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("oportunidade")
    .update(patch)
    .eq("id", id)
    .select("id, estagio, notas")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ oportunidade: data });
}

// DELETE — remove da watchlist (?id=...).
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id vazio" }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase.from("oportunidade").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
