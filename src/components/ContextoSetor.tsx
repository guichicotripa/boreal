import { type SetorContexto, CONTEXTO_ATUALIZADO_EM } from "@/lib/setor-contexto";

// Conteúdo do contexto de mercado de um setor: macro, dinâmica, consolidadores,
// tendências e fontes. Curado manualmente (setor-contexto.json). Compartilhado entre
// /setores (visão geral por vertical) e /empresa/[id] (contexto do alvo antes da abordagem),
// pra não divergir. Presentacional puro (sem hooks) → roda em server e client component.
export function ContextoSetor({ ctx }: { ctx: SetorContexto }) {
  return (
    <div>
      <p className="text-[15px] leading-relaxed text-bone">{ctx.macro}</p>
      <p className="mt-3 text-[15px] leading-relaxed text-bone">{ctx.dinamica}</p>

      {ctx.players.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 font-data text-[10px] uppercase tracking-wider text-bone/70">Principais consolidadores</p>
          <ul className="space-y-2">
            {ctx.players.map((p) => (
              <li key={p.nome} className="text-[14px] leading-relaxed text-bone">
                <span className="text-floral">{p.nome}</span> — {p.nota}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5">
        <p className="mb-2 font-data text-[10px] uppercase tracking-wider text-bone/70">Tendências</p>
        <ul className="space-y-1.5">
          {ctx.tendencias.map((t) => (
            <li key={t} className="flex gap-2 text-[14px] leading-relaxed text-bone">
              <span className="shrink-0 text-olive">·</span>
              {t}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5">
        <p className="mb-1.5 font-data text-[10px] uppercase tracking-wider text-bone/70">Fontes</p>
        <ul className="space-y-1">
          {ctx.fontes.map((f) => (
            <li key={f.url}>
              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] leading-relaxed text-floral underline-offset-2 hover:underline"
              >
                {f.titulo}
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-2 font-data text-[10px] text-olive">
          Contexto de mercado curado · atualizado em {CONTEXTO_ATUALIZADO_EM}.
        </p>
      </div>
    </div>
  );
}
