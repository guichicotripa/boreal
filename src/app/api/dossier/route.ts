import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { createUserClient } from "@/lib/supabase-server";
import { calcScore } from "@/lib/scoring";
import { gerarDossierAnalise } from "@/lib/dossier";
import type { Empresa, DossierAnalise } from "@/lib/types";
import dossierCache from "@/lib/dossier-cache.json";
import { lerMemoSalvo, salvarMemo } from "@/lib/memo-store";
import { lerResearchSalvo } from "@/lib/research-store";
import { registrarDossie } from "@/lib/evento";

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

  const skipCache = req.nextUrl.searchParams.get("fresh") === "1";

  /* Dois clientes nesta rota, de propósito.
     LEITURA pelo usuário: as policies valem, e uma firma nunca lê fora do escopo.
     ESCRITA do memo pela service_role: `empresa_memo` é corpus COMPARTILHADO
     entre clientes (deriva só de CNPJ público, e é onde está a economia de escala
     entre eles), então não tem policy de insert — ninguém escreve nele pela
     sessão. Quem escreve é o pipeline, e esta rota escrevendo é o pipeline
     aproveitando um memo que o uso real acabou de pagar. */
  const supabase = await createUserClient();
  const pipeline = createAdminClient();

  /* Ordem: BANCO → arquivo → gerar.
     O banco vem primeiro porque é o que cresce (migration 0009). O arquivo é o
     legado das 51 empresas dos demos, mantido só até elas migrarem — ver
     scripts/importar-memos-arquivo.ts. */
  /* v1 salvo desta empresa. Lido ANTES do cache porque decide se o memo guardado
     ainda serve: memo escrito sem investigação é cego para assessor contratado,
     menção pública a venda e sucessor já atuando. Se o v1 chegou depois, o memo
     guardado está desatualizado em relação ao que já se sabe, e vale refazer. */
  const salvoV1 = await lerResearchSalvo(supabase, empresaId);

  if (!skipCache) {
    const salvo = await lerMemoSalvo(supabase, empresaId);
    // Só serve se não for pior do que dá para escrever agora.
    if (salvo && (salvo.comV1 || !salvoV1)) {
      await registrarDossie(supabase, empresaId, true);
      return NextResponse.json({ analise: salvo.analise, cached: true, geradoEm: salvo.geradoEm });
    }
    // O arquivo legado não tem v1 em nenhum caso — mesma regra.
    if (!salvo && !salvoV1 && CACHE[empresaId]) {
      return NextResponse.json({ analise: CACHE[empresaId], cached: true });
    }
  }

  // Busca a empresa completa (com sócios) — fonte da verdade, não confia no client.
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
    return NextResponse.json({ error: "empresa não encontrada ou fora do seu contrato" }, { status: 404 });
  }

  const empresa = data as Empresa;
  empresa.score = calcScore(empresa);

  try {
    const analise = await gerarDossierAnalise(empresa, salvoV1?.research);
    /* Persiste o que acabou de ser gerado. Antes o memo era descartado, então
       abrir a mesma empresa de novo pagava o LLM de novo e nada do uso real
       ficava acumulado. Falha ao gravar não impede a resposta — o usuário já tem
       o memo; o pior caso é gerar outra vez depois. */
    await salvarMemo(pipeline, empresaId, analise, "api/dossier", !!salvoV1);
    await registrarDossie(supabase, empresaId, false);
    return NextResponse.json({ empresa, analise });
  } catch (err) {
    console.error("Dossier falhou:", (err as Error).message);
    return NextResponse.json({ error: "falha ao gerar análise" }, { status: 500 });
  }
}
