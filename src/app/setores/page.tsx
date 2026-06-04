import type { Metadata } from "next";
import { SETORES, SETORES_GERADO_EM, type Setor } from "@/lib/setores";

export const metadata: Metadata = {
  title: "Boreal · Setores",
  description: "Cobertura por setor — cada um tem sua lente e seu score validado.",
};

function fmt(n: number) {
  return n.toLocaleString("pt-BR");
}

const STATUS: Record<string, { label: string; cls: string }> = {
  validado: { label: "Validado", cls: "border-floral/40 text-floral" },
  itera: { label: "Itera", cls: "border-risk-mid/40 text-risk-mid" },
  consolidacao: { label: "Consolidação", cls: "border-hairline text-bone" },
};

const LENTE: Record<string, string> = {
  sucessao: "Sucessão — prevê quem vende",
  consolidacao: "Consolidação — prevê o que os roll-ups compram",
};

function recallCor(s: Setor) {
  if (s.recall_top10 == null) return "text-olive";
  if (s.recall_top10 >= 40) return "text-floral";
  if (s.recall_top10 >= 25) return "text-risk-mid";
  return "text-bone";
}

export default function Setores() {
  return (
    <div className="min-h-screen bg-smoky text-floral">
      <main className="mx-auto max-w-4xl px-6 py-12">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <p className="font-data text-[11px] uppercase tracking-wider text-olive">
              Cobertura · cada setor joga um jogo
            </p>
            <h1 className="mt-2 font-display text-3xl tracking-tight md:text-4xl">Setores</h1>
          </div>
          <a href="/" className="font-data text-sm text-bone transition-colors hover:text-floral">
            ← Busca
          </a>
        </header>

        <p className="mb-8 max-w-2xl text-sm leading-relaxed text-bone">
          O score não é único: cada setor tem sua <strong className="text-floral">lente</strong>. Onde o
          sinal de sucessão valida (recall alto), prevemos <em>quem vende</em>; onde o jogo é consolidação,
          a lente vira <em>o que os roll-ups compram</em>. O número decide — não a intuição.
        </p>

        <div className="space-y-4">
          {SETORES.map((s) => {
            const st = STATUS[s.status];
            return (
              <section key={s.id} className="rounded-xl border border-hairline bg-surface p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-xl tracking-tight text-floral">{s.nome}</h2>
                  <div className="flex items-center gap-2">
                    <span className="rounded border border-hairline px-2 py-0.5 font-data text-[10px] uppercase tracking-wider text-olive">
                      CNAE {s.cnaes.join("/")}
                    </span>
                    <span className={`rounded border px-2 py-0.5 font-data text-[10px] uppercase tracking-wider ${st.cls}`}>
                      {st.label}
                    </span>
                  </div>
                </div>

                <p className="mt-1 font-data text-[11px] uppercase tracking-wider text-olive">
                  Lente: {LENTE[s.lente]}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                  <div>
                    <p className={`font-display text-2xl tabular-nums ${recallCor(s)}`}>
                      {s.recall_top10 != null ? `${s.recall_top10}%` : "—"}
                    </p>
                    <p className="font-data text-[10px] uppercase tracking-wider text-olive">Recall top 10%</p>
                  </div>
                  <div>
                    <p className="font-display text-2xl tabular-nums text-floral">{fmt(s.quente)}</p>
                    <p className="font-data text-[10px] uppercase tracking-wider text-olive">Alvos quentes</p>
                  </div>
                  <div>
                    <p className="font-display text-2xl tabular-nums text-bone">{fmt(s.universo)}</p>
                    <p className="font-data text-[10px] uppercase tracking-wider text-olive">Universo (SP)</p>
                  </div>
                  <div>
                    <p className="font-display text-2xl tabular-nums text-bone">~{s.deals_ano}</p>
                    <p className="font-data text-[10px] uppercase tracking-wider text-olive">Deals/ano</p>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-relaxed text-bone">{s.descricao}</p>

                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 font-data text-xs">
                  <a href={`/?setor=${s.id}`} className="text-floral transition-colors hover:underline">
                    Buscar neste setor →
                  </a>
                  {s.lente === "consolidacao" && (
                    <a href="/consolidadores" className="text-bone transition-colors hover:text-floral">
                      Ver consolidadores
                    </a>
                  )}
                  <a href="/mercado" className="text-bone transition-colors hover:text-floral">
                    Ver mercado
                  </a>
                </div>
              </section>
            );
          })}
        </div>

        <p className="mt-8 font-data text-xs text-olive">
          Recall medido leakage-free (score em 2023 vs aquisições reais até 2025, decil dentro do setor).
          Gate do Relay: ≥40% valida · 25–40% itera · &lt;25% o jogo é consolidação. Gerado em{" "}
          {new Date(SETORES_GERADO_EM).toLocaleDateString("pt-BR")} · `scripts/build-setores.mjs`.
        </p>
      </main>
    </div>
  );
}
