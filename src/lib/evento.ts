/* Sensor do loop de aprendizado — server-only.
 *
 * O que se grava aqui não é uso, é SINAL DE TREINO. O score v0 é heurística
 * nossa e o v1 soma sinais da web; nenhum dos dois aprende sozinho. Quem ensina é
 * a revelação de preferência do analista: a lista que mostramos contra o que ele
 * salvou e descartou. Salvar o 17º e ignorar o 1º é o score errando, com rótulo
 * de graça.
 *
 * Por isso `registrarBusca` guarda o TOP RANQUEADO e não só a query. Diferente de
 * quase tudo neste repo, isto NÃO é recomputável: uma busca não gravada é um
 * rótulo perdido pra sempre.
 *
 * REGRA DE OURO: gravar evento NUNCA pode derrubar a request do usuário. O log
 * serve ao modelo, não ao originador que está tentando trabalhar. Toda falha aqui
 * vira console.error e a vida segue.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { escopoAtual } from "./escopo";
import { usuarioAtual } from "./sessao";
import type { Empresa } from "./types";

export type TipoEvento = "busca" | "dossie" | "investigacao" | "salvou" | "descartou" | "estagio";

async function gravar(
  supabase: SupabaseClient,
  tipo: TipoEvento,
  empresaId: string | null,
  payload: Record<string, unknown>
) {
  try {
    const [orgId, user] = await Promise.all([escopoAtual(), usuarioAtual()]);
    const { error } = await supabase.from("evento").insert({
      org_id: orgId,
      user_id: user?.id ?? null,
      tipo,
      empresa_id: empresaId,
      payload,
    });
    if (error) console.error(`[evento] ${tipo} não gravado:`, error.message);
  } catch (err) {
    // Sessão ausente, migration 0013 não aplicada, banco fora: nada disso é
    // motivo pra falhar a ação que o usuário pediu.
    console.error(`[evento] ${tipo} não gravado:`, (err as Error).message);
  }
}

/**
 * A lista ranqueada que foi EXIBIDA. É o evento mais valioso do sistema: sem ele
 * não dá pra saber o que o analista recusou, só o que aceitou — e um modelo que
 * só vê acertos não corrige nada.
 *
 * Guarda no máximo 50 posições: é o teto do que a busca devolve, e a decisão real
 * acontece nas primeiras telas.
 */
export async function registrarBusca(
  supabase: SupabaseClient,
  query: string,
  filtros: unknown,
  empresas: Empresa[],
  pagina = 0
) {
  await gravar(supabase, "busca", null, {
    query,
    filtros,
    /* Página importa pro loop: escolher o 3º da página 1 e escolher o 3º da
       página 4 são sinais muito diferentes (o segundo é posição 153 do ranking).
       Sem isto, as posições de páginas distintas se misturariam como se fossem
       todas do topo, e a mediana mentiria pra baixo. */
    pagina,
    total: empresas.length,
    // posicao é 1-based porque a pergunta que se faz depois é "em que lugar da
    // lista ele achou o que prestava", e ninguém pensa nisso começando do zero.
    top: empresas.slice(0, 50).map((e, i) => ({
      id: e.id,
      // Posição ABSOLUTA no ranking, não dentro da página: é o número que responde
      // "quão longe do topo estava o que ele quis".
      posicao: pagina * 50 + i + 1,
      score: e.score_v1?.score ?? e.score?.score ?? null,
      tinha_v1: !!e.score_v1,
    })),
  });
}

/** Escolheu. Rótulo positivo, ancorado no score que o modelo dava na hora. */
export async function registrarSalvou(supabase: SupabaseClient, empresaId: string, score: number | null) {
  await gravar(supabase, "salvou", empresaId, { score_no_momento: score });
}

/** Recusou. O rótulo NEGATIVO é o mais escasso e o mais informativo, porque o
 *  motivo escrito à mão diz o que a heurística não enxerga. */
export async function registrarDescartou(supabase: SupabaseClient, empresaId: string, motivo: string | null) {
  await gravar(supabase, "descartou", empresaId, { motivo });
}

/** Abriu o memo. Sinal fraco de interesse: leu a fundo antes de decidir. */
export async function registrarDossie(supabase: SupabaseClient, empresaId: string, doCache: boolean) {
  await gravar(supabase, "dossie", empresaId, { cache: doCache });
}

/** Mandou investigar. Sinal forte: gastou tempo de máquina nesta e não nas outras. */
export async function registrarInvestigacao(
  supabase: SupabaseClient,
  empresaId: string,
  v0: number | null,
  v1: number | null
) {
  await gravar(supabase, "investigacao", empresaId, { score_v0: v0, score_v1: v1 });
}

/** Andou (ou parou) no funil. É o desfecho real contra o score previsto. */
export async function registrarEstagio(
  supabase: SupabaseClient,
  empresaId: string | null,
  de: string | null,
  para: string
) {
  await gravar(supabase, "estagio", empresaId, { de, para });
}
