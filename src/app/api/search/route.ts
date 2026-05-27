import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { parseQueryLLM } from "@/lib/llm";
import { parseQueryHeuristic } from "@/lib/query-parser";

// Agent SDK spawna um subprocesso (Claude Code) → precisa do runtime Node, não Edge.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const queryText = String((body as { query?: string })?.query ?? "").trim();
  if (!queryText) {
    return NextResponse.json({ error: "query vazia" }, { status: 400 });
  }

  // ── 1. NL → filtros (LLM via Agent SDK; cai no heurístico se falhar) ─────────
  let filters;
  let parsedBy: "llm" | "heuristic";
  try {
    filters = await parseQueryLLM(queryText);
    parsedBy = "llm";
  } catch (err) {
    console.error("LLM parse falhou, usando heurístico:", (err as Error).message);
    filters = parseQueryHeuristic(queryText);
    parsedBy = "heuristic";
  }

  // ── 2. Monta e roda a query no Supabase ──────────────────────────────────────
  const supabase = createAdminClient();

  // Se filtra por idade do sócio, usa inner join (só empresas COM sócio que bate).
  const socioEmbed = filters.minFaixaEtaria != null ? "socio!inner" : "socio";
  let q = supabase
    .from("empresa")
    .select(
      `id, cnpj, razao_social, nome_fantasia, cnae_principal, municipio, uf,
       data_inicio_atividade, capital_social, porte,
       ${socioEmbed}(id, nome, qualificacao, faixa_etaria, data_entrada_sociedade)`
    );

  // CNAE: OR de LIKE por prefixo (no .or() o wildcard é '*', não '%')
  if (filters.cnaePrefixes.length > 0) {
    const orClause = filters.cnaePrefixes
      .map((p) => `cnae_principal.like.${p}*`)
      .join(",");
    q = q.or(orClause);
  }

  if (filters.minFaixaEtaria != null) {
    q = q.gte("socio.faixa_etaria", String(filters.minFaixaEtaria));
  }

  if (filters.maxAnoFundacao != null) {
    q = q.lte("data_inicio_atividade", `${filters.maxAnoFundacao}-12-31`);
  }

  q = q.limit(filters.limit);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    filters,
    parsedBy,
    count: data?.length ?? 0,
    empresas: data ?? [],
  });
}
