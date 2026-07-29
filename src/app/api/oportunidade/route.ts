import { NextRequest, NextResponse } from "next/server";
import { createUserClient } from "@/lib/supabase-server";
import { escopoAtual } from "@/lib/escopo";
import { registrarSalvou, registrarEstagio } from "@/lib/evento";
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
       origem, selado_em, proveniencia_hash, novo_para_setter, escopo_id,
       firma:escopo_id (nome),
       empresa:empresa_id (
         id, cnpj, razao_social, nome_fantasia, cnae_principal_desc,
         municipio, uf, capital_social, porte, telefone, email,
         socio(nome, faixa_etaria)
       ),
       interacoes:interacao(criado_em)`
    )
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  /* `escopoProprio` vai junto porque staff lê através das firmas (policy da 0013)
     e a lista chega misturada. Sem saber qual é a própria org, a tela não teria
     como escolher o padrão do filtro, e o pipeline abriria com oportunidade de
     testador no meio da do cliente, sem nada indicando de quem é. */
  return NextResponse.json({
    oportunidades: data ?? [],
    escopoProprio: await escopoAtual(),
  });
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

  /* escopo_id explícito, não pelo default da coluna. O default é a org Setter, o
     que fazia isto "funcionar" pra ela e falhar pra qualquer outra firma: a
     policy da 0011 recusa gravar com escopo que não é o seu.

     E o onConflict acompanha o unique, que a 0010 trocou de `empresa_id` pra
     `(escopo_id, empresa_id)` — com dois clientes, "uma empresa entra na
     watchlist uma vez só" não pode ser global. Ficou apontando pro antigo e
     salvar oportunidade passou a devolver 500 pra todo mundo. */
  const escopoId = await escopoAtual();

  const { data, error } = await supabase
    .from("oportunidade")
    .upsert(
      { empresa_id: empresaId, escopo_id: escopoId, score_no_save: scoreNoSave, updated_at: new Date().toISOString() },
      { onConflict: "escopo_id,empresa_id", ignoreDuplicates: false }
    )
    .select("id, estagio, score_no_save")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  /* Rótulo positivo do loop: esta empresa, com ESTE score, foi escolhida. Vale
     junto com o evento de busca — lá está a lista inteira que ele viu e não
     escolheu, que é a metade cara de conseguir. */
  await registrarSalvou(supabase, empresaId, scoreNoSave);

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
  /* Lê o estágio ANTES de escrever pra o evento guardar de-onde→pra-onde. Só o
     destino não conta a história: "voltou de qualificada pra a_analisar" é sinal
     de score errado, e "avançou" é o contrário. */
  const { data: antes } = await supabase
    .from("oportunidade").select("estagio, empresa_id").eq("id", id).maybeSingle();

  /* maybeSingle, não single: com RLS, oportunidade de outra firma simplesmente
     não existe pra esta sessão, e o `single()` estourava com "Cannot coerce the
     result to a single JSON object" — 500 com mensagem crua do PostgREST pra uma
     situação que é 404. Medido: testador de outra org tentando mover o estágio de
     uma oportunidade da Setter. O dado ficou intacto (a policy recusou), só a
     resposta estava errada. */
  const { data, error } = await supabase
    .from("oportunidade")
    .update(patch)
    .eq("id", id)
    .select("id, estagio, resultado, notas")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) {
    return NextResponse.json({ error: "oportunidade não encontrada" }, { status: 404 });
  }

  // Só quando o estágio de fato mudou: editar uma nota não é movimento de funil.
  if (patch.estagio && antes && antes.estagio !== patch.estagio) {
    await registrarEstagio(supabase, antes.empresa_id as string, antes.estagio as string, String(patch.estagio));
  }

  return NextResponse.json({ oportunidade: data });
}

// DELETE — remove da watchlist (?id=...).
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id vazio" }, { status: 400 });

  /* `.select()` pra saber QUANTAS linhas saíram. Sem isto, DELETE que não apagou
     nada devolvia `200 {ok:true}` — a API afirmando sucesso sobre um no-op.
     Medido: testador de outra firma pedindo o delete de uma oportunidade da
     Setter. A policy recusou (o dado ficou intacto, que é o que importa), mas a
     resposta dizia que deu certo. Numa UI otimista a linha desapareceria da tela
     e voltaria no refresh, e o mesmo silêncio esconderia falha de verdade. */
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("oportunidade")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) {
    return NextResponse.json({ error: "oportunidade não encontrada" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
