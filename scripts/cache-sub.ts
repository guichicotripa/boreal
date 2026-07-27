/**
 * Reconstrói OS DOIS caches (browse de setor + teses da home) VIA ASSINATURA.
 *
 *   node --experimental-strip-types --env-file=.env.local scripts/cache-sub.ts
 *   node --experimental-strip-types --env-file=.env.local scripts/cache-sub.ts --so=setor
 *   node --experimental-strip-types --env-file=.env.local scripts/cache-sub.ts --sem-reasoner
 *
 * Não usa ANTHROPIC_API_KEY e não precisa de dev server: o reasoner roda pelo
 * Agent SDK na assinatura do Claude Code (custo zero). Se o token OAuth estiver
 * vencido, abrir `claude` uma vez no terminal renova.
 *
 * POR QUE UM SCRIPT NOVO em vez de usar cache-demo-sub.mjs:
 *
 * 1. O antigo tinha `.limit(50)` SEM `order by` — o mesmo defeito que a rota de
 *    busca tinha. Rodá-lo hoje REINTRODUZIRIA no cache o problema que a migration
 *    0008 consertou: 50 empresas arbitrárias do setor servidas como shortlist.
 * 2. Ele replicava calcScore em ~40 linhas e o parse das teses à mão. Este importa
 *    `calcScore` e `parseQueryHeuristic` de verdade — a réplica é justamente como
 *    o número da tela e o do cache passam a discordar.
 * 3. Cobria saúde e educação; agro ficaria de fora.
 */
import { createClient } from "@supabase/supabase-js";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { writeFileSync, readFileSync } from "fs";
import path from "path";
import { calcScore } from "../src/lib/scoring.ts";
import { parseQueryHeuristic } from "../src/lib/query-parser.ts";
import { SETORES } from "../src/lib/setores.ts";
import { TESES_POR_SETOR, chaveDemoCache } from "../src/lib/teses.ts";
import { REGRA_LINGUAGEM, filtrarInsight } from "../src/lib/reasoner-guarda.ts";
import type { Empresa, Socio, SearchFilters } from "../src/lib/types.ts";

const args = process.argv.slice(2);
const so = (args.find((a) => a.startsWith("--so=")) ?? "").slice(5); // "setor" | "demo" | ""
const semReasoner = args.includes("--sem-reasoner");
const LIMIT = 50;
const TOP_INSIGHT = 15;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const SELECT = `id, cnpj, razao_social, nome_fantasia, cnae_principal, cnae_principal_desc,
  cnaes_secundarios, natureza_juridica, municipio, uf,
  data_inicio_atividade, capital_social, porte, telefone, email`;

/* Busca — mesma forma da rota /api/search, incluindo o `order by score_v0` ANTES
   do limit. Sem ele o cache guarda 50 empresas quaisquer do setor. */
async function buscar(filters: SearchFilters): Promise<Empresa[]> {
  const embed = filters.minFaixaEtaria != null ? "socio!inner" : "socio";
  let q = supabase
    .from("empresa")
    .select(`${SELECT}, ${embed}(id, nome, qualificacao, faixa_etaria, data_entrada_sociedade)`);

  if (filters.cnaePrefixes.length > 0) {
    q = q.or(filters.cnaePrefixes.map((p) => `cnae_principal.like.${p}*`).join(","));
  }
  if (filters.minFaixaEtaria != null) q = q.gte("socio.faixa_etaria", String(filters.minFaixaEtaria));
  if (filters.maxAnoFundacao != null) q = q.lte("data_inicio_atividade", `${filters.maxAnoFundacao}-12-31`);
  if (filters.ufs?.length) q = q.in("uf", filters.ufs);

  q = q.order("score_v0", { ascending: false, nullsFirst: false }).limit(filters.limit);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const empresas = (data ?? []) as unknown as Empresa[];

  /* O inner join do filtro de idade projeta SÓ os sócios que batem o filtro, mas o
     score conta o quadro inteiro (quadro plural vale 10 pontos). Sem isto, empresa
     com 4 sócios e um só idoso pontuaria como sócio único. */
  if (filters.minFaixaEtaria != null && empresas.length) {
    const ids = empresas.map((e) => e.id);
    const { data: todos } = await supabase
      .from("socio")
      .select("id, empresa_id, nome, qualificacao, faixa_etaria, data_entrada_sociedade")
      .in("empresa_id", ids);
    if (todos) {
      const m = new Map<string, Socio[]>();
      for (const s of todos as (Socio & { empresa_id: string })[]) {
        const a = m.get(s.empresa_id) ?? [];
        a.push({ id: s.id, nome: s.nome, qualificacao: s.qualificacao, faixa_etaria: s.faixa_etaria, data_entrada_sociedade: s.data_entrada_sociedade });
        m.set(s.empresa_id, a);
      }
      for (const e of empresas) e.socio = m.get(e.id) ?? e.socio;
    }
  }
  return empresas;
}

