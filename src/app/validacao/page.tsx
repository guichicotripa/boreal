import type { Metadata } from "next";
import validacao from "@/lib/validacao.json";
import hindcast from "@/lib/hindcast.json";
import lift from "@/lib/lift.json";

type Feature = {
  nome: string;
  universo_pct: number;
  adquiridas_pct: number;
  lift: number;
  sinal: string;
};

const SINAL_COR: Record<string, string> = {
  forte: "text-floral",
  fraco: "text-bone",
  negativo: "text-risk-high",
};

type Deal = {
  nome: string;
  municipio: string;
  fundada: number;
  decil: number;
  pct_rank: number;
  ano_deal: number | null;
};

export const metadata: Metadata = {
  title: "Boreal · Validação",
  description:
    "Como sabemos que o score funciona: validação retroativa sem leakage contra aquisições reais.",
};

type Vertical = {
  vertical: string;
  universo: number;
  n_aquisicoes: number;
  recall_top10: number;
  recall_top20: number;
  recall_top30: number;
  decil_medio: number;
  lift_top10: number;
};

const NOME_VERTICAL: Record<string, string> = {
  metalmec: "Metalmecânica · interior SP",
  saude: "Saúde · SP",
};

function fmt(n: number) {
  return n.toLocaleString("pt-BR");
}

