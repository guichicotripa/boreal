import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { calcScore } from "@/lib/scoring";
import { investigarEmpresa } from "@/lib/research";
import { lerResearchSalvo } from "@/lib/research-store";
import type { Empresa, ResearchResult } from "@/lib/types";
import researchCache from "@/lib/research-cache.json";

// API direta + web search tool server-side. Investigação leva ~30-60s (até 4 buscas).
export const runtime = "nodejs";
export const maxDuration = 180;

// Cache de research das empresas-top dos demos → clique instantâneo no Loom.
const CACHE = researchCache as unknown as Record<string, ResearchResult>;

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

  // Investigação já persistida (score_run) → devolve na hora, sem gastar o agente.
  // É o que faz reabrir a mesma empresa ser instantâneo em vez de 30-60s + custo de API.
  // `?fresh=1` ignora e reinvestiga (o v1 não expira sozinho — decisão de 21/07).
  if (!skipCache) {
    const salvo = await lerResearchSalvo(supabase, empresaId);
    if (salvo) {
      return NextResponse.json({
        research: salvo.research,
        cached: true,
        investigadoEm: salvo.investigadoEm,
      });
    }
  }
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

    // Grava no score_run — histórico versionado do scoring (gravar-tudo, base do moat) E
    // fonte de verdade do v1 daqui pra frente. AGUARDA de propósito: era fire-and-forget,
    // mas a função serverless pode congelar após a resposta e perder a escrita — o que
    // faria a empresa ser reinvestigada (e recobrada) toda vez.
    const base = {
      empresa_id: empresaId,
      score: research.score_v1,
      breakdown: empresa.score?.breakdown ?? null,
      sinais: research.sinais,
      model: "research-agent/v1 (claude via API + web search)",
    };

    // `research` (payload completo) depende da migration 0006. Se a coluna ainda não
    // existe, o insert INTEIRO falharia e o v1 nem o número seria salvo — pior que antes.
    // Então: tenta completo; se a coluna faltar, regrava só o essencial.
    let { error: insErr } = await supabase.from("score_run").insert({ ...base, research });
    let payloadSalvo = !insErr;
    if (insErr) {
      console.warn("insert com `research` falhou (migration 0006 aplicada?):", insErr.message);
      ({ error: insErr } = await supabase.from("score_run").insert(base));
      payloadSalvo = false;
    }
    if (insErr) {
      // Não derruba a resposta: o usuário vê a investigação, só não fica salva.
      console.error("score_run insert falhou (investigação não persistida):", insErr.message);
    }

    // persistido = o score sobrevive (lista reordena). payloadSalvo = não precisa re-rodar o agente.
    return NextResponse.json({ research, persistido: !insErr, payloadSalvo });
  } catch (err) {
    console.error("Research falhou:", (err as Error).message);
    return NextResponse.json({ error: "falha na investigação" }, { status: 500 });
  }
}
