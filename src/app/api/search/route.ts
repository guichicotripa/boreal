import { NextRequest, NextResponse } from "next/server";
import { createUserClient } from "@/lib/supabase-server";
import { parseQueryLLM } from "@/lib/llm";
import { parseQueryHeuristic } from "@/lib/query-parser";
import { calcScore } from "@/lib/scoring";
import { reasonAboutEmpresas } from "@/lib/reasoner";
import { lerScoresV1, aplicarV1 } from "@/lib/research-store";
import { lerDescartadas, filtrarDescartadas } from "@/lib/descarte-store";
import { escopoAtual } from "@/lib/escopo";
import { normalizeQuery } from "@/lib/teses";
import { SETORES } from "@/lib/setores";
import { permissoesAtuais, setorPermitido, ufPermitida } from "@/lib/permissoes";
import { registrarBusca } from "@/lib/evento";
import type { Empresa, Socio, SearchResponse } from "@/lib/types";
import demoCache from "@/lib/demo-cache.json";
import setoresData from "@/lib/setores.json";
import setorCache from "@/lib/setor-cache.json";

function cnaesDoSetor(id: string): string[] | null {
  return (setoresData.setores as { id: string; cnaes: string[] }[]).find((s) => s.id === id)?.cnaes ?? null;
}

export const runtime = "nodejs";
export const maxDuration = 60;

// normalizeQuery vem de lib/teses: o builder do cache grava a chave com ela, e a
// rota lê com ela. Eram duas cópias — se divergirem, o cache existe e nunca é
// encontrado, o que não dá erro nenhum, só fica lento em silêncio.

// cast via unknown: o JSON é gerado pelo próprio pipeline (confiável); evita quebrar
// o type-check a cada mudança no schema do score.
const CACHE = demoCache as unknown as Record<string, SearchResponse>;

