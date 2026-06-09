// Contexto de mercado por setor — curado manualmente (ver setor-contexto.json), com fonte.
// Dá ao analista a leitura macro/competitiva do setor de um alvo antes da abordagem.
// NÃO é gerado por modelo: é conteúdo editorial versionado, atualizado à mão.

import contextoData from "./setor-contexto.json";

export type PlayerSetor = { nome: string; nota: string };
export type FonteSetor = { titulo: string; url: string };
export type SetorContexto = {
  macro: string;
  dinamica: string;
  players: PlayerSetor[];
  tendencias: string[];
  fontes: FonteSetor[];
};

const SETORES_CTX = contextoData.setores as Record<string, SetorContexto>;
export const CONTEXTO_ATUALIZADO_EM = contextoData.atualizado_em;

export function contextoSetor(id: string | null | undefined): SetorContexto | null {
  if (!id) return null;
  return SETORES_CTX[id] ?? null;
}
