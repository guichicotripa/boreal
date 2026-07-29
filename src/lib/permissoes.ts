/* O que o contrato da firma libera — server-only.
 *
 * O banco JÁ recusa o que está fora do contrato (policies da migration 0012).
 * Este módulo existe para a aplicação SABER, não para proteger: sem ele, buscar
 * um setor não contratado devolveria lista vazia e pareceria produto quebrado.
 * A proteção é do Postgres; aqui é só a explicação.
 *
 * Regra das listas: VAZIA = sem restrição naquela dimensão. É isso que dá os três
 * tipos de contrato (só setor, só praça, os dois) sem um campo `tipo`.
 */
import { cache } from "react";
import { createUserClient } from "./supabase-server";
import { membroAtual } from "./sessao";

export type Permissoes = {
  setores: string[];  // ids do registry. [] = todos
  ufs: string[];      // siglas. [] = todas
  modulos: string[];  // superfícies liberadas, ex: "heatmap"
  /* Gente da casa (papel = 'boreal'). Ignora as três dimensões do contrato e lê
     através das orgs. A regra REAL vive em `eh_staff()` no Postgres (migration
     0013), não aqui: isto é a cópia que a UI usa pra decidir o que desenhar. Um
     bug nesta linha some com um menu; a proteção continua sendo do banco. */
  staff: boolean;
};

const SEM_ACESSO: Permissoes = { setores: [], ufs: [], modulos: [], staff: false };

export const permissoesAtuais = cache(async (): Promise<Permissoes> => {
  const membro = await membroAtual();
  if (!membro) return SEM_ACESSO;
  const staff = membro.papel === "boreal";

  const supabase = await createUserClient();
  /* As três em paralelo: são independentes e a soma das latências apareceria em
     toda página. As policies já limitam à própria org, então não há filtro por
     org_id aqui — o banco não devolveria linha de outra firma nem se pedisse. */
  const [setores, ufs, modulos] = await Promise.all([
    supabase.from("org_setor").select("setor_id"),
    supabase.from("org_uf").select("uf"),
    supabase.from("org_modulo").select("modulo"),
  ]);

  return {
    setores: (setores.data ?? []).map((r) => r.setor_id as string),
    ufs: (ufs.data ?? []).map((r) => r.uf as string),
    modulos: (modulos.data ?? []).map((r) => r.modulo as string),
    staff,
  };
});

/** Setor está no contrato? Lista vazia = contrato sem restrição de setor. */
export function setorPermitido(p: Permissoes, setorId: string): boolean {
  return p.staff || p.setores.length === 0 || p.setores.includes(setorId);
}

/** UF está na praça contratada? Lista vazia = sem restrição de praça. */
export function ufPermitida(p: Permissoes, uf: string): boolean {
  return p.staff || p.ufs.length === 0 || p.ufs.includes(uf.toUpperCase());
}

/* Módulo é o oposto das outras duas: lista vazia significa NENHUM módulo, não
   todos. Setor e praça delimitam um universo que existe por padrão; módulo é
   superfície vendida à parte, e o default de algo vendido à parte é desligado. */
export function temModulo(p: Permissoes, modulo: string): boolean {
  return p.staff || p.modulos.includes(modulo);
}
