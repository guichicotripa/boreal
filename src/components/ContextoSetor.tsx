import { type SetorContexto, CONTEXTO_ATUALIZADO_EM } from "@/lib/setor-contexto";

// Conteúdo do contexto de mercado de um setor: macro, dinâmica, consolidadores,
// tendências e fontes. Curado manualmente (setor-contexto.json). Compartilhado entre
// /setores (visão geral por vertical) e /empresa/[id] (contexto do alvo antes da abordagem),
// pra não divergir. Presentacional puro (sem hooks) → roda em server e client component.
export function ContextoSetor({ ctx }: { ctx: SetorContexto }) {
  return (
    <div>
      <p className="text-[15px] leading-relaxed text-ink-soft">{ctx.macro}</p>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{ctx.dinamica}</p>

      {ctx.players.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[11px] font-medium text-ink-muted">Principais consolidadores</p>
          <ul className="space-y-2">
            {ctx.players.map((p) => (
              <li key={p.nome} className="text-[14px] leading-relaxed text-ink-soft">
                <span className="text-ink">{p.nome}</span> — {p.nota}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5">
        <p className="mb-2 text-[11px] font-medium text-ink-muted">Tendências</p>
        <ul className="space-y-1.5">
          {ctx.tendencias.map((t) => (
            <li key={t} className="flex gap-2 text-[14px] leading-relaxed text-ink-soft">
              <span className="shrink-0 text-ink-faint">·</span>
              {t}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5">
        <p className="mb-1.5 text-[11px] font-medium text-ink-muted">Fontes</p>
        <ul className="space-y-1">
          {ctx.fontes.map((f) => (
            <li key={f.url}>
              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] leading-relaxed text-ink underline-offset-2 hover:underline"
              >
                {f.titulo}
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[10.5px] text-ink-faint">
          Contexto de mercado curado · atualizado em {CONTEXTO_ATUALIZADO_EM}.
        </p>
      </div>
    </div>
  );
}
