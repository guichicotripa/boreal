/* ── Escopo de dados (multi-tenant) — server-only ─────────────────────────────

   Escopo = FIRMA, não pessoa (decisão de 28/07/2026, ver migration 0010). A
   boutique inteira enxerga a mesma triagem: dois originadores da mesma firma
   ligando pro mesmo fundador é um vexame real, e `novo_para_setter`, que mede o
   piloto, é métrica de firma. Quem agiu fica registrado por linha (`dono`,
   `autor`), então atribuição não se perde.

   HISTÓRICO: até 28/07 isto era um stub que devolvia sempre a mesma constante, e
   o aviso no topo do arquivo dizia em maiúsculas que NÃO HAVIA ISOLAMENTO NENHUM.
   Agora a org sai da sessão. O contrato da função não mudou (continua async, como
   foi desenhada justamente pra este dia), então nenhum call-site precisou mudar.

   O escopo NUNCA vem do corpo da requisição: escopo enviado pelo cliente é escopo
   forjável. E ele agora tem cinto E suspensório — mesmo que uma rota esqueça de
   filtrar, as policies da migration 0011 recusam do lado do Postgres. */

import { membroAtual } from "./sessao";

/** UUID nulo. Era o "escopo único" do stub; hoje é o id da org Setter (ver 0010),
 *  o que fez toda linha escopada que já existia continuar válida sem backfill. */
export const ESCOPO_PADRAO = "00000000-0000-0000-0000-000000000000";

/**
 * Org de quem está pedindo. Lança se não houver sessão: rota que chama isto
 * manipula dado de firma e não tem resposta correta pra dar sem identidade.
 * A middleware barra antes, então na prática isto é a segunda linha de defesa.
 */
export async function escopoAtual(): Promise<string> {
  const membro = await membroAtual();
  if (!membro) throw new Error("sem escopo: requisição sem sessão ou usuário sem firma");
  return membro.orgId;
}
