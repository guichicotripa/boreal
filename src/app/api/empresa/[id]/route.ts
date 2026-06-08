import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { calcScore } from "@/lib/scoring";
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

  const supabase = createAdminClient();
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

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "empresa não encontrada" }, { status: 404 });
  }

  const empresa = data as Empresa;
  empresa.score = calcScore(empresa); // score v0 determinístico (a investigação eleva para v1 sob demanda)

  return NextResponse.json({ empresa });
}
