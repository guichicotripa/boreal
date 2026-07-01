import type { Metadata } from "next";
import Link from "next/link";
import { Treemap } from "@/components/Treemap";
import { corTile, DIVISOES, HEATMAP_JANELA, HEATMAP_GERADO_EM } from "@/lib/heatmap";

export const metadata: Metadata = {
  title: "Boreal · Heat-map de setores",
  description:
    "Treemap de atividade de M&A por setor (divisão CNAE): tamanho por volume de aquisições, cor por intensidade. Para priorizar onde o mercado está quente.",
};

export default function HeatMap() {
  const totalDeals = DIVISOES.reduce((a, d) => a + d.n_aquisicoes, 0);
  const janelaFim = new Date(HEATMAP_JANELA.ate).toLocaleDateString("pt-BR");
  const gerado = new Date(HEATMAP_GERADO_EM).toLocaleDateString("pt-BR");
  const nota =
    `${totalDeals.toLocaleString("pt-BR")} aquisições detectadas em SP (janela até ${janelaFim}), ` +
    `mineradas das transições do CNPJ (PJ entra + PF sai). Tamanho do bloco = volume de aquisições; ` +
    `cor = densidade (aquisições ÷ empresas do setor); divisões com <10 aquisições ficam neutras ` +
    `(sinal insuficiente). Dot = os 3 setores onde o recall do score é validado; nos demais, atividade ` +
    `observada, não previsão. Gerado em ${gerado}.`;

  return (
    // Altura da viewport menos o nav (65px), sem scroll: barra fina + treemap preenchendo o resto.
    <div className="flex flex-col" style={{ height: "calc(100dvh - 65px)" }}>
      <div className="flex items-center justify-between gap-4 px-6 py-2.5">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-lg tracking-tight text-floral">Heat-map de setores</h1>
          <span className="hidden font-data text-[10px] uppercase tracking-wider text-bone/55 sm:inline">
            Atividade de M&amp;A por setor · SP
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-2 md:flex">
            <span className="font-data text-[9px] uppercase tracking-wider text-bone/60">Menos</span>
            <div
              className="h-2 w-24 rounded-full"
              style={{ background: `linear-gradient(90deg, ${corTile(0)}, ${corTile(0.5)}, ${corTile(1)})` }}
            />
            <span className="font-data text-[9px] uppercase tracking-wider text-bone/60">Mais M&amp;A</span>
          </div>
          <div className="hidden items-center gap-1.5 lg:flex">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#FFFBF4" }} />
            <span className="font-data text-[9px] uppercase tracking-wider text-bone/60">Validado</span>
          </div>
          <span
            title={nota}
            aria-label={nota}
            className="cursor-help select-none font-data text-[13px] text-bone/50 transition-colors hover:text-bone"
          >
            ⓘ
          </span>
          <Link
            href="/"
            className="group flex items-center gap-1.5 rounded-sm font-data text-[11px] uppercase tracking-wider text-floral transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50"
          >
            <span className="transition-transform duration-200 group-hover:-translate-x-1">←</span>
            <span>Voltar</span>
          </Link>
        </div>
      </div>

      <div className="min-h-0 flex-1 px-6 pb-4">
        <Treemap />
      </div>
    </div>
  );
}
