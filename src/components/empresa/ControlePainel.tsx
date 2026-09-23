import type { SinalControle, VerificacaoWeb } from "@/lib/aquisicao";

/* "Quem controla esta empresa hoje", na página da empresa. Junta as duas camadas:
 *
 *   CADASTRO (sempre): o quadro societário da Receita, lido por `src/lib/aquisicao.ts`. Grátis e
 *   para qualquer empresa. É a fonte forte neste segmento: compra de empresa familiar de médio
 *   porte quase nunca vira notícia.
 *
 *   WEB (quando já rodou): o lote `scripts/verifica-aquisicao.ts`, com fonte registrada. Das 31
 *   verificadas em 21/09, confirmou 0 aquisições e 4 independências, e achou evento que o cadastro
 *   não mostrava (aporte de 2019 na ZIIGO, conversão para S.A.).
 *
 * QUANDO AS DUAS DISCORDAM, as duas aparecem. Esconder uma escolheria por quem vai ler, e quem vai
 * ler é justamente a pessoa que precisa ver a discordância para decidir se liga. */

const TOM_CADASTRO: Record<SinalControle["veredito"], string> = {
  "provavelmente comprada": "text-risk-mid",
  "reorganização familiar": "text-ink",
  "não sei, mas o quadro mudou": "text-ink-soft",
  "sem sinal de venda": "text-ink",
};

const ROTULO_WEB: Record<VerificacaoWeb["veredito"], string> = {
  comprada: "Aquisição confirmada com fonte",
  independente: "Independência confirmada com fonte",
  inconclusivo: "Sem informação pública suficiente",
};

const TIPO_EVENTO: Record<string, string> = {
  aquisicao: "aquisição", aporte: "aporte", fusao: "fusão", grupo_economico: "grupo econômico",
  mudanca_marca: "mudança de marca", situacao_cadastral: "situação cadastral", outro: "outro",
};

function dominio(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function ControlePainel({
  controle,
  verificacao,
}: {
  controle: SinalControle | null | undefined;
  verificacao: VerificacaoWeb | null | undefined;
}) {
  if (!controle) return null;
  const eventos = verificacao?.eventos ?? [];
  const fontes = verificacao?.fontes ?? [];

  return (
    <section className="rounded-lg border border-hairline bg-surface p-4">
      <h2 className="mb-3 text-[11px] font-medium text-ink-muted">Quem controla</h2>

      <div className="space-y-1">
        <p className="text-[10.5px] uppercase tracking-wide text-ink-muted">Quadro societário</p>
        <p className={`text-[12.5px] font-medium first-letter:uppercase ${TOM_CADASTRO[controle.veredito]}`}>
          {controle.veredito}
        </p>
        <p className="text-[11px] leading-snug text-ink-soft">{controle.porque}.</p>
      </div>

      {verificacao && (
        <div className="mt-3 space-y-1 border-t border-hairline pt-3">
          <p className="text-[10.5px] uppercase tracking-wide text-ink-muted">
            Busca na web · {new Date(verificacao.criado_em).toLocaleDateString("pt-BR")}
          </p>
          <p className="text-[12.5px] font-medium text-ink">{ROTULO_WEB[verificacao.veredito]}</p>
          {verificacao.resumo && (
            <p className="text-[11px] leading-snug text-ink-soft">{verificacao.resumo}</p>
          )}

          {eventos.length > 0 && (
            <ul className="mt-1.5 space-y-1">
              {eventos.map((ev, i) => (
                <li key={`${ev.url}-${i}`} className="text-[11px] leading-snug text-ink-soft">
                  <span className="text-ink-muted">{TIPO_EVENTO[ev.tipo] ?? ev.tipo}</span>
                  {ev.quando && <span className="tabular-nums text-ink-muted"> · {ev.quando}</span>}
                  {ev.quem && <> · {ev.quem}</>}{" "}
                  <a href={ev.url} target="_blank" rel="noopener noreferrer" className="text-ink-muted underline decoration-dotted underline-offset-2 hover:text-ink">
                    {dominio(ev.url)}
                  </a>
                </li>
              ))}
            </ul>
          )}

          {/* Sem fonte a resposta não vale nada: é o mesmo princípio do research, onde cada sinal
              carrega a URL. As fontes ficam visíveis, não escondidas num tooltip. */}
          {fontes.length > 0 && (
            <p className="mt-1.5 text-[10.5px] leading-snug text-ink-muted">
              Fontes:{" "}
              {fontes.map((f, i) => (
                <span key={f.url}>
                  {i > 0 && ", "}
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted underline-offset-2 hover:text-ink">
                    {dominio(f.url)}
                  </a>
                </span>
              ))}
            </p>
          )}
        </div>
      )}

      <p className="mt-3 text-[10.5px] leading-snug text-ink-muted">
        Indício de cadastro, não confirmação de negócio. Venda fechada e ainda não registrada não aparece.
      </p>
    </section>
  );
}
