// Research-agent — eleva o score v0 (heurística) para v1 (com sinais qualitativos da web).
//
// É o score v1 do Playbook Relay §11. A IA investiga a empresa na web e procura
// sinais que a heurística não enxerga. Híbrido e honesto:
//   - O LLM IDENTIFICA quais sinais existem (de uma lista fechada) e cita a FONTE.
//   - O CÓDIGO aplica os pesos (o LLM não inventa números de score).
//   - Ajuste é BIDIRECIONAL: pode confirmar/subir o risco OU rebaixá-lo (ex: achou sucessor).
//
// Usa o Claude Agent SDK + WebSearch nativo do Claude Code, autenticado pela ASSINATURA
// (não pela API) — custo zero. Truque: o `env` passado ao query() substitui o ambiente do
// subprocesso; ao remover ANTHROPIC_API_KEY, o Claude Code cai na assinatura logada.
// ⚠️ Só funciona local (onde o Claude Code está logado), não no Vercel.

import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Empresa, SinalQualitativo, ResearchResult } from "./types";

export type { SinalQualitativo, ResearchResult };

// Ambiente do subprocesso SEM a API key → força autenticação por assinatura.
function envSemApiKey() {
  return { ...process.env, ANTHROPIC_API_KEY: undefined };
}

// Tipos de sinal e seus pesos (ajuste sobre o score v0). Determinístico no código.
// Sinais que AUMENTAM propensão a M&A vêm do Playbook §11; redutores são lógicos.
const PESOS: Record<string, { peso: number; rotulo: string }> = {
  mencao_sucessao_venda:  { peso: +12, rotulo: "Menção pública a sucessão/venda" },
  banco_investimento:     { peso: +15, rotulo: "Assessor/banco de investimento contratado" },
  herdeiro_fora_carreira: { peso: +8,  rotulo: "Herdeiro(s) em outra carreira" },
  csuite_externo:         { peso: +6,  rotulo: "C-suite profissional externo à família" },
  big4_auditoria:         { peso: +5,  rotulo: "Auditoria Big 4" },
  sem_presenca_digital:   { peso: +3,  rotulo: "Sem pegada digital (perfil old-school)" },
  sucessor_familiar_ativo:{ peso: -25, rotulo: "Sucessor familiar já atuando" },
};

const SYSTEM =
  "Você é um analista de origination de M&A investigando uma empresa familiar brasileira " +
  "para avaliar risco sucessório. Você pesquisa SOMENTE fontes públicas (LinkedIn público, " +
  "imprensa, site da empresa, registros). NUNCA inventa fatos — se não achar evidência de um " +
  "sinal, não o reporte. Toda afirmação precisa de uma URL de fonte real encontrada na busca.";

const TIPOS = Object.keys(PESOS).join(", ");

function clamp(n: number) { return Math.max(0, Math.min(100, n)); }

export async function investigarEmpresa(empresa: Empresa): Promise<ResearchResult> {
  const scoreV0 = empresa.score?.score ?? 0;
  const socios = (empresa.socio ?? []).map((s) => s.nome).join(", ");

  const prompt = `Investigue esta empresa na web e procure sinais de risco/propensão sucessória.

Empresa: ${empresa.razao_social}${empresa.nome_fantasia ? ` (${empresa.nome_fantasia})` : ""}
Setor: ${empresa.cnae_principal_desc ?? empresa.cnae_principal}
Cidade: ${empresa.municipio} / ${empresa.uf}
Fundada em: ${empresa.data_inicio_atividade?.slice(0, 4) ?? "?"}
Sócios: ${socios || "não informado"}

Procure evidência pública para estes tipos de sinal (só reporte os que REALMENTE encontrar, com fonte):
- "mencao_sucessao_venda" — notícia/post mencionando sucessão, venda, fusão ou reorganização
- "banco_investimento" — empresa contratou assessor/banco de investimento
- "herdeiro_fora_carreira" — filhos/herdeiros do(s) sócio(s) em outras profissões (não no negócio)
- "csuite_externo" — executivos C-level com sobrenome diferente da família fundadora
- "big4_auditoria" — auditoria por Big 4 (Deloitte, PwC, EY, KPMG)
- "sucessor_familiar_ativo" — herdeiro da família JÁ atuando na gestão/sociedade (REDUZ o risco)
- "sem_presenca_digital" — a empresa praticamente não tem presença online encontrável

REGRA CRÍTICA: o campo "tipo" DEVE ser EXATAMENTE um dos sete identificadores acima (snake_case,
entre aspas). NUNCA escreva um título livre no campo "tipo" — use o identificador literal. A
descrição do achado vai no campo "descricao", não no "tipo".

Ao final, responda APENAS com este JSON (sem markdown), exemplo do formato exato:
{
  "presenca_digital": "baixa",
  "resumo": "1-2 frases do que a investigação concluiu",
  "sinais": [
    {"tipo": "sucessor_familiar_ativo", "descricao": "André, filho do fundador, já é diretor desde 2015", "fonte_url": "https://..."}
  ]
}
Valores válidos de "tipo": ${TIPOS}. Se não achar nada conclusivo, retorne "sinais": [] e explique no resumo.

EFICIÊNCIA: faça no máximo 4 buscas na web, depois conclua com o JSON. Não exaustivo — foque nos sinais mais prováveis.`;

  // Agent SDK com WebSearch — a IA pesquisa de verdade, usando a assinatura (custo zero).
  let raw: string | null = null;
  for await (const message of query({
    prompt,
    options: {
      systemPrompt: SYSTEM,
      allowedTools: ["WebSearch", "WebFetch"],
      maxTurns: 18, // web search consome ~1 turn por busca; precisa de folga pra sintetizar o JSON
      env: envSemApiKey(),
    },
  })) {
    if (message.type === "result" && message.subtype === "success") {
      raw = message.result;
    }
  }

  if (!raw) throw new Error("Research: Agent SDK não retornou resultado");

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Research: resposta sem JSON: " + raw.slice(0, 200));
  const parsed = JSON.parse(match[0]);

  // Aplica pesos no código (LLM não decide score). Descarta tipos desconhecidos.
  const sinais: SinalQualitativo[] = (Array.isArray(parsed.sinais) ? parsed.sinais : [])
    .map((s: Record<string, unknown>) => {
      const tipo = String(s.tipo ?? "");
      const def = PESOS[tipo];
      if (!def) return null;
      return {
        tipo,
        rotulo: def.rotulo,
        descricao: String(s.descricao ?? "").trim(),
        fonte_url: typeof s.fonte_url === "string" && s.fonte_url.startsWith("http") ? s.fonte_url : null,
        peso: def.peso,
      };
    })
    .filter((s: SinalQualitativo | null): s is SinalQualitativo => s !== null);

  const ajuste = sinais.reduce((acc, s) => acc + s.peso, 0);
  const scoreV1 = clamp(scoreV0 + ajuste);

  console.log(
    `[research] ${empresa.razao_social.slice(0, 30)} — v0:${scoreV0}→v1:${scoreV1} ` +
    `(${sinais.length} sinais, via assinatura)`
  );

  return {
    sinais,
    presenca_digital: ["alta", "media", "baixa", "nenhuma"].includes(parsed.presenca_digital)
      ? parsed.presenca_digital
      : "baixa",
    resumo: String(parsed.resumo ?? "").trim(),
    score_v0: scoreV0,
    score_v1: scoreV1,
    delta: scoreV1 - scoreV0,
  };
}
