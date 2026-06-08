"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { SearchResponse, Empresa, DossierAnalise, ResearchResult } from "@/lib/types";
import { scoreTier } from "@/lib/scoring";
import { precedentesParaEmpresa, cenarioIlustrativo, dadosParaFechar } from "@/lib/memo-extras";
import type { EmpresaSimilar } from "@/lib/similar";
import { setorPorId, SETORES } from "@/lib/setores";
import { storeEmpresa, storeOrigin } from "@/lib/empresa-store";

// Teses de exemplo POR SETOR — quando um setor está ativo, os atalhos se adaptam a ele
// (o CNAE vem do setor; o exemplo foca no perfil sucessório: idade do sócio, fundação).
const EXEMPLOS_POR_SETOR: Record<string, string[]> = {
  metalmec: [
    "metalmecânica no interior de SP com sócios acima de 60 anos",
    "fabricantes de máquinas e equipamentos fundados antes de 1990",
    "fabricantes de máquinas no interior de SP",
  ],
  saude: [
    "clínicas com sócios acima de 70 anos",
    "laboratórios fundados antes de 1990",
    "consultórios com sócio único idoso",
  ],
  educacao: [
    "escolas familiares com sócios acima de 70 anos",
    "colégios fundados antes de 1990",
    "creches e educação infantil de dono idoso",
  ],
};
const EXEMPLOS = EXEMPLOS_POR_SETOR.metalmec;

const FAIXA_LABEL: Record<string, string> = {
  "1": "0–12", "2": "13–20", "3": "21–30", "4": "31–40", "5": "41–50",
  "6": "51–60", "7": "61–70", "8": "71–80", "9": "80+",
};

