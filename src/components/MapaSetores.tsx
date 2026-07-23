"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import { Treemap } from "./Treemap";
import {
  gruposPorSecao,
  totalAquisicoes,
  corTile,
  HEATMAP_JANELA,
  HEATMAP_GERADO_EM,
} from "@/lib/heatmap";
import { useTemaClaro } from "./shell/TemaToggle";
import { REGIOES } from "@/lib/cnae";

// Página interativa do heat-map: seletor de região + treemap que recomputa. Full-viewport, sem scroll.
export function MapaSetores() {
  const claro = useTemaClaro(); // a legenda usa a mesma rampa dos tiles
  const [regiao, setRegiao] = useState("BR");
  const grupos = useMemo(() => gruposPorSecao(regiao), [regiao]);
  const total = useMemo(() => totalAquisicoes(regiao), [regiao]);

  const nomeRegiao = REGIOES.find((r) => r.id === regiao)?.nome ?? "Brasil";
  const janelaFim = new Date(HEATMAP_JANELA.ate).toLocaleDateString("pt-BR");
  const gerado = new Date(HEATMAP_GERADO_EM).toLocaleDateString("pt-BR");
  const nota =
    `${total.toLocaleString("pt-BR")} trocas de controle em ${nomeRegiao} (janela até ${janelaFim}), ` +
    `mineradas das transições do CNPJ (PJ entra + PF sai). Limpeza: só empresa ativa com 5+ anos ` +
    `(remove SPE/newco) e, em construção/imobiliária/energia, exclui a reorganização de holding da ` +
    `família (não é venda). Tamanho do bloco = volume; cor = densidade (trocas ÷ empresas ativas do ` +
    `setor), escala log normalizada nesta seleção; divisões com <15 ficam neutras. Dot = setores com recall do ` +
    `score validado; nos demais, atividade observada, não previsão. Gerado em ${gerado}.`;

  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 65px)" }}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-2.5">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-lg tracking-tight text-ink">Heat-map</h1>
          <div className="flex items-center gap-0.5 rounded-md border border-hairline p-0.5">
            {REGIOES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRegiao(r.id)}
                aria-pressed={regiao === r.id}
                className={`rounded px-2 py-1 font-data text-[10px] uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50 ${
                  regiao === r.id ? "bg-surface-hover text-ink" : "text-ink-muted hover:text-ink-soft"
                }`}
              >
                {r.nome}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-2 md:flex">
            <span className="font-data text-[9px] uppercase tracking-wider text-ink-muted">Menos</span>
            <div
              className="h-2 w-20 rounded-full"
              style={{ background: `linear-gradient(90deg, ${corTile(0, claro)}, ${corTile(0.5, claro)}, ${corTile(1, claro)})` }}
            />
            <span className="font-data text-[9px] uppercase tracking-wider text-ink-muted">Mais M&amp;A</span>
          </div>
          <div className="hidden items-center gap-1.5 lg:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-ink" />
            <span className="font-data text-[9px] uppercase tracking-wider text-ink-muted">Validado</span>
          </div>
          <NotaMetodologia nota={nota} />
          <Link
            href="/"
            className="group flex items-center gap-1.5 rounded-sm font-data text-[11px] uppercase tracking-wider text-ink transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50"
          >
            <span className="transition-transform duration-200 group-hover:-translate-x-1">←</span>
            <span>Voltar</span>
          </Link>
        </div>
      </div>

      <div className="min-h-0 flex-1 px-6 pb-4">
        <Treemap grupos={grupos} />
      </div>
    </div>
  );
}

// Nota metodológica: o ⓘ antigo era só um title nativo (hover, delay, morto em
// clique/touch). Vira botão de verdade com popover — fecha em clique-fora e Esc.
function NotaMetodologia({ nota }: { nota: string }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [aberto]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-label="Como este mapa é calculado"
        className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50 ${
          aberto ? "bg-surface-hover text-ink" : "text-ink-muted hover:text-ink-soft"
        }`}
      >
        <Info aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
      {aberto && (
        <div
          role="dialog"
          aria-label="Metodologia do heat-map"
          className="absolute right-0 top-8 z-50 w-80 rounded-lg border border-hairline bg-overlay p-3.5 text-[12px] leading-relaxed text-ink-soft shadow-xl shadow-black/30"
        >
          {nota}
        </div>
      )}
    </div>
  );
}
