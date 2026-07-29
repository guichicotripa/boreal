import { NextRequest, NextResponse } from "next/server";
import { createUserClient } from "@/lib/supabase-server";
import { calcScore } from "@/lib/scoring";
import { similaridade, divisaoCnae } from "@/lib/similar";
import type { Empresa } from "@/lib/types";

export const runtime = "nodejs";

// POST {empresaId} — dada uma empresa, devolve as mais parecidas do universo (look-alike).
// "Achei uma boa, me dá mais como esta." Mesma divisão CNAE como candidato; rankeia por similaridade
// (CNAE + praça + porte + época) e desempata pelo score de sucessão.
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

  // 1. Empresa-semente (só o perfil que importa pra similaridade).
  const { data: seed, error: seedErr } = await supabase
    .from("empresa")
    .select("id, razao_social, cnae_principal, municipio, uf, porte, data_inicio_atividade")
    .eq("id", empresaId)
    .single();
  if (seedErr || !seed) {
    return NextResponse.json({ error: seedErr?.message ?? "empresa não encontrada" }, { status: 404 });
  }

  const div = divisaoCnae(seed);
  if (!div) return NextResponse.json({ seed: { razao_social: seed.razao_social }, similares: [] });

  // 2. Candidatos: mesma divisão CNAE, com quadro societário, menos a própria.
  const { data, error } = await supabase
    .from("empresa")
    .select(
      `id, cnpj, razao_social, nome_fantasia, cnae_principal, cnae_principal_desc,
       cnaes_secundarios, natureza_juridica, municipio, uf, data_inicio_atividade,
       capital_social, porte, telefone, email,
       socio(id, nome, qualificacao, faixa_etaria, data_entrada_sociedade)`
    )
    .like("cnae_principal", `${div}%`)
    .neq("id", empresaId)
    .limit(300);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 3. Rankeia por similaridade (corte mínimo), desempata por score de sucessão.
  const similares = (data ?? [] as Empresa[])
    .map((c) => {
      const e = c as Empresa;
      return { ...e, score: calcScore(e), similaridade: similaridade(seed, e) };
    })
    .filter((x) => x.similaridade.pontos >= 20)
    .sort(
      (a, b) =>
        b.similaridade.pontos - a.similaridade.pontos ||
        (b.score?.score ?? 0) - (a.score?.score ?? 0)
    )
    .slice(0, 12);

  return NextResponse.json({ seed: { razao_social: seed.razao_social }, similares });
}
