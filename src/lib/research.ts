// Research-agent — eleva o score v0 (heurística) para v1 (com sinais qualitativos da web).
//
// É o score v1 do Playbook Relay §11. A IA investiga a empresa na web e procura
// sinais que a heurística não enxerga. Híbrido e honesto:
//   - O LLM IDENTIFICA quais sinais existem (de uma lista fechada) e cita a FONTE.
//   - O CÓDIGO aplica os pesos (o LLM não inventa números de score).
//   - Ajuste é BIDIRECIONAL: pode confirmar/subir o risco OU rebaixá-lo (ex: achou sucessor).
//
// Usa a Anthropic API direta (ANTHROPIC_API_KEY do .env.local) + a web search tool
import { MODELO_ANALISE } from "./modelos.ts";
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

/* Tipos de sinal e seus pesos (ajuste sobre o score determinístico).
 *
 * HONESTIDADE SOBRE ESTES PESOS: diferente dos eixos de scoring.ts, eles NÃO saíram de lift medido
 * contra aquisições reais, e não têm como sair: medir exigiria rodar o LLM sobre centenas de
 * milhares de empresas. São calibrados por ancoragem, e onde existe um proxy de registro medível
 * a DIREÇÃO deles é obrigada a concordar com o dado. Ver brain/modelo-de-score.md §11.
 *
 * Foi assim que dois deles apareceram INVERTIDOS em 29/07/2026. Ambos codificavam a tese ingênua
 * de sucessão (dono velho + nenhum herdeiro = tem que vender), que o lift condicional derrubou:
 *   · sócio de até 50 anos no quadro  lift 2,14x  (z = 9,5)  → sucessor presente PREVÊ a venda
 *   · nenhum sócio até 50 anos        lift 0,58x  (z = 9,5)  → ausência é ANTI-sinal
 * `sucessor_familiar_ativo` valia -25, o maior castigo do sistema, e `herdeiro_fora_carreira`
 * valia +8. Os dois trocaram de lado. Herdeiro no quadro não trava a venda, ele é quem a conduz.
 *
 * Magnitude ancorada no eixo equivalente do score (sucessor aparente = 14 de 100), um pouco abaixo
 * dele porque evidência qualitativa da web é menos verificável que o registro. A assimetria entre
 * +12 e -8 acompanha a dos lifts (2,14x sobe mais do que 0,58x desce).
 */
const PESOS: Record<string, { peso: number; rotulo: string }> = {
  banco_investimento:     { peso: +15, rotulo: "Assessor/banco de investimento contratado" },
  mencao_sucessao_venda:  { peso: +12, rotulo: "Menção pública a sucessão/venda" },
  sucessor_familiar_ativo:{ peso: +12, rotulo: "Sucessor familiar já atuando" },
  csuite_externo:         { peso: +6,  rotulo: "C-suite profissional externo à família" },
  big4_auditoria:         { peso: +5,  rotulo: "Auditoria Big 4" },
  sem_presenca_digital:   { peso: +3,  rotulo: "Sem pegada digital (perfil old-school)" },
  herdeiro_fora_carreira: { peso: -8,  rotulo: "Herdeiros fora do negócio (sem sucessão à vista)" },
};

const SYSTEM =
  "Você é um analista de origination de M&A investigando uma empresa familiar brasileira " +
  "para avaliar risco sucessório. Você pesquisa SOMENTE fontes públicas (LinkedIn público, " +
  "imprensa, site da empresa, registros). NUNCA inventa fatos — se não achar evidência de um " +
  "sinal, não o reporte. Toda afirmação precisa de uma URL de fonte real encontrada na busca.";

const TIPOS = Object.keys(PESOS).join(", ");

function clamp(n: number) { return Math.max(0, Math.min(100, n)); }

/* Prompt e parse ficam separados da chamada porque a investigação roda por DOIS
   caminhos: a rota (API + web search server-side, sob demanda) e o lote
   (assinatura + Agent SDK, custo zero). Enquanto cada caminho carregava a própria
   cópia do prompt — scripts/cache-research-sub.mjs tinha uma —, os v1 do lote e os
   do uso real divergiam sem ninguém ver: a cópia do .mjs nunca ganhou `gatilho`,
   `mensagem_abordagem` nem `perfil_negocio`, que hoje o memo lê. Mesmo motivo de
   DOSSIER_SYSTEM/promptDossier estarem exportados em dossier.ts. */
export const RESEARCH_SYSTEM = SYSTEM;

