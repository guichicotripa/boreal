import type { Metadata } from "next";
import Link from "next/link";
import { SETORES, SETORES_GERADO_EM, type Setor } from "@/lib/setores";

export const metadata: Metadata = {
  title: "Boreal · Setores",
  description: "Score de sucessão validado por setor. A lente segue o perfil de M&A de cada vertical.",
};

function fmt(n: number) {
  return n.toLocaleString("pt-BR");
}

const STATUS: Record<string, { label: string; cls: string }> = {
  validado: { label: "Validado", cls: "border-hairline text-bone" },
  itera: { label: "Itera", cls: "border-hairline text-bone" },
  consolidacao: { label: "Consolidação", cls: "border-hairline text-bone" },
};

const LENTE: Record<string, string> = {
  sucessao: "Sucessão: identifica quem tende a vender",
  consolidacao: "Consolidação: identifica o próximo alvo dos roll-ups",
};

function recallCor(s: Setor) {
  if (s.recall_sucessao == null) return "text-olive";
  if (s.recall_sucessao >= 70) return "text-floral";
  if (s.recall_sucessao >= 40) return "text-bone";
  return "text-bone";
}

export default function Setores() {
  return (
    <div className="min-h-screen bg-smoky text-floral">
      <main className="mx-auto max-w-4xl px-6 py-12">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <p className="font-data text-[11px] uppercase tracking-wider text-olive">
              Cobertura setorial · uma lente por vertical
            </p>
            <h1 className="mt-2 font-display text-3xl tracking-tight md:text-4xl">Setores</h1>
          </div>
          <Link href="/" className="group flex items-center gap-2 font-data text-[11px] uppercase tracking-wider text-floral transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 rounded-sm">
            <span className="transition-transform duration-200 group-hover:-translate-x-1">←</span>
            <span>Voltar à busca</span>
          </Link>
        </header>

        <p className="mb-8 max-w-2xl text-[15px] leading-relaxed text-bone">
          O score de sucessão acerta <strong>88–100% das vendas de sucessão em
          todos os setores</strong>. O que muda é a <strong>dinâmica</strong> do setor:
          em sucessão, identificamos quem vende; em consolidação, o foco é o próximo alvo dos
          roll-ups. A lente segue essa dinâmica, não o contrário.
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

                <p className="mt-1 font-data text-[11px] uppercase tracking-wider text-bone/70">
                  Lente: {LENTE[s.lente]}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                  <div>
                    <p className={`font-display text-2xl tabular-nums ${recallCor(s)}`}>
                      {s.recall_sucessao != null ? `${s.recall_sucessao}%` : "—"}
                    </p>
                    <p className="font-data text-[10px] uppercase tracking-wider text-bone/70">
                      Acerto nas vendas de sucessão
                    </p>
                  </div>
                  <div>
                    <p className="font-display text-2xl tabular-nums text-bone">{s.pct_sucessao}%</p>
                    <p className="font-data text-[10px] uppercase tracking-wider text-bone/70">
                      Do M&amp;A é sucessão
                    </p>
                  </div>
                  <div>
                    <p className="font-display text-2xl tabular-nums text-floral">{fmt(s.quente)}</p>
                    <p className="font-data text-[10px] uppercase tracking-wider text-bone/70">Sinalizadas</p>
                  </div>
                  <div>
                    <p className="font-display text-2xl tabular-nums text-bone">{fmt(s.universo)}</p>
                    <p className="font-data text-[10px] uppercase tracking-wider text-bone/70">Universo (SP)</p>
                  </div>
                </div>

                <p className="mt-4 text-[15px] leading-relaxed text-bone">{s.descricao}</p>

                {s.nacional?.recall_sucessao != null && (
                  <p className="mt-2 font-data text-[11px] text-bone/60">
                    Testado fora de SP:{" "}
                    <span className="font-medium">{s.nacional.recall_sucessao}%</span> de acerto nas vendas de
                    sucessão (Brasil inteiro, N={s.nacional.n_aquisicoes_sucessao} aquisições).
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 font-data text-xs">
                  {s.lente === "consolidacao" && (
                    <Link href="/consolidadores" className="text-bone transition-colors hover:text-floral focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 rounded-sm">
                      Ver consolidadores
                    </Link>
                  )}
                  <Link href="/mercado" className="text-bone transition-colors hover:text-floral focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 rounded-sm">
                    Ver mercado
                  </Link>
                  <Link href={`/?setor=${s.id}`} className="group flex items-center gap-1 text-floral transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 rounded-sm">
                    Buscar neste setor <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
                  </Link>
                </div>
              </section>
            );
          })}
        </div>

        <p className="mt-8 font-data text-xs text-olive">
          &ldquo;Acerto nas vendas de sucessão&rdquo; = recall@top10% medido leakage-free, apenas nas aquisições
          de perfil sucessório, sócio 61+ e empresa 25+. Status pelo perfil de M&amp;A do setor: ≥40% do M&amp;A é
          sucessão = setor de sucessão · 20–40% misto · &lt;20% consolidação. Gerado em{" "}
          {new Date(SETORES_GERADO_EM).toLocaleDateString("pt-BR")}.
        </p>
      </main>
    </div>
  );
}
