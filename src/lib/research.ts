// Research-agent — eleva o score v0 (heurística) para v1 (com sinais qualitativos da web).
//
// É o score v1 do Playbook Relay §11. A IA investiga a empresa na web e procura
// sinais que a heurística não enxerga. Híbrido e honesto:
//   - O LLM IDENTIFICA quais sinais existem (de uma lista fechada) e cita a FONTE.
//   - O CÓDIGO aplica os pesos (o LLM não inventa números de score).
//   - Ajuste é BIDIRECIONAL: pode confirmar/subir o risco OU rebaixá-lo (ex: achou sucessor).
//
// Usa a Anthropic API direta (ANTHROPIC_API_KEY do .env.local) + a web search tool
// server-side (`web_search_20250305`): o modelo busca na web sozinho e devolve o texto final.
// Funciona local E no Vercel. Custo ~$0.04-0.22/empresa (até 4 buscas + tokens).
// Substituiu o Agent SDK + WebSearch na assinatura (que só rodava com o Claude Code logado
// e foi bloqueado por "org disabled subscription access", issue claude-code#8327).

import Anthropic from "@anthropic-ai/sdk";
import type { Empresa, SinalQualitativo, ResearchResult } from "./types";

export type { SinalQualitativo, ResearchResult };

// Lazy: cria o cliente na primeira chamada (garante ANTHROPIC_API_KEY já no process.env).
let _client: Anthropic | null = null;
function getClient() {
  if (!_client) _client = new Anthropic();
  return _client;
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

Depois de listar os sinais, decida duas coisas práticas pro originador:

- "gatilho" — em UMA frase, o motivo mais acionável pra abordar ESTA empresa AGORA (o "por que agora").
  Use o achado mais time-sensitive: sócio principal em idade avançada sem sucessor, co-sócio que saiu,
  menção a venda, banco contratado. Se NÃO houver nada que justifique timing, retorne null (não force).
- "mensagem_abordagem" — um rascunho curto (3-4 frases, PT-BR, tom respeitoso e consultivo, NÃO vendedor)
  de primeiro contato com o(s) sócio(s)/empresa. DEVE citar o gatilho/achado concreto pra não ser
  genérica. É ponto de partida pro humano editar, não envio automático. Se não houver gatilho, retorne null.

Ao final, responda APENAS com este JSON (sem markdown), exemplo do formato exato:
{
  "presenca_digital": "baixa",
  "resumo": "1-2 frases do que a investigação concluiu",
  "sinais": [
    {"tipo": "sucessor_familiar_ativo", "descricao": "André, filho do fundador, já é diretor desde 2015", "fonte_url": "https://..."}
  ],
  "gatilho": "Sócio fundador na faixa 80+ e sem sucessor identificado na gestão — janela de sucessão aberta.",
  "mensagem_abordagem": "Prezado(a) [nome], acompanho o setor de [x] no interior de SP..."
}
Valores válidos de "tipo": ${TIPOS}. Se não achar nada conclusivo, retorne "sinais": [] e explique no resumo.

EFICIÊNCIA: faça no máximo 4 buscas na web, depois conclua com o JSON. Não exaustivo — foque nos sinais mais prováveis.`;

  // API direta + web search tool server-side: o modelo faz as buscas sozinho (até max_uses)
  // e devolve a resposta final. max_uses=4 espelha o "máximo 4 buscas" do prompt.
  const message = await getClient().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096, // folga pra raciocínio das buscas + o JSON final
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }],
  });

  // A resposta vem como blocks intercalados (text + server_tool_use + web_search_tool_result).
  // O JSON final está nos text blocks — concatena todos e extrai.
  const raw = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  if (!raw) throw new Error("Research: API não retornou texto");

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
    `(${sinais.length} sinais, via API + web search)`
  );

  const gatilho =
    typeof parsed.gatilho === "string" && parsed.gatilho.trim() ? parsed.gatilho.trim() : null;
  const mensagem =
    typeof parsed.mensagem_abordagem === "string" && parsed.mensagem_abordagem.trim()
      ? parsed.mensagem_abordagem.trim()
      : null;

  return {
    sinais,
    presenca_digital: ["alta", "media", "baixa", "nenhuma"].includes(parsed.presenca_digital)
      ? parsed.presenca_digital
      : "baixa",
    resumo: String(parsed.resumo ?? "").trim(),
    score_v0: scoreV0,
    score_v1: scoreV1,
    delta: scoreV1 - scoreV0,
    gatilho,
    // só mantém a mensagem se houver gatilho — sem motivo de timing, não inventa abordagem
    mensagem_abordagem: gatilho ? mensagem : null,
  };
}
