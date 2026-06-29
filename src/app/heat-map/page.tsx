import type { Metadata } from "next";
import Link from "next/link";
import {
  setoresPorTemperatura,
  consolidadoresDoSetor,
  TIER_LABEL,
  CONSOLIDADORES_JANELA,
} from "@/lib/heatmap";
import { SETORES_GERADO_EM } from "@/lib/setores";
import { contextoSetor } from "@/lib/setor-contexto";

export const metadata: Metadata = {
  title: "Boreal · Heat-map de setores",
  description:
    "Termômetro de M&A por setor: ritmo de transações, intensidade e consolidadores ativos. Para priorizar onde o mercado está quente.",
};

function fmt(n: number) {
  return n.toLocaleString("pt-BR");
}

// Nomes da Receita vêm em CAIXA ALTA; suaviza pra leitura sem perder siglas curtas.
function titulo(s: string) {
  return s
    .toLowerCase()
    .replace(/\b([a-záàâãéêíóôõúç])/g, (m) => m.toUpperCase())
    .replace(/\b(Ltda|S\/s|S\/a|Me|Epp|E|De|Da|Do|Dos|Das)\b/g, (m) => m.toLowerCase());
}

const LENTE_TXT: Record<string, string> = {
  sucessao: "Sucessão — identifica quem tende a vender",
  consolidacao: "Consolidação — identifica o próximo alvo dos roll-ups",
};

function Metrica({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-display text-2xl tabular-nums text-bone">{value}</p>
      <p className="font-data text-[10px] uppercase tracking-wider text-bone/70">{label}</p>
    </div>
  );
}

export default function HeatMap() {
  const setores = setoresPorTemperatura();
  const janelaFim = new Date(CONSOLIDADORES_JANELA.novo).toLocaleDateString("pt-BR");

  return (
    <div className="min-h-screen bg-smoky text-floral">
      <main className="mx-auto max-w-4xl px-6 py-12">
        <header className="mb-8 flex items-start justify-between">
          <div>
            <p className="font-data text-[11px] uppercase tracking-wider text-olive">
              Termômetro de M&amp;A · priorize o inbound
            </p>
            <h1 className="mt-2 font-display text-3xl tracking-tight md:text-4xl">Heat-map de setores</h1>
          </div>
          <Link
            href="/"
            className="group flex items-center gap-2 rounded-sm font-data text-[11px] uppercase tracking-wider text-floral transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50"
          >
            <span className="transition-transform duration-200 group-hover:-translate-x-1">←</span>
            <span>Voltar à busca</span>
          </Link>
        </header>

        <p className="mb-8 max-w-2xl text-[15px] leading-relaxed text-bone">
          Quando um ativo chega, a primeira pergunta é <strong>onde vale priorizar o esforço</strong>. Este
          painel ordena os setores cobertos pelo <strong>ritmo real de M&amp;A</strong> (transações por ano,
          mineradas do CNPJ) e mostra quem está consolidando agora. Não é previsão de empresa individual; é a
          leitura de mercado pra decidir onde olhar primeiro.
        </p>

        <div className="space-y-4">
          {setores.map((s) => {
            const cons = consolidadoresDoSetor(s.id);
            const ctx = contextoSetor(s.id);
            return (
              <section key={s.id} className="rounded-xl border border-hairline bg-surface p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-xl tracking-tight text-floral">{s.nome}</h2>
                  <div className="flex items-center gap-2">
                    <span className="rounded border border-hairline px-2 py-0.5 font-data text-[10px] uppercase tracking-wider text-bone/70">
                      {TIER_LABEL[s.tier]}
                    </span>
                    <span className="rounded border border-hairline px-2 py-0.5 font-data text-[10px] uppercase tracking-wider text-olive">
                      CNAE {s.cnaes.join("/")}
                    </span>
                  </div>
                </div>

                <p className="mt-1 font-data text-[11px] uppercase tracking-wider text-bone/70">
                  Lente: {LENTE_TXT[s.lente]}
                </p>

                {/* Barra de intensidade — monocromática (Floral). Cor de risco fica reservada ao score. */}
                <div className="mt-4">
                  <div className="flex items-baseline justify-between">
                    <p className="font-data text-[10px] uppercase tracking-wider text-bone/70">
                      Intensidade de M&amp;A
                    </p>
                    <p className="font-display text-2xl tabular-nums text-floral">
                      {s.deals_ano}
                      <span className="ml-1 font-data text-[11px] text-bone/70">deals/ano</span>
                    </p>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-hairline">
                    <div className="h-full rounded-full bg-floral" style={{ width: `${s.intensidade}%` }} />
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                  <Metrica value={`${s.densidade_pct.toFixed(2)}%`} label="Do estoque quente girou" />
                  <Metrica value={s.n_consolidadores > 0 ? `${s.n_consolidadores}` : "—"} label="Consolidadores ativos" />
                  <Metrica value={`${s.pct_sucessao}%`} label="Do M&A é sucessão" />
                  <Metrica value={fmt(s.quente)} label="Empresas sinalizadas" />
                </div>

                {cons.length > 0 && (
                  <div className="mt-5 border-t border-hairline pt-5">
                    <p className="mb-3 font-data text-[11px] uppercase tracking-wider text-bone/70">
                      Quem está comprando agora
                    </p>
                    <ul className="space-y-1.5">
                      {cons.map((c) => (
                        <li key={c.nome} className="flex items-baseline justify-between gap-3 text-[13px]">
                          <span className="text-bone">{titulo(c.nome)}</span>
                          <span className="shrink-0 font-data text-[11px] text-bone/70">
                            {c.n_adquiridas} aquisições
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {ctx && (
                  <div className="mt-5 border-t border-hairline pt-5">
                    <p className="mb-2 font-data text-[11px] uppercase tracking-wider text-bone/70">
                      Leitura de mercado
                    </p>
                    <p className="text-[15px] leading-relaxed text-bone">{ctx.macro}</p>
                    <Link
                      href="/setores"
                      className="group mt-3 inline-flex items-center gap-1 rounded-sm font-data text-xs text-floral transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50"
                    >
                      Contexto completo do setor{" "}
                      <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
                    </Link>
                  </div>
                )}

                <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1 font-data text-xs">
                  {s.lente === "consolidacao" && (
                    <Link
                      href="/consolidadores"
                      className="rounded-sm text-bone transition-colors hover:text-floral focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50"
                    >
                      Ver consolidadores
                    </Link>
                  )}
                  <Link
                    href={`/?setor=${s.id}`}
                    className="group flex items-center gap-1 rounded-sm text-floral transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50"
                  >
                    Buscar neste setor{" "}
                    <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
                  </Link>
                </div>
              </section>
            );
          })}
        </div>

        <p className="mt-8 font-data text-xs text-olive">
          Ritmo e consolidadores minerados das transições do CNPJ (SP), janela até {janelaFim}. &ldquo;Deals/ano&rdquo;
          = transações detectadas no setor, anualizadas. &ldquo;Do estoque quente girou&rdquo; = fração das empresas
          sinalizadas que mudaram de mão na janela. Cobertura atual: 3 setores. Gerado em{" "}
          {new Date(SETORES_GERADO_EM).toLocaleDateString("pt-BR")}.
        </p>
      </main>
    </div>
  );
}
