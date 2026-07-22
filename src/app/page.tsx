"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SearchResponse, Empresa } from "@/lib/types";
import { FAIXA_LABEL } from "@/lib/format";
import { setorPorId, SETORES } from "@/lib/setores";
import { readScoresConhecidos, storeEmpresa, storeOrigin, type ScoreConhecido } from "@/lib/empresa-store";
import { ResultsTable } from "@/components/radar/ResultsTable";
import { PeekPanel } from "@/components/radar/PeekPanel";

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

export default function Radar() {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<SearchResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [setorAtivo, setSetorAtivo] = useState<string | null>(null);
  const [peekId, setPeekId] = useState<string | null>(null);
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
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("setor");
    if (s && setorPorId(s)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSetorAtivo(s === "metalmec" ? null : s);
    }
  }, []);

  // Troca o setor ativo sem rodar busca; limpa resultados de outro setor.
  // metalmec = universo default (null) — mantém o demo-cache instantâneo.
  function trocarSetor(id: string) {
    setSetorAtivo(id === "metalmec" ? null : id);
    setRes(null);
    setErro(null);
    setPeekId(null);
  }

  async function buscar(q: string, setor?: string) {
    if (!q.trim() && !setor) return;
    setLoading(true);
    setErro(null);
    setRes(null);
    setPeekId(null);
    try {
      const r = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(setor ? { query: q, setor } : { query: q }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data: SearchResponse = await r.json();
      setRes(data);
    } catch {
      setErro("falha");
    } finally {
      setLoading(false);
    }
  }

  const setorCob = setorPorId(setorAtivo ?? "metalmec") ?? setorPorId("metalmec")!;

  // Score efetivo = v1 investigado (se houve) ou o v0 da busca.
  // Precedência: `score_v1` do servidor (score_run, fonte de verdade) > overlay local
  // (investigação feita depois desta lista carregar) > v0. A lista já vem ordenada do
  // servidor; reordenamos aqui só pra absorver o overlay local.
  // useMemo: a lista é dependência do efeito de teclado abaixo — sem memo, o
  // efeito re-assinaria a cada render.
  const empresasOrdenadas = useMemo(() => {
    if (!res) return [];
    const scoreEfetivo = (e: Empresa) =>
      e.score_v1?.score ?? scoreOverrides[e.id]?.score ?? e.score?.score ?? 0;
    return [...res.empresas].sort((a, b) => scoreEfetivo(b) - scoreEfetivo(a));
  }, [res, scoreOverrides]);

  // Overrides efetivos entregues à tabela/peek: o v1 do servidor entra como se fosse
  // um override, pra linha mostrar número e delta sem cada componente reimplementar a
  // precedência. O overlay local só preenche quem o servidor não trouxe.
  const overridesEfetivos = useMemo(() => {
    const out = { ...scoreOverrides };
    for (const e of res?.empresas ?? []) {
      if (e.score_v1) out[e.id] = { score: e.score_v1.score, delta: e.score_v1.delta };
    }
    return out;
  }, [res, scoreOverrides]);

  const peekEmpresa = peekId ? empresasOrdenadas.find((e) => e.id === peekId) ?? null : null;

  // Teclado de triagem (padrão workbench): j/k percorre os resultados abrindo o
  // peek; Enter abre a página da empresa selecionada. Ignora campos de texto e
  // a paleta de comandos.
  useEffect(() => {
    if (empresasOrdenadas.length === 0) return;
    function onKey(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement;
      if (alvo.closest("input, textarea, select, [role=dialog]")) return;
      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        const idx = peekId ? empresasOrdenadas.findIndex((x) => x.id === peekId) : -1;
        const prox = e.key === "j"
          ? empresasOrdenadas[Math.min(idx + 1, empresasOrdenadas.length - 1)]
          : empresasOrdenadas[Math.max(idx - 1, 0)];
        setPeekId(prox.id);
        // A linha selecionada só existe no DOM após o re-render — agenda o scroll.
        setTimeout(() => {
          document.querySelector('tr[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
        }, 0);
      } else if (e.key === "Enter" && peekId) {
        const emp = empresasOrdenadas.find((x) => x.id === peekId);
        if (!emp) return;
        storeEmpresa(emp);
        storeOrigin("busca");
        router.push(`/empresa/${emp.id}`);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [empresasOrdenadas, peekId, router]);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <main className="mx-auto max-w-6xl px-6 py-8 md:pb-20">
        {/* Cabeçalho da bancada: switcher de setor + credencial curta.
            O hero editorial de pitch mora na seção Prova (/validacao). */}
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <p className="mb-2 text-[11px] font-medium text-ink-soft/60">Setor</p>
            <div className="inline-flex flex-wrap gap-1 rounded-lg border border-hairline p-1">
              {SETORES.map((s) => {
                const ativo = (setorAtivo ?? "metalmec") === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => trocarSetor(s.id)}
                    aria-pressed={ativo}
                    className={`rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50 ${
                      ativo ? "bg-surface-hover text-ink" : "text-ink-soft/70 hover:text-ink-soft"
                    }`}
                  >
                    {s.nome}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-[12.5px] text-ink-soft/70">
            <strong className="text-ink-soft">{setorPorId("metalmec")?.recall_sucessao ?? 97}% das vendas por sucessão</strong>{" "}
            no nosso top 10%, 12 meses antes.{" "}
            <Link
              href="/validacao"
              className="whitespace-nowrap text-ink transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50 rounded-sm"
            >
              ver validação →
            </Link>
          </p>
        </div>

        {/* Busca — input em linha + botão primário sólido (a ação principal da tela) */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            buscar(texto, setorAtivo ?? undefined);
          }}
          className="mt-6"
        >
          <p className="mb-2 text-[11px] font-medium text-ink-soft/60">
            Descreva uma tese em linguagem livre
          </p>
          <div className="flex items-center gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-hairline bg-surface px-3 py-2.5 transition-colors focus-within:border-ink/30">
              <span className="font-data text-sm text-ink-faint">›</span>
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder={(EXEMPLOS_POR_SETOR[setorAtivo ?? "metalmec"] ?? EXEMPLOS)[0]}
                className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="shrink-0 rounded-lg bg-ink px-4 py-2.5 text-[13px] font-medium text-canvas transition-colors hover:bg-ink/90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/50"
            >
              {loading ? "Buscando…" : "Buscar tese"}
            </button>
          </div>
        </form>

        {/* Exemplos — teses sugeridas do setor ativo */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {(EXEMPLOS_POR_SETOR[setorAtivo ?? "metalmec"] ?? EXEMPLOS).map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setTexto(ex);
                buscar(ex, setorAtivo ?? undefined);
              }}
              className="rounded border border-hairline px-2 py-1 text-xs text-ink-soft transition-colors hover:border-hairline-hover hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50"
            >
              {ex}
            </button>
          ))}
        </div>

        {/* Strip de cobertura — o painel lateral antigo, compactado numa linha */}
        <p className="mt-4 border-t border-hairline pt-3 text-[11.5px] text-ink-soft/60">
          <span className="text-ink-soft">{setorCob.nome}</span>
          {" · "}CNAE {setorCob.cnaes.join("/")}
          {" · "}lente {setorCob.lente === "consolidacao" ? "consolidação" : "sucessão"}
          {setorCob.recall_sucessao != null && (
            <>
              {" · "}
              <span className="tabular-nums">{setorCob.recall_sucessao}%</span> de acerto nas vendas de sucessão
            </>
          )}
          {" · ~"}
          <span className="tabular-nums">{setorCob.deals_ano}</span> transações/ano
          {" · base demo "}
          <span className="tabular-nums">2.000</span> empresas SP{" · "}
          <Link
            href="/setores"
            className="text-ink transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50 rounded-sm"
          >
            ver setor →
          </Link>
        </p>

        {/* Loading */}
        {loading && <SearchSkeleton />}

        {/* Erro */}
        {erro && (
          <div className="mt-10 py-10">
            <p className="text-[11px] font-medium text-ink-soft/60">Erro na busca</p>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
              Não foi possível realizar a busca. Verifique a conexão e tente de novo.
            </p>
            <button
              onClick={() => buscar(texto, setorAtivo ?? undefined)}
              className="mt-3 inline-flex items-center gap-2 rounded border border-hairline px-3 py-2 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-ink/40 hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50"
            >
              <span aria-hidden="true">↻</span> Tentar de novo
            </button>
          </div>
        )}

        {/* Resultados */}
        {res && !loading && (
          <section className="mt-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-y-2 text-sm text-ink-soft">
              <span className="flex flex-wrap items-center gap-x-1">
                <span className="whitespace-nowrap">
                  {res.count} empresa{res.count === 1 ? "" : "s"}
                </span>
                {res.reasoned && res.reasonedCount && (
                  <span className="whitespace-nowrap text-[12px] text-ink-faint">
                    · top {res.reasonedCount} analisadas por IA
                  </span>
                )}
              </span>
              <span className="flex flex-wrap gap-2">
                {res.filters.cnaePrefixes.map((c) => (
                  <span key={c} className="rounded bg-surface px-2 py-0.5 text-[11.5px] text-ink-soft">
                    CNAE {c}
                  </span>
                ))}
                {res.filters.minFaixaEtaria != null && (
                  <span className="rounded bg-surface px-2 py-0.5 text-[11.5px] text-ink-soft">
                    sócios {FAIXA_LABEL[String(res.filters.minFaixaEtaria)]}+
                  </span>
                )}
                {res.filters.maxAnoFundacao != null && (
                  <span className="rounded bg-surface px-2 py-0.5 text-[11.5px] text-ink-soft">
                    até {res.filters.maxAnoFundacao}
                  </span>
                )}
              </span>
            </div>

            {res.count > 0 && (
              <ResultsTable
                empresas={empresasOrdenadas}
                scoreOverrides={overridesEfetivos}
                savedIds={savedIds}
                peekId={peekId}
                onPeek={(e) => setPeekId((cur) => (cur === e.id ? null : e.id))}
              />
            )}

            {res.count === 0 && (
              <div className="rounded-lg border border-hairline py-12 text-center">
                <p className="font-display text-lg text-ink">Nenhuma empresa encontrada.</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
                  A tese pode estar restrita demais. Tente ampliar a faixa etária,
                  remover um CNAE ou flexibilizar o ano de fundação.
                </p>
              </div>
            )}
          </section>
        )}

        <PeekPanel
          empresa={peekEmpresa}
          investigacao={peekEmpresa ? overridesEfetivos[peekEmpresa.id] : undefined}
          jaSalvo={peekEmpresa ? savedIds.has(peekEmpresa.id) : undefined}
          onClose={() => setPeekId(null)}
        />
      </main>
    </div>
  );
}

