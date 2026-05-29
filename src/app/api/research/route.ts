import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { calcScore } from "@/lib/scoring";
import { investigarEmpresa } from "@/lib/research";
import type { Empresa, ResearchResult } from "@/lib/types";
import researchCache from "@/lib/research-cache.json";

// Agent SDK spawna o Claude Code (assinatura) → runtime Node. Investigação é lenta (~1-2min).
export const runtime = "nodejs";
export const maxDuration = 180;

// Cache de research das empresas-top dos demos → clique instantâneo no Loom.
const CACHE = researchCache as Record<string, ResearchResult>;

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

  // Cache hit → resposta instantânea (top dos demos pré-investigado).
  const skipCache = req.nextUrl.searchParams.get("fresh") === "1";
  if (!skipCache && CACHE[empresaId]) {
    return NextResponse.json({ research: CACHE[empresaId], cached: true });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("empresa")
    .select(
      `id, cnpj, razao_social, nome_fantasia, cnae_principal, cnae_principal_desc,
       natureza_juridica, municipio, uf, data_inicio_atividade, capital_social, porte,
       socio(id, nome, qualificacao, faixa_etaria, data_entrada_sociedade)`
    )
    .eq("id", empresaId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "empresa não encontrada" }, { status: 404 });
  }

  const empresa = data as Empresa;
  empresa.score = calcScore(empresa); // garante score v0 antes de investigar

  try {
    const research = await investigarEmpresa(empresa);
    return NextResponse.json({ research });
  } catch (err) {
    console.error("Research falhou:", (err as Error).message);
    return NextResponse.json({ error: "falha na investigação" }, { status: 500 });
  }
}
