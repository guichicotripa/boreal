"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Empresa, ResearchResult, DossierAnalise, TrajetoriaResult } from "@/lib/types";
import type { EmpresaSimilar } from "@/lib/similar";
import { scoreTier } from "@/lib/scoring";
import { setorPorCnae } from "@/lib/setores";
import { contextoSetor } from "@/lib/setor-contexto";
import { ContextoSetor } from "@/components/ContextoSetor";
import { readEmpresa, readOrigin, storeEmpresa, storeScoreConhecido, type Origin } from "@/lib/empresa-store";
import {
  formatCnpj, formatTelefone, formatCapitalCompact,
  FAIXA_LABEL, FAIXA_COLOR, TIER_STYLES, anosOperacao,
} from "@/lib/format";
import { ResearchDisplay } from "@/components/empresa/ResearchDisplay";
import { MemoDisplay } from "@/components/empresa/MemoDisplay";
import { Timeline } from "@/components/empresa/Timeline";
import { TrajetoriaEventos } from "@/components/empresa/TrajetoriaEventos";
import { Phone, Mail } from "lucide-react";

/* Página da empresa — layout de registro (padrão Grata/Attio):
   rail esquerda com os atributos fixos (score, dados da Receita, contato, sócios)
   sempre visíveis; tabs à direita com o conteúdo profundo. Substitui o scroll
   editorial de coluna única com scroll-spy (F4 do plano-ui-workbench). */

const TABS = [
  { id: "visao", label: "Visão geral" },
  { id: "investigacao", label: "Investigação" },
  { id: "memo", label: "Memo" },
  { id: "trajetoria", label: "Trajetória" },
  { id: "similares", label: "Similares" },
] as const;
type TabId = (typeof TABS)[number]["id"];

// As 4 dimensões do score (scoring.ts). Barras na cor do tier de risco (TIER_STYLES.bar) —
// reforçam a leitura de risco de relance. Decisão aprovada 2026-06-08 (ver brand guide #16).
const DIMENSOES = [
  { key: "idade_socios", label: "Idade dos sócios", max: 30 },
  { key: "antiguidade_empresa", label: "Antiguidade", max: 30 },
  { key: "porte_relevancia", label: "Porte / relevância", max: 30 },
  { key: "quadro_plural", label: "Quadro plural", max: 10 },
] as const;

// Fases da investigação ao vivo — dão sinal de progresso (não travou) em vez de um
// texto estático. Espelham o que o research-agent faz em fontes públicas.
const RESEARCH_FASES = [
  "Lendo o quadro societário…",
  "Buscando sócios e herdeiros na imprensa…",
  "Cruzando sinais de sucessão e movimentação…",
  "Sintetizando a investigação…",
] as const;

