import type { Metadata } from "next";
import Link from "next/link";
import dados from "@/lib/consolidadores.json";
import backtest from "@/lib/backtest-consolidadores.json";

export const metadata: Metadata = {
  title: "Boreal · Consolidadores",
  description:
    "A outra lente: detectar roll-ups em formação no registro e mapear o buy-box deles (descritivo).",
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
        <header className="mb-10 flex items-start justify-between">
          <div>
            <p className="font-data text-[11px] uppercase tracking-wider text-olive">
              A outra lente · quem compra
            </p>
            <h1 className="mt-2 font-display text-3xl tracking-tight md:text-4xl text-balance">
              Roll-ups se formando no registro
            </h1>
          </div>
          <Link href="/" className="group flex items-center gap-2 font-data text-[11px] uppercase tracking-wider text-floral transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 rounded-sm">
            <span className="transition-transform duration-200 group-hover:-translate-x-1">←</span>
            <span>Voltar à busca</span>
          </Link>
        </header>

        {/* Tese das duas lentes */}
        <section className="rounded-xl border border-hairline bg-surface p-6">
          <p className="text-[15px] leading-relaxed text-bone">
            O mercado tem <strong>dois jogos</strong>, e o registro revela
            qual setor joga qual.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-hairline p-4">
              <p className="font-data text-[11px] uppercase tracking-wider text-bone/70">
                Metalmecânica · sucessão
              </p>
              <p className="mt-2 text-sm leading-snug text-bone">
                Donos envelhecendo, sem plano de sucessão. O modelo identifica quem tem{" "}
                <strong>maior propensão a vender</strong>, com antecedência.
              </p>
            </div>
            <div className="rounded-lg border border-hairline p-4">
              <p className="font-data text-[11px] uppercase tracking-wider text-bone/70">
                Saúde · consolidação
              </p>
              <p className="mt-2 text-sm leading-snug text-bone">
                Roll-ups em expansão, sem anunciar. O modelo detecta <strong>quem está comprando e com que padrão</strong>, em tempo real.
              </p>
            </div>
          </div>
          <p className="mt-4 text-[13px] leading-relaxed text-bone/60">
            Mesma mina de dados (transições de sócios no CNPJ), invertida: em vez de detectar o sócio
            PJ <em>entrando</em> num alvo, agrupamos por <em>quem</em> entrou. Quem aparece em muitas
            empresas do mesmo setor é um consolidador — e dá pra mapear o <em>buy-box</em> dele (o perfil
            do que já comprou).
          </p>
        </section>

        {/* Honestidade: o backtest da previsão */}
        <section className="mt-6">
          <p className="font-data text-[11px] uppercase tracking-wider text-bone/70">
            E o próximo alvo? Backtestamos — e não vendemos como previsão
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-bone">
            Testamos se os candidatos listados pelo buy-box seriam de fato adquiridos:{" "}
            <strong>{Math.round((backtest.lift - 1) * 100)}% a mais de acerto</strong> que uma empresa aleatória do
            mesmo setor. O ganho é real. Mas o padrão de setor e cidade não captura as nuances que
            determinam o timing de cada deal. Por isso apresentamos os consolidadores como{" "}
            <strong>detecção descritiva</strong>, não como previsão: quem está ativamente comprando,
            em que ritmo e com que perfil: o tipo de inteligência que não aparece numa lista de
            prospecção convencional. A força preditiva mora na sucessão:{" "}
            <strong>97% de acerto nas vendas de sucessão</strong>.
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
                <span className="shrink-0 font-data text-sm text-floral">
                  {c.n_adquiridas} já adquiridas
                </span>
              </div>
              <p className="mt-5 font-data text-[11px] uppercase tracking-wider text-bone/70">
                Candidatos no padrão do comprador
              </p>
              <ul className="mt-2 divide-y divide-hairline">
                {c.proximos_alvos.map((a) => (
                  <li key={a.nome} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="text-sm text-floral">{titulo(a.nome)}</span>
                    <span className="shrink-0 font-data text-[11px] text-bone/70">
                      sócio {a.socio_faixa} · desde {a.desde}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="mt-8 font-data text-xs text-olive">
          Candidatos = empresas ainda independentes (só sócios PF no quadro), dentro do buy-box do
          consolidador, com sócio 61+. Não é uma previsão validada
          (ver backtest acima) — é o universo que se encaixa no padrão. Gerado em{" "}
          {new Date(dados.gerado_em).toLocaleDateString("pt-BR")} · minerado do CNPJ (Receita Federal via BigQuery).
        </p>
      </main>
    </div>
  );
}
