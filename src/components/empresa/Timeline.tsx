import type { Empresa } from "@/lib/types";

// Timeline horizontal: fundação → entrada de cada sócio. Mostra "quadro travado"
// visualmente. CSS puro, sem lib de chart. Agrupa eventos do mesmo ano e alinha
// os labels conforme a posição (evita corte nas bordas).
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

  const eventos = [...porAno.entries()]
    .map(([ano, labels]) => ({ ano, label: labels.join(" · ") }))
    .sort((a, b) => a.ano - b.ano);

  return (
    <div>
      <h4 className="mb-2 text-[11px] font-medium text-ink-muted">
        Linha do tempo societária
      </h4>
      {/* Altura explícita evita margin collapse (conteúdo é absoluto) */}
      <div className="relative mt-10 h-8 mb-4">
        {/* Linha separada, insetada pelo raio do dot em cada lado */}
        <div className="absolute inset-x-[18px] top-0 border-b border-hairline" />

        {eventos.map((ev, i) => {
          const pct = ((ev.ano - anoFund) / span) * 100;
          const isLeft  = pct === 0;
          const isRight = pct >= 92;

          if (isLeft) {
            return (
              <div key={i} className="absolute left-0 -translate-y-1/2" style={{ width: 28 }}>
                <span className="absolute -top-7 left-0 max-w-[8rem] truncate whitespace-nowrap text-[10px] text-ink-soft">
                  {ev.label}
                </span>
                <span className="mx-auto block h-2 w-2 rounded-full bg-risk-mid" />
                <span className="absolute top-3 w-full text-center font-data text-[10px] tabular-nums text-ink-muted">
                  {ev.ano}
                </span>
              </div>
            );
          }

          if (isRight) {
            return (
              <div key={i} className="absolute -translate-y-1/2 -translate-x-1/2" style={{ left: `${pct}%`, width: 28 }}>
                <span className="absolute -top-7 w-full truncate whitespace-nowrap text-center text-[10px] text-ink-soft">
                  {ev.label}
                </span>
                <span className="mx-auto block h-2 w-2 rounded-full bg-risk-mid" />
                <span className="absolute top-3 w-full text-center font-data text-[10px] tabular-nums text-ink-muted">
                  {ev.ano}
                </span>
              </div>
            );
          }

          return (
            <div
              key={i}
              className="absolute flex flex-col -translate-y-1/2 -translate-x-1/2 items-center text-center"
              style={{ left: `${pct}%` }}
            >
              <span className="absolute -top-7 max-w-[8rem] truncate whitespace-nowrap text-[10px] text-ink-soft">
                {ev.label}
              </span>
              <span className="h-2 w-2 rounded-full bg-risk-mid" />
              <span className="absolute top-3 font-data text-[10px] tabular-nums text-ink-muted">
                {ev.ano}
              </span>
            </div>
          );
        })}

        {/* Marcador "Hoje" — container fixo 28px, tudo centrado */}
        <div className="absolute right-0 -translate-y-1/2" style={{ width: 28 }}>
          <span className="absolute -top-7 w-full text-center font-data text-[10px] uppercase tracking-wide text-ink-muted">
            Hoje
          </span>
          <span className="mx-auto block h-2 w-2 rounded-full border border-hairline-hover bg-transparent" />
          <span className="absolute top-3 w-full text-center font-data text-[10px] tabular-nums text-ink-muted">
            {anoAtual}
          </span>
        </div>
      </div>
    </div>
  );
}
