"use client";

import type { Oportunidade } from "@/lib/types";

function Chevron({ up }: { up: boolean }) {
  return (
    <svg
      viewBox="0 0 10 10"
      fill="currentColor"
      className={`h-[9px] w-[9px] transition-transform duration-200 ${up ? "rotate-180" : ""}`}
    >
      <path d="M1.5 2.5 L8.5 2.5 L5 7.5 Z" />
    </svg>
  );
}

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <div>
      <p className="font-display text-2xl tabular-nums text-ink">{n}</p>
      <p className="text-[11px] text-ink-muted">{label}</p>
    </div>
  );
}

// O LOOP DE OUTCOME (o moat): compara o score PREVISTO (no save) com o DESFECHO real.
// Se as oportunidades que viraram receptivo/deal tinham score médio maior que as perdidas,
// o score prevê o resultado do mundo real — e isso é training data que recalibra o modelo.
export function Dashboard({
  ops,
  collapsed,
  onToggle,
}: {
  ops: Oportunidade[];
  collapsed: boolean;
  onToggle: () => void;
}) {
  const contatados = ops.filter((o) =>
    ["abordado", "em_conversa", "entregue"].includes(o.estagio)
  ).length;
  const positivos = ops.filter(
    (o) => o.resultado === "receptivo" || o.resultado === "deal_fechado"
  );
  const negativos = ops.filter(
    (o) => o.resultado === "nao_receptivo" || o.resultado === "perdido"
  );
  const deals = ops.filter((o) => o.resultado === "deal_fechado").length;
  const comDesfecho = positivos.length + negativos.length;
  const hitReal =
    comDesfecho > 0 ? Math.round((positivos.length / comDesfecho) * 100) : null;

  const media = (arr: Oportunidade[]) => {
    const s = arr.map((o) => o.score_no_save).filter((n): n is number => n != null);
    return s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : null;
  };
  const scorePos = media(positivos);
  const scoreNeg = media(negativos);
  const loopFecha = scorePos != null && scoreNeg != null && scorePos > scoreNeg;

  if (collapsed) {
    return (
      <div
        className="mb-4 flex cursor-pointer items-center justify-between rounded-lg border border-hairline bg-surface px-4 py-2.5 transition-colors hover:border-hairline-hover"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggle(); }}
        aria-label="Expandir estatísticas"
      >
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 pointer-events-none">
          <span className="text-[11px] font-medium text-ink-muted">
            Estatísticas
          </span>
          <span className="text-[11.5px] tabular-nums text-ink-soft">
            {ops.length} no funil
            {deals > 0 ? ` · ${deals} deal${deals > 1 ? "s" : ""}` : ""}
            {hitReal != null ? ` · ${hitReal}% hit rate` : ""}
          </span>
        </div>
        <div className="ml-4 shrink-0 text-ink-faint pointer-events-none">
          <Chevron up={false} />
        </div>
      </div>
    );
  }

  return (
    <section className="mb-6 rounded-xl border border-hairline bg-surface p-5">
      {/* Stats row — clicking anywhere here collapses */}
      <div
        className="flex cursor-pointer items-start gap-4 transition-opacity hover:opacity-80"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggle(); }}
        aria-label="Recolher estatísticas"
      >
        <div className="grid flex-1 grid-cols-3 gap-4 sm:grid-cols-5 pointer-events-none">
          <Stat n={ops.length} label="No funil" />
          <Stat n={contatados} label="Contatados" />
          <Stat n={positivos.length} label="Receptivos" />
          <Stat n={deals} label="Deals" />
          <Stat n={hitReal != null ? `${hitReal}%` : "--"} label="Hit rate real" />
        </div>
        <div className="shrink-0 text-ink-faint pointer-events-none">
          <Chevron up={true} />
        </div>
      </div>

      {/* O loop: previsto x realizado */}
      <div className="mt-5 border-t border-hairline pt-4">
        <p className="text-[11px] font-medium text-ink-muted">
          Loop de outcome · score previsto × desfecho real
        </p>
        {scorePos != null || scoreNeg != null ? (
          <>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm text-ink-soft">
              <span>
                <strong>Desfecho positivo</strong>: score médio{" "}
                <span className="tabular-nums text-ink">{scorePos ?? "--"}</span>
              </span>
              <span>
                <strong>Desfecho negativo</strong>: score médio{" "}
                <span className="tabular-nums text-ink">{scoreNeg ?? "--"}</span>
              </span>
            </div>
            <p className="mt-2 text-xs leading-snug text-ink-muted">
              {loopFecha
                ? "As empresas que reagiram bem tinham score maior — o score prevê o desfecho real. É o ground truth que recalibra o modelo (o moat)."
                : "Conforme os desfechos entram, comparamos previsto × real. Se o positivo superar o negativo, o score se confirma — e vira training data."}
            </p>
          </>
        ) : (
          <p className="mt-2 text-xs leading-snug text-ink-muted">
            Ainda sem desfechos registrados. Mova oportunidades para &ldquo;Entregue&rdquo; e marque o
            resultado — o loop começa a medir previsto × real.
          </p>
        )}
      </div>
    </section>
  );
}
