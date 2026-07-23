"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Empresa } from "@/lib/types";

// Timeline horizontal: fundação → entrada de cada sócio → hoje. Mostra "quadro
// travado" visualmente. CSS puro, sem lib de chart.
//
// O problema difícil aqui é empacotar os labels: empresas com várias entradas
// recentes amontoam tudo no fim da régua (um hospital da base tem 5 entradas em
// 2018–2025 + "Hoje"). Escalonar em duas alturas fixas não resolve — vizinhos do
// mesmo nível voltam a colidir. Então medimos a largura real de cada label e
// distribuímos em N níveis por empacotamento guloso: cada label desce pro
// primeiro nível onde couber sem encostar no anterior daquele nível.
type Marco = { pct: number; ano: number; label: string; hoje?: boolean };

// Precisa ser MAIOR que a altura da linha do label (15px pro text-[10px]), senão
// níveis adjacentes se tocam. 17 = 15 de altura + 2 de respiro.
const ALTURA_NIVEL = 17;
const FOLGA = 8; // respiro horizontal mínimo entre dois labels do mesmo nível

// useLayoutEffect avisa no SSR; no cliente ele evita o flash do reposicionamento.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function Timeline({ empresa }: { empresa: Empresa }) {
  const anoFund = empresa.data_inicio_atividade
    ? Number(empresa.data_inicio_atividade.slice(0, 4))
    : null;

  const marcos = useMemo<Marco[]>(() => {
    if (!anoFund) return [];
    const anoAtual = new Date().getFullYear();
    const span = anoAtual - anoFund || 1;

    // Agrupa labels por ano (fundação + sócio que entrou no mesmo ano não colidem).
    const porAno = new Map<number, string[]>();
    porAno.set(anoFund, ["Fundação"]);
    for (const s of empresa.socio ?? []) {
      const ano = s.data_entrada_sociedade ? Number(s.data_entrada_sociedade.slice(0, 4)) : null;
      if (ano === null || !Number.isFinite(ano)) continue;
      const nome = s.nome.split(" ")[0];
      const arr = porAno.get(ano);
      if (arr) arr.push(nome);
      else porAno.set(ano, [nome]);
    }

    const lista: Marco[] = [...porAno.entries()]
      .map(([ano, labels]) => ({
        ano,
        label: labels.join(" · "),
        pct: Math.min(100, Math.max(0, ((ano - anoFund) / span) * 100)),
      }))
      .sort((a, b) => a.pct - b.pct);
    lista.push({ pct: 100, ano: anoAtual, label: "Hoje", hoje: true });
    return lista;
  }, [anoFund, empresa.socio]);

  const trilhoRef = useRef<HTMLDivElement>(null);
  const [niveis, setNiveis] = useState<number[]>([]);

  // Mede os labels e empacota em níveis. A medição é estável: o nível só muda a
  // posição VERTICAL, então left/right não dependem do resultado — não há loop.
  useIsoLayoutEffect(() => {
    const el = trilhoRef.current;
    if (!el || marcos.length === 0) return;

    function empacotar() {
      const alvo = trilhoRef.current;
      if (!alvo) return;
      const labels = Array.from(alvo.querySelectorAll<HTMLElement>("[data-marco-label]"));
      const fimPorNivel: number[] = [];
      const novos = labels.map((l) => {
        const r = l.getBoundingClientRect();
        let n = 0;
        while (fimPorNivel[n] != null && r.left < fimPorNivel[n] + FOLGA) n++;
        fimPorNivel[n] = r.right;
        return n;
      });
      setNiveis((prev) =>
        prev.length === novos.length && prev.every((v, i) => v === novos[i]) ? prev : novos
      );
    }

    empacotar();
    const ro = new ResizeObserver(empacotar);
    ro.observe(el);
    return () => ro.disconnect();
  }, [marcos]);

  if (!anoFund || marcos.length === 0) return null;

  const maxNivel = niveis.length ? Math.max(...niveis) : 0;

  return (
    <div>
      <h4 className="mb-2 text-[11px] font-medium text-ink-muted">Linha do tempo societária</h4>
      {/* As margens crescem com o nº de níveis usados, senão o topo/base vaza */}
      <div
        ref={trilhoRef}
        className="relative h-2"
        style={{ marginTop: 30 + maxNivel * ALTURA_NIVEL, marginBottom: 26 + maxNivel * ALTURA_NIVEL }}
      >
        <div className="absolute inset-x-[4px] top-1/2 border-b border-hairline" />
        {marcos.map((m, i) => {
          // Mapeia 0–100% → 3–97% pra o dot da borda não encostar/cortar.
          const left = 3 + (m.pct / 100) * 94;
          // Ancoragem horizontal do texto conforme a posição (evita corte nas bordas).
          const anchor = m.pct <= 2 ? "left-0" : m.pct >= 98 ? "right-0" : "left-0 -translate-x-1/2";
          const nivel = niveis[i] ?? 0;
          return (
            <div key={`${m.ano}-${i}`} className="absolute top-1/2" style={{ left: `${left}%` }}>
              <span
                className={`absolute left-0 top-0 block h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ${
                  m.hoje ? "border border-hairline-hover bg-transparent" : "bg-risk-mid"
                }`}
              />
              <span
                data-marco-label
                className={`absolute ${anchor} max-w-[7rem] truncate whitespace-nowrap text-[10px] ${
                  m.hoje ? "text-ink-muted" : "text-ink-soft"
                }`}
                style={{ top: -(18 + nivel * ALTURA_NIVEL) }}
              >
                {m.label}
              </span>
              <span
                className={`absolute ${anchor} font-data text-[10px] tabular-nums text-ink-muted`}
                style={{ top: 10 + nivel * ALTURA_NIVEL }}
              >
                {m.ano}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
