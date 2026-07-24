// Parser NL → filtros via Anthropic API direta.
// Usa ANTHROPIC_API_KEY do .env.local — funciona local e em deploy (Vercel).
// Substitui o Agent SDK (que dependia do Claude Code logado e tinha ~8s de overhead).

import Anthropic from "@anthropic-ai/sdk";
import type { SearchFilters } from "./types";

// Lazy: cria o cliente na primeira chamada, não no load do módulo.
// Garante que ANTHROPIC_API_KEY já está no process.env quando o cliente é criado.
let _client: Anthropic | null = null;
function getClient() {
  if (!_client) _client = new Anthropic();
  return _client;
}

const SYSTEM =
  "Você converte consultas em linguagem natural sobre empresas brasileiras de " +
  "metalmecânica em filtros de busca estruturados. Responda SEMPRE e APENAS com um " +
  "objeto JSON válido, sem texto antes ou depois, sem blocos de markdown.";

export async function parseQueryLLM(texto: string): Promise<SearchFilters> {
  const anoAtual = new Date().getFullYear();

  const prompt = `Consulta: "${texto}"

Extraia os filtros e responda só com JSON neste formato exato:
{"cnaePrefixes":["24","25","28"],"minFaixaEtaria":null,"maxAnoFundacao":null,"ufs":null,"limit":50}

Regras:
- cnaePrefixes: 24=metalurgia básica, 25=produtos de metal/esquadrias/serralheria, 28=máquinas e equipamentos. Se a consulta não restringir o tipo, use ["24","25","28"].
- minFaixaEtaria: faixa etária mínima dos sócios, ou null se não mencionar. Mapa: 5=41-50, 6=51-60, 7=61-70, 8=71-80, 9=mais de 80. "sócios acima de 60"→7, "mais de 50 anos"→6, "donos idosos/aposentando/sucessão"→7.
- maxAnoFundacao: ano máximo de fundação (empresa fundada ATÉ esse ano = empresa antiga), ou null. "fundada antes de 1995"→1995, "mais de 30 anos de empresa"→${anoAtual - 30}, "empresa antiga/tradicional"→${anoAtual - 25}.
- ufs: siglas das UFs citadas como praça, ex ["SP"] ou ["MG","PR"]. null se a consulta não citar estado/região. "no interior de SP"→["SP"], "no Sul"→["RS","SC","PR"], "no Nordeste"→["BA","PE","CE","MA","PB","RN","AL","PI","SE"].
- limit: número de resultados desejado. Padrão 50, máximo 100.`;

  const message = await getClient().messages.create({
    model: "claude-haiku-4-5", // tarefa trivial (JSON de filtros) → Haiku: 3-4x mais rápido, 6x mais barato
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
    cnaePrefixes:
      Array.isArray(parsed.cnaePrefixes) && parsed.cnaePrefixes.length > 0
        ? parsed.cnaePrefixes.map(String)
        : ["24", "25", "28"],
    minFaixaEtaria:
      typeof parsed.minFaixaEtaria === "number" ? parsed.minFaixaEtaria : null,
    maxAnoFundacao:
      typeof parsed.maxAnoFundacao === "number" ? parsed.maxAnoFundacao : null,
    // Só siglas plausíveis: o LLM às vezes devolve nome por extenso ou lixo.
    ufs:
      Array.isArray(parsed.ufs) && parsed.ufs.length > 0
        ? (parsed.ufs.map((u: unknown) => String(u).toUpperCase().trim()).filter((u: string) => /^[A-Z]{2}$/.test(u)) as string[])
        : null,
    limit:
      typeof parsed.limit === "number"
        ? Math.min(Math.max(parsed.limit, 1), 100)
        : 50,
  };
}
