import type { Metadata } from "next";
import tam from "@/lib/tam.json";

export const metadata: Metadata = {
  title: "Boreal · Mercado",
  description: "O tamanho do mercado: universo de alvos com perfil sucessório vs. liquidez real.",
};

type Vertical = {
  id: string;
  nome: string;
  total: number;
  independentes: number;
  quente: number;
  deals_ano: number;
};

function fmt(n: number) {
  return n.toLocaleString("pt-BR");
}

// Sensibilidade ILUSTRATIVA — não é dado por empresa. Assunções explícitas e conservadoras.
const GIRO_ALVO = 0.02; // 2% ao ano (vs 0,46% hoje) se a originação destravar
const TICKET = 30; // R$ milhões, ticket médio conservador middle-market
const FEE = 0.03; // 3% de advisory fee

export default function Mercado() {
  const verticais = tam.verticais as Vertical[];
  const dealsPotenciais = Math.round(tam.quente_total * GIRO_ALVO);
  const dealValueBi = (dealsPotenciais * TICKET) / 1000; // R$ bi/ano
  const feesMi = Math.round(dealValueBi * 1000 * FEE); // R$ mi/ano

  return (
    <div className="min-h-screen bg-smoky text-floral">
      <main className="mx-auto max-w-3xl px-6 py-12">
        <header className="mb-10 flex items-center justify-between">
          <div>
            <p className="font-data text-[11px] uppercase tracking-wider text-olive">
              O mercado · oferta vs. liquidez
            </p>
            <h1 className="mt-2 font-display text-3xl tracking-tight md:text-4xl">
              Grande e ilíquido — por falta de originação
            </h1>
          </div>
          <a href="/" className="font-data text-sm text-bone transition-colors hover:text-floral">
            ← Busca
          </a>
        </header>

        {/* Hero — o gap */}
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-hairline bg-surface p-6">
            <p className="font-display text-[56px] leading-none tracking-tight text-floral">
              {fmt(tam.quente_total)}
            </p>
            <p className="mt-3 text-sm leading-snug text-bone">
              empresas com <strong className="text-floral">perfil sucessório quente</strong>{" "}
              (independentes, sócio 61+, 25+ anos) — só em metalmec + saúde, só em SP.
            </p>
          </div>
          <div className="rounded-xl border border-hairline bg-surface p-6">
            <p className="font-display text-[56px] leading-none tracking-tight text-risk-mid">
              {tam.giro_anual_pct.toLocaleString("pt-BR")}%
            </p>
            <p className="mt-3 text-sm leading-snug text-bone">
              transacionam por ano (~{tam.deals_ano_total} deals). Menos de 1% de giro:{" "}
              <strong className="text-floral">o mercado está congelado</strong> — não por falta de
              alvo, mas de quem origina.
            </p>
          </div>
        </section>

        {/* Funil por vertical */}
        <section className="mt-10">
          <h2 className="font-data text-[11px] uppercase tracking-wider text-olive">
            O funil, por vertical
          </h2>
          <div className="mt-4 overflow-hidden rounded-xl border border-hairline">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline bg-surface text-left font-data text-[11px] uppercase tracking-wider text-olive">
                  <th className="px-4 py-3 font-medium">Vertical</th>
                  <th className="px-4 py-3 text-right font-medium">Universo</th>
                  <th className="px-4 py-3 text-right font-medium">Independentes</th>
                  <th className="px-4 py-3 text-right font-medium">Quentes</th>
                  <th className="px-4 py-3 text-right font-medium">Deals/ano</th>
                </tr>
              </thead>
              <tbody className="font-data">
                {verticais.map((v) => (
                  <tr key={v.id} className="border-b border-hairline last:border-0">
                    <td className="px-4 py-3 text-floral">{v.nome}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-bone">{fmt(v.total)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-bone">{fmt(v.independentes)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-floral">{fmt(v.quente)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-bone">~{v.deals_ano}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Sensibilidade ilustrativa — honesta */}
        <section className="mt-10 rounded-xl border border-hairline bg-surface p-6">
          <h2 className="font-data text-[11px] uppercase tracking-wider text-olive">
            O que isso vale — sensibilidade ilustrativa
          </h2>
          <p className="mt-3 leading-relaxed text-bone">
            Se a originação ativa levar o giro de {tam.giro_anual_pct.toLocaleString("pt-BR")}% para{" "}
            {(GIRO_ALVO * 100).toFixed(0)}% ao ano, são{" "}
            <strong className="text-floral">~{fmt(dealsPotenciais)} transações/ano</strong> a mais. A um
            ticket conservador de R${TICKET}M e fee de {(FEE * 100).toFixed(0)}%, isso é da ordem de{" "}
            <strong className="text-floral">R$ {dealValueBi.toFixed(1)} bi/ano em deal value</strong> e{" "}
            <strong className="text-floral">~R$ {fmt(feesMi)} mi/ano em fees origináveis</strong>.
          </p>
          <p className="mt-3 text-xs leading-snug text-olive">
            Sensibilidade ilustrativa com premissas explícitas — não estimamos R$ por empresa (isso seria
            dado inventado). E isto é <strong className="text-bone">2 verticais em 1 estado</strong>: o
            universo familiar brasileiro é ~90% das empresas do país.
          </p>
        </section>
      </main>
    </div>
  );
}
