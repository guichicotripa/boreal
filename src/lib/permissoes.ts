/* O que o contrato da firma libera — server-only.
 *
 * Este arquivo faz UMA coisa: buscar as linhas do contrato no Postgres. As REGRAS (o que lista
 * vazia significa em cada dimensão, como setor e mandato se somam) moram em `./contrato`, que é
 * puro e testável — o runner do `node --test` não consegue importar este módulo, porque ele puxa
 * `supabase-server` e `sessao`.
 *
 * Tudo de `./contrato` é reexportado daqui, então nenhum call-site precisa saber da divisão.
 *
 * O banco JÁ recusa o que está fora do contrato (policies das migrations 0012 e 0014). Este
 * módulo existe para a aplicação SABER, não para proteger: sem ele, buscar um setor não
 * contratado devolveria lista vazia e pareceria produto quebrado.
 */
import { cache } from "react";
import { createUserClient } from "./supabase-server";
import { membroAtual } from "./sessao";
import { SEM_ACESSO, type Permissoes } from "./contrato";

export {
  setorPermitido,
  mandatoPermitido,
  ufPermitida,
  temModulo,
  universoDaOrg,
  type Permissoes,
} from "./contrato";

export const permissoesAtuais = cache(async (): Promise<Permissoes> => {
  const membro = await membroAtual();
  if (!membro) return SEM_ACESSO;
  const staff = membro.papel === "boreal";

  const supabase = await createUserClient();
  /* As quatro em paralelo: são independentes e a soma das latências apareceria em toda página.
     As policies já limitam à própria org, então não há filtro por org_id aqui — o banco não
     devolveria linha de outra firma nem se pedisse. */
  const [setores, mandatos, ufs, modulos] = await Promise.all([
    supabase.from("org_setor").select("setor_id"),
    supabase.from("org_mandato").select("mandato_id"),
    supabase.from("org_uf").select("uf"),
    supabase.from("org_modulo").select("modulo"),
  ]);

  return {
    setores: (setores.data ?? []).map((r) => r.setor_id as string),
    mandatos: (mandatos.data ?? []).map((r) => r.mandato_id as string),
    ufs: (ufs.data ?? []).map((r) => r.uf as string),
    modulos: (modulos.data ?? []).map((r) => r.modulo as string),
    staff,
  };
});
