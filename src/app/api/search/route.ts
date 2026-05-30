import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { parseQueryLLM } from "@/lib/llm";
import { parseQueryHeuristic } from "@/lib/query-parser";
import { calcScore } from "@/lib/scoring";
import { reasonAboutEmpresas } from "@/lib/reasoner";
import type { Empresa, SearchResponse } from "@/lib/types";
import demoCache from "@/lib/demo-cache.json";

export const runtime = "nodejs";
export const maxDuration = 60;

// Normaliza a query pra casar com o cache: lowercase, sem acento, espaços colapsados.
function normalizeQuery(q: string): string {
  return q
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// cast via unknown: o JSON é gerado pelo próprio pipeline (confiável); evita quebrar
// o type-check a cada mudança no schema do score.
const CACHE = demoCache as unknown as Record<string, SearchResponse>;

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

  // ── 0. Cache dos demos canônicos — resposta instantânea e determinística ──────
  // Permite pular o cache com ?fresh=1 (útil pra rebuildar o cache).
  const skipCache = req.nextUrl.searchParams.get("fresh") === "1";
  if (!skipCache) {
    const hit = CACHE[normalizeQuery(queryText)];
    if (hit) {
      return NextResponse.json({ ...hit, cached: true });
    }
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
      `id, cnpj, razao_social, nome_fantasia, cnae_principal, cnae_principal_desc,
       cnaes_secundarios, natureza_juridica, municipio, uf,
       data_inicio_atividade, capital_social, porte, telefone, email,
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

  // ── 3. Score determinístico por empresa, ordenar desc ────────────────────────
  const empresas = (data ?? []) as Empresa[];
  const scored = empresas
    .map((e) => ({ ...e, score: calcScore(e) }))
    .sort((a, b) => (b.score?.score ?? 0) - (a.score?.score ?? 0));

  // ── 4. Reasoner LLM batched: one-liner + flags pro top 15 ────────────────────
  // Roda em paralelo com a resposta — se falhar, devolve sem insights (não quebra busca).
  let reasoned = false;
  let reasonedCount = 0;
  try {
    const insights = await reasonAboutEmpresas(scored, 15);
    const byId = new Map(insights.map((i) => [i.empresa_id, i]));
    for (const e of scored) {
      const ins = byId.get(e.id);
      if (ins) {
        e.insight = { one_liner: ins.one_liner, flags: ins.flags };
        reasonedCount++;
      }
    }
    reasoned = reasonedCount > 0;
  } catch (err) {
    console.error("Reasoner falhou (seguindo sem insights):", (err as Error).message);
  }

  return NextResponse.json({
    filters,
    parsedBy,
    count: scored.length,
    empresas: scored,
    reasoned,
    reasonedCount,
  });
}
