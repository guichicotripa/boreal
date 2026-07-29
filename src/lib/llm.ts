// Parser NL → filtros via Anthropic API direta.
// Usa ANTHROPIC_API_KEY do .env.local — funciona local e em deploy (Vercel).
// Substitui o Agent SDK (que dependia do Claude Code logado e tinha ~8s de overhead).

import Anthropic from "@anthropic-ai/sdk";
import type { SearchFilters } from "./types";
import { SETORES } from "./setores";
import { ROTULOS_FORA_DA_BASE } from "./query-parser";
import { MODELO_EXTRACAO } from "./modelos.ts";

// Lazy: cria o cliente na primeira chamada, não no load do módulo.
// Garante que ANTHROPIC_API_KEY já está no process.env quando o cliente é criado.
let _client: Anthropic | null = null;
function getClient() {
  if (!_client) _client = new Anthropic();
  return _client;
}

const SYSTEM =
  "Você converte consultas em linguagem natural sobre empresas brasileiras em " +
  "filtros de busca estruturados. Responda SEMPRE e APENAS com um " +
  "objeto JSON válido, sem texto antes ou depois, sem blocos de markdown.";

/* Vocabulário de setor vindo do registry, não hardcoded: setor novo ingerido
   passa a ser buscável por texto livre sem editar este prompt. Antes o prompt
   só descrevia 24/25/28 e mandava usar esses quando não reconhecia — então
   "clínicas com sócios idosos" devolvia metalúrgicas. */
const CNAES_INDEXADOS = SETORES.map((s) => `${s.cnaes.join("/")}=${s.nome}`).join(", ");
const PREFIXOS_INDEXADOS = [...new Set(SETORES.flatMap((s) => s.cnaes))];
/* Os exemplos de setor NÃO coberto saem da mesma lista que o parser heurístico
   usa. Estavam escritos à mão aqui e incluíam "agro" — que agora é indexado; o
   prompt mandaria o LLM negar um setor que a base cobre. */
const EXEMPLOS_FORA = ROTULOS_FORA_DA_BASE.slice(0, 6).join(", ");

export async function parseQueryLLM(texto: string): Promise<SearchFilters> {
  const anoAtual = new Date().getFullYear();

  const prompt = `Consulta: "${texto}"

Extraia os filtros e responda só com JSON neste formato exato:
{"cnaePrefixes":[],"minFaixaEtaria":null,"maxAnoFundacao":null,"ufs":null,"setorForaDaBase":null,"limit":50}

Regras:
- cnaePrefixes: SÓ estes setores estão indexados: ${CNAES_INDEXADOS}. Use os prefixos do setor pedido. Se a consulta não citar setor nenhum, use [] (busca ampla).
- setorForaDaBase: se a consulta pedir um setor que NÃO está na lista acima (ex: ${EXEMPLOS_FORA}), coloque aqui o nome do setor pedido e devolva cnaePrefixes vazio. NUNCA substitua por um setor indexado. null se o setor pedido está coberto ou se nenhum foi citado.
- minFaixaEtaria: faixa etária mínima dos sócios, ou null se não mencionar. Mapa: 5=41-50, 6=51-60, 7=61-70, 8=71-80, 9=mais de 80. "sócios acima de 60"→7, "mais de 50 anos"→6, "donos idosos/aposentando/sucessão"→7.
- maxAnoFundacao: ano máximo de fundação (empresa fundada ATÉ esse ano = empresa antiga), ou null. "fundada antes de 1995"→1995, "mais de 30 anos de empresa"→${anoAtual - 30}, "empresa antiga/tradicional"→${anoAtual - 25}.
- ufs: siglas das UFs citadas como praça, ex ["SP"] ou ["MG","PR"]. null se a consulta não citar estado/região. "no interior de SP"→["SP"], "no Sul"→["RS","SC","PR"], "no Nordeste"→["BA","PE","CE","MA","PB","RN","AL","PI","SE"].
- limit: número de resultados desejado. Padrão 50, máximo 100.`;

  const message = await getClient().messages.create({
    model: MODELO_EXTRACAO, // tarefa trivial (JSON de filtros) → Haiku: mais rápido e barato
    max_tokens: 256,
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });

  const raw =
    message.content[0].type === "text" ? message.content[0].text : "";

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Resposta sem JSON: " + raw.slice(0, 200));
  const parsed = JSON.parse(match[0]);

  // Normaliza — nunca confiar cegamente no output do LLM
  return {
    // Só prefixos que existem na base. Sem isto o LLM "ajuda" inventando CNAE de
    // setor não indexado (ex: 41 pra construção) e a busca devolve zero sem dizer
    // por quê — some com o aviso de setor fora da base. Vazio = busca ampla.
    cnaePrefixes:
      Array.isArray(parsed.cnaePrefixes)
        ? parsed.cnaePrefixes
            .map(String)
            .filter((p: string) => PREFIXOS_INDEXADOS.some((i) => p.startsWith(i) || i.startsWith(p)))
        : [],
    minFaixaEtaria:
      typeof parsed.minFaixaEtaria === "number" ? parsed.minFaixaEtaria : null,
    maxAnoFundacao:
      typeof parsed.maxAnoFundacao === "number" ? parsed.maxAnoFundacao : null,
    // Só siglas plausíveis: o LLM às vezes devolve nome por extenso ou lixo.
    ufs:
      Array.isArray(parsed.ufs) && parsed.ufs.length > 0
        ? (parsed.ufs.map((u: unknown) => String(u).toUpperCase().trim()).filter((u: string) => /^[A-Z]{2}$/.test(u)) as string[])
        : null,
    setorForaDaBase:
      typeof parsed.setorForaDaBase === "string" && parsed.setorForaDaBase.trim()
        ? parsed.setorForaDaBase.trim().slice(0, 60)
        : null,
    limit:
      typeof parsed.limit === "number"
        ? Math.min(Math.max(parsed.limit, 1), 100)
        : 50,
  };
}
