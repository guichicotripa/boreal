/* ── Escopo de dados (pré-multi-tenant) — server-only ─────────────────────────

   ATENÇÃO: isto é um STUB. Hoje devolve SEMPRE a mesma constante, logo NÃO HÁ
   ISOLAMENTO NENHUM entre usuários ou clientes. A coluna `escopo_id` existe no
   banco para que a junta esteja no lugar certo quando o auth chegar — não porque
   já separe alguma coisa. Não trate dado escopado como dado isolado.

   O gate de acesso atual é senha única compartilhada (ver lib/gate.ts): todo
   mundo que entra é indistinguível. Enquanto isso for verdade, todo escopo é o
   mesmo escopo.

   Quando houver auth, para ligar de verdade é preciso TUDO isto:
     1. `escopoAtual()` passa a ler a identidade da sessão;
     2. policies de RLS em cada tabela escopada (hoje a RLS está ligada, mas sem
        policy — o acesso é só via service role, que ignora RLS);
     3. decidir a semântica: escopo = pessoa (descarte é julgamento do analista)
        ou = firma (a boutique inteira compartilha a triagem)? A FORMA é a mesma
        nos dois casos, por isso dá pra adiar a decisão sem repensar o schema.

   É async de propósito: ler a identidade vai exigir `await cookies()`. Nascendo
   async, ligar o auth não muda nenhum call-site. */

/** UUID nulo — o "escopo único" enquanto não existe identidade. */
export const ESCOPO_PADRAO = "00000000-0000-0000-0000-000000000000";

/** Escopo de quem está pedindo. Stub: hoje é sempre o mesmo. Ver aviso acima. */
export async function escopoAtual(): Promise<string> {
  return ESCOPO_PADRAO;
}
