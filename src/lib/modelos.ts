/**
 * Qual modelo cada tarefa usa. Um lugar só.
 *
 * Os ids estavam escritos à mão em seis arquivos (dossier, reasoner, research,
 * llm e dois scripts) e ficaram todos presos na geração 4 depois que a 5 saiu —
 * ninguém tinha por onde ver que estavam velhos. Mesmo motivo de o registry de
 * setores e o lift.json terem virado fonte única: id repetido é id que envelhece
 * em silêncio.
 *
 * Ao trocar de geração, mexa AQUI e rode `npm test && npm run build`.
 */

/** Tarefa pesada de análise: memo (dossiê) e investigação (research v1). */
export const MODELO_ANALISE = "claude-sonnet-5";

/**
 * Análise em que a profundidade compensa o custo. Medido em 25/07/2026 no memo
 * da METALTELA (5 sócios, duas famílias), Opus 5 contra Sonnet 5:
 *   · leu "exceto padronizados" no CNAE e concluiu produto sob especificação com
 *     cliente cativo — o Sonnet ignorou o campo
 *   · levantou risco de INVENTÁRIO travar a transação num quadro de 5 sócios
 *     idosos, e mandou puxar o contrato social na JUCESP pra ver as cláusulas
 *   · perguntou qual foi o maior investimento em máquina nos últimos 5 anos —
 *     pergunta que revela se o dono ainda investe ou já desistiu
 * Custo: 113,8s contra 27,9s. Quatro vezes mais lento, e na assinatura isso é
 * orçamento de sessão, não dinheiro.
 */
export const MODELO_ANALISE_PROFUNDA = "claude-opus-5";

/** Extração de JSON estruturado (filtros da busca) — tarefa trivial, latência importa. */
export const MODELO_EXTRACAO = "claude-haiku-4-5-20251001";

/** One-liner + flags da lista. Volume alto, texto curto. */
export const MODELO_INSIGHT = "claude-sonnet-5";
