"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Empresa, ResearchResult, DossierAnalise } from "@/lib/types";
import type { EmpresaSimilar } from "@/lib/similar";
import { scoreTier } from "@/lib/scoring";
import { readEmpresa, readOrigin, storeEmpresa, storeScoreConhecido, type Origin } from "@/lib/empresa-store";
import {
  formatCnpj, formatTelefone, formatCapitalCompact,
  FAIXA_LABEL, FAIXA_COLOR, TIER_STYLES, anosOperacao,
} from "@/lib/format";
import { ResearchDisplay } from "@/components/empresa/ResearchDisplay";
import { MemoDisplay } from "@/components/empresa/MemoDisplay";

// Seções na ordem de leitura do analista: identidade → evidência → score → ação → lateral.
const SECOES = [
  { id: "sobre", label: "Sobre" },
  { id: "socios", label: "Sócios" },
  { id: "score", label: "Score" },
  { id: "investigar", label: "Investigar" },
  { id: "dossie", label: "Dossiê" },
  { id: "similares", label: "Similares" },
] as const;

// As 4 dimensões do score (scoring.ts). Barras na cor do tier de risco (TIER_STYLES.bar) —
// reforçam a leitura de risco de relance. Decisão aprovada 2026-06-08 (ver brand guide #16).
const DIMENSOES = [
  { key: "idade_socios", label: "Idade dos sócios", max: 30 },
  { key: "antiguidade_empresa", label: "Antiguidade da empresa", max: 30 },
  { key: "porte_relevancia", label: "Porte / relevância", max: 30 },
  { key: "quadro_plural", label: "Quadro plural", max: 10 },
] as const;

