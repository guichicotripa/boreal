// Dossiê — memo instantâneo de uma empresa para deal sourcing.
//
// Híbrido: a parte analítica (overview, perguntas, tese) é gerada pelo Claude;
// a parte estrutural (timeline, quadro societário) a UI monta direto dos dados.
// Aqui só geramos a análise — economiza tokens e mantém os dados 100% precisos.

import Anthropic from "@anthropic-ai/sdk";
import type { Empresa, DossierAnalise, RedFlag, ResearchResult } from "./types";
import { MODELO_ANALISE } from "./modelos";

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

/* O que a investigação (v1) achou na web, reduzido ao que muda a análise.
   Sem isto o memo escrevia tese de aproximação, red flags e próximo passo
   conhecendo só o registro do CNPJ — cego para "tem banco de investimento
   contratado", "o herdeiro seguiu outra carreira", "há menção pública a venda".
   São justamente os fatos que decidem o ângulo e a urgência da abordagem. */
function researchParaPrompt(r: ResearchResult) {
  return {
    resumo_do_que_foi_achado: r.resumo,
    perfil_do_negocio: r.perfil_negocio ?? null,
    presenca_digital: r.presenca_digital,
    gatilho_de_timing: r.gatilho,
    score_apos_investigacao: r.score_v1,
    delta_vs_score_de_registro: r.delta,
    sinais_encontrados: (r.sinais ?? []).map((s) => ({
      sinal: s.rotulo,
      descricao: s.descricao,
      peso_no_score: s.peso,
      fonte: s.fonte_url,
    })),
  };
}

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
    cnpj: e.cnpj,
    setor: e.cnae_principal_desc ?? e.cnae_principal,
    cnae_codigo: e.cnae_principal,
    atividades_secundarias: (e.cnaes_secundarios ?? []).map((c) => c.descricao).filter(Boolean),
    cidade: e.municipio,
    uf: e.uf,
    fundada_em: e.data_inicio_atividade?.slice(0, 4) ?? null,
    natureza_juridica: e.natureza_juridica,
    capital_social: e.capital_social, // ⚠️ registro contábil histórico — NÃO é porte nem receita
    porte: e.porte,
    contato: { telefone: e.telefone ?? null, email: e.email ?? null },
    score_risco_sucessorio: e.score?.score ?? null,
    sinais: e.score?.sinais ?? [],
    quadro_societario: socios,
  };
}

/* O prompt e o parse são exportados separados da chamada porque o memo é gerado
   por dois caminhos: a rota (API, sob demanda) e o lote (assinatura, custo zero).
   Se cada caminho tivesse a própria cópia do prompt, os memos do lote e os do uso
   real divergiriam sem ninguém notar — é o mesmo motivo de calcScore ser importada
   em vez de replicada nos scripts. */
export const DOSSIER_SYSTEM = SYSTEM;

