// Reasoner — gera um one-liner narrativo + flags por empresa via Anthropic API direta.
//
// Roda DEPOIS do score determinístico. Pega top N empresas, monta UMA chamada
// pro Claude com todos os dados estruturados, e devolve uma análise curta de
// cada uma. É o que diferencia "lista filtrada" de "research agent": prova que
// o modelo leu e raciocinou sobre AQUELA empresa, não só matched filtros.

import Anthropic from "@anthropic-ai/sdk";
import type { Empresa } from "./types";
import { REGRA_LINGUAGEM, filtrarInsight } from "./reasoner-guarda";

let _client: Anthropic | null = null;
function getClient() {
  if (!_client) _client = new Anthropic();
  return _client;
}

export type EmpresaInsight = {
  empresa_id: string;
  one_liner: string;  // 1 frase, ~20–25 palavras, PT-BR, específica à empresa
  flags: string[];    // 2–3 tags curtas, ex: ["sócios 80+", "quadro travado"]
};

const SYSTEM =
  "Você é um analista sênior de PE/M&A no Brasil, especializado em empresas " +
  "familiares com risco sucessório. Recebe dados estruturados de empresas e " +
  "escreve análises curtas e específicas. Responde SEMPRE e APENAS com JSON " +
  "válido (array), sem texto antes/depois, sem markdown.\n\n" +
  REGRA_LINGUAGEM;

const FAIXA_LABEL: Record<string, string> = {
  "1": "0-12", "2": "13-20", "3": "21-30", "4": "31-40", "5": "41-50",
  "6": "51-60", "7": "61-70", "8": "71-80", "9": "80+",
};

// Reduz cada empresa a só o que importa pro raciocínio (economiza tokens).
function compact(e: Empresa) {
  const socios = (e.socio ?? []).map((s) => ({
    nome: s.nome,
    faixa: s.faixa_etaria ? FAIXA_LABEL[s.faixa_etaria] ?? s.faixa_etaria : null,
    entrou_em: s.data_entrada_sociedade?.slice(0, 4) ?? null,
  }));
  return {
    id: e.id,
    nome: e.razao_social,
    setor: e.cnae_principal_desc ?? e.cnae_principal, // descrição legível em vez de código
    cidade: e.municipio,                              // nome resolvido da cidade
    natureza: e.natureza_juridica,
    fundada_em: e.data_inicio_atividade?.slice(0, 4) ?? null,
    capital_social: e.capital_social,
    porte: e.porte,
    score: e.score?.score ?? null,
    sinais_score: e.score?.sinais ?? [],
    socios,
  };
}

/**
 * Gera one-liner + flags para top N empresas em UMA chamada LLM.
 * Se falhar, lança erro — o caller decide se cai em fallback.
 */
export async function reasonAboutEmpresas(
  empresas: Empresa[],
  topN = 15
): Promise<EmpresaInsight[]> {
  const sample = empresas.slice(0, topN).map(compact);
  if (sample.length === 0) return [];

  const prompt = `Analise estas ${sample.length} empresas com possível risco sucessório.

Para CADA uma, escreva:
- "one_liner": 1 frase (máx 25 palavras) em português que prove que você leu os dados dessa empresa específica. Cite ano de fundação, idade dos sócios, ou outro dado concreto. NUNCA frases genéricas tipo "empresa com sinais de risco sucessório".
- "flags": 2 a 3 tags curtas (máx 3 palavras cada) que resumem o perfil. Exemplos: "sócios 80+", "quadro travado 40 anos", "porte sweet spot", "fundador único".

Responda APENAS com este JSON (array, mesma ordem):
[{"empresa_id":"...","one_liner":"...","flags":["...","..."]}]

Dados:
${JSON.stringify(sample, null, 2)}`;

  const message = await getClient().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });

  // Log de uso pra monitorar custo real
  const usage = message.usage;
  console.log(
    `[reasoner] tokens: ${usage.input_tokens} in / ${usage.output_tokens} out` +
    ` — custo estimado: $${((usage.input_tokens * 3 + usage.output_tokens * 15) / 1_000_000).toFixed(4)}`
  );

  const raw =
    message.content[0].type === "text" ? message.content[0].text : "";

  // Extrai o array JSON do output
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("Reasoner: resposta sem array JSON: " + raw.slice(0, 200));

  const parsed = JSON.parse(match[0]);
  if (!Array.isArray(parsed)) throw new Error("Reasoner: resposta não é array");

  // Normaliza — descarta entradas malformadas em vez de quebrar
  const nomePorId = new Map(empresas.map((e) => [e.id, e.razao_social]));
  return parsed
    .filter((x): x is Record<string, unknown> => x !== null && typeof x === "object")
    .map((x) => ({
      empresa_id: String(x.empresa_id ?? ""),
      one_liner: String(x.one_liner ?? "").trim(),
      flags: Array.isArray(x.flags)
        ? x.flags.map((f) => String(f).trim()).filter(Boolean).slice(0, 3)
        : [],
    }))
    .filter((x) => x.empresa_id && x.one_liner)
    // Rede de segurança sobre a regra de linguagem: o prompt evita gerar, isto
    // evita publicar. Ver reasoner-guarda.ts para o que motivou.
    .map((x) => filtrarInsight(x, nomePorId.get(x.empresa_id)))
    .filter((x): x is NonNullable<typeof x> => x !== null);
}