export function promptResearch(empresa: Empresa, opts?: { contextoSite?: string }): string {
  const socios = (empresa.socio ?? []).map((s) => s.nome).join(", ");

  // Contexto pré-coletado do site oficial (lido via Scrapling na geração de cache). Quando presente,
  // o modelo usa como base do perfil_negocio e gasta menos buscas — o site já vem mastigado, então
  // as buscas focam nos sinais de sucessão/venda que o site nunca traz. Browser não roda no Vercel,
  // por isso a coleta é offline (script/worker) e só o texto entra aqui.
  const ctxSite = opts?.contextoSite?.trim()
    ? `\nCONTEXTO JÁ COLETADO DO SITE OFICIAL (extraído do site da empresa; use como base do ` +
      `perfil_negocio e para guiar as buscas — NÃO re-busque o site, foque as buscas nos sinais de ` +
      `sucessão/venda que o site não traz):\n"""\n${opts.contextoSite.trim().slice(0, 12000)}\n"""\n`
    : "";

  return `Investigue esta empresa na web e procure sinais de risco/propensão sucessória.

Empresa: ${empresa.razao_social}${empresa.nome_fantasia ? ` (${empresa.nome_fantasia})` : ""}
Setor: ${empresa.cnae_principal_desc ?? empresa.cnae_principal}
Cidade: ${empresa.municipio} / ${empresa.uf}
Fundada em: ${empresa.data_inicio_atividade?.slice(0, 4) ?? "?"}
Sócios: ${socios || "não informado"}
${ctxSite}
Procure evidência pública para estes tipos de sinal (só reporte os que REALMENTE encontrar, com fonte):
- "mencao_sucessao_venda" — notícia/post mencionando sucessão, venda, fusão ou reorganização
- "banco_investimento" — empresa contratou assessor/banco de investimento
- "herdeiro_fora_carreira" — filhos/herdeiros do(s) sócio(s) em outras profissões, longe do negócio
- "csuite_externo" — executivos C-level com sobrenome diferente da família fundadora
- "big4_auditoria" — auditoria por Big 4 (Deloitte, PwC, EY, KPMG)
- "sucessor_familiar_ativo" — herdeiro da família JÁ atuando na gestão da empresa
- "sem_presenca_digital" — a empresa praticamente não tem presença online encontrável

CONTRAINTUITIVO, e é medido: sucessor familiar atuando AUMENTA a propensão à venda, não reduz.
Quem conduz uma venda é o herdeiro que está dentro do negócio (negocia, organiza a casa, contrata
assessor, e com frequência é quem decide sair). Empresa de dono idoso sem ninguém da geração
seguinte tende a encerrar, não a vender. Não "corrija" isso: reporte o que encontrar.

REGRA DE EVIDÊNCIA para "sucessor_familiar_ativo": só reporte se a fonte for EXTERNA ao registro
público (imprensa, LinkedIn, site da empresa, entrevista). Página de agregador de CNPJ que apenas
repete o quadro societário NÃO conta: o quadro já foi lido e pontuado antes de você ser chamado,
e re-reportá-lo faz o mesmo fato valer duas vezes. O que agrega aqui é o herdeiro que aparece na
GESTÃO sem estar visível como sócio.

REGRA CRÍTICA: o campo "tipo" DEVE ser EXATAMENTE um dos sete identificadores acima (snake_case,
entre aspas). NUNCA escreva um título livre no campo "tipo" — use o identificador literal. A
descrição do achado vai no campo "descricao", não no "tipo".

Depois de listar os sinais, decida duas coisas práticas pro originador:

- "gatilho" — em UMA frase, o motivo mais acionável pra abordar ESTA empresa AGORA (o "por que agora").
  Use o achado mais time-sensitive: menção a venda, banco contratado, sucessor assumindo a gestão,
  co-sócio que saiu, mudança recente no comando. Se NÃO houver nada que justifique timing, retorne
  null (não force). "Sócio idoso" sozinho NÃO é gatilho: é condição de anos, não motivo de agora.
- "mensagem_abordagem" — um rascunho curto (3-4 frases, PT-BR, tom respeitoso e consultivo, NÃO vendedor)
  de primeiro contato com o(s) sócio(s)/empresa. DEVE citar o gatilho/achado concreto pra não ser
  genérica. É ponto de partida pro humano editar, não envio automático. Se não houver gatilho, retorne null.

Separado da análise sucessória, descreva o NEGÓCIO da empresa:

- "perfil_negocio" — 2-3 frases sobre o que a empresa faz na prática: produtos/serviços principais,
  modelo de negócio (como ganha dinheiro) e tipo de cliente (B2B/B2C, setores atendidos, clientes
  conhecidos se públicos). Baseie-se SÓ no que encontrar na web/site da empresa; não invente nem
  estime faturamento. Se não achar nada além do CNAE, retorne null.

Ao final, responda APENAS com este JSON (sem markdown), exemplo do formato exato:
{
  "presenca_digital": "baixa",
  "resumo": "1-2 frases do que a investigação concluiu",
  "perfil_negocio": "Fabricante de moldes para injeção plástica; vende B2B para a indústria automotiva e de embalagens.",
  "sinais": [
    {"tipo": "sucessor_familiar_ativo", "descricao": "André, filho do fundador, assumiu a direção comercial em 2023 (entrevista à Valor)", "fonte_url": "https://..."}
  ],
  "gatilho": "Segunda geração assumiu a direção em 2023 e a empresa contratou assessoria no mesmo ano: transição em curso, momento de conversa.",
  "mensagem_abordagem": "Prezado(a) [nome], acompanho o setor de [x] no interior de SP..."
}
Valores válidos de "tipo": ${TIPOS}. Se não achar nada conclusivo, retorne "sinais": [] e explique no resumo.

EFICIÊNCIA: faça no máximo 4 buscas na web, depois conclua com o JSON. Não exaustivo — foque nos sinais mais prováveis.`;
}

