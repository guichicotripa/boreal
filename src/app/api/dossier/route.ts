import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { calcScore } from "@/lib/scoring";
import { gerarDossierAnalise } from "@/lib/dossier";
import type { Empresa, DossierAnalise } from "@/lib/types";
import dossierCache from "@/lib/dossier-cache.json";

export const runtime = "nodejs";
export const maxDuration = 60;

// Cache de memos das empresas-chave dos demos → expandir é instantâneo no pitch (custo zero).
const CACHE = dossierCache as unknown as Record<string, DossierAnalise>;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const empresaId = String((body as { empresaId?: string })?.empresaId ?? "").trim();
  if (!empresaId) {
    return NextResponse.json({ error: "empresaId vazio" }, { status: 400 });
  }

  // Cache hit → memo instantâneo (a UI só usa `analise`; a empresa ela já tem da busca).
  const skipCache = req.nextUrl.searchParams.get("fresh") === "1";
  if (!skipCache && CACHE[empresaId]) {
    return NextResponse.json({ analise: CACHE[empresaId], cached: true });
  }

  // Busca a empresa completa (com sócios) — fonte da verdade, não confia no client.
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("empresa")
    .select(
      `id, cnpj, razao_social, nome_fantasia, cnae_principal, cnae_principal_desc,
       cnaes_secundarios, natureza_juridica, municipio, uf,
       data_inicio_atividade, capital_social, porte, telefone, email,
       socio(id, nome, qualificacao, faixa_etaria, data_entrada_sociedade)`
    )
    .eq("id", empresaId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "empresa não encontrada" }, { status: 404 });
  }

  const empresa = data as Empresa;
  empresa.score = calcScore(empresa);

  try {
    const analise = await gerarDossierAnalise(empresa);
    return NextResponse.json({ empresa, analise });
  } catch (err) {
    console.error("Dossier falhou:", (err as Error).message);
    return NextResponse.json({ error: "falha ao gerar análise" }, { status: 500 });
  }
}