export default function EmpresaPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [carregado, setCarregado] = useState(false);
  const [empresaLoading, setEmpresaLoading] = useState(false);
  const [origin, setOrigin] = useState<Origin>("busca");

  // Investigação — auto-disparada ao abrir (decisão de produto: overview rico imediato;
  // com cache, custo zero em re-visita. Pendência de alinhamento com Guilherme registrada).
  const [research, setResearch] = useState<ResearchResult | null>(null);
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchErro, setResearchErro] = useState(false);

  // Dossiê — sob demanda (LLM mais pesado).
  const [memo, setMemo] = useState<DossierAnalise | null>(null);
  const [memoLoading, setMemoLoading] = useState(false);
  const [memoErro, setMemoErro] = useState(false);

  // Similares — auto (query barata por CNAE).
  const [similares, setSimilares] = useState<EmpresaSimilar[] | null>(null);
  const [similaresLoading, setSimilaresLoading] = useState(false);

  const [secaoAtiva, setSecaoAtiva] = useState<string>("sobre");

  // Hidrata a empresa com os dados canônicos do servidor (sócios + breakdown completos).
  // Fonte de verdade independente da entrada — corrige o caminho pipeline (objeto parcial)
  // e o link direto/refresh (sessionStorage vazio).
  const fetchEmpresa = useCallback(async () => {
    setEmpresaLoading(true);
    try {
      const r = await fetch(`/api/empresa/${id}`);
      if (!r.ok) return;
      const data = await r.json();
      if (data.empresa) setEmpresa(data.empresa);
    } catch {
      // mantém o que veio do sessionStorage (se houver)
    } finally {
      setEmpresaLoading(false);
    }
  }, [id]);

  const fetchResearch = useCallback(async () => {
    setResearchLoading(true);
    setResearchErro(false);
    try {
      const r = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId: id }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setResearch(data.research);
      // Propaga o score_v1 + delta para a home (e demais telas) refletirem a investigação.
      if (typeof data.research?.score_v1 === "number") {
        storeScoreConhecido(id, data.research.score_v1, data.research.delta ?? 0);
      }
    } catch {
      setResearchErro(true);
    } finally {
      setResearchLoading(false);
    }
  }, [id]);

  const fetchSimilares = useCallback(async () => {
    setSimilaresLoading(true);
    try {
      const r = await fetch("/api/similar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId: id }),
      });
      const data = await r.json();
      if (r.ok) setSimilares(data.similares ?? []);
      else setSimilares([]);
    } catch {
      setSimilares([]);
    } finally {
      setSimilaresLoading(false);
    }
  }, [id]);

  async function gerarMemo() {
    if (memo) return;
    setMemoLoading(true);
    setMemoErro(false);
    try {
      const r = await fetch("/api/dossier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId: id }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setMemo(data.analise);
    } catch {
      setMemoErro(true);
    } finally {
      setMemoLoading(false);
    }
  }

  // Mount: paint instantâneo com o que estiver no sessionStorage (ponte da home/pipeline),
  // depois hidrata com os dados canônicos do servidor se vier parcial (pipeline) ou nulo
  // (link direto). research/similares disparam por id, independem do objeto.
  useEffect(() => {
    const e = readEmpresa(id);
    // Inicialização a partir do sessionStorage (sistema externo) no mount — set síncrono intencional.
    /* eslint-disable react-hooks/set-state-in-effect */
    setEmpresa(e);
    setOrigin(readOrigin());
    setCarregado(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    // Objeto parcial (sem sócios/breakdown) ou ausente → busca a versão completa pelo id.
    if (!e || !e.socio || !e.score?.breakdown) {
      fetchEmpresa();
    }
    fetchResearch();
    fetchSimilares();
  }, [id, fetchEmpresa, fetchResearch, fetchSimilares]);

  // Scroll-spy — destaca a seção que está no topo da viewport conforme rola.
  useEffect(() => {
    if (!empresa) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setSecaoAtiva(e.target.id);
        }
      },
      { rootMargin: "-30% 0px -65% 0px", threshold: 0 }
    );
    for (const s of SECOES) {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, [empresa]);

  function irPara(secaoId: string) {
    document.getElementById(secaoId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ── Estado: empresa não encontrada (GET falhou — id inexistente) ──
  if (carregado && !empresa && !empresaLoading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20">
        <p className="font-data text-[10px] uppercase tracking-wider text-olive">Empresa não encontrada</p>
        <h1 className="mt-2 font-display text-2xl text-floral">Não localizamos esta empresa.</h1>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-bone">
          O identificador pode estar incorreto ou a empresa não está na base indexada. Volte à busca para encontrar empresas-alvo.
        </p>
        <Link
          href="/"
          className="group mt-5 inline-flex items-center gap-2 font-data text-[11px] uppercase tracking-wider text-floral transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 rounded-sm"
        >
          <span className="transition-transform duration-200 group-hover:-translate-x-0.5">←</span>
          Ir para a busca
        </Link>
      </main>
    );
  }

  // ── Estado: ainda lendo o sessionStorage (primeiro paint) ──
  if (!empresa) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20" aria-busy="true">
        <div className="h-3 w-32 animate-pulse rounded bg-surface-hover" />
        <div className="mt-4 h-8 w-2/3 animate-pulse rounded bg-surface-hover" />
      </main>
    );
  }

  const e = empresa;
  const socios = e.socio ?? [];
  const score = research?.score_v1 ?? e.score?.score ?? 0;
  const breakdown = e.score?.breakdown;
  const sinaisScore = e.score?.sinais ?? [];
  const perfilSuc = e.score?.perfil_sucessorio ?? false;
  const tier = scoreTier(score);
  const t = TIER_STYLES[tier];
  const { ano: anoFund, anos: anosOp } = anosOperacao(e.data_inicio_atividade);
  const backHref = origin === "pipeline" ? "/pipeline" : "/";
  const backLabel = origin === "pipeline" ? "Pipeline" : "Busca";

  return (
    <div className="bg-smoky text-floral">
      {/* ── HERO (rola embora) ── */}
      <header className="mx-auto max-w-3xl px-6 pt-8 pb-6">
        <Link
          href={backHref}
          className="group inline-flex items-center gap-2 font-data text-[11px] uppercase tracking-wider text-bone/70 transition-colors hover:text-floral focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 rounded-sm"
        >
          <span className="transition-transform duration-200 group-hover:-translate-x-0.5">←</span>
          {backLabel}
        </Link>

        <h1 className="mt-5 font-display text-3xl leading-[1.1] tracking-tight text-floral md:text-[40px]">
          {e.razao_social}
        </h1>
        <p className="mt-2 font-data text-[12px] text-bone/70">
          {formatCnpj(e.cnpj)}
          <span className="text-olive"> · </span>{e.municipio}/{e.uf}
          <span className="text-olive"> · </span>fundada {anoFund}{anosOp != null ? ` (${anosOp} anos)` : ""}
          {e.porte && <><span className="text-olive"> · </span>{e.porte}</>}
        </p>

        {/* Resumo do score (número + tier + leitura) — breakdown completo fica na seção Score */}
        <div className="mt-6 flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-4 sm:flex-row sm:items-center sm:gap-5">
          <div aria-live="polite" className={`flex shrink-0 items-baseline gap-2 rounded-md border ${t.badge} px-3 py-1.5`}>
            <span className={`font-data text-[28px] leading-none tabular-nums ${t.text}`}>{score}</span>
            <span className={`font-data text-[10px] uppercase tracking-wider ${t.text}`}>{t.label}</span>
            {research?.delta != null && research.delta !== 0 && (
              <span className={`font-data text-[10px] tabular-nums ${research.delta > 0 ? "text-risk-high" : "text-bone/60"}`}>
                {research.delta > 0 ? `↑${research.delta}` : `↓${Math.abs(research.delta)}`}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-data text-[10px] uppercase tracking-wider text-bone/70">Risco sucessório</p>
            <p className="mt-1 text-[13px] leading-snug text-bone">
              {perfilSuc
                ? "Sócio 61+ e empresa com 25+ anos — lente de sucessão confiável."
                : "Fora do perfil sucessório — score de menor confiança (provável consolidação)."}
            </p>
          </div>
        </div>

        {e.insight?.one_liner && (
          <p className="mt-4 font-display text-[17px] leading-relaxed text-floral">
            {e.insight.one_liner}
          </p>
        )}
      </header>

      {/* ── SCROLL-SPY NAV (sticky, abaixo da navbar global) + ação primária + chip de score ── */}
      <nav className="sticky top-[60px] z-30 border-y border-hairline bg-smoky/95 backdrop-blur supports-[backdrop-filter]:bg-smoky/80">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-6 py-2.5">
          <ul className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {SECOES.map((s) => {
              const ativo = secaoAtiva === s.id;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => irPara(s.id)}
                    aria-current={ativo ? "true" : undefined}
                    className={`whitespace-nowrap rounded-md px-2.5 py-1 font-data text-[11px] uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 ${
                      ativo ? "bg-surface-hover text-floral" : "text-bone/70 hover:text-bone"
                    }`}
                  >
                    {s.label}
                  </button>
                </li>
              );
            })}
          </ul>
          <span
            className={`hidden shrink-0 items-baseline gap-1 rounded border ${t.badge} px-1.5 py-0.5 sm:inline-flex`}
            title="Score de risco sucessório"
          >
            <span className={`font-data text-[13px] leading-none tabular-nums ${t.text}`}>{score}</span>
            <span className={`font-data text-[9px] uppercase tracking-wide ${t.text}`}>{t.label}</span>
          </span>
          <AcaoPrimaria empresa={e} />
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-6 pb-24">
        {/* ── SOBRE ── */}
        <Secao id="sobre" titulo="Sobre">
          {e.cnae_principal_desc && (
            <p className="font-display text-[17px] leading-relaxed text-floral">{e.cnae_principal_desc}</p>
          )}

          {/* Camada enriquecida — descrição da IA (skeleton enquanto investiga) */}
          {researchLoading ? (
            <div className="mt-3 space-y-2" aria-busy="true">
              <div className="h-3 w-full animate-pulse rounded bg-surface-hover" />
              <div className="h-3 w-11/12 animate-pulse rounded bg-surface-hover" />
              <div className="h-3 w-4/5 animate-pulse rounded bg-surface-hover" />
            </div>
          ) : research?.resumo ? (
            <p className="mt-3 text-[15px] leading-relaxed text-bone">{research.resumo}</p>
          ) : null}

          {/* Campos estruturados (instantâneos, da Receita) */}
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            <Campo k="Natureza jurídica" v={e.natureza_juridica} />
            <Campo k="Capital social" v={formatCapitalCompact(e.capital_social)} />
            <Campo k="Porte" v={e.porte} />
            <Campo k="CNAE principal" v={e.cnae_principal} sub={e.cnae_principal_desc} />
            <Campo k="Telefone" v={e.telefone ? formatTelefone(e.telefone) : null} />
            <Campo k="E-mail" v={e.email} />
          </dl>

          {e.cnaes_secundarios && e.cnaes_secundarios.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 font-data text-[10px] uppercase tracking-wider text-bone/70">Atividades secundárias</p>
              <ul className="space-y-1">
                {e.cnaes_secundarios.map((c) => (
                  <li key={c.codigo} className="flex items-center gap-2 text-[12px] leading-relaxed text-bone/60">
                    <span className="shrink-0 text-olive">·</span>
                    {c.descricao ?? c.codigo}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-4 font-data text-[10px] text-olive">Dados públicos da Receita Federal.</p>
        </Secao>

        {/* ── SÓCIOS ── (evidência do score: idade é o driver de maior peso) */}
        <Secao
          id="socios"
          titulo="Sócios"
          nota={socios.length > 0 ? "Idade dos sócios é o principal driver do score." : undefined}
        >
          {socios.length > 0 ? (
            <ul className="divide-y divide-hairline">
              {socios.map((s) => {
                const ent = s.data_entrada_sociedade?.slice(0, 4);
                return (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[15px] text-floral">{s.nome}</p>
                      {ent && (
                        <p className="font-data text-[11px] text-bone/70">sócio desde {ent}</p>
                      )}
                    </div>
                    {s.faixa_etaria && FAIXA_LABEL[s.faixa_etaria] && (
                      <span className={`shrink-0 rounded px-1.5 py-0.5 font-data text-[11px] tabular-nums ${FAIXA_COLOR[s.faixa_etaria] ?? "bg-surface text-bone"}`}>
                        {FAIXA_LABEL[s.faixa_etaria]} anos
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-[15px] text-bone">Quadro societário não disponível.</p>
          )}
        </Secao>

        {/* ── SCORE ── (breakdown completo — barras neutras) */}
        <Secao id="score" titulo="Score">
          <div className="flex items-baseline gap-3">
            <span className={`font-data text-[40px] leading-none tabular-nums ${t.text}`}>{score}</span>
            <span className={`font-data text-[11px] uppercase tracking-wider ${t.text}`}>{t.label}</span>
            <span className="font-data text-[11px] text-olive">/ 100</span>
          </div>

          {breakdown && (
            <ul className="mt-5 space-y-3">
              {DIMENSOES.map((d) => {
                const pts = breakdown[d.key];
                const pct = Math.round((pts / d.max) * 100);
                return (
                  <li key={d.key}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[13px] text-bone">
                        {d.label}
                        {d.key === "idade_socios" && socios.length > 0 && (
                          <button
                            type="button"
                            onClick={() => irPara("socios")}
                            className="group ml-2 font-data text-[10px] uppercase tracking-wider text-floral transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 rounded-sm"
                          >
                            ver sócios{" "}
                            <span className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">→</span>
                          </button>
                        )}
                      </span>
                      <span className="font-data text-[11px] tabular-nums text-bone/70">{pts}/{d.max}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface">
                      <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {research?.sinais && research.sinais.length > 0 && (
            <div className="mt-5 border-t border-hairline pt-5">
              <p className="mb-3 font-data text-[10px] uppercase tracking-wider text-bone/70">
                Sinais — investigação com IA
              </p>
              <div className="space-y-1">
                {research.sinais.map((s, i) => (
                  <div key={i} className="flex items-start justify-between gap-4 py-1.5">
                    <span className="text-[13px] text-bone">{s.rotulo}</span>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 font-data text-[10px] tabular-nums ${
                      s.peso > 0 ? "bg-risk-high/15 text-risk-high" : "bg-surface text-bone"
                    }`}>
                      {s.peso > 0 ? `+${s.peso}` : `−${Math.abs(s.peso)}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sinaisScore.length > 0 && (
            <div className="mt-5 border-t border-hairline pt-5">
              <p className="mb-3 font-data text-[10px] uppercase tracking-wider text-bone/70">
                Sinais estruturais — da Receita
              </p>
              <ul className="space-y-1.5">
                {sinaisScore.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-bone">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-olive" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Link
            href="/validacao"
            className="group mt-5 inline-flex items-center gap-1.5 font-data text-[11px] uppercase tracking-wider text-floral transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 rounded-sm"
          >
            Como calculamos o score
            <span className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">→</span>
          </Link>
        </Secao>

        {/* ── INVESTIGAR ── (auto-disparada) */}
        <Secao id="investigar" titulo="Investigar">
          {researchLoading ? (
            <p className="animate-pulse text-[13px] text-bone/70" role="status">
              A IA está pesquisando sócios, herdeiros, imprensa e quadro societário em fontes públicas…
            </p>
          ) : research ? (
            <ResearchDisplay research={research} />
          ) : researchErro ? (
            <EstadoErro
              msg="Não foi possível carregar a investigação."
              onRetry={fetchResearch}
            />
          ) : null}
        </Secao>

        {/* ── DOSSIÊ ── (sob demanda; síntese a partir da investigação) */}
        <Secao
          id="dossie"
          titulo="Dossiê"
          nota="Síntese a partir dos sinais investigados acima."
        >
          {memo ? (
            <MemoDisplay empresa={e} analise={memo} />
          ) : memoLoading ? (
            <p className="animate-pulse text-[13px] text-bone/70" role="status">
              Gerando dossiê…
            </p>
          ) : memoErro ? (
            <EstadoErro msg="Não foi possível gerar o memo." onRetry={gerarMemo} />
          ) : (
            <button
              type="button"
              onClick={gerarMemo}
              className="inline-flex items-center gap-2 rounded border border-hairline px-3 py-2 font-data text-[11px] uppercase tracking-wider text-bone transition-colors hover:border-hairline-hover hover:text-floral focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50"
            >
              Gerar dossiê
            </button>
          )}
        </Secao>

        {/* ── SIMILARES ── (auto; critério explícito) */}
        <Secao
          id="similares"
          titulo="Similares"
          nota="Critério: mesmo CNAE, praça e porte."
        >
          {similaresLoading ? (
            <p className="animate-pulse text-[13px] text-bone/70" role="status">Buscando empresas parecidas…</p>
          ) : similares && similares.length > 0 ? (
            <ul className="divide-y divide-hairline">
              {similares.map((s) => {
                const sTier = scoreTier(s.score?.score ?? 0);
                const sT = TIER_STYLES[sTier];
                return (
                  <li key={s.id}>
                    <Link
                      href={`/empresa/${s.id}`}
                      onClick={() => storeEmpresa(s)}
                      className="flex items-center justify-between gap-3 py-2.5 transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 rounded-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-display text-[15px] text-floral">{s.razao_social}</p>
                        <p className="font-data text-[11px] text-bone/60">
                          {s.municipio}/{s.uf}
                          {s.similaridade.motivos.length > 0 && ` · ${s.similaridade.motivos.join(", ")}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-data text-[11px] tabular-nums text-bone/60">
                          {s.similaridade.pontos}% match
                        </span>
                        <span className={`rounded border ${sT.badge} px-1.5 font-data text-[11px] tabular-nums ${sT.text}`}>
                          {s.score?.score ?? 0}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-[13px] text-bone">Nenhuma empresa parecida no universo indexado.</p>
          )}
        </Secao>
      </main>
    </div>
  );
}

// ── Sub-componentes ──────────────────────────────────────────────────────────

// Seção com eyebrow (label estrutural Bone/70) + nota opcional. scroll-mt limpa as navs sticky.
function Secao({
  id, titulo, nota, children,
}: {
  id: string; titulo: string; nota?: string; children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-hairline py-8 first:border-t-0">
      <div className="mb-4">
        <h2 className="font-data text-[11px] uppercase tracking-wider text-bone/70">{titulo}</h2>
        {nota && <p className="mt-1 text-[12px] text-bone/60">{nota}</p>}
      </div>
      {children}
    </section>
  );
}

// Campo de definição: rótulo mono + valor. Esconde quando vazio (não polui com "—" em massa).
function Campo({ k, v, sub }: { k: string; v: string | null | undefined; sub?: string | null }) {
  if (!v) return null;
  return (
    <div className="min-w-0">
      <dt className="font-data text-[10px] uppercase tracking-wider text-bone/70">{k}</dt>
      <dd className="mt-0.5 text-[13px] text-floral">
        {v}
        {sub && <span className="block text-[11px] leading-snug text-bone/70">{sub}</span>}
      </dd>
    </div>
  );
}

// Estado de erro — variante monocromática (sem cor de alarme), com retry. Brand v3.
function EstadoErro({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div>
      <p className="text-[13px] text-bone/70">{msg}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 inline-flex items-center gap-2 rounded border border-hairline px-3 py-1.5 font-data text-[11px] uppercase tracking-wider text-bone transition-colors hover:border-hairline-hover hover:text-floral focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50"
      >
        <span aria-hidden="true">↻</span> Tentar de novo
      </button>
    </div>
  );
}

// Ação primária — salvar no pipeline (POST idempotente). Veredito stage-aware (avançar/
// arquivar) lendo o estágio atual é o próximo incremento.
function AcaoPrimaria({ empresa }: { empresa: Empresa }) {
  const [estado, setEstado] = useState<"idle" | "salvando" | "salvo">("idle");

  async function salvar() {
    if (estado !== "idle") return;
    setEstado("salvando");
    try {
      // Garante que o pipeline consiga reabrir esta empresa depois (mesma ponte de sessionStorage).
      storeEmpresa(empresa);
      const r = await fetch("/api/oportunidade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId: empresa.id }),
      });
      if (!r.ok) throw new Error();
      setEstado("salvo");
    } catch {
      setEstado("idle");
    }
  }

  return (
    <button
      type="button"
      onClick={salvar}
      disabled={estado !== "idle"}
      className={`shrink-0 rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 ${
        estado === "salvo"
          ? "text-floral"
          : "border border-hairline text-bone hover:border-hairline-hover hover:text-floral"
      }`}
    >
      {estado === "salvo" ? "✓ no pipeline" : estado === "salvando" ? "Salvando…" : "Salvar no pipeline"}
    </button>
  );
}
