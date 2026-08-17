import { NextRequest, NextResponse } from "next/server";
import { motivoIndisponivel, mensagemIndisponivel, valeTentarDeNovo } from "@/lib/llm-indisponivel";
import { createAdminClient } from "@/lib/supabase";
import { createUserClient } from "@/lib/supabase-server";
import { calcScore } from "@/lib/scoring";
import { investigarEmpresa } from "@/lib/research";
import { lerResearchSalvo, salvarResearch } from "@/lib/research-store";
import { registrarInvestigacao } from "@/lib/evento";
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

  /* Mesma divisão da /api/dossier: leitura pela sessão (policies valem), escrita
     pela service_role. `score_run` é corpus compartilhado, derivado de CNPJ
     público, e não tem policy de insert — quem grava é o pipeline. */
  const supabase = await createUserClient();
  const pipeline = createAdminClient();

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
    return NextResponse.json({ error: "empresa não encontrada ou fora do seu contrato" }, { status: 404 });
  }

  const empresa = data as Empresa;
  empresa.score = calcScore(empresa); // garante score v0 antes de investigar

  try {
    const research = await investigarEmpresa(empresa);

    // Grava no score_run — histórico versionado do scoring (gravar-tudo, base do moat) E
    // fonte de verdade do v1 daqui pra frente. AGUARDA de propósito: era fire-and-forget,
    // mas a função serverless pode congelar após a resposta e perder a escrita — o que
    // faria a empresa ser reinvestigada (e recobrada) toda vez.
    // Falha de escrita não derruba a resposta: o usuário vê a investigação, só não fica salva.
    const { persistido, payloadSalvo } = await salvarResearch(
      pipeline,
      empresaId,
      research,
      empresa.score?.breakdown,
      "research-agent/v1 (claude via API + web search)"
    );

    /* Sinal FORTE de interesse: mandar investigar gasta tempo de maquina, entao
       o analista escolheu esta e nao as outras 49 da lista. */
    await registrarInvestigacao(supabase, empresaId, research.score_v0, research.score_v1);

    // persistido = o score sobrevive (lista reordena). payloadSalvo = não precisa re-rodar o agente.
    return NextResponse.json({ research, persistido, payloadSalvo });
  } catch (err) {
    console.error("Research falhou:", (err as Error).message);
    /* INDISPONIBILIDADE não é BUG, e a tela precisa saber a diferença. A conta de API está sem
       crédito desde 25/07, e o pré-cache cobre só o topo de cada mandato: empresa fora do lote
       caía aqui como 500 "falha", que é a mesma cara de defeito de verdade. Para um originador da
       Setter isso lê como produto quebrado, quando o fato é administrativo.
       503 e não 500 porque é serviço indisponível, não erro de processamento. */
    const motivo = motivoIndisponivel(err);
    if (motivo) {
      return NextResponse.json(
        { error: mensagemIndisponivel(motivo, "investigação"), indisponivel: motivo, tentarDeNovo: valeTentarDeNovo(motivo) },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "falha na investigação" }, { status: 500 });
  }
}
