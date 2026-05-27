// Parser por LLM via Claude Agent SDK.
// Usa a autenticação do Claude Code (assinatura) — funciona LOCALMENTE, onde o
// Claude Code está logado. NÃO funciona em deploy (Vercel) sem ANTHROPIC_API_KEY.
// Quando for pro Vercel, trocar por chamada direta à Anthropic API (mesma interface).
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { SearchFilters } from "./types";

// O .env.local tem ANTHROPIC_API_KEY vazia ("") por enquanto. Uma key vazia pode
// confundir o SDK (tentar autenticar com ela em vez de cair na assinatura do
// Claude Code). Se estiver vazia, removemos do ambiente → força auth por assinatura.
if (!process.env.ANTHROPIC_API_KEY) {
  delete process.env.ANTHROPIC_API_KEY;
}

const SYSTEM =
  "Você converte consultas em linguagem natural sobre empresas brasileiras de " +
  "metalmecânica em filtros de busca estruturados. Responda SEMPRE e APENAS com um " +
  "objeto JSON válido, sem texto antes ou depois, sem blocos de markdown.";

export async function parseQueryLLM(texto: string): Promise<SearchFilters> {
  const anoAtual = new Date().getFullYear();

  const prompt = `Consulta: "${texto}"

Extraia os filtros e responda só com JSON neste formato exato:
{"cnaePrefixes":["24","25","28"],"minFaixaEtaria":null,"maxAnoFundacao":null,"limit":50}

Regras:
- cnaePrefixes: 24=metalurgia básica, 25=produtos de metal/esquadrias/serralheria, 28=máquinas e equipamentos. Se a consulta não restringir o tipo, use ["24","25","28"].
- minFaixaEtaria: faixa etária mínima dos sócios, ou null se não mencionar. Mapa: 5=41-50, 6=51-60, 7=61-70, 8=71-80, 9=mais de 80. "sócios acima de 60"→7, "mais de 50 anos"→6, "donos idosos/aposentando/sucessão"→7.
- maxAnoFundacao: ano máximo de fundação (empresa fundada ATÉ esse ano = empresa antiga), ou null. "fundada antes de 1995"→1995, "mais de 30 anos de empresa"→${anoAtual - 30}, "empresa antiga/tradicional"→${anoAtual - 25}.
- limit: número de resultados desejado. Padrão 50, máximo 100.`;

  let raw: string | null = null;
  for await (const message of query({
    prompt,
    options: { maxTurns: 1, allowedTools: [], systemPrompt: SYSTEM },
  })) {
    if (message.type === "result" && message.subtype === "success") {
      raw = message.result;
    }
  }

  if (!raw) throw new Error("Agent SDK não retornou resultado");

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Resposta sem JSON: " + raw.slice(0, 200));
  const parsed = JSON.parse(match[0]);

  // Normaliza / valida — nunca confiar cegamente no output do LLM
  return {
    cnaePrefixes:
      Array.isArray(parsed.cnaePrefixes) && parsed.cnaePrefixes.length > 0
        ? parsed.cnaePrefixes.map(String)
        : ["24", "25", "28"],
    minFaixaEtaria:
      typeof parsed.minFaixaEtaria === "number" ? parsed.minFaixaEtaria : null,
    maxAnoFundacao:
      typeof parsed.maxAnoFundacao === "number" ? parsed.maxAnoFundacao : null,
    limit:
      typeof parsed.limit === "number" ? Math.min(Math.max(parsed.limit, 1), 100) : 50,
  };
}
