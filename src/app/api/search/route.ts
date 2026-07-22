import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { parseQueryLLM } from "@/lib/llm";
import { parseQueryHeuristic } from "@/lib/query-parser";
import { calcScore } from "@/lib/scoring";
import { reasonAboutEmpresas } from "@/lib/reasoner";
import { lerScoresV1, aplicarV1 } from "@/lib/research-store";
import type { Empresa, Socio, SearchResponse } from "@/lib/types";
import demoCache from "@/lib/demo-cache.json";
import setoresData from "@/lib/setores.json";
import setorCache from "@/lib/setor-cache.json";

function cnaesDoSetor(id: string): string[] | null {
  return (setoresData.setores as { id: string; cnaes: string[] }[]).find((s) => s.id === id)?.cnaes ?? null;
}

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

// Overlay do v1 investigado sobre uma resposta pronta (inclusive as de cache estático).
// Sem isto, os chips de demo — que não tocam o banco — continuariam listando o v0 e as
// empresas já investigadas nunca subiriam na lista. Uma query indexada por ids.
async function comV1(resp: SearchResponse): Promise<SearchResponse> {
  const empresas = resp.empresas ?? [];
  if (empresas.length === 0) return resp;
  try {
    const supabase = createAdminClient();
    const v1 = await lerScoresV1(supabase, empresas.map((e) => e.id));
    if (Object.keys(v1).length === 0) return resp;
    return { ...resp, empresas: aplicarV1(empresas, v1) };
  } catch (err) {
    // Falhou a leitura do v1: serve o v0 (degrada, não quebra a busca).
    console.error("overlay de v1 falhou:", (err as Error).message);
    return resp;
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const queryText = String((body as { query?: string })?.query ?? "").trim();
  // Setor escolhido (página /setores) escopa os CNAEs — permite "trabalhar setor por setor".
  const setorId = String((body as { setor?: string })?.setor ?? "").trim();
  const setorCnaes = setorId ? cnaesDoSetor(setorId) : null;
  if (!queryText && !setorCnaes) {
    return NextResponse.json({ error: "query vazia" }, { status: 400 });
  }

  // ── 0. Cache — demos canônicos (texto) ou browse de setor (instantâneo no demo) ──
  const skipCache = req.nextUrl.searchParams.get("fresh") === "1";
  // Tese + setor (saúde/educação): chave composta `setor|tese`, pra ficar instantâneo como o
  // metalmec. Metalmec é o setor default (a home não manda setor) e cai no ramo de texto puro abaixo.
  if (!skipCache && queryText && setorId) {
    const hit = CACHE[`${setorId}|${normalizeQuery(queryText)}`];
    if (hit) {
      return NextResponse.json({ ...(await comV1(hit)), cached: true });
    }
  }
  if (!skipCache && queryText && !setorCnaes) {
    const hit = CACHE[normalizeQuery(queryText)];
    if (hit) {
      return NextResponse.json({ ...(await comV1(hit)), cached: true });
    }
  }
  // Browse de setor sem texto: serve do cache (saúde/educação ficam instantâneos como o metalmec).
  if (!skipCache && setorId && !queryText) {
    const hit = (setorCache.porSetor as Record<string, SearchResponse>)[setorId];
    if (hit) {
      return NextResponse.json({ ...(await comV1(hit)), cached: true });
    }
  }

  // ── 1. NL → filtros (LLM via Agent SDK; cai no heurístico se falhar) ─────────
  let filters;
  let parsedBy: "llm" | "heuristic";
  if (queryText) {
    try {
      filters = await parseQueryLLM(queryText);
      parsedBy = "llm";
    } catch (err) {
      console.error("LLM parse falhou, usando heurístico:", (err as Error).message);
      filters = parseQueryHeuristic(queryText);
      parsedBy = "heuristic";
    }
  } else {
    // Browse de setor sem texto: só o setor, ordenado por score.
    filters = { cnaePrefixes: [], minFaixaEtaria: null, maxAnoFundacao: null, limit: 50 };
    parsedBy = "heuristic";
  }

  // Setor escolhido sobrepõe os CNAEs inferidos (a praça/idade do NL seguem valendo).
  if (setorCnaes) filters.cnaePrefixes = setorCnaes;

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

  const empresas = (data ?? []) as Empresa[];

  // ── 2b. Quadro societário completo ───────────────────────────────────────────
  // O inner join do filtro de idade projeta SÓ os sócios que batem o filtro. Mas o score
  // (e o quadro_plural) precisa de TODOS os sócios da empresa. Busca o quadro completo.
  if (filters.minFaixaEtaria != null && empresas.length > 0) {
    const ids = empresas.map((e) => e.id);
    const { data: todos } = await supabase
      .from("socio")
      .select("id, empresa_id, nome, qualificacao, faixa_etaria, data_entrada_sociedade")
      .in("empresa_id", ids);
    if (todos) {
      const porEmpresa = new Map<string, Socio[]>();
      for (const s of todos as (Socio & { empresa_id: string })[]) {
        const arr = porEmpresa.get(s.empresa_id) ?? [];
        arr.push({ id: s.id, nome: s.nome, qualificacao: s.qualificacao, faixa_etaria: s.faixa_etaria, data_entrada_sociedade: s.data_entrada_sociedade });
        porEmpresa.set(s.empresa_id, arr);
      }
      for (const e of empresas) e.socio = porEmpresa.get(e.id) ?? e.socio;
    }
  }

  // ── 3. Score determinístico por empresa, ordenar desc ────────────────────────
  let scored = empresas
    .map((e) => ({ ...e, score: calcScore(e) }))
    .sort((a, b) => (b.score?.score ?? 0) - (a.score?.score ?? 0));

  // ── 3b. Overlay do v1 já investigado — reordena pelo score efetivo ───────────
  // Empresa investigada mantém o score que a investigação apurou e assume a posição
  // correspondente na lista, em vez de voltar pro v0 a cada busca nova.
  try {
    const v1 = await lerScoresV1(supabase, scored.map((e) => e.id));
    if (Object.keys(v1).length > 0) scored = aplicarV1(scored, v1);
  } catch (err) {
    console.error("overlay de v1 falhou:", (err as Error).message);
  }

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