// Pós-processo de uma resposta pronta (inclusive as de cache estático):
//   1. remove as empresas descartadas no Radar;
//   2. aplica o overlay do v1 investigado e reordena.
// Sem isto, os chips de demo — que não tocam o banco — continuariam listando o v0,
// as investigadas nunca subiriam e as descartadas voltariam a aparecer. Duas queries
// indexadas por ids. `count` é recontado: a UI mostra esse número.
async function comOverlays(resp: SearchResponse): Promise<SearchResponse> {
  let empresas = resp.empresas ?? [];
  if (empresas.length === 0) return resp;
  const supabase = await createUserClient();

  /* O score NUNCA vem do cache: é recalculado aqui e a lista é reordenada por ele.
     Os caches guardam o que é caro (parse da query, insight do LLM, ida ao banco) e
     o score custa microssegundos. Quando o v0 virou v1 os caches passaram a servir
     números da fórmula antiga, e pior que número velho seria a lista ORDENADA pela
     fórmula antiga com os números da nova — um 45 acima de um 88 na tela. */
  empresas = empresas
    .map((e) => ({ ...e, score: calcScore(e) }))
    .sort((a, b) => (b.score?.score ?? 0) - (a.score?.score ?? 0));

  try {
    const descartadas = await lerDescartadas(supabase, await escopoAtual(), empresas.map((e) => e.id));
    empresas = filtrarDescartadas(empresas, descartadas);
  } catch (err) {
    // Falhou a leitura do descarte: mostra tudo (degrada, não quebra a busca).
    console.error("filtro de descartadas falhou:", (err as Error).message);
  }

  try {
    const v1 = await lerScoresV1(supabase, empresas.map((e) => e.id));
    if (Object.keys(v1).length > 0) empresas = aplicarV1(empresas, v1);
  } catch (err) {
    // Falhou a leitura do v1: serve o v0 (degrada, não quebra a busca).
    console.error("overlay de v1 falhou:", (err as Error).message);
  }

  return { ...resp, empresas, count: empresas.length };
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

  /* Página em vez de "os 50 e pronto". Antes da paginação, tudo além do 50º era
     inalcançável: numa base de 51.033 empresas, o originador via 0,1% do universo
     e não tinha como saber que havia mais.

     Vem como `pagina` (0-based) e não como offset cru: offset do cliente é
     forjável pra pular pro fim da base e paginar dado que a tese não pediu.
     Limitado a 40 páginas porque ninguém garimpa 2.000 empresas na mão, e sem
     teto o `.range()` fundo fica caro. */
  const paginaBruta = Number((body as { pagina?: number })?.pagina ?? 0);
  const pagina = Number.isFinite(paginaBruta) ? Math.min(Math.max(Math.trunc(paginaBruta), 0), 40) : 0;

  // ── 0. Cache — demos canônicos (texto) ou browse de setor (instantâneo no demo) ──
  /* `pagina > 0` ignora o cache: os caches (demo e browse de setor) guardam a
     PRIMEIRA página de cada consulta, não o universo. Servir o cache na página 2
     devolveria as mesmas 50 empresas de novo, e o originador leria isso como
     "acabou" quando ainda há 51 mil linhas atrás. */
  const skipCache = req.nextUrl.searchParams.get("fresh") === "1" || pagina > 0;
  // Tese + setor (saúde/educação): chave composta `setor|tese`, pra ficar instantâneo como o
  // metalmec. Metalmec é o setor default (a home não manda setor) e cai no ramo de texto puro abaixo.
  if (!skipCache && queryText && setorId) {
    const hit = CACHE[`${setorId}|${normalizeQuery(queryText)}`];
    if (hit) {
      return NextResponse.json({ ...(await comOverlays(hit)), cached: true });
    }
  }
  if (!skipCache && queryText && !setorCnaes) {
    const hit = CACHE[normalizeQuery(queryText)];
    if (hit) {
      return NextResponse.json({ ...(await comOverlays(hit)), cached: true });
    }
  }
  // Browse de setor sem texto: serve do cache (saúde/educação ficam instantâneos como o metalmec).
  if (!skipCache && setorId && !queryText) {
    /* `unknown` no meio porque o `score` gravado no JSON é da fórmula antiga e não
       casa mais com ScoreBreakdown. Não é dívida: comOverlays recalcula o score de
       toda linha servida do cache, então o campo do arquivo é ignorado de propósito. */
    const hit = (setorCache.porSetor as unknown as Record<string, SearchResponse>)[setorId];
    if (hit) {
      return NextResponse.json({ ...(await comOverlays(hit)), cached: true });
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
    filters = { cnaePrefixes: [], minFaixaEtaria: null, maxAnoFundacao: null, ufs: null, setorForaDaBase: null, limit: 50 };
    parsedBy = "heuristic";
  }

  // Setor escolhido sobrepõe os CNAEs inferidos (a praça/idade do NL seguem valendo).
  if (setorCnaes) {
    filters.cnaePrefixes = setorCnaes;
    filters.setorForaDaBase = null; // o seletor manda: o setor está indexado
  }

  // Pediu setor que a base não cobre: devolve zero AGORA, com o motivo. Antes o
  // parser trocava calado por metalmecânica e entregava 50 empresas erradas.
  // Curto-circuito também evita gastar reasoner num resultado que não existe.
  if (filters.setorForaDaBase && filters.cnaePrefixes.length === 0) {
    return NextResponse.json({
      filters,
      parsedBy,
      count: 0,
      empresas: [],
      reasoned: false,
      reasonedCount: 0,
    });
  }

  /* Pediu algo fora do CONTRATO (≠ fora da base: o dado existe, esta firma é que
     não comprou). As policies da 0012 já devolveriam zero linha sozinhas — isto
     não é a proteção, é a explicação. Sem a mensagem o originador vê lista vazia
     num setor que ele sabe que existe e conclui que a ferramenta quebrou. */
  const perm = await permissoesAtuais();
  const pedidos = SETORES.filter((s) =>
    filters.cnaePrefixes.some((p) => s.cnaes.some((c) => c.startsWith(p) || p.startsWith(c)))
  );
  const bloqueados = pedidos.filter((s) => !setorPermitido(perm, s.id));
  const ufsBloqueadas = (filters.ufs ?? []).filter((uf) => !ufPermitida(perm, uf));

  // Só corta quando NADA do que foi pedido está no contrato. Se parte está, a
  // busca segue e a RLS entrega o que pode — avisar o que ficou de fora basta.
  const tudoBloqueado =
    (pedidos.length > 0 && bloqueados.length === pedidos.length) ||
    ((filters.ufs?.length ?? 0) > 0 && ufsBloqueadas.length === filters.ufs!.length);

  if (tudoBloqueado) {
    const oque = bloqueados.length ? bloqueados.map((s) => s.nome).join(" e ") : ufsBloqueadas.join(" e ");
    return NextResponse.json({
      filters,
      parsedBy,
      count: 0,
      empresas: [],
      reasoned: false,
      reasonedCount: 0,
      foraDoContrato: oque,
    });
  }

  const aviso = bloqueados.length || ufsBloqueadas.length
    ? [...bloqueados.map((s) => s.nome), ...ufsBloqueadas].join(" e ")
    : null;

  // ── 2. Monta e roda a query no Supabase ──────────────────────────────────────
  const supabase = await createUserClient();
  const offset = pagina * filters.limit;

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

  // Praça. Sem isto a UF da tese era ignorada e a busca devolvia outra região
  // em silêncio — pior que devolver nada, porque parece resposta.
  if (filters.ufs?.length) {
    q = q.in("uf", filters.ufs);
  }

  /* ORDENAR ANTES DE CORTAR. Sem este order, o `.limit()` abaixo devolvia 50
     linhas arbitrárias do setor e o passo 3 as ordenava entre si — ranking de
     uma amostra, apresentado como shortlist priorizada. Medido em 25/07/2026,
     depois de a cobertura de saúde ir de 2.000 pra 34.599 empresas: ZERO das 50
     devolvidas estavam no top-50 real do setor (score médio 50,6 contra 100).
     Antes disso o defeito ficava escondido porque o ingest só carregava a cauda
     de faixa etária mais alta, e qualquer 50 daquelas linhas pareciam boas.
     score_v0 é materializado por scripts/backfill-score-v0.ts (migration 0008);
     `nulls last` joga empresa ainda não pontuada pro fim em vez de pro topo. */
  /* `.order("id")` como desempate NÃO é enfeite: é o que torna a paginação
     possível. O score está SATURADO no topo (as primeiras dezenas são todas 100),
     e `.range()` sobre ordem com empate devolve a mesma empresa em duas páginas e
     esquece outra — foi assim que o backfill de score_v0 deixou 18.386 de fora.
     Com o id como último critério, a ordem é total e estável entre requests. */
  q = q
    .order("score_v0", { ascending: false, nullsFirst: false })
    .order("id")
    /* Pede UMA linha além da página pra saber se existe próxima, sem um count()
       separado (que numa tabela de 51 mil linhas com filtro custa mais que a
       própria busca). A linha extra é descartada abaixo. */
    .range(offset, offset + filters.limit);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const linhas = (data ?? []) as Empresa[];
  const temMais = linhas.length > filters.limit;
  const empresas = temMais ? linhas.slice(0, filters.limit) : linhas;

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

  // ── 3a. Tira as descartadas no Radar ─────────────────────────────────────────
  // Antes do reasoner: não faz sentido gastar chamada de LLM comentando empresa
  // que o operador já disse que não quer ver.
  try {
    const descartadas = await lerDescartadas(supabase, await escopoAtual(), scored.map((e) => e.id));
    scored = filtrarDescartadas(scored, descartadas);
  } catch (err) {
    console.error("filtro de descartadas falhou:", (err as Error).message);
  }

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

  /* A lista ranqueada que o analista vai ver. Gravada AQUI, depois do v1 e da
     ordenação final, porque o que ensina o modelo é o que foi EXIBIDO — não o que
     o banco devolveu antes de reordenar. `await` de propósito: em serverless, o
     que fica pendente depois da resposta pode simplesmente não acontecer, e este
     é o único dado do sistema que não dá pra recomputar depois. */
  await registrarBusca(supabase, queryText, filters, scored, pagina);

  return NextResponse.json({
    filters,
    parsedBy,
    count: scored.length,
    empresas: scored,
    pagina,
    /* `temMais` sai da linha extra pedida ao banco, ANTES do filtro de
       descartadas. Uma página pode voltar com menos de 50 (descarte remove do
       meio) e ainda assim ter próxima — por isso não dá pra inferir "acabou" de
       `count < limit`, que é o erro óbvio de quem consome isto. */
    temMais,
    reasoned,
    reasonedCount,
    // Parte do pedido ficou fora do contrato: a lista veio, mas incompleta em
    // relação ao que foi perguntado. Dizer é melhor que entregar menos calado.
    foraDoContratoParcial: aviso,
  });
}
