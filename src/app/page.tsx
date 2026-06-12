"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SearchResponse, Empresa } from "@/lib/types";
import { scoreTier } from "@/lib/scoring";
import {
  FAIXA_LABEL, TIER_STYLES,
  formatCnpj, formatCapitalCompact,
} from "@/lib/format";
import { setorPorId, SETORES } from "@/lib/setores";
import { storeEmpresa, storeOrigin, readScoresConhecidos, type ScoreConhecido } from "@/lib/empresa-store";

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
  // Overlay de score pós-investigação: a página da empresa persiste o score_v1;
  // aqui refletimos ao montar e ao voltar (bfcache/refocus) sem refazer a busca.
  const [scoreOverrides, setScoreOverrides] = useState<Record<string, ScoreConhecido>>({});
  // IDs de empresas já salvas no pipeline — inicializa e atualiza ao voltar de qualquer rota.
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const refresh = () => setScoreOverrides(readScoresConhecidos());
    refresh();
    window.addEventListener("pageshow", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  useEffect(() => {
    async function refreshSaved() {
      try {
        const r = await fetch("/api/oportunidade");
        const d = await r.json();
        const ids = new Set<string>(
          (d.oportunidades ?? []).map((o: { empresa: { id: string } }) => o.empresa.id)
        );
        setSavedIds(ids);
      } catch { /* silencioso */ }
    }
    refreshSaved();
    window.addEventListener("pageshow", refreshSaved);
    window.addEventListener("focus", refreshSaved);
    return () => {
      window.removeEventListener("pageshow", refreshSaved);
      window.removeEventListener("focus", refreshSaved);
    };
  }, []);

  // Se veio de /setores (?setor=...), só ativa o setor — NÃO dispara busca.
  // O usuário decide quando buscar (digitando uma tese ou clicando num exemplo).
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("setor");
    if (s && setorPorId(s)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSetorAtivo(s === "metalmec" ? null : s);
    }
  }, []);

  // Troca o setor ativo (adapta exemplos + painel de cobertura) sem rodar busca.
  // Limpa resultados anteriores pra não deixar empresas de outro setor na tela.
  // metalmec é o universo default (representado como null, igual ao `?? "metalmec"`
  // usado no resto do arquivo): manter null faz os exemplos de metalmec baterem o
  // demo-cache (sem setor na query) e voltarem com one-liner instantâneo. Setores
  // não-default passam o id e vão ao vivo (dependem da ANTHROPIC_API_KEY pro reasoner).
  function trocarSetor(id: string) {
    setSetorAtivo(id === "metalmec" ? null : id);
    setRes(null);
    setErro(null);
  }

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

  // Score efetivo = score_v1 da investigação (se houve) ou o score_v0 da busca.
  const scoreEfetivo = (e: Empresa) =>
    scoreOverrides[e.id]?.score ?? e.score?.score ?? 0;
  // Reordena por score efetivo desc — uma empresa investigada que caiu (ex: 100→81)
  // desce na lista, em vez de ficar presa na posição da ordenação original.
  const empresasOrdenadas = res
    ? [...res.empresas].sort((a, b) => scoreEfetivo(b) - scoreEfetivo(a))
    : [];

  return (
    <div className="min-h-screen bg-smoky text-floral">
      <main className="mx-auto max-w-5xl px-6 py-10 md:pb-20">
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
              <Link href="/validacao" className="group/prova whitespace-nowrap text-floral transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 rounded-sm">
                ver metodologia{" "}
                <span className="inline-block transition-transform duration-200 group-hover/prova:translate-x-0.5">→</span>
              </Link>
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
                      onClick={() => trocarSetor(s.id)}
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
                  {empresasOrdenadas.map((e) => (
                    <EmpresaCard key={e.id} empresa={e} investigacao={scoreOverrides[e.id]} jaSalvo={savedIds.has(e.id)} />
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

          {/* Sidebar — cobertura + dinâmica do setor ativo */}
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
            </ul>

            {/* Dinâmica do setor — números VALIDADOS no universo SP (não a base do demo) */}
            <p className="mt-5 font-data text-[10px] uppercase tracking-wider text-bone/70">
              Dinâmica do setor · SP
            </p>
            <ul className="mt-3 space-y-1.5 font-data text-xs text-bone">
              <li>Lente: {setorCob.lente === "consolidacao" ? "consolidação" : "sucessão"}</li>
              <li>
                <span className="tabular-nums text-floral">{setorCob.pct_sucessao}%</span>{" "}do M&amp;A é por sucessão
              </li>
              {setorCob.recall_sucessao != null && (
                <li>
                  <span className="tabular-nums text-floral">{setorCob.recall_sucessao}%</span> de acerto nessas vendas
                </li>
              )}
              <li>
                ~<span className="tabular-nums text-floral">{setorCob.deals_ano}</span> transações/ano
              </li>
            </ul>

            <p className="mt-5 font-data text-[11px] text-bone/60">
              Base do demo: <span className="tabular-nums">2.000</span> empresas · SP
            </p>
            <Link
              href="/setores"
              className="group/setor mt-2 inline-block font-data text-xs text-floral transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 rounded-sm"
            >
              ver análise do setor{" "}
              <span className="inline-block transition-transform duration-200 group-hover/setor:translate-x-0.5">→</span>
            </Link>
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

// Card de triagem — score + nome + stats. A profundidade (investigar, memo,
// sócios, similares) vive na página da empresa (/empresa/[id]).
function EmpresaCard({ empresa: e, investigacao, jaSalvo }: { empresa: Empresa; investigacao?: ScoreConhecido; jaSalvo?: boolean }) {
  const router = useRouter();
  // Posição do pointerdown — distingue clique limpo de arrasto de seleção.
  const downRef = useRef<{ x: number; y: number } | null>(null);

  function abrirEmpresa() {
    storeEmpresa(e);
    storeOrigin("busca");
    router.push(`/empresa/${e.id}`);
  }

  // Clicar no card todo navega — mas sem atropelar seleção/cópia nem os elementos
  // interativos internos (título, botão Salvar).
  function onCardClick(ev: React.MouseEvent<HTMLLIElement>) {
    if ((ev.target as HTMLElement).closest("a, button, input, textarea, select")) return;
    if ((window.getSelection()?.toString().trim().length ?? 0) > 0) return;
    const d = downRef.current;
    if (d && (Math.abs(ev.clientX - d.x) > 4 || Math.abs(ev.clientY - d.y) > 4)) return;
    abrirEmpresa();
  }

  // Investigação = score_v1 + delta vs v0 (se a empresa já foi investigada nesta sessão).
  const score = investigacao?.score ?? e.score?.score ?? 0;
  const delta = investigacao?.delta ?? null;
  const tier = scoreTier(score);
  const t = TIER_STYLES[tier];
  const socios = e.socio ?? [];

  const anoFund = e.data_inicio_atividade ? e.data_inicio_atividade.slice(0, 4) : "—";
  const anosOp = e.data_inicio_atividade
    ? new Date().getFullYear() - Number(e.data_inicio_atividade.slice(0, 4))
    : null;
  const faixasPF = socios
    .map((s) => Number(s.faixa_etaria))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 9);
  const socioMaisVelho = faixasPF.length ? FAIXA_LABEL[String(Math.max(...faixasPF))] : null;

  return (
    <li
      onPointerDown={(ev) => { downRef.current = { x: ev.clientX, y: ev.clientY }; }}
      onClick={onCardClick}
      className="rounded-lg border border-hairline bg-surface overflow-hidden p-4 transition-colors hover:bg-surface-hover"
    >
      {/* Header: score badge + nome + salvar */}
      <div className="flex items-start gap-3">
        <div className="flex shrink-0 flex-col items-center gap-1">
          <div className={`rounded border ${t.badge} px-2 py-1 text-center`}>
            <div className={`font-data text-lg tabular-nums leading-none ${t.text}`}>{score}</div>
            <div className={`font-data text-[9px] uppercase tracking-wide ${t.text} opacity-70`}>
              {t.label}
            </div>
          </div>
          {/* Sinal de investigação: empresa já investigada → mostra o ajuste do score */}
          {delta != null && (
            <span
              className={`font-data text-[9px] tabular-nums ${
                delta > 0 ? "text-risk-high" : delta < 0 ? "text-bone/60" : "text-bone/50"
              }`}
              title="ajuste do score após investigação com IA"
            >
              {delta > 0 ? `↑${delta}` : delta < 0 ? `↓${Math.abs(delta)}` : "✓ IA"}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              href={`/empresa/${e.id}`}
              onClick={() => { storeEmpresa(e); storeOrigin("busca"); }}
              className="font-display text-lg leading-tight text-floral transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 rounded-sm"
            >
              {e.razao_social}
            </Link>
          </div>
          <p className="font-data text-[11px] text-olive">
            {e.municipio}/{e.uf} · {formatCnpj(e.cnpj)}
          </p>
        </div>
        <SalvarButton empresaId={e.id} jaSalvo={jaSalvo} />
      </div>

      {/* One-liner */}
      {e.insight?.one_liner && (
        <p className="mt-3 font-display text-sm leading-relaxed text-floral">
          {e.insight.one_liner}
        </p>
      )}

      {/* Stats strip */}
      <div className="mt-3 flex flex-wrap overflow-hidden rounded-lg border border-hairline">
        <Stat k="Porte" v={e.porte ?? "—"} hi />
        <Stat k="Capital" v={formatCapitalCompact(e.capital_social) ?? "—"} hi />
        <Stat k="Fundada" v={anoFund} sub={anosOp != null ? `${anosOp}a` : undefined} />
        <Stat
          k="Sócio +"
          v={socioMaisVelho ?? "—"}
          sub={socios.length ? `${socios.length} ${socios.length === 1 ? "sócio" : "sócios"}` : undefined}
        />
      </div>
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

function SalvarButton({ empresaId, jaSalvo }: { empresaId: string; jaSalvo?: boolean }) {
  const [estado, setEstado] = useState<"idle" | "salvando" | "salvo">(
    jaSalvo ? "salvo" : "idle"
  );

  // Sincroniza quando o parent atualiza savedIds (ex: ao voltar de outra rota).
  useEffect(() => {
    if (jaSalvo) setEstado("salvo");
  }, [jaSalvo]);

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

