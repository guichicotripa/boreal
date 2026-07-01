import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import {
  gruposPorSecao,
  corTile,
  corTextoTile,
  DIVISOES,
  HEATMAP_JANELA,
  HEATMAP_GERADO_EM,
} from "@/lib/heatmap";
import { treemapAgrupado } from "@/lib/treemap";

export const metadata: Metadata = {
  title: "Boreal · Heat-map de setores",
  description:
    "Treemap de atividade de M&A por setor (divisão CNAE): tamanho por volume de aquisições, cor por intensidade. Para priorizar onde o mercado está quente.",
};

// Canvas lógico do treemap; os tiles são posicionados em % dele (responsivo via aspect-ratio).
const W = 1000;
const H = 700;
const HEADER = 16;
const GAP = 3;

export default function HeatMap() {
  const grupos = gruposPorSecao();
  const layout = treemapAgrupado(grupos, { x: 0, y: 0, w: W, h: H }, { header: HEADER, gap: GAP });
  const totalDeals = DIVISOES.reduce((a, d) => a + d.n_aquisicoes, 0);
  const janelaFim = new Date(HEATMAP_JANELA.ate).toLocaleDateString("pt-BR");

  const pctX = (v: number) => `${(v / W) * 100}%`;
  const pctY = (v: number) => `${(v / H) * 100}%`;

  return (
    <div className="min-h-screen bg-smoky text-floral">
      <main className="mx-auto max-w-6xl px-6 py-12">
        <header className="mb-6 flex items-start justify-between">
          <div>
            <p className="font-data text-[11px] uppercase tracking-wider text-olive">
              Termômetro de M&amp;A · priorize o inbound
            </p>
            <h1 className="mt-2 font-display text-3xl tracking-tight md:text-4xl">Heat-map de setores</h1>
          </div>
          <Link
            href="/"
            className="group flex items-center gap-2 rounded-sm font-data text-[11px] uppercase tracking-wider text-floral transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50"
          >
            <span className="transition-transform duration-200 group-hover:-translate-x-1">←</span>
            <span>Voltar à busca</span>
          </Link>
        </header>

        <p className="mb-5 max-w-3xl text-[15px] leading-relaxed text-bone">
          Cada bloco é um setor da economia (divisão CNAE). O <strong>tamanho</strong> é o volume de
          aquisições detectadas no CNPJ; a <strong>cor</strong>, quão intensa é a rotatividade de M&amp;A
          relativa ao tamanho do setor (mais claro = mais quente). É a leitura de mercado pra decidir onde
          olhar primeiro, não previsão de empresa individual.
        </p>

        {/* Treemap — tiles posicionados em % de um canvas lógico W×H (responsivo). */}
        <div
          className="relative w-full overflow-hidden rounded-lg border border-hairline"
          style={{ aspectRatio: `${W} / ${H}`, backgroundColor: "#141310" }}
        >
          {layout.map(({ grupo, tiles }) => (
            <Fragment key={grupo.secaoSigla}>
              <div
                className="absolute flex items-center px-1"
                style={{ left: pctX(grupo.x), top: pctY(grupo.y), width: pctX(grupo.w), height: pctY(HEADER) }}
              >
                <span className="truncate font-data text-[9px] uppercase tracking-[0.12em] text-bone/55">
                  {grupo.secaoNome}
                </span>
              </div>

              {tiles.map((t) => {
                const showLabel = t.w > 52 && t.h > 22;
                const showNum = t.w > 52 && t.h > 40;
                return (
                  <div
                    key={t.div}
                    title={`${t.nome} — ${t.n_aquisicoes} aquisições · ${t.deals_ano}/ano · ${(t.densidade * 100).toFixed(2)}% do estoque${t.validado ? " · score validado" : ""}`}
                    className="absolute overflow-hidden"
                    style={{
                      left: pctX(t.x),
                      top: pctY(t.y),
                      width: pctX(t.w),
                      height: pctY(t.h),
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
            </Fragment>
          ))}
        </div>

        {/* Legenda */}
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2">
            <span className="font-data text-[10px] uppercase tracking-wider text-bone/70">Menos M&amp;A</span>
            <div className="h-2.5 w-40 rounded-full" style={{ background: `linear-gradient(90deg, ${corTile(0)}, ${corTile(0.5)}, ${corTile(1)})` }} />
            <span className="font-data text-[10px] uppercase tracking-wider text-bone/70">Mais M&amp;A</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#FFFBF4" }} />
            <span className="font-data text-[10px] uppercase tracking-wider text-bone/70">Score validado</span>
          </div>
        </div>

        <p className="mt-6 max-w-3xl font-data text-xs leading-relaxed text-olive">
          {totalDeals.toLocaleString("pt-BR")} aquisições detectadas em SP (janela até {janelaFim}), mineradas
          das transições do CNPJ (PJ entra + PF sai). Cor = densidade (aquisições ÷ empresas do setor);
          divisões com menos de 10 aquisições ficam neutras (sinal insuficiente). Tamanho = volume de
          aquisições. &ldquo;Score validado&rdquo; marca os 3 setores onde medimos o recall do score
          (metalmec, saúde, educação); nos demais, mostramos a atividade observada, não previsão. Gerado em{" "}
          {new Date(HEATMAP_GERADO_EM).toLocaleDateString("pt-BR")}.
        </p>
      </main>
    </div>
  );
}
