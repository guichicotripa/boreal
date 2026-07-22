"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { treemapAgrupado } from "@/lib/treemap";
import { corTile, corTextoTile, type GrupoSecao } from "@/lib/heatmap";
import { SecaoIcon } from "./SecaoIcon";

const HEADER = 15; // faixa pro rótulo da seção
const GAP = 2;

// Coluna de estatística do badge de hover.
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="leading-tight">
      <div className="font-data text-[8px] uppercase tracking-wider text-ink-soft/45">{label}</div>
      <div className="font-display text-[15px] tabular-nums text-ink-soft">{value}</div>
    </div>
  );
}

// Treemap responsivo: mede o próprio container e faz o layout em px reais (aspect ratio fiel,
// sem esticar). Re-layout no resize. Preenche 100% do pai — o pai é quem define a altura.
// `grupos` vem do pai (muda conforme a região selecionada).
export function Treemap({ grupos }: { grupos: GrupoSecao[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [dim, setDim] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => {
      const r = el.getBoundingClientRect();
      setDim({ w: Math.floor(r.width), h: Math.floor(r.height) });
    };
    medir(); // medição síncrona imediata (não espera o callback assíncrono do RO)
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(
    () =>
      dim.w > 0 && dim.h > 0
        ? treemapAgrupado(grupos, { x: 0, y: 0, w: dim.w, h: dim.h }, { header: HEADER, gap: GAP })
        : [],
    [grupos, dim.w, dim.h],
  );

  const [hover, setHover] = useState<{ kind: "div" | "sec"; id: string } | null>(null);
  const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

  // Dados pro badge flutuante: divisão (tile) ou seção inteira (cabeçalho).
  const badge = useMemo(() => {
    if (!hover) return null;
    if (hover.kind === "sec") {
      const g = grupos.find((x) => x.secaoSigla === hover.id);
      if (!g) return null;
      const universo = g.itens.reduce((a, d) => a + d.universo, 0);
      const perAno = g.itens.reduce((a, d) => a + d.deals_ano, 0);
      const dens = universo > 0 ? (g.value / universo) * 100 : 0;
      return {
        iconSigla: g.secaoSigla, kicker: "Setor", titulo: g.secaoNome, validado: false,
        stats: [
          ["Trocas de controle", g.value.toLocaleString("pt-BR")],
          ["Por ano", fmt(perAno)],
          ["Densidade média", `${dens.toFixed(2)}%`],
          ["Divisões", String(g.itens.length)],
        ] as [string, string][],
      };
    }
    let t: (typeof layout)[number]["tiles"][number] | undefined;
    for (const { tiles } of layout) {
      const f = tiles.find((x) => x.div === hover.id);
      if (f) { t = f; break; }
    }
    if (!t) return null;
    return {
      iconSigla: t.secaoSigla, kicker: t.secaoNome, titulo: t.nome, validado: t.validado,
      stats: [
        ["Trocas de controle", t.n_aquisicoes.toLocaleString("pt-BR")],
        ["Por ano", fmt(t.deals_ano)],
        ["Densidade", `${(t.densidade * 100).toFixed(2)}%`],
      ] as [string, string][],
    };
  }, [hover, grupos, layout]);

  return (
    <div
      ref={ref}
      onMouseLeave={() => setHover(null)}
      className="relative h-full w-full overflow-hidden rounded-lg border border-hairline"
      style={{ backgroundColor: "#141310" }}
    >
      {layout.map(({ grupo, tiles }) => (
        <div key={grupo.secaoSigla}>
          <div
            className="absolute flex items-center px-1"
            onMouseEnter={() => setHover({ kind: "sec", id: grupo.secaoSigla })}
            style={{ left: grupo.x, top: grupo.y, width: grupo.w, height: HEADER }}
          >
            <span
              className={`truncate font-data text-[9px] uppercase tracking-[0.12em] transition-colors ${
                hover?.id === grupo.secaoSigla ? "text-ink" : "text-ink-soft/55"
              }`}
            >
              {grupo.secaoNome}
            </span>
          </div>

          {tiles.map((t) => {
            const showLabel = t.w > 46 && t.h > 20;
            const showNum = t.w > 46 && t.h > 36;
            return (
              <div
                key={t.div}
                onMouseEnter={() => setHover({ kind: "div", id: t.div })}
                title={`${t.nome} · ${t.n_aquisicoes} trocas · ${t.deals_ano}/ano · ${(t.densidade * 100).toFixed(2)}% do estoque${t.validado ? " · score validado" : ""}`}
                className="absolute overflow-hidden"
                style={{
                  left: t.x,
                  top: t.y,
                  width: t.w,
                  height: t.h,
                  backgroundColor: corTile(t.intensidade),
                  color: corTextoTile(t.intensidade),
                  outline: "1px solid rgba(20,19,16,0.55)",
                }}
              >
                {t.validado && (
                  <span
                    className="absolute right-[3px] top-[3px] h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: "#FFFBF4" }}
                  />
                )}
                {showLabel && (
                  <div className="p-1 leading-tight">
                    <div className="truncate font-data text-[9px] font-medium">{t.nome}</div>
                    {showNum && (
                      <div className="font-display text-[13px] tabular-nums">
                        {t.deals_ano}
                        <span className="ml-0.5 text-[8px] opacity-70">/ano</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Badge flutuante sob o mouse — centralizado embaixo, estilo TradingView. */}
      {badge && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2">
          <div
            className="flex items-center gap-4 rounded-lg border border-hairline px-4 py-2.5 shadow-xl"
            style={{ backgroundColor: "rgba(13,12,10,0.96)" }}
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-surface-hover text-ink">
                <SecaoIcon sigla={badge.iconSigla} className="h-[19px] w-[19px]" />
              </span>
              <div className="leading-tight">
                <div className="flex items-center gap-1.5 font-data text-[8px] uppercase tracking-wider text-ink-soft/45">
                  <span className="max-w-[150px] truncate">{badge.kicker}</span>
                  {badge.validado && (
                    <span className="inline-flex items-center gap-1 text-ink/80">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#FFFBF4" }} />
                      validado
                    </span>
                  )}
                </div>
                <div className="max-w-[190px] truncate font-display text-sm text-ink">{badge.titulo}</div>
              </div>
            </div>
            <div className="h-9 w-px bg-hairline" />
            {badge.stats.map(([label, value]) => (
              <Stat key={label} label={label} value={value} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