// ── Reasoner via assinatura (espelha src/lib/reasoner.ts, sem a API key) ─────
const FAIXA_LABEL: Record<string, string> = {
  "1": "0-12", "2": "13-20", "3": "21-30", "4": "31-40", "5": "41-50",
  "6": "51-60", "7": "61-70", "8": "71-80", "9": "80+",
};
const REASONER_SYSTEM =
  "Você é um analista sênior de PE/M&A no Brasil, especializado em empresas familiares com risco " +
  "sucessório. Recebe dados estruturados de empresas e escreve análises curtas e específicas. " +
  "Responde SEMPRE e APENAS com JSON válido (array), sem texto antes/depois, sem markdown.\n\n" +
  REGRA_LINGUAGEM;

function compact(e: Empresa) {
  return {
    id: e.id,
    nome: e.razao_social,
    setor: e.cnae_principal_desc ?? e.cnae_principal,
    cidade: e.municipio,
    natureza: e.natureza_juridica,
    fundada_em: e.data_inicio_atividade?.slice(0, 4) ?? null,
    capital_social: e.capital_social,
    porte: e.porte,
    score: e.score?.score ?? null,
    sinais_score: e.score?.sinais ?? [],
    socios: (e.socio ?? []).map((s) => ({
      nome: s.nome,
      faixa: s.faixa_etaria ? FAIXA_LABEL[s.faixa_etaria] ?? s.faixa_etaria : null,
      entrou_em: s.data_entrada_sociedade?.slice(0, 4) ?? null,
    })),
  };
}

type Insight = { empresa_id: string; one_liner: string; flags: string[] };

let descartadosPorLinguagem = 0;

async function reason(empresas: Empresa[]): Promise<Insight[]> {
  const sample = empresas.slice(0, TOP_INSIGHT).map(compact);
  if (!sample.length) return [];
  const prompt = `Analise estas ${sample.length} empresas com possível risco sucessório.

Para CADA uma, escreva:
- "one_liner": 1 frase (máx 25 palavras) em português que prove que você leu os dados dessa empresa específica. Cite ano de fundação, idade dos sócios, ou outro dado concreto. NUNCA frases genéricas tipo "empresa com sinais de risco sucessório".
- "flags": 2 a 3 tags curtas (máx 3 palavras cada) que resumem o perfil. Exemplos: "sócios 80+", "quadro travado 40 anos", "porte sweet spot", "fundador único".

Responda APENAS com este JSON (array, mesma ordem):
[{"empresa_id":"...","one_liner":"...","flags":["...","..."]}]

Dados:
${JSON.stringify(sample, null, 2)}`;

  let raw: string | null = null;
  for await (const m of query({
    prompt,
    options: {
      systemPrompt: REASONER_SYSTEM,
      allowedTools: [],
      maxTurns: 4,
      // Zerar a key força o SDK a autenticar pela assinatura em vez de cobrar da API.
      env: { ...process.env, ANTHROPIC_API_KEY: undefined } as NodeJS.ProcessEnv,
    },
  })) {
    if (m.type === "result" && m.subtype === "success") raw = m.result;
  }
  if (!raw) throw new Error("reasoner sem resultado");
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("reasoner sem array JSON: " + raw.slice(0, 120));
  const nomePorId = new Map(empresas.map((e) => [e.id, e.razao_social]));
  return (JSON.parse(match[0]) as unknown[])
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => ({
      empresa_id: String(x.empresa_id ?? ""),
      one_liner: String(x.one_liner ?? "").trim(),
      flags: Array.isArray(x.flags) ? x.flags.map((f) => String(f).trim()).filter(Boolean).slice(0, 3) : [],
    }))
    .filter((x) => x.empresa_id && x.one_liner)
    // Mesma rede do reasoner ao vivo: prompt evita gerar, filtro evita publicar.
    .map((x) => {
      const ok = filtrarInsight(x, nomePorId.get(x.empresa_id));
      if (!ok) { descartadosPorLinguagem++; return null; }
      if (ok.flags.length !== x.flags.length) descartadosPorLinguagem++;
      return ok;
    })
    .filter((x): x is Insight => x !== null);
}

