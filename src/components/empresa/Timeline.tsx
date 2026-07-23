import type { Empresa } from "@/lib/types";

// Timeline horizontal: fundação → entrada de cada sócio → hoje. Mostra "quadro
// travado" visualmente. CSS puro, sem lib de chart.
//
// Dois ajustes de legibilidade: (1) labels de marcos próximos escalonam em duas
// alturas — evita a sobreposição de um sócio recente com "Hoje"; (2) a posição
// horizontal é mapeada pra faixa 3–97% pra o dot da borda não ser cortado.
type Marco = { pct: number; ano: number; label: string; hoje?: boolean };

export function Timeline({ empresa }: { empresa: Empresa }) {
  const anoFund = empresa.data_inicio_atividade
    ? Number(empresa.data_inicio_atividade.slice(0, 4))
    : null;
  if (!anoFund) return null;

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

  const marcos: Marco[] = [...porAno.entries()]
    .map(([ano, labels]) => ({
      ano,
      label: labels.join(" · "),
      pct: Math.min(100, Math.max(0, ((ano - anoFund) / span) * 100)),
    }))
    .sort((a, b) => a.pct - b.pct);
  marcos.push({ pct: 100, ano: anoAtual, label: "Hoje", hoje: true });

  // Escalona a altura quando dois marcos ficam a menos de GAP% um do outro:
  // alterna nível 0/1 pra o label e o ano não sobreporem os do vizinho.
  const GAP = 14;
  let nivelAnterior = 0;
  let pctAnterior = -Infinity;
  const comNivel = marcos.map((m) => {
    const nivel = m.pct - pctAnterior < GAP && nivelAnterior === 0 ? 1 : 0;
    nivelAnterior = nivel;
    pctAnterior = m.pct;
    return { ...m, nivel };
  });

  return (
    <div>
      <h4 className="mb-2 text-[11px] font-medium text-ink-muted">Linha do tempo societária</h4>
      {/* Margens folgadas acomodam os dois níveis de label (acima) e de ano (abaixo) */}
      <div className="relative mt-14 mb-11 h-2">
        <div className="absolute inset-x-[4px] top-1/2 border-b border-hairline" />
        {comNivel.map((m, i) => {
          // Mapeia 0–100% → 3–97% pra o dot da borda não encostar/cortar.
          const left = 3 + (m.pct / 100) * 94;
          // Ancoragem horizontal do texto conforme a posição (evita corte nas bordas).
          const anchor =
            m.pct <= 2 ? "left-0" : m.pct >= 98 ? "right-0" : "left-0 -translate-x-1/2";
          const topLabel = m.nivel === 1 ? "-top-11" : "-top-6";
          const topAno = m.nivel === 1 ? "top-7" : "top-2.5";
          return (
            <div key={i} className="absolute top-1/2" style={{ left: `${left}%` }}>
              <span
                className={`absolute left-0 top-0 block h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ${
                  m.hoje ? "border border-hairline-hover bg-transparent" : "bg-risk-mid"
                }`}
              />
              <span className={`absolute ${anchor} ${topLabel} max-w-[7rem] truncate whitespace-nowrap text-[10px] ${m.hoje ? "text-ink-muted" : "text-ink-soft"}`}>
                {m.label}
              </span>
              <span className={`absolute ${anchor} ${topAno} font-data text-[10px] tabular-nums text-ink-muted`}>
                {m.ano}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
