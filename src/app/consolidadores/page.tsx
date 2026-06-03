import type { Metadata } from "next";
import dados from "@/lib/consolidadores.json";

export const metadata: Metadata = {
  title: "Boreal · Consolidadores",
  description:
    "A outra lente: detectar roll-ups em formação no registro e prever o próximo alvo deles.",
};

type Alvo = {
  nome: string;
  cnae: string;
  socio_faixa: string;
  desde: number;
  encaixe: number;
};
type Consolidador = {
  consolidador: string;
  n_adquiridas: number;
  cnaes: string[];
  n_municipios: number;
  proximos_alvos: Alvo[];
};

function titulo(s: string) {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/ Ltda| S\/s| S\.a\.| Sa\b/gi, "");
}

export default function Consolidadores() {
  const consolidadores = dados.consolidadores as Consolidador[];

  return (
    <div className="min-h-screen bg-smoky text-floral">
      <main className="mx-auto max-w-3xl px-6 py-12">
        <header className="mb-10 flex items-center justify-between">
          <div>
            <p className="font-data text-[11px] uppercase tracking-wider text-olive">
              A outra lente · quem compra
            </p>
            <h1 className="mt-2 font-display text-3xl tracking-tight md:text-4xl">
              Consolidadores e o próximo alvo
            </h1>
          </div>
          <a href="/" className="font-data text-sm text-bone transition-colors hover:text-floral">
            ← Busca
          </a>
        </header>

        {/* Tese das duas lentes */}
        <section className="rounded-xl border border-hairline bg-surface p-6">
          <p className="leading-relaxed text-bone">
            O mercado tem <strong className="text-floral">dois jogos</strong>, e o registro revela
            qual setor joga qual.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-hairline p-4">
              <p className="font-data text-[11px] uppercase tracking-wider text-olive">
                Metalmecânica · sucessão
              </p>
              <p className="mt-2 text-sm leading-snug text-bone">
                Donos envelhecendo, sem sucessor. O modelo prevê quem vai <strong className="text-floral">vender</strong>.{" "}
                <a href="/validacao" className="text-risk-mid underline-offset-2 hover:underline">
                  67% de recall →
                </a>
              </p>
            </div>
            <div className="rounded-lg border border-hairline p-4">
              <p className="font-data text-[11px] uppercase tracking-wider text-olive">
                Saúde · consolidação
              </p>
              <p className="mt-2 text-sm leading-snug text-bone">
                Roll-ups comprando dezenas de clínicas. O modelo prevê o que eles vão{" "}
                <strong className="text-floral">comprar a seguir</strong>.
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs leading-snug text-olive">
            Mesma mina de dados (transições de sócios no CNPJ), invertida: em vez de detectar o sócio
            PJ <em>entrando</em> num alvo, agrupamos por <em>quem</em> entrou. Quem aparece em muitas
            empresas do mesmo setor é um consolidador — e o perfil do que já comprou prevê o próximo.
          </p>
        </section>

        {/* Consolidadores */}
        <div className="mt-8 space-y-6">
          {consolidadores.map((c) => (
            <section key={c.consolidador} className="rounded-xl border border-hairline bg-surface p-6">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="font-display text-xl tracking-tight text-floral">
                  {titulo(c.consolidador)}
                </h2>
                <span className="shrink-0 font-data text-sm text-risk-mid">
                  {c.n_adquiridas} já adquiridas
                </span>
              </div>
              <p className="mt-1 font-data text-[11px] uppercase tracking-wider text-olive">
                Buy-box: CNAE {c.cnaes.join(", ")} · {c.n_municipios}{" "}
                {c.n_municipios === 1 ? "praça" : "praças"}
              </p>

              <p className="mt-5 font-data text-[11px] uppercase tracking-wider text-bone">
                Próximos alvos prováveis
              </p>
              <ul className="mt-2 divide-y divide-hairline">
                {c.proximos_alvos.map((a, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="text-sm text-floral">{titulo(a.nome)}</span>
                    <span className="shrink-0 font-data text-[11px] text-olive">
                      sócio {a.socio_faixa} · desde {a.desde}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="mt-8 font-data text-xs text-olive">
          Alvos = empresas ainda independentes (só sócios PF no quadro), no buy-box do consolidador, com
          sócio 61+. Gerado em {new Date(dados.gerado_em).toLocaleDateString("pt-BR")} · ground truth
          minerado do CNPJ (Receita Federal via BigQuery).
        </p>
      </main>
    </div>
  );
}