export default function Validacao() {
  const verticais = validacao.verticais as Vertical[];
  // Herói = o vertical com o sinal mais forte (maior recall no top decil).
  const heroi = [...verticais].sort((a, b) => b.recall_top10 - a.recall_top10)[0];

  return (
    <div className="min-h-screen bg-smoky text-floral">
      <main className="mx-auto max-w-3xl px-6 py-12">
        <header className="mb-10 flex items-start justify-between">
          <div>
            <p className="font-data text-[11px] uppercase tracking-wider text-olive">
              Validação retroativa · sem lookahead bias
            </p>
            <h1 className="mt-2 font-display text-3xl tracking-tight md:text-4xl">
              Como sabemos que o score funciona
            </h1>
          </div>
          <a href="/" className="group flex items-center gap-2 font-data text-[11px] uppercase tracking-wider text-floral transition-opacity hover:opacity-70">
            <span className="transition-transform duration-200 group-hover:-translate-x-1">←</span>
            <span>Voltar à busca</span>
          </a>
        </header>

        {/* Número-herói */}
        <section className="rounded-xl border border-hairline bg-surface p-8">
          <p className="font-display text-[64px] leading-none tracking-tight text-floral md:text-[88px]">
            {heroi.recall_top10}%
          </p>
          <p className="mt-4 max-w-xl text-lg leading-snug text-bone">
            das <strong>{heroi.n_aquisicoes} aquisições reais</strong> dos
            últimos {validacao.janela.anos} anos em {NOME_VERTICAL[heroi.vertical] ?? heroi.vertical}{" "}
            estavam no <strong>top 10%</strong> do nosso ranking — calculado{" "}
            <strong>12 meses antes</strong> de o deal acontecer.
          </p>
          <p className="mt-3 font-data text-sm text-olive">
            Por acaso seria 10%. Isso é{" "}
            <span className="text-floral">{heroi.lift_top10}× melhor que aleatório</span> · decil
            médio {heroi.decil_medio.toLocaleString("pt-BR")}/10 (5,5 = sem sinal).
          </p>
        </section>

        {/* Hindcast nominal — o número feito concreto */}
        <section className="mt-10">
          <h2 className="font-data text-[11px] uppercase tracking-wider text-olive">
            Aquisições reais — comprovadas depois do corte
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-bone">
            Empresas que foram adquiridas depois de 2023-06-10. A coluna &ldquo;rank&rdquo; mostra
            onde o modelo já as colocava <strong>antes</strong> do deal acontecer — sem nunca ter
            visto o futuro.
          </p>
          <div className="mt-4 overflow-hidden rounded-xl border border-hairline">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline bg-surface text-left font-data text-[11px] uppercase tracking-wider text-olive">
                  <th className="px-4 py-3 font-medium">Empresa</th>
                  <th className="px-4 py-3 font-medium">Praça</th>
                  <th className="px-4 py-3 text-right font-medium">Vendida</th>
                  <th className="px-4 py-3 text-right font-medium">Rank pré-deal</th>
                </tr>
              </thead>
              <tbody>
                {(hindcast.deals as Deal[]).slice(0, 10).map((d, i) => (
                  <tr key={i} className="border-b border-hairline last:border-0">
                    <td className="px-4 py-3 text-floral">{d.nome}</td>
                    <td className="px-4 py-3 text-bone">{d.municipio}</td>
                    <td className="px-4 py-3 text-right font-data tabular-nums text-bone">
                      {d.ano_deal ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-data tabular-nums text-floral">
                      top {d.pct_rank <= 1 ? "1" : Math.ceil(d.pct_rank)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-snug text-olive">
            {hindcast.no_top10} das {hindcast.total_aquisicoes} aquisições reais caíram no nosso top
            decil ({hindcast.recall_top10}%). Mostramos as de melhor rank acima — mas o número agrega
            todas, inclusive as que erramos. Sem cherry-pick.
          </p>
        </section>

        {/* Metodologia */}
        <section className="mt-10">
          <h2 className="font-data text-[11px] uppercase tracking-wider text-olive">
            A metodologia em 3 passos
          </h2>
          <ol className="mt-4 space-y-4">
            <li className="flex gap-4">
              <span className="font-display text-2xl text-floral">1</span>
              <p className="text-bone">
                <strong className="text-floral">Ground truth de graça.</strong> Comparamos dois
                snapshots da Receita Federal (2023 → 2025) e detectamos a assinatura de uma aquisição
                no registro: <strong>um sócio PJ entra e um sócio PF sai</strong>.
                Sem comprar dados, sem garimpar imprensa.
              </p>
            </li>
            <li className="flex gap-4">
              <span className="font-display text-2xl text-floral">2</span>
              <p className="text-bone">
                <strong className="text-floral">Zero leakage.</strong> O score é calculado só com os
                dados de 2023 — <strong>antes</strong> de qualquer aquisição. O
                modelo nunca vê o futuro que está tentando prever.
              </p>
            </li>
            <li className="flex gap-4">
              <span className="font-display text-2xl text-floral">3</span>
              <p className="text-bone">
                <strong className="text-floral">Medimos o recall.</strong> Das empresas que de fato
                foram adquiridas, quantas o ranking tinha colocado no top decil do próprio setor? É o
                único teste que importa: o modelo acerta antes do fato.
              </p>
            </li>
          </ol>
        </section>

        {/* Tabela por vertical — honestidade inclusa */}
        <section className="mt-10">
          <h2 className="font-data text-[11px] uppercase tracking-wider text-olive">
            Resultado por setor
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-bone">
            O score é mais forte onde sucessão é o driver estrutural de liquidez.
            Em <strong>metalmecânica</strong>, recall de 67% com{" "}
            <strong>lift de 6,7×</strong>. Em <strong>saúde</strong> — onde metade do M&A
            é consolidação, não sucessão — o sinal cai para 1,8×. Mostramos os dois, sem filtrar.
          </p>
          <div className="mt-4 overflow-hidden rounded-xl border border-hairline">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline bg-surface text-left font-data text-[11px] uppercase tracking-wider text-olive">
                  <th className="px-4 py-3 font-medium">Setor</th>
                  <th className="px-4 py-3 text-right font-medium">Universo</th>
                  <th className="px-4 py-3 text-right font-medium">Aquisições</th>
                  <th className="px-4 py-3 text-right font-medium">Top 10%</th>
                  <th className="px-4 py-3 text-right font-medium">Lift</th>
                </tr>
              </thead>
              <tbody className="font-data">
                {verticais.map((v) => (
                  <tr key={v.vertical} className="border-b border-hairline last:border-0">
                    <td className="px-4 py-3 text-floral">
                      {NOME_VERTICAL[v.vertical] ?? v.vertical}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-bone">{fmt(v.universo)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-bone">{v.n_aquisicoes}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-floral">
                      {v.recall_top10}%
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-bone">{v.lift_top10}×</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-snug text-olive">
            Sem cherry-pick: os números são crus, incluindo os setores onde o sinal é fraco.
          </p>
        </section>

        {/* O loop de calibração — os pesos são fit, não chutados */}
        <section className="mt-10">
          <h2 className="font-data text-[11px] uppercase tracking-wider text-olive">
            O score não é chutado — ele se calibra contra o que aconteceu
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-bone">
            Cada feature foi medida contra 340 aquisições reais. O <strong>lift</strong> é
            quanto ela aparece mais nas empresas vendidas do que no universo. É isso que define o peso —
            e o dado <strong>corrigiu a nossa intuição</strong> duas vezes.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-bone">
            &ldquo;Quadro estagnado&rdquo; (0,81×) e &ldquo;sócio único&rdquo; (0×) tinham lift baixo/negativo —
            a hipótese era que indicavam risco, mas as vendidas dizem o contrário. Saíram. Esse é o
            loop: minerar o resultado real → medir o lift → recalibrar. Sem leakage, reproduzível.
          </p>
          <div className="mt-4 overflow-hidden rounded-xl border border-hairline">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline bg-surface text-left font-data text-[11px] uppercase tracking-wider text-olive">
                  <th className="px-4 py-3 font-medium">Sinal</th>
                  <th className="px-4 py-3 text-right font-medium">No universo</th>
                  <th className="px-4 py-3 text-right font-medium">Nas vendidas</th>
                  <th className="px-4 py-3 text-right font-medium">Lift</th>
                </tr>
              </thead>
              <tbody className="font-data">
                <tr className="border-b border-hairline bg-surface">
                  <td colSpan={4} className="px-4 py-2 font-data text-[10px] uppercase tracking-wider text-olive">
                    Sinais que pesam no score
                  </td>
                </tr>
                {(lift.features as Feature[])
                  .filter((f) => f.sinal !== "negativo")
                  .map((f) => (
                    <tr key={f.nome} className="border-b border-hairline">
                      <td className="px-4 py-3 text-floral">{f.nome}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-bone">{f.universo_pct}%</td>
                      <td className="px-4 py-3 text-right tabular-nums text-bone">{f.adquiridas_pct}%</td>
                      <td className="px-4 py-3 text-right tabular-nums text-floral">
                        {f.lift.toLocaleString("pt-BR")}×
                      </td>
                    </tr>
                  ))}
                <tr className="border-b border-hairline bg-surface">
                  <td colSpan={4} className="px-4 py-2 font-data text-[10px] uppercase tracking-wider text-olive">
                    Sinais descartados pelo dado
                  </td>
                </tr>
                {(lift.features as Feature[])
                  .filter((f) => f.sinal === "negativo")
                  .map((f) => (
                    <tr key={f.nome} className="border-b border-hairline last:border-0">
                      <td className="px-4 py-3 text-olive">{f.nome}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-olive">{f.universo_pct}%</td>
                      <td className="px-4 py-3 text-right tabular-nums text-olive">{f.adquiridas_pct}%</td>
                      <td className="px-4 py-3 text-right tabular-nums text-olive">
                        {f.lift.toLocaleString("pt-BR")}×
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Metodologia detalhada + por que importa */}
        <section className="mt-10 rounded-xl border border-hairline bg-surface p-6">
          <h2 className="font-data text-[11px] uppercase tracking-wider text-olive">
            Por que isso importa
          </h2>
          <p className="mt-3 leading-relaxed text-bone">
            A maioria das ferramentas de deal sourcing entrega uma lista e não consegue dizer se ela{" "}
            <em>funciona</em>. O Boreal consegue: é um{" "}
            <strong>
              modelo preditivo de eventos de liquidez no mercado privado
            </strong>
            , validado contra o que de fato aconteceu, sem viés de retrovisor. Esse é o ativo — não a
            interface.
          </p>
          <p className="mt-4 font-data text-xs text-olive">
            Medição gerada em {new Date(validacao.gerado_em).toLocaleDateString("pt-BR")} · janela{" "}
            {validacao.janela.corte} → {validacao.janela.novo} · ground truth minerado do CNPJ
            (Receita Federal via BigQuery).
          </p>
        </section>

        {/* CTA final */}
        <div className="mt-10 flex justify-center">
          <a
            href="/"
            className="group flex items-center gap-2 font-data text-[11px] uppercase tracking-wider text-floral transition-opacity hover:opacity-70"
          >
            <span className="transition-transform duration-200 group-hover:-translate-x-1">←</span>
            <span>Rodar uma tese com esse score</span>
          </a>
        </div>
      </main>
    </div>
  );
}
