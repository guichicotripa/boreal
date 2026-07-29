import { NextRequest, NextResponse } from "next/server";
import { createUserClient } from "@/lib/supabase-server";
import { calcScore } from "@/lib/scoring";
import { lerScoresV1 } from "@/lib/research-store";
import type { Empresa } from "@/lib/types";

// GET canônico de uma empresa pelo id — devolve o objeto Empresa COMPLETO (sócios +
// score + breakdown). É a fonte de verdade da página /empresa/[id], que antes dependia
// só da ponte de sessionStorage (parcial quando aberta pela pipeline). Mesma query da
// rota de research, sem a parte de investigação.
export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "id vazio" }, { status: 400 });
  }

  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("empresa")
    .select(
      `id, cnpj, razao_social, nome_fantasia, cnae_principal, cnae_principal_desc,
       cnaes_secundarios, natureza_juridica, municipio, uf, data_inicio_atividade,
       capital_social, porte, telefone, email,
       socio(id, nome, qualificacao, faixa_etaria, data_entrada_sociedade)`
    )
    .eq("id", id)
    .single();

  /* Não repassa `error.message`: com RLS, empresa fora do contrato faz o
     `.single()` falhar e o PostgREST devolve "Cannot coerce the result to a
     single JSON object", que vazava direto pro cliente. Além de incompreensível,
     descrevia o mecanismo interno em vez do fato. Id inexistente e id fora do
     contrato dão a MESMA resposta de propósito: distinguir os dois contaria a
     quem não contratou um setor que aquela empresa existe. */
  if (error || !data) {
    return NextResponse.json(
      { error: "empresa não encontrada ou fora do seu contrato" },
      { status: 404 }
    );
  }

  const empresa = data as Empresa;
  empresa.score = calcScore(empresa); // score v0 determinístico (a investigação eleva para v1 sob demanda)

  // v1 já investigado (score_run) — a página abre direto com o número apurado, sem
  // esperar o research responder. Ausente = empresa nunca investigada.
  try {
    const v1 = await lerScoresV1(supabase, [id]);
    if (v1[id]) {
      empresa.score_v1 = {
        score: v1[id].score,
        delta: v1[id].score - (empresa.score?.score ?? v1[id].score),
        investigado_em: v1[id].investigado_em,
      };
    }
  } catch {
    // sem v1: a página mostra o v0 e a investigação preenche quando responder
  }

  return NextResponse.json({ empresa });
}
