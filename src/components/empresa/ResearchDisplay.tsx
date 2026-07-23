import type { ResearchResult } from "@/lib/types";
import { PRESENCA_LABEL } from "@/lib/format";

// Resultado da investigação da IA: resumo, gatilho de timing, sinais com fonte e
// rascunho de abordagem. Componente compartilhado entre a home (card) e a página
// da empresa — fonte única do vocabulário visual da investigação.
export function ResearchDisplay({ research }: { research: ResearchResult }) {
  return (
    <div className="space-y-3 rounded-lg border border-hairline bg-surface p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-ink-muted">Investigação da IA</span>
        <span className="text-[10.5px] text-ink-muted">{PRESENCA_LABEL[research.presenca_digital]}</span>
      </div>
      {research.resumo && (
        <p className="text-sm leading-relaxed text-ink">{research.resumo}</p>
      )}
      {research.gatilho ? (
        <div className="rounded-md border border-risk-high/30 bg-risk-high/10 p-2.5">
          <p className="text-[11px] font-medium text-risk-high">Por que agora</p>
          <p className="mt-1 text-sm leading-snug text-ink">{research.gatilho}</p>
        </div>
      ) : (
        <div className="rounded-md bg-surface-hover p-2.5">
          <p className="text-[11px] font-medium text-ink-muted">
            Sem gatilho de timing · não é o momento
          </p>
          <p className="mt-1 text-sm leading-snug text-ink-soft">
            {research.sinais.some((s) => s.peso < 0)
              ? "A investigação encontrou sinal de sucessão já encaminhada (herdeiro ativo). Abordar agora tende a ser improdutivo — monitorar."
              : "O perfil não indica uma janela de abordagem no momento. Manter no radar, sem priorizar contato."}
          </p>
        </div>
      )}
      {research.sinais.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {research.sinais.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-data text-[10px] tabular-nums ${
                s.peso > 0 ? "bg-risk-high/15 text-risk-high" : "bg-fill text-ink-soft"
              }`}>
                {s.peso > 0 ? `+${s.peso}` : s.peso}
              </span>
              <div>
                <span className="font-medium text-ink">{s.rotulo}</span>
                <span className="text-ink-soft"> — {s.descricao}</span>
                {s.fonte_url && (
                  <a href={s.fonte_url} target="_blank" rel="noopener noreferrer"
                    className="ml-1 text-ink-faint transition-colors hover:text-ink-soft focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50 rounded-sm">
                    ↗ fonte
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-ink-soft">Nenhum sinal qualitativo conclusivo encontrado.</p>
      )}
      {research.mensagem_abordagem && (
        <div className="rounded-md bg-surface-hover p-2.5">
          <p className="text-[11px] font-medium text-ink-muted">
            Rascunho de abordagem · edite antes de enviar
          </p>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
            {research.mensagem_abordagem}
          </p>
        </div>
      )}
    </div>
  );
}