export function promptDossier(empresa: Empresa, research?: ResearchResult | null): string {
  const dados = dadosParaPrompt(empresa);
  const investigacao = research ? researchParaPrompt(research) : null;
  return `Gere a análise do dossiê desta empresa. Use SÓ os dados fornecidos —
não invente faturamento, número de funcionários ou fatos que não estão aqui.

REGRAS CRÍTICAS:
- NUNCA use capital_social como proxy de porte/tamanho/faturamento — é registro contábil histórico,
  pode estar defasado décadas. Se mencionar, deixe claro que não indica receita nem valor.
- Não invente número financeiro. Se não há base para estimar faturamento/EBITDA, diga "não estimável
  sem dados adicionais" — não chute.
- Não invente ESTATÍSTICA nem base de comparação. Nada de "empresas nesse perfil vendem em 3-5 anos",
  "X% dos casos", "estatisticamente antecede". Nenhum número desses foi medido; escrever isso é
  inventar prova. Descreva o padrão em palavras ("quadro parado há 29 anos, sem geração seguinte
  visível") e pare aí.
- Não invente CREDENCIAL nossa. Você não sabe em que setor a boutique atua, quem ela conhece nem que
  deals já fez. O "por que nós" de tese_aproximacao deve sair do que os DADOS sustentam (ex: "chegar
  antes de virar processo competitivo", "o ângulo é continuidade, não venda") — nunca de experiência
  ou especialização afirmada sobre nós mesmos.
- red_flags: liste os riscos PROVÁVEIS dado o perfil (setor, idade da empresa, estrutura) — não afirme
  que o passivo existe; classifique a severidade e diga COMO verificar. Para indústria antiga, considere:
  passivo fiscal (checar PGFN/CARF/TJSP — grátis), NR-12 (segurança de máquinas), passivo ambiental,
  dependência do fundador (hub-and-spoke), concentração de clientes. Só inclua os que fazem sentido aqui.

Responda APENAS com este JSON:
{
  "overview": "2-3 frases sobre o que a empresa é (setor, idade, porte declarado, localização) — sem usar capital social como tamanho",
  "analise_sucessoria": "1 parágrafo: leia o quadro societário e explique por que há (ou não) risco sucessório — idade dos sócios, há quanto tempo o quadro está parado, presença/ausência de herdeiros mais jovens, sinais de transição",
  "red_flags": [{"risco": "ex: passivo fiscal oculto", "severidade": "alta|media|baixa", "como_verificar": "ex: consulta PGFN Dívida Ativa + CARF pelo CNPJ (grátis)"}],
  "perguntas_abordagem": ["4 a 5 perguntas específicas para o primeiro contato, ancoradas nos dados desta empresa — não genéricas"],
  "tese_aproximacao": "2-3 frases: por que essa empresa é um alvo interessante, qual o ângulo de abordagem, E por que o adquirente/originador é o interlocutor certo (o 'por que nós' — acesso, timing, relação, conhecimento do setor)",
  "proximo_passo": "1 frase concreta: qual o próximo passo de origination — canal sugerido (usar telefone/email se houver no dado de contato; senão LinkedIn do sócio mais jovem, contador via QSA, ou associação setorial) + ação"
}

Dados da empresa (registro público do CNPJ):
${JSON.stringify(dados, null, 2)}
${investigacao ? `
INVESTIGAÇÃO NA WEB (v1) — já feita para esta empresa. Use estes achados; eles valem
mais que o perfil de registro para decidir o ângulo e a urgência:
${JSON.stringify(investigacao, null, 2)}

Como usar a investigação:
- "tese_aproximacao" e "proximo_passo" devem partir dos sinais encontrados e do gatilho de
  timing, não só do perfil societário. Se há banco de investimento contratado ou menção
  pública a venda, isso MUDA o ângulo e precisa aparecer.
- "analise_sucessoria" deve reconciliar registro e web: se a investigação achou sucessor
  familiar já atuando, diga que o risco sucessório é menor do que o quadro sugere.
- "perguntas_abordagem" devem incorporar o que já se sabe — não pergunte o que a
  investigação já respondeu.
- "red_flags": só o que o perfil ou os achados sustentam. A investigação NÃO autoriza
  afirmar passivo; segue valendo listar risco provável e como verificar.
- Cite o achado, nunca a fonte crua como se fosse fato consumado. Se um sinal tem
  fonte null, trate como indício fraco.` : `
SEM investigação na web para esta empresa: escreva a partir do registro apenas, e não
finja saber de fatos externos (assessores, intenção de venda, sucessores).`}`;
}

export async function gerarDossierAnalise(
  empresa: Empresa,
  research?: ResearchResult | null
): Promise<DossierAnalise> {
  const prompt = promptDossier(empresa, research);

  const message = await getClient().messages.create({
    model: MODELO_ANALISE,
    max_tokens: 1500,
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });

  const usage = message.usage;
  console.log(
    `[dossier] ${empresa.razao_social.slice(0, 30)} — ${usage.input_tokens} in / ${usage.output_tokens} out` +
    ` ($${((usage.input_tokens * 3 + usage.output_tokens * 15) / 1_000_000).toFixed(4)})`
  );

  return parseDossier(message.content[0].type === "text" ? message.content[0].text : "");
}

/** Normaliza a resposta do modelo em DossierAnalise. Compartilhado pelos dois caminhos. */
export function parseDossier(raw: string): DossierAnalise {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Dossier: resposta sem JSON: " + raw.slice(0, 200));

  const parsed = JSON.parse(match[0]);
  const SEV = ["alta", "media", "baixa"];
  return {
    overview: String(parsed.overview ?? "").trim(),
    analise_sucessoria: String(parsed.analise_sucessoria ?? "").trim(),
    red_flags: Array.isArray(parsed.red_flags)
      ? parsed.red_flags
          .map((r: Record<string, unknown>): RedFlag => ({
            risco: String(r?.risco ?? "").trim(),
            severidade: (SEV.includes(String(r?.severidade)) ? String(r?.severidade) : "media") as RedFlag["severidade"],
            como_verificar: String(r?.como_verificar ?? "").trim(),
          }))
          .filter((r: RedFlag) => r.risco)
      : [],
    perguntas_abordagem: Array.isArray(parsed.perguntas_abordagem)
      ? parsed.perguntas_abordagem.map((p: unknown) => String(p).trim()).filter(Boolean)
      : [],
    tese_aproximacao: String(parsed.tese_aproximacao ?? "").trim(),
    proximo_passo: String(parsed.proximo_passo ?? "").trim(),
  };
}