function formatCnpj(cnpj: string) {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function formatTelefone(tel: string) {
  const d = tel.replace(/\D/g, "");
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  return tel;
}

// Capital compacto — bem mais varrível que o valor cheio (R$ 52,5 mi vs R$ 52.500.000).
function formatCapitalCompact(v: number | null): string | null {
  if (v == null) return null;
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  return `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

// Descrição curta dos CNAEs cobertos por setor — para o painel de cobertura.
const CNAE_LABEL: Record<string, string> = {
  "24": "Metalurgia",
  "25": "Produtos de metal",
  "28": "Máquinas e equipamentos",
  "86": "Atenção à saúde",
  "851": "Educação infantil e fundamental",
  "852": "Ensino médio",
};

export default function Home() {
  const [texto, setTexto] = useState("");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<SearchResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [setorAtivo, setSetorAtivo] = useState<string | null>(null);

  // Se veio de /setores (?setor=...), busca o setor direto.
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("setor");
    if (s && setorPorId(s)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSetorAtivo(s);
      buscar("", s);
    }
  }, []);

  async function buscar(q: string, setor?: string) {
    if (!q.trim() && !setor) return;
    setLoading(true);
    setErro(null);
    setRes(null);
    try {
      const r = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(setor ? { query: q, setor } : { query: q }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "erro na busca");
      setRes(data);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Setor ativo (default metalmec) — dirige o painel de cobertura.
  const setorCob = setorPorId(setorAtivo ?? "metalmec") ?? setorPorId("metalmec")!;

  return (
    <div className="min-h-screen bg-smoky text-floral">
      <main className="mx-auto max-w-5xl px-6 py-10 md:py-20">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-[2fr_1fr]">
          {/* Coluna principal — hero + search + resultados */}
          <div className="min-w-0">
            {/* Overline */}
            <p className="font-data text-[11px] uppercase tracking-[0.2em] text-bone">
              <span className="text-floral">BOREAL</span>{" "}
              <span className="text-olive">·</span>{" "}
              <span>Modelo preditivo de M&amp;A</span>
            </p>

            {/* Headline */}
            <h1 className="mt-6 font-display text-3xl leading-[1.1] tracking-tight text-floral md:text-[44px]">
              O modelo que prevê quem vai vender — antes do mercado.
            </h1>

            {/* Subheadline — credencial enxuta: o número, sem a moldura de venda */}
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-bone">
              <strong>{setorPorId("metalmec")?.recall_sucessao ?? 97}% das vendas por sucessão</strong>{" "}
              já estavam no nosso top 10%, 12 meses antes.{" "}
              <a href="/validacao" className="group/prova whitespace-nowrap text-floral transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 rounded-sm">
                ver metodologia{" "}
                <span className="inline-block transition-transform duration-200 group-hover/prova:translate-x-0.5">→</span>
              </a>
            </p>

            {/* Switcher de setor — troca o universo sem ir até /setores */}
            <div className="mt-8">
              <p className="mb-2 font-data text-[10px] uppercase tracking-[0.18em] text-bone/70">Setor</p>
              <div className="inline-flex flex-wrap gap-1 rounded-lg border border-hairline p-1">
                {SETORES.map((s) => {
                  const ativo = (setorAtivo ?? "metalmec") === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { setSetorAtivo(s.id); buscar(texto, s.id); }}
                      aria-pressed={ativo}
                      className={`rounded-md px-3 py-1.5 font-data text-[11px] uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 ${
                        ativo ? "bg-surface-hover text-floral" : "text-bone/70 hover:text-bone"
                      }`}
                    >
                      {s.nome}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Search — underline + prompt */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                buscar(texto, setorAtivo ?? undefined);
              }}
              className="mt-8"
            >
              <p className="mb-3 font-data text-[10px] uppercase tracking-[0.18em] text-bone/70">
                Descreva uma tese em linguagem livre
              </p>
              <div className="flex items-center gap-2 border-b border-hairline-hover pb-3 transition-colors focus-within:border-floral/30">
                <span className="font-data text-sm text-olive">›</span>
                <input
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="metalmecânica no interior de SP com sócios 70+ e fundada antes de 1990"
                  className="flex-1 bg-transparent text-sm text-floral outline-none placeholder:text-olive"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="group flex items-center gap-2 font-data text-[11px] uppercase tracking-wider text-floral transition-opacity hover:opacity-70 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 rounded-sm"
                >
                  {loading ? "Buscando…" : (
                    <>
                      <span>Buscar tese</span>
                      <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Exemplos — teses sugeridas, adaptadas ao setor ativo */}
            <div className="mt-6 flex flex-wrap gap-1.5">
              {(EXEMPLOS_POR_SETOR[setorAtivo ?? "metalmec"] ?? EXEMPLOS).map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => {
                    setTexto(ex);
                    buscar(ex, setorAtivo ?? undefined);
                  }}
                  className="rounded border border-hairline px-2 py-1 text-xs text-bone transition-colors hover:border-hairline-hover hover:text-floral focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50"
                >
                  {ex}
                </button>
              ))}
            </div>

            {/* Loading */}
            {loading && <LoadingSteps />}

            {/* Erro */}
            {erro && (
              <div className="mt-10 py-10">
                <p className="font-data text-[10px] uppercase tracking-wider text-olive">Erro na busca</p>
                <p className="mt-2 text-[15px] leading-relaxed text-bone">
                  Não foi possível realizar a busca. Verifique a conexão e tente de novo.
                </p>
                <button
                  onClick={() => buscar(texto, setorAtivo ?? undefined)}
                  className="mt-3 inline-flex items-center gap-2 rounded border border-hairline px-3 py-2 font-data text-[11px] uppercase tracking-wider text-bone transition-colors hover:border-floral/40 hover:text-floral focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50"
                >
                  <span aria-hidden="true">↻</span> Tentar de novo
                </button>
              </div>
            )}

            {/* Resultados */}
            {res && !loading && (
              <section className="mt-10">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-y-2 text-sm text-bone">
                  <span className="flex flex-wrap items-center gap-x-1">
                    <span className="whitespace-nowrap">
                      {res.count} empresa{res.count === 1 ? "" : "s"}
                    </span>
                    {res.reasoned && res.reasonedCount && (
                      <span className="whitespace-nowrap font-data text-xs uppercase tracking-wide text-olive">
                        · top {res.reasonedCount} analisadas por IA
                      </span>
                    )}
                  </span>
                  <span className="flex flex-wrap gap-2">
                    {res.filters.cnaePrefixes.map((c) => (
                      <span key={c} className="rounded bg-surface px-2 py-0.5 font-data text-xs uppercase tracking-wide text-bone">
                        CNAE {c}
                      </span>
                    ))}
                    {res.filters.minFaixaEtaria != null && (
                      <span className="rounded bg-surface px-2 py-0.5 font-data text-xs uppercase tracking-wide text-bone">
                        sócios {FAIXA_LABEL[String(res.filters.minFaixaEtaria)]}+
                      </span>
                    )}
                    {res.filters.maxAnoFundacao != null && (
                      <span className="rounded bg-surface px-2 py-0.5 font-data text-xs uppercase tracking-wide text-bone">
                        até {res.filters.maxAnoFundacao}
                      </span>
                    )}
                  </span>
                </div>

                <ul className="flex flex-col gap-3">
                  {res.empresas.map((e) => (
                    <EmpresaCard key={e.id} empresa={e} />
                  ))}
                </ul>

                {res.count === 0 && (
                  <div className="py-10 text-center">
                    <p className="font-display text-lg text-floral">Nenhuma empresa encontrada.</p>
                    <p className="mt-2 text-sm text-bone">
                      A tese pode estar restrita demais. Tente ampliar a faixa etária,
                      remover um CNAE ou flexibilizar o ano de fundação.
                    </p>
                  </div>
                )}
              </section>
            )}
          </div>

          {/* Sidebar — cobertura do setor ativo */}
          <aside className="md:border-l md:border-hairline md:pl-6">
            <p className="font-data text-[10px] uppercase tracking-wider text-bone/70">
              Cobertura
            </p>
            <p className="mt-2 font-display text-sm text-floral">{setorCob.nome}</p>
            <ul className="mt-3 space-y-1.5 font-data text-xs text-bone">
              {setorCob.cnaes.map((c) => (
                <li key={c}>
                  <span className="text-floral">CNAE {c}</span>
                  {CNAE_LABEL[c] ? ` · ${CNAE_LABEL[c]}` : ""}
                </li>
              ))}
              <li className="text-olive">—</li>
              <li>Lente: {setorCob.lente === "consolidacao" ? "consolidação" : "sucessão"}</li>
              <li><span className="tabular-nums text-floral">2.000</span> empresas · São Paulo</li>
            </ul>
          </aside>
        </div>
      </main>
    </div>
  );
}

// Loading com steps progressivos — dá sensação de trabalho durante a busca ao vivo.
// (Demos cacheados retornam instantâneos, então isso só aparece em buscas novas.)
const LOADING_STEPS = [
  "Interpretando a consulta…",
  "Traduzindo para filtros estruturados…",
  "Filtrando empresas na base da Receita…",
  "Calculando score de risco sucessório…",
  "Comentando as primeiras empresas com IA…",
  "Montando os resultados…",
];

function LoadingSteps() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1));
    }, 5500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="mt-10 flex flex-col gap-2" aria-live="polite" aria-busy="true">
      {LOADING_STEPS.slice(0, step + 1).map((s, i) => (
        <div
          key={i}
          className={`flex items-center gap-2 text-sm ${
            i === step ? "text-floral" : "text-olive"
          }`}
        >
          {i === step ? (
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-bone" />
          ) : (
            <span className="text-olive">✓</span>
          )}
          {s}
        </div>
      ))}
    </div>
  );
}

const TIER_STYLES = {
  alto:  { badge: "border-risk-high/40 bg-risk-high/5", text: "text-risk-high", label: "ALTO"  },
  medio: { badge: "border-risk-mid/40 bg-risk-mid/5",   text: "text-risk-mid",  label: "MÉD"   },
  baixo: { badge: "border-hairline bg-surface",         text: "text-bone",      label: "BAIXO" },
} as const;

const FAIXA_COLOR: Record<string, string> = {
  "9": "bg-risk-high/15 text-risk-high", // 80+
  "8": "bg-risk-high/15 text-risk-high", // 71-80
  "7": "bg-risk-mid/15 text-risk-mid",   // 61-70
  "6": "bg-surface text-bone",           // 51-60
};

function EmpresaCard({ empresa: e }: { empresa: Empresa }) {
  // Research — lógica levantada do ResearchPanel
  const [research, setResearch] = useState<ResearchResult | null>(null);
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchAberto, setResearchAberto] = useState(false);
  const [researchErro, setResearchErro] = useState<string | null>(null);

  // Memo — lógica levantada do DossierPanel
  const [memoAnalise, setMemoAnalise] = useState<DossierAnalise | null>(null);
  const [memoLoading, setMemoLoading] = useState(false);
  const [memoAberto, setMemoAberto] = useState(false);
  const [memoErro, setMemoErro] = useState<string | null>(null);

  // Sócios
  const [sociosAberto, setSociosAberto] = useState(false);

  // Look-alike (achar similares)
  const [similares, setSimilares] = useState<EmpresaSimilar[] | null>(null);
  const [similaresLoading, setSimilaresLoading] = useState(false);
  const [similaresAberto, setSimilaresAberto] = useState(false);
  const [similaresErro, setSimilaresErro] = useState<string | null>(null);

  const scoreV0 = e.score?.score ?? 0;
  const score = research?.score_v1 ?? scoreV0;
  const tier = scoreTier(score);
  const t = TIER_STYLES[tier];
  const socios = e.socio ?? [];

  // Stats de triagem — porte/capital/fundada/sócio mais velho.
  const anoFund = e.data_inicio_atividade ? e.data_inicio_atividade.slice(0, 4) : "—";
  const anosOperacao = e.data_inicio_atividade
    ? new Date().getFullYear() - Number(e.data_inicio_atividade.slice(0, 4))
    : null;
  const faixasPF = socios
    .map((s) => Number(s.faixa_etaria))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 9);
  const socioMaisVelho = faixasPF.length ? FAIXA_LABEL[String(Math.max(...faixasPF))] : null;

  async function investigar() {
    if (research || researchAberto) { setResearchAberto((v) => !v); return; }
    if (researchLoading) return;
    setResearchLoading(true);
    setResearchErro(null);
    setResearchAberto(true);
    try {
      const r = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId: e.id }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "erro na investigação");
      setResearch(data.research);
    } catch (err) {
      setResearchErro((err as Error).message);
    } finally {
      setResearchLoading(false);
    }
  }

  async function gerarMemo() {
    if (memoAnalise || memoAberto) { setMemoAberto((v) => !v); return; }
    if (memoLoading) return;
    setMemoLoading(true);
    setMemoErro(null);
    setMemoAberto(true);
    try {
      const r = await fetch("/api/dossier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId: e.id }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "erro ao gerar memo");
      setMemoAnalise(data.analise);
    } catch (err) {
      setMemoErro((err as Error).message);
    } finally {
      setMemoLoading(false);
    }
  }

  async function buscarSimilares() {
    if (similares || similaresAberto) { setSimilaresAberto((v) => !v); return; }
    if (similaresLoading) return;
    setSimilaresLoading(true);
    setSimilaresErro(null);
    setSimilaresAberto(true);
    try {
      const r = await fetch("/api/similar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId: e.id }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "erro ao buscar similares");
      setSimilares(data.similares ?? []);
    } catch (err) {
      setSimilaresErro((err as Error).message);
    } finally {
      setSimilaresLoading(false);
    }
  }

  return (
    <li className="rounded-lg border border-hairline bg-surface overflow-hidden p-4 transition-colors hover:bg-surface-hover">
      {/* Header: score badge + nome + salvar */}
      <div className="flex items-start gap-3">
        <div className={`shrink-0 rounded border ${t.badge} px-2 py-1 text-center`}>
          <div className={`font-data text-lg tabular-nums leading-none ${t.text}`}>{score}</div>
          <div className={`font-data text-[9px] uppercase tracking-wide ${t.text} opacity-70`}>
            {t.label}
            {research?.delta && research.delta !== 0 && (
              <span className={`opacity-100 ${research.delta > 0 ? "text-risk-high" : "text-bone"}`}>
                {" "}{research.delta > 0 ? "↑" : "↓"}
              </span>
            )}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              href={`/empresa/${e.id}`}
              onClick={() => { storeEmpresa(e); storeOrigin("busca"); }}
              className="group/nome font-display text-lg leading-tight text-floral transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 rounded-sm"
            >
              {e.razao_social}
              <span className="ml-1.5 inline-block font-data text-[10px] uppercase tracking-wider text-olive opacity-0 transition-opacity group-hover/nome:opacity-100">
                ver perfil →
              </span>
            </Link>
          </div>
          <p className="font-data text-[11px] text-olive">
            {e.municipio}/{e.uf} · {formatCnpj(e.cnpj)}
          </p>
        </div>
        <SalvarButton empresaId={e.id} />
      </div>

      {/* One-liner */}
      {e.insight?.one_liner && (
        <p className="mt-3 font-display text-sm leading-relaxed text-floral">
          {e.insight.one_liner}
        </p>
      )}

      {/* Stats de triagem — porte e capital em primeira classe (mono, tabular) */}
      <div className="mt-3 flex flex-wrap overflow-hidden rounded-lg border border-hairline">
        <Stat k="Porte" v={e.porte ?? "—"} hi />
        <Stat k="Capital" v={formatCapitalCompact(e.capital_social) ?? "—"} hi />
        <Stat k="Fundada" v={anoFund} sub={anosOperacao != null ? `${anosOperacao}a` : undefined} />
        <Stat
          k="Sócio +"
          v={socioMaisVelho ?? "—"}
          sub={socios.length ? `${socios.length} ${socios.length === 1 ? "sócio" : "sócios"}` : undefined}
        />
      </div>

      {/* Ações */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-hairline pt-2">
        {socios.length > 0 && (
          <>
            <button
              onClick={() => setSociosAberto((v) => !v)}
              className="font-data text-xs text-bone transition-colors hover:text-floral focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 rounded-sm"
            >
              {sociosAberto ? "Ocultar detalhes" : "Ver detalhes"}
            </button>
            <span className="text-olive">·</span>
          </>
        )}
        <button
          onClick={investigar}
          disabled={researchLoading}
          className="font-data text-xs text-bone transition-colors hover:text-floral disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 rounded-sm"
        >
          {researchLoading
            ? "Investigando…"
            : research
              ? researchAberto ? "Ocultar investigação" : "Ver investigação"
              : "Investigar com IA"}
        </button>
        <span className="text-olive">·</span>
        <button
          onClick={gerarMemo}
          disabled={memoLoading}
          className="font-data text-xs text-bone transition-colors hover:text-floral disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 rounded-sm"
        >
          {memoLoading
            ? "Gerando memo…"
            : memoAnalise
              ? memoAberto ? "Ocultar memo" : "Ver memo"
              : "Memo"}
        </button>
        <span className="text-olive">·</span>
        <button
          onClick={buscarSimilares}
          disabled={similaresLoading}
          className="font-data text-xs text-bone transition-colors hover:text-floral disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 rounded-sm"
        >
          {similaresLoading
            ? "Buscando…"
            : similares
              ? similaresAberto ? "Ocultar similares" : "Ver similares"
              : "Similares"}
        </button>
      </div>

      {/* Erros */}
      {researchErro && <p className="mt-2 text-xs text-bone/70">Não foi possível carregar a investigação. Tente de novo.</p>}
      {memoErro && <p className="mt-2 text-xs text-bone/70">Não foi possível gerar o memo. Tente de novo.</p>}
      {similaresErro && <p className="mt-2 text-xs text-bone/70">Não foi possível carregar os similares. Tente de novo.</p>}

      {/* Painel: similares (look-alike) */}
      {similaresAberto && (
        <div className="mt-3 rounded-lg border border-hairline bg-surface p-3">
          <p className="mb-2 font-data text-[10px] uppercase tracking-wider text-olive">
            Empresas similares no universo
          </p>
          {similaresLoading ? (
            <p className="text-xs text-bone">Buscando parecidas…</p>
          ) : similares && similares.length > 0 ? (
            <ul className="divide-y divide-hairline">
              {similares.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-display text-sm text-floral">{s.razao_social}</p>
                    <p className="font-data text-[11px] text-olive">
                      {s.municipio}/{s.uf}
                      {s.similaridade.motivos.length > 0 && ` · ${s.similaridade.motivos.join(", ")}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-data text-[11px] tabular-nums text-bone" title="similaridade">
                      {s.similaridade.pontos}%
                    </span>
                    <span
                      className="rounded border border-hairline px-1.5 font-data text-[11px] tabular-nums text-floral"
                      title="score de sucessão"
                    >
                      {s.score?.score ?? 0}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-bone">Nenhuma empresa parecida no universo indexado.</p>
          )}
        </div>
      )}

      {/* Painel: sócios */}
      {sociosAberto && (
        <div className="mt-3 rounded-lg border border-hairline bg-surface p-3 space-y-3">
          <div>
            <p className="mb-1.5 font-data text-[10px] uppercase tracking-wider text-olive">Sócios</p>
            <ul className="flex flex-col gap-1.5">
              {socios.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <span className="text-sm text-floral">{s.nome}</span>
                  {s.faixa_etaria && FAIXA_LABEL[s.faixa_etaria] && (
                    <span className={`rounded px-1.5 py-0.5 font-data text-xs ${FAIXA_COLOR[s.faixa_etaria] ?? "bg-surface text-bone"}`}>
                      {FAIXA_LABEL[s.faixa_etaria]} anos
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
          {(e.telefone || e.email) && (
            <div>
              <p className="mb-1 font-data text-[10px] uppercase tracking-wider text-olive">Contato da empresa</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-bone">
                {e.telefone && <span>{formatTelefone(e.telefone)}</span>}
                {e.email && <span>{e.email}</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Painel: investigação */}
      {researchLoading && (
        <p className="mt-3 animate-pulse text-xs text-bone" role="status">
          A IA está pesquisando sócios, herdeiros, imprensa e quadro societário em fontes públicas…
        </p>
      )}
      {research && researchAberto && <ResearchDisplay research={research} />}

      {/* Painel: memo */}
      {memoAberto && memoLoading && (
        <p className="mt-3 animate-pulse font-data text-xs text-bone">Gerando memo de investimento…</p>
      )}
      {memoAberto && memoAnalise && <MemoDisplay empresa={e} analise={memoAnalise} />}
    </li>
  );
}

// Célula da stats strip — rótulo mono + valor tabular. `hi` = destaque (porte/capital).
function Stat({ k, v, sub, hi }: { k: string; v: string; sub?: string; hi?: boolean }) {
  return (
    <div className="min-w-[88px] flex-1 border-r border-hairline px-3 py-2 last:border-r-0">
      <p className="font-data text-[9px] uppercase tracking-wider text-bone/70">{k}</p>
      <p className={`mt-0.5 font-data text-[13px] tabular-nums ${hi ? "text-floral" : "text-bone"}`}>
        {v}
        {sub && <span className="text-olive"> · {sub}</span>}
      </p>
    </div>
  );
}

function SalvarButton({ empresaId }: { empresaId: string }) {
  const [estado, setEstado] = useState<"idle" | "salvando" | "salvo">("idle");

  async function salvar() {
    if (estado === "salvo") return;
    setEstado("salvando");
    try {
      const r = await fetch("/api/oportunidade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId }),
      });
      if (!r.ok) throw new Error();
      setEstado("salvo");
    } catch {
      setEstado("idle");
    }
  }

  return (
    <button
      onClick={salvar}
      disabled={estado !== "idle"}
      className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 ${
        estado === "salvo"
          ? "text-floral"
          : "border border-hairline text-bone hover:border-hairline-hover hover:text-floral"
      }`}
    >
      {estado === "salvo" ? "✓ no pipeline" : estado === "salvando" ? "Salvando…" : "Salvar no pipeline"}
    </button>
  );
}

const PRESENCA_LABEL: Record<string, string> = {
  alta: "presença digital alta", media: "presença digital média",
  baixa: "presença digital baixa", nenhuma: "sem presença digital",
};

function ResearchDisplay({ research }: { research: ResearchResult }) {
  return (
    <div className="mt-3 space-y-3 rounded-lg border border-hairline bg-surface p-3">
      <div className="flex items-center justify-between">
        <span className="font-data text-[10px] uppercase tracking-wider text-bone/70">Investigação da IA</span>
        <span className="font-data text-[10px] text-olive">{PRESENCA_LABEL[research.presenca_digital]}</span>
      </div>
      {research.resumo && (
        <p className="text-sm leading-relaxed text-floral">{research.resumo}</p>
      )}
      {research.gatilho ? (
        <div className="rounded-md border border-risk-high/30 bg-risk-high/10 p-2.5">
          <p className="font-data text-[10px] uppercase tracking-wider text-risk-high">Por que agora</p>
          <p className="mt-1 text-sm leading-snug text-floral">{research.gatilho}</p>
        </div>
      ) : (
        <div className="rounded-md bg-surface-hover p-2.5">
          <p className="font-data text-[10px] uppercase tracking-wider text-bone/70">
            Sem gatilho de timing · não é o momento
          </p>
          <p className="mt-1 text-sm leading-snug text-bone">
            {research.sinais.some((s) => s.peso < 0)
              ? "A investigação encontrou sinal de sucessão já encaminhada (herdeiro ativo). Abordar agora tende a ser improdutivo — monitorar."
              : "O perfil não indica uma janela de abordagem no momento. Manter no radar, sem priorizar contato."}
          </p>
        </div>
      )}
      {research.sinais.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {research.sinais.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-data text-[10px] tabular-nums ${
                s.peso > 0 ? "bg-risk-high/15 text-risk-high" : "bg-surface text-bone"
              }`}>
                {s.peso > 0 ? `+${s.peso}` : s.peso}
              </span>
              <div>
                <span className="font-medium text-floral">{s.rotulo}</span>
                <span className="text-bone"> — {s.descricao}</span>
                {s.fonte_url && (
                  <a href={s.fonte_url} target="_blank" rel="noopener noreferrer"
                    className="ml-1 text-olive transition-colors hover:text-bone focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 rounded-sm">
                    ↗ fonte
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-bone">Nenhum sinal qualitativo conclusivo encontrado.</p>
      )}
      {research.mensagem_abordagem && (
        <div className="rounded-md bg-surface-hover p-2.5">
          <p className="font-data text-[10px] uppercase tracking-wider text-bone/70">
            Rascunho de abordagem · edite antes de enviar
          </p>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-bone">
            {research.mensagem_abordagem}
          </p>
        </div>
      )}
    </div>
  );
}

function MemoDisplay({ empresa, analise }: { empresa: Empresa; analise: DossierAnalise }) {
  const precedentes = precedentesParaEmpresa(empresa);
  const cenario = cenarioIlustrativo(empresa);
  const dadosFechar = dadosParaFechar(empresa);
  return (
    <div className="mt-3 space-y-5 rounded-lg border border-hairline bg-surface p-4 text-sm">
      <span className="font-data text-[10px] uppercase tracking-wider text-bone/70">Memo de investimento</span>
      <p className="leading-relaxed text-floral">{analise.overview}</p>
      <Timeline empresa={empresa} />
      <div>
        <h4 className="mb-1 font-data text-[10px] uppercase tracking-wider text-bone/70">
          Análise de risco sucessório
        </h4>
        <p className="leading-relaxed text-floral">{analise.analise_sucessoria}</p>
      </div>

      {/* Red flags a investigar — D.2: ordenado por severidade, max 5 · D.3: como_verificar em linha própria */}
      {analise.red_flags?.length ? (
        <div>
          <h4 className="mb-1 font-data text-[10px] uppercase tracking-wider text-bone/70">
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
                      : "border-hairline text-bone";
                return (
                  <li key={i}>
                    <div>
                      <span className={`mr-2 rounded border px-1.5 py-0.5 font-data text-[10px] uppercase tracking-wider ${cor}`}>
                        {rf.severidade}
                      </span>
                      <span className="text-floral">{rf.risco}</span>
                    </div>
                    {rf.como_verificar && (
                      <p className="mt-1 pl-0.5 text-[11px] leading-relaxed text-bone">
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
          <h4 className="mb-1 font-data text-[10px] uppercase tracking-wider text-bone/70">
            Perguntas para o primeiro contato
          </h4>
          <ul className="list-decimal space-y-1 pl-5 text-floral">
            {analise.perguntas_abordagem.map((p, i) => (
              <li key={i} className="leading-relaxed">{p}</li>
            ))}
          </ul>
        </div>
      )}
      {/* Quant #1 — Precedentes de M&A do setor (minerado do CNPJ, dado real) */}
      {precedentes && (
        <div>
          <h4 className="mb-1 font-data text-[10px] uppercase tracking-wider text-bone/70">
            Precedentes de M&amp;A no setor
          </h4>
          <p className="leading-relaxed text-floral">
            <strong>{precedentes.n_deals}</strong> aquisições em {precedentes.setor} (SP) nos últimos{" "}
            {precedentes.periodo_anos.toLocaleString("pt-BR")} anos —{" "}
            {precedentes.padrao === "consolidacao"
              ? "setor em consolidação ativa."
              : "compras pontuais, sem consolidador dominante."}
          </p>
          {precedentes.compradores.length > 0 && (
            <p className="mt-1 text-[11px] leading-relaxed text-bone">
              <span className="text-bone/70">Compradores ativos:</span>{" "}
              {precedentes.compradores.map((c) => `${c.nome} (${c.n})`).join(" · ")}
            </p>
          )}
          {precedentes.exemplos.length > 0 && (
            <p className="mt-0.5 text-[11px] leading-relaxed text-bone/70">
              Ex. adquiridas: {precedentes.exemplos.join(" · ")}
            </p>
          )}
          <p className="mt-1 font-data text-[10px] text-olive">Minerado do CNPJ — transações reais, não estimativa.</p>
        </div>
      )}

      {/* Quant #2 — Cenário de retorno: faixas de referência (frame, não valuation) */}
      <div>
        <h4 className="mb-1 font-data text-[10px] uppercase tracking-wider text-bone/70">
          Cenário de retorno — referência (ilustrativo)
        </h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-data text-xs sm:grid-cols-4">
          <div><span className="text-bone/70">Entrada</span><br /><span className="text-floral">{cenario.multiplo_entrada}</span></div>
          <div><span className="text-bone/70">Saída</span><br /><span className="text-floral">{cenario.multiplo_saida}</span></div>
          <div><span className="text-bone/70">Hold</span><br /><span className="text-floral">{cenario.hold}</span></div>
          <div><span className="text-bone/70">Alvo</span><br /><span className="text-floral">{cenario.retorno_alvo}</span></div>
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-olive">{cenario.nota}</p>
      </div>

      {/* Quant #3 — Para fechar o número: o que pedir ao dono (sourcing → IC) */}
      <div>
        <h4 className="mb-1 font-data text-[10px] uppercase tracking-wider text-bone/70">
          Para fechar o número — pedir ao dono
        </h4>
        <ul className="list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-bone">
          {dadosFechar.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      </div>

      {/* D.4: tese hairline (recuada, contexto) */}
      <div className="pl-3">
        <h4 className="mb-1 font-data text-[10px] uppercase tracking-wider text-bone/70">
          Tese de aproximação
        </h4>
        <p className="leading-relaxed text-floral">{analise.tese_aproximacao}</p>
      </div>

      {/* D.4: próximo passo surface-hover (mais destaque, CTA) */}
      {analise.proximo_passo && (
        <div className="rounded-md bg-surface-hover p-3">
          <h4 className="mb-1 font-data text-[10px] uppercase tracking-wider text-bone/70">
            Próximo passo
          </h4>
          <p className="leading-relaxed text-floral">→ {analise.proximo_passo}</p>
        </div>
      )}
    </div>
  );
}

// Timeline horizontal: fundação → entrada de cada sócio. Mostra "quadro travado"
// visualmente. CSS puro, sem lib de chart. Agrupa eventos do mesmo ano e alinha
// os labels conforme a posição (evita corte nas bordas).
function Timeline({ empresa }: { empresa: Empresa }) {
  const anoFund = empresa.data_inicio_atividade
    ? Number(empresa.data_inicio_atividade.slice(0, 4))
    : null;
  if (!anoFund) return null;

  const anoAtual = new Date().getFullYear();
  const span = anoAtual - anoFund || 1;

  // Agrupa labels por ano (fundação + sócio que entrou no mesmo ano não colidem).
  const porAno = new Map<number, string[]>();
  porAno.set(anoFund, ["Fundação"]);
  for (const s of empresa.socio ?? []) {
    const ano = s.data_entrada_sociedade ? Number(s.data_entrada_sociedade.slice(0, 4)) : null;
    if (ano === null || !Number.isFinite(ano)) continue;
    const nome = s.nome.split(" ")[0];
    const arr = porAno.get(ano);
    if (arr) arr.push(nome);
    else porAno.set(ano, [nome]);
  }

  const eventos = [...porAno.entries()]
    .map(([ano, labels]) => ({ ano, label: labels.join(" · ") }))
    .sort((a, b) => a.ano - b.ano);

  return (
    <div>
      <h4 className="mb-2 font-data text-[10px] uppercase tracking-wider text-bone/70">
        Linha do tempo societária
      </h4>
      {/* Altura explícita evita margin collapse (conteúdo é absoluto) */}
      <div className="relative mt-10 h-8 mb-4">
        {/* Linha separada, insetada pelo raio do dot em cada lado */}
        <div className="absolute inset-x-[18px] top-0 border-b border-hairline" />

        {eventos.map((ev, i) => {
          const pct = ((ev.ano - anoFund) / span) * 100;
          const isLeft  = pct === 0;
          const isRight = pct >= 92;

          if (isLeft) {
            return (
              <div key={i} className="absolute left-0 -translate-y-1/2" style={{ width: 28 }}>
                <span className="absolute -top-7 left-0 max-w-[8rem] truncate whitespace-nowrap text-[10px] text-bone">
                  {ev.label}
                </span>
                <span className="mx-auto block h-2 w-2 rounded-full bg-risk-mid" />
                <span className="absolute top-3 w-full text-center font-data text-[10px] tabular-nums text-olive">
                  {ev.ano}
                </span>
              </div>
            );
          }

          if (isRight) {
            return (
              <div key={i} className="absolute -translate-y-1/2 -translate-x-1/2" style={{ left: `${pct}%`, width: 28 }}>
                <span className="absolute -top-7 w-full truncate whitespace-nowrap text-center text-[10px] text-bone">
                  {ev.label}
                </span>
                <span className="mx-auto block h-2 w-2 rounded-full bg-risk-mid" />
                <span className="absolute top-3 w-full text-center font-data text-[10px] tabular-nums text-olive">
                  {ev.ano}
                </span>
              </div>
            );
          }

          return (
            <div
              key={i}
              className="absolute flex flex-col -translate-y-1/2 -translate-x-1/2 items-center text-center"
              style={{ left: `${pct}%` }}
            >
              <span className="absolute -top-7 max-w-[8rem] truncate whitespace-nowrap text-[10px] text-bone">
                {ev.label}
              </span>
              <span className="h-2 w-2 rounded-full bg-risk-mid" />
              <span className="absolute top-3 font-data text-[10px] tabular-nums text-olive">
                {ev.ano}
              </span>
            </div>
          );
        })}

        {/* Marcador "Hoje" — container fixo 28px, tudo centrado */}
        <div className="absolute right-0 -translate-y-1/2" style={{ width: 28 }}>
          <span className="absolute -top-7 w-full text-center font-data text-[10px] uppercase tracking-wide text-olive">
            Hoje
          </span>
          <span className="mx-auto block h-2 w-2 rounded-full border border-hairline-hover bg-transparent" />
          <span className="absolute top-3 w-full text-center font-data text-[10px] tabular-nums text-olive">
            {anoAtual}
          </span>
        </div>
      </div>
    </div>
  );
}