/** Monta a resposta cacheada — mesmo formato que /api/search devolve. */
async function montar(filters: SearchFilters, rotulo: string) {
  const empresas = await buscar(filters);
  const scored = empresas
    .map((e) => ({ ...e, score: calcScore(e) }))
    .sort((a, b) => (b.score?.score ?? 0) - (a.score?.score ?? 0));

  let reasonedCount = 0;
  if (!semReasoner) {
    try {
      const insights = await reason(scored);
      const byId = new Map(insights.map((i) => [i.empresa_id, i]));
      for (const e of scored) {
        const ins = byId.get(e.id);
        if (ins) { e.insight = { one_liner: ins.one_liner, flags: ins.flags }; reasonedCount++; }
      }
    } catch (err) {
      // Falha de reasoner não pode derrubar o cache: o ranking (que é o que importa)
      // já está correto. Melhor cache certo sem comentário que cache velho com comentário.
      console.log(`\n    ⚠ reasoner falhou: ${(err as Error).message}`);
    }
  }

  const medio = scored.length
    ? (scored.reduce((a, e) => a + (e.score?.score ?? 0), 0) / scored.length).toFixed(1)
    : "0";
  console.log(`${rotulo.padEnd(52)} ${scored.length} empresas · score médio ${medio} · ${reasonedCount} insights`);

  return {
    filters,
    parsedBy: "heuristic" as const,
    count: scored.length,
    empresas: scored,
    reasoned: reasonedCount > 0,
    reasonedCount,
  };
}

const ROOT = path.resolve(".");
const semTeto = { minFaixaEtaria: null, maxAnoFundacao: null, ufs: null, setorForaDaBase: null };

// ── 1. Browse por setor ──────────────────────────────────────────────────────
if (so !== "demo") {
  console.log("\nBrowse de setor:\n");
  const porSetor: Record<string, unknown> = {};
  for (const s of SETORES) {
    porSetor[s.id] = await montar({ ...semTeto, cnaePrefixes: s.cnaes, limit: LIMIT }, `  ${s.nome}`);
  }
  writeFileSync(
    path.resolve(ROOT, "src/lib/setor-cache.json"),
    JSON.stringify({ gerado_em: new Date().toISOString().slice(0, 10), porSetor }, null, 2) + "\n",
    "utf8"
  );
  console.log("\n✓ src/lib/setor-cache.json");
}

// ── 2. Teses da home ─────────────────────────────────────────────────────────
if (so !== "setor") {
  console.log("\nTeses por setor:\n");
  const destino = path.resolve(ROOT, "src/lib/demo-cache.json");
  /* Reconstrói do zero em vez de mesclar no arquivo existente. Mesclar deixava a
     chave de tese REMOVIDA no cache, e quem digitasse a frase antiga continuaria
     recebendo a resposta velha — foi o caso de "consultórios com sócio único
     idoso", tirada por prometer o que a busca não faz. Nada é gravado antes de
     todas as teses passarem, então uma falha no meio preserva o cache anterior. */
  const anterior: Record<string, unknown> = JSON.parse(readFileSync(destino, "utf8"));
  const cache: Record<string, unknown> = {};

  for (const setor of SETORES) {
    for (const texto of TESES_POR_SETOR[setor.id] ?? []) {
      /* O parse sai do MESMO heurístico da busca; só o CNAE é sobrescrito pelo
         setor, exatamente como a rota faz quando há setor selecionado. */
      const filters: SearchFilters = {
        ...parseQueryHeuristic(texto),
        cnaePrefixes: setor.cnaes,
        setorForaDaBase: null,
        limit: LIMIT,
      };
      const resp = await montar(filters, `  [${setor.id}] ${texto}`);
      cache[chaveDemoCache(setor.id, texto)] = resp;
      /* Metalmecânica é o setor default: a home não manda `setor`, e a rota cai no
         ramo de chave de texto puro. Mas quem chega por /setores?setor=metalmec
         manda, e aí a rota procura "metalmec|...". Gravamos as duas para o atalho
         funcionar pelos dois caminhos. */
      if (setor.id === "metalmec") cache[`metalmec|${chaveDemoCache(setor.id, texto)}`] = resp;
    }
  }

  const removidas = Object.keys(anterior).filter((k) => !(k in cache));
  if (removidas.length) console.log(`\n  removidas do cache (tese não existe mais): ${removidas.join(", ")}`);

  writeFileSync(destino, JSON.stringify(cache, null, 2) + "\n", "utf8");
  console.log(`\n✓ src/lib/demo-cache.json — ${Object.keys(cache).length} chaves`);
}

if (descartadosPorLinguagem > 0) {
  console.log(
    `\n⚠ ${descartadosPorLinguagem} insight(s)/flag(s) barrados pela regra de linguagem.` +
    `\n  Se o número for alto, o prompt está deixando passar — ver src/lib/reasoner-guarda.ts.`
  );
}