export default function EmpresaPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [carregado, setCarregado] = useState(false);
  const [empresaLoading, setEmpresaLoading] = useState(false);
  const [origin, setOrigin] = useState<Origin>("busca");
  const [tab, setTab] = useState<TabId>("visao");

  // Investigação — auto-disparada ao abrir (decisão de produto: overview rico imediato;
  // com cache, custo zero em re-visita. Pendência de alinhamento com Guilherme registrada).
  const [research, setResearch] = useState<ResearchResult | null>(null);
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchErro, setResearchErro] = useState(false);

  // Memo — sob demanda (LLM mais pesado).
  const [memo, setMemo] = useState<DossierAnalise | null>(null);
  const [memoLoading, setMemoLoading] = useState(false);
  const [memoErro, setMemoErro] = useState(false);

  // Similares — auto (query barata por CNAE).
  const [similares, setSimilares] = useState<EmpresaSimilar[] | null>(null);
  const [similaresLoading, setSimilaresLoading] = useState(false);

  // Trajetória societária — auto (cache-first; alimenta a tab própria e o bloco no memo).
  const [traj, setTraj] = useState<TrajetoriaResult | null>(null);

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

  const fetchTrajetoria = useCallback(async () => {
    try {
      const r = await fetch("/api/trajetoria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId: id }),
      });
      const data = await r.json();
      if (r.ok) setTraj({ pontos: data.pontos ?? [], eventos: data.eventos ?? [] });
    } catch {
      // silencioso — a tab Trajetória mostra o empty state se não vier nada
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
    fetchTrajetoria();
  }, [id, fetchEmpresa, fetchResearch, fetchSimilares, fetchTrajetoria]);

  // ── Estado: empresa não encontrada (GET falhou — id inexistente) ──
  if (carregado && !empresa && !empresaLoading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20">
        <p className="text-[11px] font-medium text-ink-muted">Empresa não encontrada</p>
        <h1 className="mt-2 font-display text-2xl text-ink">Não localizamos esta empresa.</h1>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-ink-soft">
          O identificador pode estar incorreto ou a empresa não está na base indexada. Volte ao Radar para encontrar empresas-alvo.
        </p>
        <Link
          href="/"
          className="group mt-5 inline-flex items-center gap-2 rounded-sm text-[12px] font-medium text-ink transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50"
        >
          <span className="transition-transform duration-200 group-hover:-translate-x-0.5">←</span>
          Ir pro Radar
        </Link>
      </main>
    );
  }

  // ── Estado: ainda lendo o sessionStorage (primeiro paint) ──
  if (!empresa) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10" aria-busy="true">
        <div className="h-3 w-32 animate-pulse rounded bg-surface-hover" />
        <div className="mt-4 h-8 w-2/3 animate-pulse rounded bg-surface-hover" />
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[300px_minmax(0,1fr)]">
          <div className="h-64 animate-pulse rounded-lg bg-surface-hover" />
          <div className="h-64 animate-pulse rounded-lg bg-surface-hover" />
        </div>
      </main>
    );
  }

  const e = empresa;
  const socios = e.socio ?? [];
  // Precedência: investigação desta sessão > v1 já persistido (score_run, vem do GET) > v0.
  // O v1 salvo faz a página abrir com o número apurado, sem esperar o research responder.
  const score = research?.score_v1 ?? e.score_v1?.score ?? e.score?.score ?? 0;
  const deltaV1 = research?.delta ?? e.score_v1?.delta ?? null;
  const breakdown = e.score?.breakdown;
  const sinaisScore = e.score?.sinais ?? [];
  const perfilSuc = e.score?.perfil_sucessorio ?? false;
  const tier = scoreTier(score);
  const t = TIER_STYLES[tier];
  const { ano: anoFund, anos: anosOp } = anosOperacao(e.data_inicio_atividade);
  const backHref = origin === "pipeline" ? "/pipeline" : "/";
  const backLabel = origin === "pipeline" ? "Pipeline" : "Radar";
  const setor = setorPorCnae(e.cnae_principal);
  const ctx = contextoSetor(setor?.id);
  const temTrajetoria = (traj?.eventos.length ?? 0) > 0 || !!e.data_inicio_atividade;

  return (
    <div className="bg-canvas text-ink">
      {/* ── Header do registro (compacto — a identidade, não um hero) ── */}
      <header className="mx-auto max-w-6xl px-6 pb-5 pt-6">
        <Link
          href={backHref}
          className="group inline-flex items-center gap-2 rounded-sm text-[12px] font-medium text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50"
        >
          <span className="transition-transform duration-200 group-hover:-translate-x-0.5">←</span>
          {backLabel}
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h1 className="font-display text-2xl leading-tight tracking-tight text-ink md:text-[28px]">
              {e.razao_social}
            </h1>
            <p className="mt-1.5 font-data text-[12px] text-ink-muted">
              {formatCnpj(e.cnpj)}
              <span className="text-ink-faint"> · </span>{e.municipio}/{e.uf}
              <span className="text-ink-faint"> · </span>fundada {anoFund}{anosOp != null ? ` (${anosOp} anos)` : ""}
              {e.porte && <><span className="text-ink-faint"> · </span>{e.porte}</>}
            </p>
          </div>
          <AcaoPrimaria empresa={e} />
        </div>
      </header>

      {/* ── Registro: rail de atributos + tabs de conteúdo ── */}
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-x-8 gap-y-6 px-6 pb-24 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* ── RAIL (atributos fixos — sempre visíveis, sem navegar) ── */}
        <aside className="space-y-4 lg:sticky lg:top-[72px] lg:self-start">
          {/* Score */}
          <section className="rounded-lg border border-hairline bg-surface p-4">
            <div aria-live="polite" className="flex items-baseline gap-2">
              <span className={`font-data text-[32px] leading-none tabular-nums ${t.text}`}>{score}</span>
              <span className={`text-[11px] font-medium ${t.text}`}>{t.label}</span>
              {deltaV1 != null && deltaV1 !== 0 && (
                <span
                  className={`font-data text-[11px] tabular-nums ${deltaV1 > 0 ? "text-risk-high" : "text-ink-muted"}`}
                  title="ajuste da investigação sobre o score determinístico"
                >
                  {deltaV1 > 0 ? `↑${deltaV1}` : `↓${Math.abs(deltaV1)}`}
                </span>
              )}
              <span className="font-data text-[11px] text-ink-muted">/ 100</span>
            </div>
            <p className="mt-2 text-[12px] leading-snug text-ink-soft">
              {perfilSuc
                ? "Sócio 61+ e empresa com 25+ anos — lente de sucessão confiável."
                : "Fora do perfil sucessório — score de menor confiança (provável consolidação)."}
            </p>

            {breakdown && (
              <ul className="mt-4 space-y-2">
                {DIMENSOES.map((d) => {
                  const pts = breakdown[d.key];
                  return (
                    <li key={d.key} className="flex items-center gap-2">
                      <span className="w-[104px] shrink-0 text-[11.5px] text-ink-soft">{d.label}</span>
                      <span className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-hairline">
                        <span className={`block h-full ${t.bar}`} style={{ width: `${Math.round((pts / d.max) * 100)}%` }} />
                      </span>
                      <span className="w-10 shrink-0 text-right font-data text-[10.5px] tabular-nums text-ink-muted">
                        {pts}/{d.max}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            <Link
              href="/validacao"
              className="group mt-4 inline-flex items-center gap-1.5 rounded-sm text-[11.5px] font-medium text-ink transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50"
            >
              Como calculamos
              <span className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">→</span>
            </Link>
          </section>

          {/* Dados da Receita */}
          <section className="rounded-lg border border-hairline p-4">
            <h2 className="mb-3 text-[11px] font-medium text-ink-muted">Dados</h2>
            <dl className="space-y-2.5">
              <Campo k="Natureza jurídica" v={e.natureza_juridica} />
              <Campo k="Capital social" v={formatCapitalCompact(e.capital_social)} mono />
              <Campo k="CNAE principal" v={e.cnae_principal} sub={e.cnae_principal_desc} mono />
            </dl>
            <p className="mt-3 text-[10.5px] text-ink-muted">Dados públicos da Receita Federal.</p>
          </section>

          {/* Contato */}
          {(e.telefone || e.email) && (
            <section className="rounded-lg border border-hairline p-4">
              <h2 className="mb-3 text-[11px] font-medium text-ink-muted">Contato</h2>
              <div className="flex flex-col gap-2">
                {e.telefone && (
                  <a
                    href={`tel:${e.telefone.replace(/\D/g, "")}`}
                    className="inline-flex w-fit items-center gap-1.5 rounded-md border border-hairline px-2.5 py-1.5 font-data text-[11px] text-ink-soft transition-colors hover:border-hairline-hover hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50"
                  >
                    <Phone aria-hidden="true" className="h-3 w-3" strokeWidth={1.75} />
                    {formatTelefone(e.telefone)}
                  </a>
                )}
                {e.email && (
                  <a
                    href={`mailto:${e.email}`}
                    className="inline-flex max-w-full items-center gap-1.5 truncate rounded-md border border-hairline px-2.5 py-1.5 font-data text-[11px] text-ink-soft transition-colors hover:border-hairline-hover hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50"
                  >
                    <Mail aria-hidden="true" className="h-3 w-3 shrink-0" strokeWidth={1.75} />
                    <span className="truncate">{e.email.toLowerCase()}</span>
                  </a>
                )}
              </div>
            </section>
          )}

          {/* Sócios — evidência do driver de maior peso do score */}
          <section className="rounded-lg border border-hairline p-4">
            <h2 className="mb-3 text-[11px] font-medium text-ink-muted">
              Sócios{socios.length > 0 ? ` (${socios.length})` : ""}
            </h2>
            {socios.length > 0 ? (
              <ul className="space-y-2.5">
                {socios.map((s, i) => {
                  const ent = s.data_entrada_sociedade?.slice(0, 4);
                  return (
                    <li key={s.id ?? `${s.nome}-${i}`} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] text-ink">{s.nome}</p>
                        {ent && <p className="text-[10.5px] text-ink-muted">sócio desde {ent}</p>}
                      </div>
                      {s.faixa_etaria && FAIXA_LABEL[s.faixa_etaria] && (
                        <span className={`shrink-0 rounded px-1.5 py-0.5 font-data text-[10.5px] tabular-nums ${FAIXA_COLOR[s.faixa_etaria] ?? "bg-surface text-ink-soft"}`}>
                          {FAIXA_LABEL[s.faixa_etaria]}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[12px] text-ink-muted">Quadro societário não disponível.</p>
            )}
          </section>
        </aside>

        {/* ── CONTEÚDO (tabs) ── */}
        <div className="min-w-0">
          <nav aria-label="Seções da empresa" className="flex items-center overflow-x-auto border-b border-hairline">
            {TABS.map(({ id: tabId, label }) => {
              const ativo = tab === tabId;
              return (
                <button
                  key={tabId}
                  type="button"
                  onClick={() => setTab(tabId)}
                  aria-current={ativo ? "true" : undefined}
                  className={`mr-1 flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 pb-2.5 pt-1 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50 ${
                    ativo ? "border-ink text-ink" : "border-transparent text-ink-muted hover:text-ink"
                  }`}
                >
                  {label}
                  {tabId === "investigacao" && researchLoading && (
                    <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink" />
                  )}
                  {tabId === "similares" && similares && similares.length > 0 && (
                    <span className="rounded-full border border-hairline px-1.5 py-px font-data text-[10px] tabular-nums text-ink-muted">
                      {similares.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="pt-5">
            {/* ── VISÃO GERAL ── */}
            {tab === "visao" && (
              <div className="space-y-7">
                {e.insight?.one_liner && (
                  <p className="font-display text-[17px] leading-relaxed text-ink">
                    {e.insight.one_liner}
                  </p>
                )}

                <div>
                  {e.cnae_principal_desc && (
                    <p className="text-[15px] leading-relaxed text-ink">{e.cnae_principal_desc}</p>
                  )}
                  {/* Camada enriquecida — descrição da IA (skeleton enquanto investiga) */}
                  {researchLoading ? (
                    <div className="mt-3" aria-busy="true">
                      <div className="space-y-2">
                        <div className="h-3 w-full animate-pulse rounded bg-surface-hover" />
                        <div className="h-3 w-11/12 animate-pulse rounded bg-surface-hover" />
                        <div className="h-3 w-4/5 animate-pulse rounded bg-surface-hover" />
                      </div>
                      <p className="mt-2 text-[11px] text-ink-muted">
                        Descrição enriquecida pela IA · costuma levar de 30 a 60s
                      </p>
                    </div>
                  ) : research?.perfil_negocio || research?.resumo ? (
                    <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
                      {research?.perfil_negocio || research?.resumo}
                    </p>
                  ) : null}
                </div>

                {/* Sinais — evidência do score (IA + estruturais) */}
                {research?.sinais && research.sinais.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-[11px] font-medium text-ink-muted">Sinais — investigação com IA</h3>
                    <div className="space-y-1">
                      {research.sinais.map((s, i) => (
                        <div key={i} className="flex items-start justify-between gap-4 py-1">
                          <span className="text-[13px] text-ink-soft">{s.rotulo}</span>
                          <span className={`shrink-0 rounded px-1.5 py-0.5 font-data text-[10px] tabular-nums ${
                            s.peso > 0 ? "bg-risk-high/15 text-risk-high" : "bg-surface text-ink-soft"
                          }`}>
                            {s.peso > 0 ? `+${s.peso}` : `−${Math.abs(s.peso)}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {sinaisScore.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-[11px] font-medium text-ink-muted">Sinais estruturais — da Receita</h3>
                    <ul className="space-y-1.5">
                      {sinaisScore.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-[13px] text-ink-soft">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-faint" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {e.cnaes_secundarios && e.cnaes_secundarios.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-[11px] font-medium text-ink-muted">Atividades secundárias</h3>
                    <ul className="space-y-1">
                      {e.cnaes_secundarios.map((c) => (
                        <li key={c.codigo} className="flex items-center gap-2 text-[12px] leading-relaxed text-ink-muted">
                          <span className="shrink-0 text-ink-faint">·</span>
                          {c.descricao ?? c.codigo}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Contexto do setor — leitura macro/competitiva antes da abordagem */}
                {ctx && setor && (
                  <div className="border-t border-hairline pt-6">
                    <h3 className="mb-1 text-[11px] font-medium text-ink-muted">Contexto do setor</h3>
                    <p className="mb-3 text-[12px] text-ink-muted">
                      {setor.nome} · lente {setor.lente === "consolidacao" ? "consolidação" : "sucessão"}
                    </p>
                    <ContextoSetor ctx={ctx} />
                  </div>
                )}
              </div>
            )}

            {/* ── INVESTIGAÇÃO ── (auto-disparada ao abrir a página) */}
            {tab === "investigacao" && (
              researchLoading ? (
                <ResearchProgress />
              ) : research ? (
                <ResearchDisplay research={research} />
              ) : researchErro ? (
                <EstadoErro msg="Não foi possível carregar a investigação." onRetry={fetchResearch} />
              ) : null
            )}

            {/* ── MEMO ── (sob demanda; síntese a partir da investigação) */}
            {tab === "memo" && (
              memo ? (
                <MemoDisplay empresa={e} analise={memo} trajetoria={traj} />
              ) : memoLoading ? (
                <p className="animate-pulse text-[13px] text-ink-muted" role="status">
                  Gerando memo…
                </p>
              ) : memoErro ? (
                <EstadoErro msg="Não foi possível gerar o memo." onRetry={gerarMemo} />
              ) : (
                <div>
                  <p className="max-w-md text-[13px] leading-relaxed text-ink-muted">
                    Síntese de investimento a partir dos sinais investigados: análise sucessória,
                    red flags, perguntas de abordagem e precedentes do setor.
                  </p>
                  <button
                    type="button"
                    onClick={gerarMemo}
                    className="mt-4 inline-flex items-center gap-2 rounded-md bg-ink px-3.5 py-2 text-[12.5px] font-medium text-canvas transition-colors hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50"
                  >
                    Gerar memo
                  </button>
                </div>
              )
            )}

            {/* ── TRAJETÓRIA ── (linha do tempo + movimentação real do quadro) */}
            {tab === "trajetoria" && (
              temTrajetoria ? (
                <div className="space-y-8">
                  <Timeline empresa={e} />
                  {traj && traj.eventos.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-[11px] font-medium text-ink-muted">
                        Movimentação societária (2022→2025)
                      </h3>
                      <TrajetoriaEventos trajetoria={traj} />
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[13px] text-ink-muted">Sem histórico societário disponível.</p>
              )
            )}

            {/* ── SIMILARES ── (auto; critério explícito) */}
            {tab === "similares" && (
              <div>
                <p className="mb-3 text-[12px] text-ink-muted">Critério: mesmo CNAE, praça e porte.</p>
                {similaresLoading ? (
                  <p className="animate-pulse text-[13px] text-ink-muted" role="status">Buscando empresas parecidas…</p>
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
                            className="flex items-center justify-between gap-3 rounded-sm py-2.5 transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-[13.5px] font-medium text-ink">{s.razao_social}</p>
                              <p className="text-[11px] text-ink-muted">
                                {s.municipio}/{s.uf}
                                {s.similaridade.motivos.length > 0 && ` · ${s.similaridade.motivos.join(", ")}`}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className="font-data text-[11px] tabular-nums text-ink-muted">
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
                  <p className="text-[13px] text-ink-soft">Nenhuma empresa parecida no universo indexado.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-componentes ──────────────────────────────────────────────────────────

// Campo do rail: rótulo + valor (mono opcional pra dados). Esconde quando vazio.
function Campo({ k, v, sub, mono }: { k: string; v: string | null | undefined; sub?: string | null; mono?: boolean }) {
  if (!v) return null;
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] font-medium text-ink-muted">{k}</dt>
      <dd className={`mt-0.5 text-[12.5px] text-ink ${mono ? "font-data tabular-nums" : ""}`}>
        {v}
        {sub && <span className="block font-sans text-[11px] leading-snug text-ink-muted">{sub}</span>}
      </dd>
    </div>
  );
}

// Progresso da investigação ao vivo — fase rotativa (sinal de vida) + expectativa
// honesta como faixa (não um número exato que vira promessa quebrada se estourar).
function ResearchProgress() {
  const [fase, setFase] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setFase((f) => Math.min(f + 1, RESEARCH_FASES.length - 1));
    }, 6000);
    return () => clearInterval(id);
  }, []);

  return (
    <div role="status" aria-live="polite">
      <p className="flex items-center gap-2 text-[13px]">
        <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-ink" />
        <span className="text-ink">{RESEARCH_FASES[fase]}</span>
      </p>
      <p className="mt-1.5 text-[11px] text-ink-muted">
        Pesquisa em fontes públicas · costuma levar de 30 a 60s
      </p>
    </div>
  );
}

// Estado de erro — variante monocromática (sem cor de alarme), com retry. Brand v3.
function EstadoErro({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div>
      <p className="text-[13px] text-ink-muted">{msg}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 inline-flex items-center gap-2 rounded border border-hairline px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-hairline-hover hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50"
      >
        <span aria-hidden="true">↻</span> Tentar de novo
      </button>
    </div>
  );
}

// Ação primária do registro — salvar no pipeline (POST idempotente). Botão sólido:
// é a única ação primária da tela (regra do workbench: um botão sólido por tela).
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
      className={`shrink-0 rounded-md px-3.5 py-2 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50 ${
        estado === "salvo"
          ? "border border-hairline text-ink"
          : "bg-ink text-canvas hover:bg-ink/90 disabled:opacity-60"
      }`}
    >
      {estado === "salvo" ? "✓ no pipeline" : estado === "salvando" ? "Salvando…" : "Salvar no pipeline"}
    </button>
  );
}
