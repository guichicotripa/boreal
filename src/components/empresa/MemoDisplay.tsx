import type { Empresa, DossierAnalise, TrajetoriaResult } from "@/lib/types";
import { precedentesParaEmpresa, cenarioIlustrativo, dadosParaFechar } from "@/lib/memo-extras";
import { Timeline } from "./Timeline";
import { TrajetoriaEventos } from "./TrajetoriaEventos";

// Memo de investimento: narrativa LLM (overview, análise sucessória, red flags,
// perguntas, tese, próximo passo) + três blocos quantitativos determinísticos
// (precedentes, cenário, dados para fechar). Compartilhado entre home e página da empresa.
// `trajetoria` é opcional: quando presente, mostra a movimentação societária real
// (entrou/saiu/envelheceu) reconstruída do CNPJ — o que a Timeline (só entradas atuais) não vê.
export function MemoDisplay({
  empresa,
  analise,
  trajetoria,
}: {
  empresa: Empresa;
  analise: DossierAnalise;
  trajetoria?: TrajetoriaResult | null;
}) {
  const precedentes = precedentesParaEmpresa(empresa);
  const cenario = cenarioIlustrativo(empresa);
  const dadosFechar = dadosParaFechar(empresa);
  return (
    <div className="space-y-5 rounded-lg border border-hairline bg-surface p-4 text-sm">
      <span className="text-[11px] font-medium text-ink-soft/60">Dossiê</span>
      <p className="leading-relaxed text-ink">{analise.overview}</p>
      <Timeline empresa={empresa} />

      {/* Movimentação societária real (2022→2025) — o que a Timeline não mostra:
          saídas e envelhecimento de faixa, reconstruídos comparando snapshots do CNPJ. */}
      {trajetoria && trajetoria.eventos.length > 0 && (
        <div>
          <h4 className="mb-1 text-[11px] font-medium text-ink-soft/60">
            Movimentação societária (2022→2025)
          </h4>
          <TrajetoriaEventos trajetoria={trajetoria} />
        </div>
      )}
      <div>
        <h4 className="mb-1 text-[11px] font-medium text-ink-soft/60">
          Análise de risco sucessório
        </h4>
        <p className="leading-relaxed text-ink">{analise.analise_sucessoria}</p>
      </div>

      {/* Red flags a investigar — ordenado por severidade, max 5 · como_verificar em linha própria */}
      {analise.red_flags?.length ? (
        <div>
          <h4 className="mb-1 text-[11px] font-medium text-ink-soft/60">
            Red flags a investigar
          </h4>
          <ul className="space-y-2.5">
            {[...analise.red_flags]
              .sort((a, b) => {
                const ord = { alta: 0, media: 1, baixa: 2 } as Record<string, number>;
                return (ord[a.severidade] ?? 3) - (ord[b.severidade] ?? 3);
              })
              .slice(0, 5)
              .map((rf, i) => {
                const cor =
                  rf.severidade === "alta"
                    ? "border-risk-high/50 text-risk-high"
                    : rf.severidade === "media"
                      ? "border-risk-mid/50 text-risk-mid"
                      : "border-hairline text-ink-soft";
                return (
                  <li key={i}>
                    <div>
                      <span className={`mr-2 rounded border px-1.5 py-0.5 text-[10px] font-medium ${cor}`}>
                        {rf.severidade}
                      </span>
                      <span className="text-ink">{rf.risco}</span>
                    </div>
                    {rf.como_verificar && (
                      <p className="mt-1 pl-0.5 text-[11px] leading-relaxed text-ink-soft">
                        {rf.como_verificar}
                      </p>
                    )}
                  </li>
                );
              })}
          </ul>
        </div>
      ) : null}

      {analise.perguntas_abordagem.length > 0 && (
        <div>
          <h4 className="mb-1 text-[11px] font-medium text-ink-soft/60">
            Perguntas para o primeiro contato
          </h4>
          <ul className="list-decimal space-y-1 pl-5 text-ink">
            {analise.perguntas_abordagem.map((p, i) => (
              <li key={i} className="leading-relaxed">{p}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Quant #1 — Precedentes de M&A do setor (minerado do CNPJ, dado real) */}
      {precedentes && (
        <div>
          <h4 className="mb-1 text-[11px] font-medium text-ink-soft/60">
            Precedentes de M&amp;A no setor
          </h4>
          <p className="leading-relaxed text-ink">
            <strong>{precedentes.n_deals}</strong> aquisições em {precedentes.setor} (SP) nos últimos{" "}
            {precedentes.periodo_anos.toLocaleString("pt-BR")} anos —{" "}
            {precedentes.padrao === "consolidacao"
              ? "setor em consolidação ativa."
              : "compras pontuais, sem consolidador dominante."}
          </p>
          {precedentes.compradores.length > 0 && (
            <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
              <span className="text-ink-soft/70">Compradores ativos:</span>{" "}
              {precedentes.compradores.map((c) => `${c.nome} (${c.n})`).join(" · ")}
            </p>
          )}
          {precedentes.exemplos.length > 0 && (
            <p className="mt-0.5 text-[11px] leading-relaxed text-ink-soft/70">
              Ex. adquiridas: {precedentes.exemplos.join(" · ")}
            </p>
          )}
          <p className="mt-1 text-[10.5px] text-ink-soft/60">Minerado do CNPJ — transações reais, não estimativa.</p>
        </div>
      )}

      {/* Quant #2 — Cenário de retorno: faixas de referência (frame, não valuation) */}
      <div>
        <h4 className="mb-1 text-[11px] font-medium text-ink-soft/60">
          Cenário de retorno — referência (ilustrativo)
        </h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-data text-xs sm:grid-cols-4">
          <div><span className="text-ink-soft/70">Entrada</span><br /><span className="text-ink">{cenario.multiplo_entrada}</span></div>
          <div><span className="text-ink-soft/70">Saída</span><br /><span className="text-ink">{cenario.multiplo_saida}</span></div>
          <div><span className="text-ink-soft/70">Hold</span><br /><span className="text-ink">{cenario.hold}</span></div>
          <div><span className="text-ink-soft/70">Alvo</span><br /><span className="text-ink">{cenario.retorno_alvo}</span></div>
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft/60">{cenario.nota}</p>
      </div>

      {/* Quant #3 — Para fechar o número: o que pedir ao dono (sourcing → IC) */}
      <div>
        <h4 className="mb-1 text-[11px] font-medium text-ink-soft/60">
          Para fechar o número — pedir ao dono
        </h4>
        <ul className="list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-ink-soft">
          {dadosFechar.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      </div>

      {/* Tese hairline (recuada, contexto) */}
      <div className="pl-3">
        <h4 className="mb-1 text-[11px] font-medium text-ink-soft/60">
          Tese de aproximação
        </h4>
        <p className="leading-relaxed text-ink">{analise.tese_aproximacao}</p>
      </div>

      {/* Próximo passo surface-hover (mais destaque, CTA) */}
      {analise.proximo_passo && (
        <div className="rounded-md bg-surface-hover p-3">
          <h4 className="mb-1 text-[11px] font-medium text-ink-soft/60">
            Próximo passo
          </h4>
          <p className="leading-relaxed text-ink">→ {analise.proximo_passo}</p>
        </div>
      )}
    </div>
  );
}