export async function investigarEmpresa(
  empresa: Empresa,
  opts?: { contextoSite?: string },
): Promise<ResearchResult> {
  const scoreV0 = empresa.score?.score ?? 0;

  // API direta + web search tool server-side: o modelo faz as buscas sozinho (até max_uses)
  // e devolve a resposta final. max_uses=4 espelha o "máximo 4 buscas" do prompt.
  const message = await getClient().messages.create({
    model: MODELO_ANALISE,
    max_tokens: 4096, // folga pra raciocínio das buscas + o JSON final
    system: SYSTEM,
    messages: [{ role: "user", content: promptResearch(empresa, opts) }],
    // Com o site já mastigado, 3 buscas bastam (foco em sucessão); sem contexto, 4.
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: opts?.contextoSite ? 3 : 4 }],
  });

  // A resposta vem como blocks intercalados (text + server_tool_use + web_search_tool_result).
  // O JSON final está nos text blocks — concatena todos e extrai.
  const raw = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  if (!raw) throw new Error("Research: API não retornou texto");

  const res = parseResearch(raw, scoreV0);
  console.log(
    `[research] ${empresa.razao_social.slice(0, 30)} — v0:${res.score_v0}→v1:${res.score_v1} ` +
    `(${res.sinais.length} sinais, via API + web search)`
  );
  return res;
}

/**
 * Ajuste total de um conjunto de sinais, com o peso contando UMA VEZ POR TIPO.
 *
 * Os pesos foram desenhados como "este sinal existe" → tanto; duas menções ao mesmo fato não são
 * dois fatos. Sem isto, uma empresa real levou `sucessor_familiar_ativo` duas vezes e o peso
 * dobrou. Os sinais repetidos FICAM na lista de propósito: cada um tem fonte própria, e duas
 * fontes para o mesmo achado é evidência mais forte para quem lê. O que não pode dobrar é o número.
 *
 * Lê o peso de PESOS pelo tipo em vez de confiar no `peso` gravado no objeto: investigação
 * persistida carrega o peso da época, então recalcular a partir dela exige a tabela atual. É o
 * que permite corrigir uma inversão de sinal sem reinvestigar tudo do zero.
 */
export function ajusteDeSinais(sinais: { tipo: string }[]): number {
  const tiposContados = new Set<string>();
  return sinais.reduce((acc, s) => {
    if (tiposContados.has(s.tipo)) return acc;
    tiposContados.add(s.tipo);
    return acc + (PESOS[s.tipo]?.peso ?? 0);
  }, 0);
}

/** Normaliza a resposta do modelo em ResearchResult. Compartilhado pelos dois caminhos. */
export function parseResearch(raw: string, scoreV0: number): ResearchResult {
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

  /* Peso conta UMA VEZ POR TIPO, não por ocorrência. Os pesos foram desenhados
     como "este sinal existe" → tanto; duas menções ao mesmo fato não são dois
     fatos. Sem isto, uma empresa levou `sucessor_familiar_ativo` duas vezes e
     caiu 50 pontos em vez de 25, e o -25 é o maior peso do sistema.

     Os sinais repetidos FICAM na lista de propósito: cada um tem fonte própria, e
     duas fontes para o mesmo achado é evidência mais forte para quem lê. O que
     não pode dobrar é o número. */
  const scoreV1 = clamp(scoreV0 + ajusteDeSinais(sinais));

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
    perfil_negocio:
      typeof parsed.perfil_negocio === "string" && parsed.perfil_negocio.trim()
        ? parsed.perfil_negocio.trim()
        : null,
    score_v0: scoreV0,
    score_v1: scoreV1,
    delta: scoreV1 - scoreV0,
    gatilho,
    // só mantém a mensagem se houver gatilho — sem motivo de timing, não inventa abordagem
    mensagem_abordagem: gatilho ? mensagem : null,
  };
}
