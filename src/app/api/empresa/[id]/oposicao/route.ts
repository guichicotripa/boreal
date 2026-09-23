import { NextRequest, NextResponse } from "next/server";
import { createUserClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

const CANAIS = ["email", "telefone", "whatsapp", "pessoalmente", "outro"] as const;
type Canal = (typeof CANAIS)[number];

/* POST — registra que o titular pediu para não ser contatado (LGPD art. 18 §2º).
 *
 * A rota só REGISTRA o pedido. Quem apaga o contato é o banco: o trigger da migration 0021 limpa a
 * linha na hora e impede que o backfill da Receita a reescreva. Fazer a limpeza aqui, na rota,
 * repetiria a regra em dois lugares e deixaria o backfill livre para devolver o contato.
 *
 * NÃO HÁ DELETE AQUI DE PROPÓSITO. Reverter uma oposição é decisão sensível e fica com a Boreal,
 * pela service_role. A policy da 0021 também nega delete a usuário autenticado, então mesmo uma
 * chamada direta ao PostgREST não reverte.
 *
 * Idempotente: pedir duas vezes não é erro. O titular que repete o pedido está sendo claro, e a
 * resposta certa é "já está registrado", não 409. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id vazio" }, { status: 400 });

  let body: { motivo?: string; canal?: string } = {};
  try {
    body = await req.json();
  } catch {
    // corpo vazio é aceito: o pedido vale mesmo sem motivo
  }
  const canal: Canal | null = CANAIS.includes(body.canal as Canal) ? (body.canal as Canal) : null;
  if (body.canal && !canal) {
    return NextResponse.json({ error: `canal "${body.canal}" não existe` }, { status: 400 });
  }

  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "sessão expirada" }, { status: 401 });

  /* O CNPJ vem do banco, não do corpo: a chave da oposição é o CNPJ, e aceitar um CNPJ digitado
     deixaria qualquer um bloquear o contato de empresa que nem enxerga. Ler pela sessão do usuário
     também garante que ele só registra oposição em empresa que o contrato dele libera. */
  const { data: emp } = await supabase.from("empresa").select("cnpj").eq("id", id).single();
  if (!emp) return NextResponse.json({ error: "empresa não encontrada ou fora do seu contrato" }, { status: 404 });

  const { error } = await supabase.from("oposicao_contato").upsert(
    {
      cnpj: emp.cnpj,
      motivo: body.motivo ? String(body.motivo).slice(0, 500) : null,
      canal,
      registrado_por: auth.user.id,
    },
    { onConflict: "cnpj", ignoreDuplicates: true },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
