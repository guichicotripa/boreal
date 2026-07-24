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
  // Descarte: o servidor filtra na busca, mas quem descarta AGORA precisa ver a
  // linha sumir sem refazer a query — então guardamos os ids descartados na sessão.
  const [descartadasIds, setDescartadasIds] = useState<Set<string>>(new Set());
  const [desfazer, setDesfazer] = useState<{ empresa: Empresa; timer: number } | null>(null);
  // Total de descartadas no escopo — só pra oferecer o caminho de volta (/descartadas).
  const [totalDescartadas, setTotalDescartadas] = useState(0);
  // Cobertura da base — buscada SÓ quando a busca dá zero, pra explicar o vazio
  // com honestidade em vez de culpar a tese do usuário.
  const [cobertura, setCobertura] = useState<{
    total: number;
    ufs: { uf: string }[];
    divisoes: { nome: string }[];
  } | null>(null);

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

  // Contagem de descartadas — atualiza ao montar e ao voltar de /descartadas
  // (onde o usuário pode ter restaurado alguma).
  useEffect(() => {
    async function refreshDescartadas() {
      try {
        const r = await fetch("/api/descarte");
        const d = await r.json();
        setTotalDescartadas(d.total ?? 0);
      } catch { /* silencioso: o link some, a busca segue */ }
    }
    refreshDescartadas();
    window.addEventListener("pageshow", refreshDescartadas);
    window.addEventListener("focus", refreshDescartadas);
    return () => {
      window.removeEventListener("pageshow", refreshDescartadas);
      window.removeEventListener("focus", refreshDescartadas);
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
    return res.empresas
      .filter((e) => !descartadasIds.has(e.id))
      .sort((a, b) => scoreEfetivo(b) - scoreEfetivo(a));
  }, [res, scoreOverrides, descartadasIds]);

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

  // Descarta otimista: some da lista na hora, persiste em background. Se o POST
  // falhar, devolve a linha — melhor reaparecer do que mentir que sumiu.
  async function descartar(e: Empresa) {
    setDescartadasIds((s) => new Set(s).add(e.id));
    setTotalDescartadas((n) => n + 1);
    if (peekId === e.id) setPeekId(null);
    if (desfazer) window.clearTimeout(desfazer.timer);
    const timer = window.setTimeout(() => setDesfazer(null), 8000);
    setDesfazer({ empresa: e, timer });
    try {
      const r = await fetch("/api/descarte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId: e.id }),
      });
      if (!r.ok) throw new Error();
    } catch {
      setDescartadasIds((s) => {
        const n = new Set(s);
        n.delete(e.id);
        return n;
      });
      setTotalDescartadas((n) => Math.max(0, n - 1));
      window.clearTimeout(timer);
      setDesfazer(null);
    }
  }

  async function restaurar(e: Empresa) {
    if (desfazer) window.clearTimeout(desfazer.timer);
    setDesfazer(null);
    setDescartadasIds((s) => {
      const n = new Set(s);
      n.delete(e.id);
      return n;
    });
    setTotalDescartadas((n) => Math.max(0, n - 1));
    try {
      await fetch("/api/descarte", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId: e.id }),
      });
    } catch {
      // a linha já voltou na UI; o servidor reconcilia na próxima busca
    }
  }

  // Busca vazia → carrega a cobertura pra explicar o porquê. Lazy: a esmagadora
  // maioria das buscas retorna algo e nunca paga essa consulta.
  useEffect(() => {
    if (!res || res.count > 0 || cobertura) return;
    let vivo = true;
    fetch("/api/cobertura")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (vivo && d && !d.error) setCobertura(d);
      })
      .catch(() => { /* silencioso: o estado vazio genérico ainda serve */ });
    return () => { vivo = false; };
  }, [res, cobertura]);

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
            <p className="mb-2 text-[11px] font-medium text-ink-muted">Setor</p>
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
                      ativo ? "bg-surface-hover text-ink" : "text-ink-muted hover:text-ink-soft"
                    }`}
                  >
                    {s.nome}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-[12.5px] text-ink-muted">
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
          <p className="mb-2 text-[11px] font-medium text-ink-muted">
            Descreva uma tese em linguagem livre
          </p>
          <div className="flex items-center gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-hairline bg-surface px-3 py-2.5 transition-colors focus-within:border-ink/30">
              <span className="text-sm text-ink-faint">›</span>
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
        <p className="mt-4 border-t border-hairline pt-3 text-[11.5px] text-ink-muted">
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
            <p className="text-[11px] font-medium text-ink-muted">Erro na busca</p>
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
                  {empresasOrdenadas.length} empresa{empresasOrdenadas.length === 1 ? "" : "s"}
                </span>
                {res.reasoned && res.reasonedCount && (
                  <span className="whitespace-nowrap text-[12px] text-ink-muted">
                    · top {res.reasonedCount} analisadas por IA
                  </span>
                )}
                {totalDescartadas > 0 && (
                  <Link
                    href="/descartadas"
                    className="whitespace-nowrap rounded-sm text-[12px] text-ink-muted underline-offset-2 transition-colors hover:text-ink-soft hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50"
                  >
                    · {totalDescartadas} descartada{totalDescartadas === 1 ? "" : "s"}
                  </Link>
                )}
              </span>
              <span className="flex flex-wrap gap-2">
                {res.filters.cnaePrefixes.map((c) => (
                  <span key={c} className="rounded bg-fill px-2 py-0.5 text-[11.5px] text-ink-soft">
                    CNAE {c}
                  </span>
                ))}
                {res.filters.minFaixaEtaria != null && (
                  <span className="rounded bg-fill px-2 py-0.5 text-[11.5px] text-ink-soft">
                    sócios {FAIXA_LABEL[String(res.filters.minFaixaEtaria)]}+
                  </span>
                )}
                {res.filters.maxAnoFundacao != null && (
                  <span className="rounded bg-fill px-2 py-0.5 text-[11.5px] text-ink-soft">
                    até {res.filters.maxAnoFundacao}
                  </span>
                )}
                {res.filters.ufs?.length ? (
                  <span className="rounded bg-fill px-2 py-0.5 text-[11.5px] text-ink-soft">
                    {res.filters.ufs.join(", ")}
                  </span>
                ) : null}
              </span>
            </div>

            {empresasOrdenadas.length > 0 && (
              <ResultsTable
                empresas={empresasOrdenadas}
                scoreOverrides={overridesEfetivos}
                savedIds={savedIds}
                peekId={peekId}
                onPeek={(e) => setPeekId((cur) => (cur === e.id ? null : e.id))}
                onDescartar={descartar}
              />
            )}

            {res.count > 0 && empresasOrdenadas.length === 0 && (
              <div className="rounded-lg border border-hairline py-12 text-center">
                <p className="font-display text-lg text-ink">Você descartou todas.</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
                  Todas as empresas desta busca foram descartadas do Radar.
                </p>
              </div>
            )}

            {res.count === 0 && (
              <div className="rounded-lg border border-hairline px-6 py-12 text-center">
                {/* Três causas MUITO diferentes: setor fora da base (sabemos o nome),
                    praça/tese restrita, ou nada bateu. Antes a tela culpava sempre a
                    tese, o que é enganoso quando o limite é nosso. */}
                {res.filters.setorForaDaBase ? (
                  <>
                    <p className="font-display text-lg text-ink">
                      {res.filters.setorForaDaBase} não está na base indexada.
                    </p>
                    <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
                      Preferimos não devolver empresas de outro setor: seria resposta
                      errada com cara de resposta certa.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-display text-lg text-ink">Nenhuma empresa encontrada.</p>
                    <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
                      Pode ser a tese restrita demais (tente ampliar a faixa etária ou o ano
                      de fundação), ou a praça ainda não estar indexada.
                    </p>
                  </>
                )}
                {cobertura && (
                  <div className="mx-auto mt-4 max-w-lg rounded-md bg-fill px-4 py-3 text-left">
                    <p className="text-[11px] font-medium text-ink-muted">
                      O que está indexado hoje
                    </p>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
                      <span className="text-ink">
                        {cobertura.total.toLocaleString("pt-BR")} empresas
                      </span>{" "}
                      em {cobertura.ufs.map((u) => u.uf).join(", ")} ·{" "}
                      {cobertura.divisoes.map((d) => d.nome).join(", ")}.
                    </p>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">
                      Fora disso a busca não retorna, mesmo que o heat-map mostre
                      atividade — ele cobre o Brasil inteiro, a base indexada não.
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        <PeekPanel
          empresa={peekEmpresa}
          investigacao={peekEmpresa ? overridesEfetivos[peekEmpresa.id] : undefined}
          jaSalvo={peekEmpresa ? savedIds.has(peekEmpresa.id) : undefined}
          onClose={() => setPeekId(null)}
          onDescartar={descartar}
        />

        {/* Desfazer o descarte — 8s. Descarte é reversível, então avisa em vez de perguntar. */}
        {desfazer && (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-5 left-1/2 z-[55] flex -translate-x-1/2 items-center gap-3 rounded-lg border border-hairline bg-overlay px-4 py-2.5 shadow-xl shadow-black/40"
          >
            <span className="max-w-[260px] truncate text-[12.5px] text-ink-soft">
              <span className="text-ink">{desfazer.empresa.razao_social}</span> descartada
            </span>
            <button
              type="button"
              onClick={() => restaurar(desfazer.empresa)}
              className="shrink-0 rounded-md border border-hairline px-2.5 py-1 text-[12px] font-medium text-ink transition-colors hover:border-hairline-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50"
            >
              Desfazer
            </button>
          </div>
        )}
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
        <span className="text-[10px] tabular-nums text-ink-faint">
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
