import type { Metadata } from "next";
import Link from "next/link";
import tam from "@/lib/tam.json";
import coorte from "@/lib/coorte-destino.json";

export const metadata: Metadata = {
  title: "Mercado",
  description: "Muita empresa em estágio de sucessão, quase nenhum negócio — e por quê.",
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

// Sensibilidade ILUSTRATIVA — não é dado por empresa. Premissas explícitas e conservadoras.
const GIRO_ALVO = 0.02; // 2% ao ano (vs 0,46% hoje) se a originação destravar
const TICKET = 30; // R$ milhões, ticket médio conservador middle-market
const FEE = 0.03; // 3% de advisory fee

// Agrega o destino das duas verticais num só quadro.
const co = coorte.verticais as Record<string, { total: number; destinos: Record<string, number> }>;
const dest = { total: 0, inalterada: 0, baixada_inativa: 0, socio_saiu_ou_pj: 0, sucessao_familiar: 0, vendida: 0 };
for (const v of Object.values(co)) {
  dest.total += v.total;
  for (const k of Object.keys(dest)) if (k !== "total") dest[k as keyof typeof dest] += v.destinos[k] ?? 0;
}
const pct = (n: number) => Math.round((n / dest.total) * 100);
const DESTINOS = [
  { k: "inalterada", rotulo: "Seguem iguais — mesmo dono, em operação", forte: true },
  { k: "socio_saiu_ou_pj", rotulo: "Mudaram de sócio", forte: false },
  { k: "baixada_inativa", rotulo: "Encerradas ou inativas", forte: false },
  { k: "sucessao_familiar", rotulo: "Transferidas a um herdeiro", forte: false },
  { k: "vendida", rotulo: "Foram vendidas", forte: false },
] as const;

export default function Mercado() {
  const verticais = tam.verticais as Vertical[];
  const dealsPotenciais = Math.round(tam.quente_total * GIRO_ALVO);
  const dealValueBi = (dealsPotenciais * TICKET) / 1000; // R$ bi/ano
  const feesMi = Math.round(dealValueBi * 1000 * FEE); // R$ mi/ano

  return (
    <div className="min-h-screen bg-smoky text-floral">
      <main className="mx-auto max-w-3xl px-6 py-12">
        <header className="mb-10 flex items-start justify-between">
          <div>
            <p className="font-data text-[11px] uppercase tracking-wider text-olive">
              O mercado · o que ele realmente é
            </p>
            <h1 className="mt-2 font-display text-3xl tracking-tight md:text-4xl">
              Muita empresa. Quase nenhum negócio.
            </h1>
          </div>
          <Link href="/" className="group flex items-center gap-2 font-data text-[11px] uppercase tracking-wider text-floral transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 rounded-sm">
            <span className="transition-transform duration-200 group-hover:-translate-x-1">←</span>
            <span>Voltar à busca</span>
          </Link>
        </header>

        {/* Hero — o contraste */}
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-hairline bg-surface p-6">
            <p className="font-display text-[56px] leading-none tracking-tight text-floral">
              {fmt(tam.quente_total)}
            </p>
            <p className="mt-3 text-sm leading-snug text-bone">
              empresas com <strong>sócio com 61+ anos, 25+ anos de operação e
              ainda sob controle familiar</strong> — em metalmecânica, saúde e educação, só em SP.
            </p>
          </div>
          <div className="rounded-xl border border-hairline bg-surface p-6">
            <p className="font-display text-[56px] leading-none tracking-tight text-floral">
              {tam.giro_anual_pct.toLocaleString("pt-BR")}%
            </p>
            <p className="mt-3 text-sm leading-snug text-bone">
              são vendidas por ano (~{tam.deals_ano_total} negócios). Praticamente{" "}
              <strong>nenhuma muda de dono</strong>.
            </p>
          </div>
        </section>

        {/* Coorte — o que acontece com elas */}
        <section className="mt-10">
          <h2 className="font-data text-[11px] uppercase tracking-wider text-bone/70">
            O que acontece com elas em 2 anos?
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-bone">
            Acompanhamos as {fmt(dest.total)}{" "}empresas mais sinalizadas de 2023 até 2025. O resultado:
          </p>
          <ul className="mt-4 space-y-2">
            {DESTINOS.map((d) => {
              const n = dest[d.k as keyof typeof dest];
              const p = pct(n);
              return (
                <li key={d.k} className="flex items-center gap-3">
                  <span
                    className={`w-12 shrink-0 text-right font-display text-2xl tabular-nums ${
                      d.forte ? "text-floral" : "text-bone"
                    }`}
                  >
                    {p < 1 ? "<1" : p}%
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
                    <div
                      className={`h-full rounded-full ${d.forte ? "bg-floral/60" : "bg-bone/30"}`}
                      style={{ width: `${Math.max(p, 1)}%` }}
                    />
                  </div>
                  <span className="w-64 shrink-0 text-sm text-bone">{d.rotulo}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-[15px] leading-relaxed text-bone">
            A empresa <strong>não quebra, nem é vendida</strong>. Ela só fica parada: o controlador
            envelhece sem que nenhum comprador a aborde.
          </p>
        </section>

        {/* Macro — o juro explica parte */}
        <section className="mt-10">
          <h2 className="font-data text-[11px] uppercase tracking-wider text-bone/70">
            E o juro explica parte disso
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-bone">
            Nos últimos 3 anos o juro (Selic) ficou entre <strong>13% e 15%</strong>,
            o mais alto em quase 20 anos. Com custo de capital elevado, o volume de aquisições é mínimo. Agora a
            Selic <strong>começou a cair</strong> (14,5% em abril/2026). O estoque represado
            nesse período só cresceu.
          </p>
        </section>

        {/* A leitura honesta */}
        <section className="mt-6 rounded-xl border border-hairline bg-surface p-6">
          <p className="text-[15px] leading-relaxed text-bone">
            Então o mercado não está vazio. Está <strong>cheio de empresas boas, paradas, que ninguém
            procurou</strong>, e a fila cresce. Montar essa lista agora, enquanto o juro ainda segura os
            compradores, é chegar na frente pra quando ele cair.
          </p>
        </section>

        {/* Funil por vertical */}
        <section className="mt-10">
          <h2 className="font-data text-[11px] uppercase tracking-wider text-bone/70">
            De onde sai a conta
          </h2>
          <div className="mt-4 overflow-hidden rounded-xl border border-hairline">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline bg-surface text-left font-data text-[11px] uppercase tracking-wider text-olive">
                  <th scope="col" className="px-4 py-3 font-medium">Setor</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Todas</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Da família</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Sinalizadas</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Vendas/ano</th>
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
          <h2 className="font-data text-[11px] uppercase tracking-wider text-bone/70">
            Quanto isso pode valer — conta ilustrativa
          </h2>
          <p className="mt-3 leading-relaxed text-bone">
            Se a originação ativa levar a venda de {tam.giro_anual_pct.toLocaleString("pt-BR")}% para{" "}
            {(GIRO_ALVO * 100).toFixed(0)}% ao ano, são{" "}
            <strong>~{fmt(dealsPotenciais)} negócios/ano</strong> a mais. A um
            ticket conservador de R${TICKET}M e fee de {(FEE * 100).toFixed(0)}%, isso dá{" "}
            <strong>R$ {dealValueBi.toFixed(1)} bi/ano</strong> em negócios e{" "}
            <strong>~R$ {fmt(feesMi)} mi/ano em comissão</strong>.
          </p>
          <p className="mt-3 text-xs leading-snug text-olive">
            Conta ilustrativa, com premissas à mostra. Não estimamos R$ por empresa (seria dado
            inventado). São <strong>3 setores em 1 estado</strong>: empresa
            familiar é ~90% das empresas do Brasil.
          </p>
        </section>
      </main>
    </div>
  );
}
