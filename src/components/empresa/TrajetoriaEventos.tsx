import type { TrajetoriaResult, TrajetoriaEvento } from "@/lib/types";

// Separa o nome do sócio (sempre na cor primária) do status (cor por tipo). Os eventos vêm
// com o nome embutido no `texto` ("Saiu FULANO", "FULANO: 71–80 → 80+"), então
// parseamos por tipo. O envelhecimento ganha o verbo que faltava: sem ele,
// "FULANO: 71–80 → 80+" ao lado de "Entrou X" parecia uma entrada em 2023.
function partesEvento(ev: TrajetoriaEvento): { nome: string; status: string } {
  if (ev.tipo === "saiu") {
    return { nome: ev.texto.replace(/^Saiu\s+/, ""), status: "saiu" };
  }
  if (ev.tipo === "entrou") {
    const m = ev.texto.match(/^Entrou\s+(.*?)(?:\s+\(([^)]*)\))?$/);
    return { nome: m?.[1] ?? ev.texto, status: m?.[2] ? `entrou (${m[2]})` : "entrou" };
  }
  // envelheceu: "NOME: 71–80 → 80+"
  const idx = ev.texto.indexOf(":");
  return idx >= 0
    ? { nome: ev.texto.slice(0, idx).trim(), status: `envelheceu · ${ev.texto.slice(idx + 1).trim()}` }
    : { nome: ev.texto, status: "envelheceu" };
}

// Lista de movimentação societária real (entrou/saiu/envelheceu), reconstruída
// comparando snapshots anuais do CNPJ. Sem título próprio — cada consumidor
// (MemoDisplay, tab Trajetória) põe o heading no seu estilo.
export function TrajetoriaEventos({ trajetoria }: { trajetoria: TrajetoriaResult }) {
  return (
    <>
      <ul className="space-y-1">
        {trajetoria.eventos.map((ev, i) => {
          const { nome, status } = partesEvento(ev);
          const statusColor =
            ev.tipo === "entrou"
              ? "text-ink/60"
              : ev.tipo === "saiu"
                ? "text-risk-high"
                : "text-risk-mid";
          return (
            <li key={`${ev.ano}-${i}`} className="flex gap-2 text-[13px] leading-snug">
              <span className="shrink-0 font-data tabular-nums text-ink-soft/60">{ev.ano}</span>
              <span className="min-w-0">
                <span className="text-ink">{nome}</span>
                {status && <span className={`ml-1.5 ${statusColor}`}>{status}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-1 text-[11px] text-ink-soft/60">
        Reconstruído comparando snapshots anuais do CNPJ — o ano marca quando a mudança foi
        detectada, não quando o sócio entrou.
      </p>
    </>
  );
}
