import { NextRequest, NextResponse } from "next/server";
import { createUserClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

const TIPOS = ["ligacao", "email", "reuniao", "whatsapp", "nota"] as const;
type Tipo = (typeof TIPOS)[number];

/* Espelham os checks da migration 0020. Duplicar a lista aqui não é redundância inútil: sem isso,
   valor inválido só estouraria no banco, e o erro que chega na tela é a mensagem crua do Postgres.
   Validar antes devolve 400 com o nome do campo. */
const DESFECHOS = [
  "falou_com_decisor", "falou_com_empresa", "caiu_no_intermediario",
  "nao_atendeu", "contato_invalido", "recusou",
] as const;
const CANAIS = ["telefone", "email", "whatsapp", "site", "indicacao", "outro"] as const;
type Desfecho = (typeof DESFECHOS)[number];
type Canal = (typeof CANAIS)[number];

const CAMPOS = "id, oportunidade_id, tipo, descricao, autor, criado_em, desfecho, contato_tipo, contato_usado";

// GET ?oportunidade_id=... — log de toques de uma oportunidade (mais recente primeiro).
export async function GET(req: NextRequest) {
  const opId = req.nextUrl.searchParams.get("oportunidade_id");
  if (!opId) return NextResponse.json({ error: "oportunidade_id vazio" }, { status: 400 });

  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("interacao")
    .select(CAMPOS)
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
  const b = body as {
    oportunidade_id?: string; tipo?: string; descricao?: string; autor?: string;
    desfecho?: string; contato_tipo?: string; contato_usado?: string;
  };
  const opId = String(b?.oportunidade_id ?? "").trim();
  const descricao = String(b?.descricao ?? "").trim();
  if (!opId) return NextResponse.json({ error: "oportunidade_id vazio" }, { status: 400 });
  if (!descricao) return NextResponse.json({ error: "descrição vazia" }, { status: 400 });
  const tipo: Tipo = TIPOS.includes(b?.tipo as Tipo) ? (b!.tipo as Tipo) : "nota";

  /* Ausente vira `null`, e `null` quer dizer "ainda não registrado". Isso é deliberadamente
     diferente de `nao_atendeu`: quem não preencheu não disse que ninguém atendeu, e tratar os
     dois como a mesma coisa envenenaria o rótulo de treino com silêncio. */
  const desfecho: Desfecho | null = DESFECHOS.includes(b?.desfecho as Desfecho)
    ? (b!.desfecho as Desfecho)
    : null;
  if (b?.desfecho && !desfecho) {
    return NextResponse.json({ error: `desfecho "${b.desfecho}" não existe` }, { status: 400 });
  }
  const canal: Canal | null = CANAIS.includes(b?.contato_tipo as Canal) ? (b!.contato_tipo as Canal) : null;
  if (b?.contato_tipo && !canal) {
    return NextResponse.json({ error: `contato_tipo "${b.contato_tipo}" não existe` }, { status: 400 });
  }

  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("interacao")
    .insert({
      oportunidade_id: opId,
      tipo,
      descricao,
      autor: b?.autor ? String(b.autor) : null,
      desfecho,
      contato_tipo: canal,
      contato_usado: b?.contato_usado ? String(b.contato_usado).slice(0, 200) : null,
    })
    .select(CAMPOS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  /* "Disseram não" tem que ter consequência. Registrar a recusa e deixar a oportunidade como
     pendente é pior que não registrar: o próximo originador vê "pendente", liga de novo, e a mesma
     pessoa que já disse não recebe a segunda ligação. Ver `brain/pesquisa/lgpd-contato.md`.

     SÓ MEXE EM QUEM ESTÁ PENDENTE. Se alguém já marcou `receptivo` ou `deal_fechado` à mão, uma
     recusa registrada depois não pode apagar isso: pode ser recusa de outra pessoa da empresa, ou de
     outro assunto. A decisão humana explícita vence a automática.

     NÃO ARQUIVA. Recusa pode ser "agora não", e sumir com a empresa do pipeline esconderia a
     informação de quem já tentou. Ela continua visível, marcada como não receptiva. */
  let resultadoAtualizado = false;
  if (desfecho === "recusou") {
    const { data: upd } = await supabase
      .from("oportunidade")
      .update({ resultado: "nao_receptivo", updated_at: new Date().toISOString() })
      .eq("id", opId)
      .eq("resultado", "pendente")
      .select("id");
    resultadoAtualizado = (upd?.length ?? 0) > 0;
  }

  return NextResponse.json({ interacao: data, resultadoAtualizado });
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
