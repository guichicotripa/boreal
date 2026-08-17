/* Por que a chamada ao LLM falhou, e o que dizer ao usuário sobre isso.
 *
 * O PROBLEMA CONCRETO: `ANTHROPIC_API_KEY` está sem crédito desde 25/07/2026. Investigação e memo
 * ao vivo dependem dela, e o pré-cache cobre só o topo de cada mandato. Um originador da Setter que
 * abrir empresa fora do lote recebe hoje "falha na investigação" com status 500, que é a mesma
 * mensagem de bug de verdade. Na frente de cliente pagante isso lê como produto quebrado, quando o
 * fato é banal e administrativo: acabou o crédito.
 *
 * A distinção importa porque as AÇÕES são opostas. Sem crédito, tentar de novo nunca vai funcionar
 * e o botão de repetir é uma mentira. Falha transitória, sim.
 *
 * PURO E SEM DEPENDÊNCIA do SDK de propósito: recebe `unknown` e olha status e texto. Assim dá pra
 * testar sem instanciar cliente nenhum, e o mesmo classificador serve para research e dossiê.
 */

export type MotivoIndisponivel = "sem_credito" | "sem_chave" | "limite" | null;

type ComStatus = { status?: unknown; statusCode?: unknown; message?: unknown };

function textoDe(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  const e = err as ComStatus & { error?: { message?: unknown } };
  return [e.message, e.error?.message].filter((x) => typeof x === "string").join(" ");
}

function statusDe(err: unknown): number | null {
  const e = err as ComStatus;
  const s = e?.status ?? e?.statusCode;
  return typeof s === "number" ? s : null;
}

/**
 * Classifica o erro. `null` = falha comum (rede, parse, bug), que continua sendo 500 e continua
 * merecendo "tentar de novo".
 */
export function motivoIndisponivel(err: unknown): MotivoIndisponivel {
  const txt = textoDe(err).toLowerCase();
  const status = statusDe(err);

  /* Chave ausente estoura na CONSTRUÇÃO do cliente, antes de qualquer request, então não tem
     status HTTP nenhum — só a mensagem do SDK. */
  if (/anthropic_api_key|api key.*(missing|empty)/.test(txt)) return "sem_chave";

  // "Your credit balance is too low to access the Anthropic API" — vem como 400, não 402.
  if (/credit balance|insufficient.*credit|billing/.test(txt)) return "sem_credito";

  if (status === 401 || status === 403 || /authentication_error|invalid x-api-key/.test(txt)) {
    return "sem_chave";
  }

  /* 429 e overloaded são TRANSITÓRIOS e por isso ficam separados dos outros dois: aqui tentar de
     novo mais tarde é exatamente a coisa certa a fazer. */
  if (status === 429 || status === 529 || /rate.?limit|overloaded/.test(txt)) return "limite";

  return null;
}

/** Frase para o usuário. Diz o que houve, o que ainda funciona e o que fazer, sem jargão. */
export function mensagemIndisponivel(motivo: Exclude<MotivoIndisponivel, null>, oque: "investigação" | "memo"): string {
  const base =
    motivo === "limite"
      ? `A ${oque} ao vivo está congestionada no momento.`
      : `A ${oque} ao vivo está desligada agora (a conta de API do Boreal está sem crédito).`;
  const depois =
    motivo === "limite"
      ? "Tente de novo em alguns minutos."
      : "Isto não é falha desta empresa nem da sua busca. As empresas do topo de cada mandato já vêm com a investigação pronta; esta ainda não foi processada.";
  return `${base} ${depois}`;
}

/** Dá pra resolver tentando de novo? Só o congestionamento. */
export function valeTentarDeNovo(motivo: MotivoIndisponivel): boolean {
  return motivo === "limite";
}