// Loading com steps progressivos — só aparece em buscas ao vivo (cache é instantâneo).
const LOADING_STEPS = [
  "Interpretando a consulta…",
  "Traduzindo para filtros estruturados…",
  "Filtrando empresas na base da Receita…",
  "Calculando score de risco sucessório…",
  "Comentando as primeiras empresas com IA…",
  "Montando os resultados…",
];

function Bar({ w, h = 12, className = "" }: { w: number | string; h?: number; className?: string }) {
  return <div className={`rounded bg-hairline ${className}`} style={{ width: w, height: h }} />;
}

// Skeleton em forma de TABELA (espelha o ResultsTable, anti layout-shift).
function SearchSkeleton() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1));
    }, 5500);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="mt-6" role="status" aria-live="polite" aria-busy="true">
      <div className="mb-4 flex items-center gap-2 text-sm">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink" />
        <span className="text-ink">{LOADING_STEPS[step]}</span>
        <span className="font-data text-[10px] uppercase tracking-wider text-ink-faint">
          {step + 1}/{LOADING_STEPS.length}
        </span>
      </div>

      <div className="animate-pulse overflow-hidden rounded-lg border border-hairline" aria-hidden="true">
        {/* header */}
        <div className="flex gap-6 border-b border-hairline px-3 py-2.5">
          {[120, 60, 50, 40, 50, 50].map((w, i) => (
            <Bar key={i} w={w} h={8} />
          ))}
        </div>
        {/* linhas */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-6 border-b border-hairline px-3 py-3 last:border-b-0">
            <div className="w-[260px] space-y-1.5">
              <Bar w="70%" h={12} />
              <Bar w="45%" h={9} />
            </div>
            <Bar w={70} h={10} />
            <Bar w={50} h={10} />
            <Bar w={40} h={10} />
            <Bar w={50} h={10} />
            <Bar w={50} h={10} />
          </div>
        ))}
      </div>
    </section>
  );
}
