// Dossiê — memo instantâneo de uma empresa para deal sourcing.
//
// Híbrido: a parte analítica (overview, perguntas, tese) é gerada pelo Claude;
// a parte estrutural (timeline, quadro societário) a UI monta direto dos dados.
// Aqui só geramos a análise — economiza tokens e mantém os dados 100% precisos.

import Anthropic from "@anthropic-ai/sdk";
import type { Empresa, DossierAnalise } from "./types";

let _client: Anthropic | null = null;
function getClient() {
  if (!_client) _client = new Anthropic();
  return _client;
}

export type { DossierAnalise };

const SYSTEM =
  "Você é um sócio de uma boutique de M&A no Brasil, especializado em originação de " +
  "deals com empresas familiares em risco sucessório. Recebe o dossiê de dados de uma " +
  "empresa e escreve uma análise objetiva e acionável para um analista que vai fazer o " +
  "primeiro contato com o fundador. Tom profissional, específico, sem encher linguiça. " +
  "Responde SEMPRE e APENAS com JSON válido, sem markdown.";

const FAIXA_LABEL: Record<string, string> = {
  "1": "0-12", "2": "13-20", "3": "21-30", "4": "31-40", "5": "41-50",
  "6": "51-60", "7": "61-70", "8": "71-80", "9": "80+",
};

function dadosParaPrompt(e: Empresa) {
  const socios = (e.socio ?? []).map((s) => ({
    nome: s.nome,
    faixa_etaria: s.faixa_etaria ? FAIXA_LABEL[s.faixa_etaria] ?? s.faixa_etaria : null,
    qualificacao: s.qualificacao,
    entrou_em: s.data_entrada_sociedade?.slice(0, 4) ?? null,
  }));
  return {
    razao_social: e.razao_social,
    nome_fantasia: e.nome_fantasia,
    setor: e.cnae_principal_desc ?? e.cnae_principal,
    atividades_secundarias: (e.cnaes_secundarios ?? []).map((c) => c.descricao).filter(Boolean),
    cidade: e.municipio,
    uf: e.uf,
    fundada_em: e.data_inicio_atividade?.slice(0, 4) ?? null,
    natureza_juridica: e.natureza_juridica,
    capital_social: e.capital_social,
    porte: e.porte,
    score_risco_sucessorio: e.score?.score ?? null,
    sinais: e.score?.sinais ?? [],
    quadro_societario: socios,
  };
}

export async function gerarDossierAnalise(empresa: Empresa): Promise<DossierAnalise> {
  const dados = dadosParaPrompt(empresa);

  const prompt = `Gere a análise do dossiê desta empresa. Use SÓ os dados fornecidos —
não invente faturamento, número de funcionários ou fatos que não estão aqui.

Responda APENAS com este JSON:
{
  "overview": "2-3 frases sobre o que a empresa é (setor, idade, porte, localização)",
  "analise_sucessoria": "1 parágrafo: leia o quadro societário e explique por que há (ou não) risco sucessório — idade dos sócios, há quanto tempo o quadro está parado, presença ou ausência de herdeiros mais jovens, sinais de transição",
  "perguntas_abordagem": ["4 a 5 perguntas específicas para o primeiro contato com o fundador, ancoradas nos dados desta empresa — não genéricas"],
  "tese_aproximacao": "2 frases: por que essa empresa é um alvo interessante e qual o ângulo de abordagem"
}

Dados da empresa:
${JSON.stringify(dados, null, 2)}`;

  const message = await getClient().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });

  const usage = message.usage;
  console.log(
    `[dossier] ${empresa.razao_social.slice(0, 30)} — ${usage.input_tokens} in / ${usage.output_tokens} out` +
    ` ($${((usage.input_tokens * 3 + usage.output_tokens * 15) / 1_000_000).toFixed(4)})`
  );

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Dossier: resposta sem JSON: " + raw.slice(0, 200));

  const parsed = JSON.parse(match[0]);
  return {
    overview: String(parsed.overview ?? "").trim(),
    analise_sucessoria: String(parsed.analise_sucessoria ?? "").trim(),
    perguntas_abordagem: Array.isArray(parsed.perguntas_abordagem)
      ? parsed.perguntas_abordagem.map((p: unknown) => String(p).trim()).filter(Boolean)
      : [],
    tese_aproximacao: String(parsed.tese_aproximacao ?? "").trim(),
  };
}
