"use client";

import { COL } from "./helpers";

export type ScoreSort = "asc" | "desc" | null;

export function ColHeader({
  isEntregue,
  scoreSort,
  onScoreSort,
  donoSort,
  onDonoSort,
  acaoSort,
  onAcaoSort,
}: {
  isEntregue: boolean;
  scoreSort: ScoreSort;
  onScoreSort: () => void;
  donoSort: boolean;
  onDonoSort: () => void;
  acaoSort: ScoreSort;
  onAcaoSort: () => void;
}) {
  return (
    <div
      className="mb-0.5 grid items-center gap-x-4 border-x border-x-transparent border-b border-b-hairline/40 px-3 pb-1.5 text-[11px] font-medium text-bone/50"
      style={{ gridTemplateColumns: COL }}
    >
      {/* grip placeholder */}
      <span />
      <button
        onClick={onScoreSort}
        className="flex items-center gap-1 transition-colors hover:text-bone focus-visible:outline-none"
        title={
          scoreSort === "asc" ? "ordenar decrescente" :
          scoreSort === "desc" ? "remover ordenação" :
          "ordenar crescente"
        }
      >
        Score
        {scoreSort === "asc" && <span className="text-floral">↑</span>}
        {scoreSort === "desc" && <span className="text-floral">↓</span>}
      </button>
      <span>Empresa</span>
      {/* pl-[18px] = px-2 (8px) do container + pl-2.5 (10px) do input/chip — alinha o título com o texto "dono" abaixo */}
      <button
        onClick={onDonoSort}
        className="flex items-center gap-1 pl-[18px] transition-colors hover:text-bone focus-visible:outline-none"
        title={donoSort ? "remover ordenação" : "ordenar por dono"}
      >
        {isEntregue ? "Dono · Resultado" : "Dono · Estágio"}
        {donoSort && <span className="text-floral">↑</span>}
      </button>
      {isEntregue ? (
        <span />
      ) : (
        <button
          onClick={onAcaoSort}
          className="flex items-center gap-1 transition-colors hover:text-bone focus-visible:outline-none"
          title={
            acaoSort === "asc" ? "ordenar decrescente" :
            acaoSort === "desc" ? "remover ordenação" :
            "ordenar crescente"
          }
        >
          Próxima ação
          {acaoSort === "asc" && <span className="text-floral">↑</span>}
          {acaoSort === "desc" && <span className="text-floral">↓</span>}
        </button>
      )}
      <span>Contato</span>
      <span>Notas</span>
      <span />
    </div>
  );
}
