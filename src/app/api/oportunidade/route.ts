import { NextRequest, NextResponse } from "next/server";
import { createUserClient } from "@/lib/supabase-server";
import { calcScore } from "@/lib/scoring";
import type { Empresa } from "@/lib/types";

export const runtime = "nodejs";

const ESTAGIOS = ["identificado", "abordado", "em_conversa", "qualificado", "entregue", "arquivado"] as const;
type Estagio = (typeof ESTAGIOS)[number];
const RESULTADOS = ["pendente", "receptivo", "nao_receptivo", "deal_fechado", "perdido"] as const;
type Resultado = (typeof RESULTADOS)[number];

// GET — lista a watchlist com os dados da empresa (pra montar o pipeline na UI).
export async function GET() {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("oportunidade")
    .select(
      `id, estagio, resultado, notas, dono, proxima_acao, proxima_acao_em, score_no_save, created_at,
       origem, selado_em, proveniencia_hash, novo_para_setter,
       empresa:empresa_id (
         id, cnpj, razao_social, nome_fantasia, cnae_principal_desc,
         municipio, uf, capital_social, porte, telefone, email,
         socio(nome, faixa_etaria)
       ),
       interacoes:interacao(criado_em)`
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

  const supabase = await createUserClient();

  // Snapshot do score no momento do save = o "previsto" do loop de outcome. Computado no servidor
  // a partir dos sócios (não confia no client). Idempotente: só grava na primeira vez (não sobrescreve
  // o previsto histórico se a empresa for re-salva).
  const { data: emp } = await supabase
    .from("empresa")
    .select("id, data_inicio_atividade, porte, socio(faixa_etaria, data_entrada_sociedade)")
    .eq("id", empresaId)
    .single();
  const scoreNoSave = emp ? calcScore(emp as unknown as Empresa).score : null;

  const { data, error } = await supabase
    .from("oportunidade")
    .upsert(
      { empresa_id: empresaId, score_no_save: scoreNoSave, updated_at: new Date().toISOString() },
      { onConflict: "empresa_id", ignoreDuplicates: false }
    )
    .select("id, estagio, score_no_save")
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
  const b = body as {
    id?: string; estagio?: string; resultado?: string; notas?: string;
    dono?: string; proxima_acao?: string; proxima_acao_em?: string | null;
  };
  const id = String(b?.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "id vazio" }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (b.estagio !== undefined) {
    if (!ESTAGIOS.includes(b.estagio as Estagio)) {
      return NextResponse.json({ error: "estágio inválido" }, { status: 400 });
    }
    patch.estagio = b.estagio;
  }
  if (b.resultado !== undefined) {
    if (!RESULTADOS.includes(b.resultado as Resultado)) {
      return NextResponse.json({ error: "resultado inválido" }, { status: 400 });
    }
    patch.resultado = b.resultado;
  }
  if (b.notas !== undefined) patch.notas = String(b.notas);
  if (b.dono !== undefined) patch.dono = b.dono ? String(b.dono) : null;
  if (b.proxima_acao !== undefined) patch.proxima_acao = b.proxima_acao ? String(b.proxima_acao) : null;
  if (b.proxima_acao_em !== undefined) {
    patch.proxima_acao_em = b.proxima_acao_em ? String(b.proxima_acao_em) : null;
  }

  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("oportunidade")
    .update(patch)
    .eq("id", id)
    .select("id, estagio, resultado, notas")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ oportunidade: data });
}

// DELETE — remove da watchlist (?id=...).
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id vazio" }, { status: 400 });

  const supabase = await createUserClient();
  const { error } = await supabase.from("oportunidade").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
