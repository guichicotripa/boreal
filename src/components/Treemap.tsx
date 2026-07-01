"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { treemapAgrupado } from "@/lib/treemap";
import { corTile, corTextoTile, type GrupoSecao } from "@/lib/heatmap";

const HEADER = 15; // faixa pro rótulo da seção
const GAP = 2;

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

  return (
    <div
      ref={ref}
      className="relative h-full w-full overflow-hidden rounded-lg border border-hairline"
      style={{ backgroundColor: "#141310" }}
    >
      {layout.map(({ grupo, tiles }) => (
        <div key={grupo.secaoSigla}>
          <div
            className="absolute flex items-center px-1"
            style={{ left: grupo.x, top: grupo.y, width: grupo.w, height: HEADER }}
          >
            <span className="truncate font-data text-[9px] uppercase tracking-[0.12em] text-bone/55">
              {grupo.secaoNome}
            </span>
          </div>

          {tiles.map((t) => {
            const showLabel = t.w > 46 && t.h > 20;
            const showNum = t.w > 46 && t.h > 36;
            return (
              <div
                key={t.div}
                title={`${t.nome} — ${t.n_aquisicoes} aquisições · ${t.deals_ano}/ano · ${(t.densidade * 100).toFixed(2)}% do estoque${t.validado ? " · score validado" : ""}`}
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
    </div>
  );
}
