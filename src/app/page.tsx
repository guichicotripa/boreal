"use client";

import { useState, useEffect } from "react";
import type { SearchResponse, Empresa, DossierAnalise, ResearchResult } from "@/lib/types";
import { scoreTier } from "@/lib/scoring";

const EXEMPLOS = [
  "metalmecânica no interior de SP com sócios acima de 60 anos",
  "fabricantes de máquinas e equipamentos fundados antes de 1990",
  "fabricantes de máquinas no interior de SP",
];

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

function anoFundacao(data: string | null) {
  return data ? data.slice(0, 4) : "—";
}

export default function Home() {
  const [texto, setTexto] = useState("");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<SearchResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function buscar(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    setErro(null);
    setRes(null);
    try {
      const r = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
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

  return (
    <div className="min-h-screen bg-smoky text-floral">
      <main className="mx-auto max-w-5xl px-6 py-20">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-[2fr_1fr]">
          {/* Coluna principal — hero + search + resultados */}
          <div className="min-w-0">
            {/* Overline */}
            <p className="font-data text-[11px] uppercase tracking-[0.2em] text-bone">
              <span className="text-floral">BOREAL</span>{" "}
              <span className="text-olive">·</span> Deal sourcing
            </p>

            {/* Headline */}
            <h1 className="mt-6 font-display text-[44px] leading-[1.1] tracking-tight text-floral">
              A inteligência privada que encontra empresas familiares antes do mercado.
            </h1>

            {/* Search — underline + prompt */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                buscar(texto);
              }}
              className="mt-8"
            >
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
                  className="font-data text-[11px] uppercase tracking-wider text-floral transition-opacity hover:opacity-80 disabled:opacity-50"
                >
                  {loading ? "Buscando…" : "Buscar tese →"}
                </button>
              </div>
            </form>

            {/* Exemplos — teses sugeridas */}
            <div className="mt-6 flex flex-wrap gap-1.5">
              {EXEMPLOS.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => {
                    setTexto(ex);
                    buscar(ex);
                  }}
                  className="rounded border border-hairline px-2 py-1 text-xs text-bone transition-colors hover:border-hairline-hover hover:text-floral"
                >
                  {ex}
                </button>
              ))}
            </div>

            {/* Loading */}
            {loading && <LoadingSteps />}

            {/* Erro */}
            {erro && (
              <div className="mt-10 rounded-lg border border-risk-high/30 bg-risk-high/5 px-4 py-3 text-sm text-risk-high">
                {erro}
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
                        · {res.reasonedCount} comentadas por IA
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
                  <p className="text-sm text-bone">
                    Nenhuma empresa bateu com os filtros. Tente afrouxar a consulta.
                  </p>
                )}
              </section>
            )}
          </div>

          {/* Sidebar — cobertura do universo de busca */}
          <aside className="md:border-l md:border-hairline md:pl-6">
            <p className="font-data text-[10px] uppercase tracking-wider text-olive">
              Cobertura
            </p>
            <ul className="mt-3 space-y-1.5 font-data text-xs text-bone">
              <li>
                <span className="text-floral">CNAE 24</span> · Metalurgia
              </li>
              <li>
                <span className="text-floral">CNAE 25</span> · Produtos de metal
              </li>
              <li>
                <span className="text-floral">CNAE 28</span> · Máquinas e equipamentos
              </li>
              <li className="text-olive">—</li>
              <li>Interior de SP</li>
              <li>Score sucessório</li>
            </ul>
            <p className="mt-6 font-data text-[10px] uppercase tracking-wider text-olive">
              Base
            </p>
            <p className="mt-1 font-data text-xs tabular-nums text-bone">
              2.000 empresas indexadas
            </p>
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
  "Analisando o top 15 com IA…",
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
    <div className="mt-10 flex flex-col gap-2">
      {LOADING_STEPS.slice(0, step + 1).map((s, i) => (
        <div
          key={i}
          className={`flex items-center gap-2 text-sm ${
            i === step ? "text-floral" : "text-olive"
          }`}
        >
          {i === step ? (
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-risk-mid" />
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
  alto:  { box: "border-risk-high/40 bg-risk-high/5", text: "text-risk-high", label: "Alto risco sucessório" },
  medio: { box: "border-risk-mid/40 bg-risk-mid/5",   text: "text-risk-mid",  label: "Risco moderado" },
  baixo: { box: "border-hairline bg-surface",         text: "text-bone",      label: "Risco baixo" },
} as const;

function EmpresaCard({ empresa: e }: { empresa: Empresa }) {
  const socios = e.socio ?? [];
  const [research, setResearch] = useState<ResearchResult | null>(null);
  const scoreV0 = e.score?.score ?? 0;
  const score = research?.score_v1 ?? scoreV0; // badge mostra v1 após investigação
  const tier = scoreTier(score);
  const tierStyle = TIER_STYLES[tier];
  const sinais = e.score?.sinais ?? [];

  return (
    <li className="rounded-lg border border-hairline bg-surface p-4">
      {/* Header com score em destaque */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {/* Score badge — mostra v1 e o delta após investigação */}
          <div className={`shrink-0 rounded-lg border ${tierStyle.box} px-3 py-2 text-center transition-colors`}>
            <div className={`font-data text-2xl tabular-nums ${tierStyle.text}`}>
              {score}
            </div>
            <div className="mt-0.5 font-data text-[10px] uppercase tracking-wider text-olive">
              {research ? "score v1" : "score"}
            </div>
            {research && research.delta !== 0 && (
              <div
                className={`mt-0.5 font-data text-[10px] tabular-nums ${
                  research.delta > 0 ? "text-risk-high" : "text-bone"
                }`}
                title="ajuste após investigação da IA"
              >
                {scoreV0} {research.delta > 0 ? "↑" : "↓"} {score}
              </div>
            )}
          </div>
          {/* Nome + tier */}
          <div>
            <h3 className="font-display text-lg text-floral">{e.razao_social}</h3>
            {e.nome_fantasia && (
              <p className="text-sm text-bone">{e.nome_fantasia}</p>
            )}
            <p className={`mt-1 text-xs ${tierStyle.text}`}>{tierStyle.label}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="font-data text-xs text-olive">{formatCnpj(e.cnpj)}</span>
          <SalvarButton empresaId={e.id} />
        </div>
      </div>

      {/* One-liner do reasoner LLM (se rodou) */}
      {e.insight?.one_liner && (
        <p className="mt-3 font-display text-sm italic leading-relaxed text-floral">
          &ldquo;{e.insight.one_liner}&rdquo;
        </p>
      )}

      {/* Flags do reasoner */}
      {e.insight?.flags && e.insight.flags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {e.insight.flags.map((f, i) => (
            <span
              key={i}
              className="rounded-full border border-hairline px-2 py-0.5 font-data text-[10px] uppercase tracking-wider text-bone"
            >
              {f}
            </span>
          ))}
        </div>
      )}

      {/* Sinais do score determinístico (bullets curtos) */}
      {sinais.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-bone">
          {sinais.map((s, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-olive" />
              {s}
            </li>
          ))}
        </ul>
      )}

      {/* Setor (descrição legível do CNAE) */}
      {e.cnae_principal_desc && (
        <p className="mt-3 text-xs text-bone">{e.cnae_principal_desc}</p>
      )}

      {/* Metadados da empresa */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-bone">
        <span>{e.municipio} / {e.uf}</span>
        <span>Fundada em {anoFundacao(e.data_inicio_atividade)}</span>
        {e.capital_social != null && (
          <span>Capital R$ {Number(e.capital_social).toLocaleString("pt-BR")}</span>
        )}
        {e.porte && <span>{e.porte}</span>}
        {e.natureza_juridica && <span>{e.natureza_juridica}</span>}
      </div>

      {/* Contato — output mais valioso pra deal sourcing */}
      {(e.telefone || e.email) && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-bone">
          {e.telefone && <span>☎ {formatTelefone(e.telefone)}</span>}
          {e.email && <span>✉ {e.email}</span>}
        </div>
      )}

      {/* Sócios */}
      {socios.length > 0 && (
        <div className="mt-3 border-t border-hairline pt-3">
          <p className="mb-1 font-data text-[10px] uppercase tracking-wider text-olive">
            Sócios
          </p>
          <ul className="flex flex-col gap-1">
            {socios.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-sm">
                <span className="text-floral">{s.nome}</span>
                {s.faixa_etaria && FAIXA_LABEL[s.faixa_etaria] && (
                  <span className="rounded bg-risk-mid/15 px-1.5 py-0.5 font-data text-xs text-risk-mid">
                    {FAIXA_LABEL[s.faixa_etaria]} anos
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Research-agent — investigação na web sob demanda (assinatura) */}
      <ResearchPanel empresa={e} research={research} onResult={setResearch} />

      {/* Dossiê — memo instantâneo sob demanda */}
      <DossierPanel empresa={e} />
    </li>
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
      className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
        estado === "salvo"
          ? "text-floral"
          : "border border-hairline text-bone hover:border-hairline-hover hover:text-floral"
      }`}
    >
      {estado === "salvo" ? "✓ no pipeline" : estado === "salvando" ? "salvando…" : "+ salvar"}
    </button>
  );
}

const PRESENCA_LABEL: Record<string, string> = {
  alta: "presença digital alta", media: "presença digital média",
  baixa: "presença digital baixa", nenhuma: "sem presença digital",
};

function ResearchPanel({
  empresa, research, onResult,
}: {
  empresa: Empresa;
  research: ResearchResult | null;
  onResult: (r: ResearchResult) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function investigar() {
    setLoading(true);
    setErro(null);
    try {
      const r = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId: empresa.id }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "erro na investigação");
      onResult(data.research);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 border-t border-hairline pt-3">
      {!research && (
        <button
          onClick={investigar}
          disabled={loading}
          className="text-xs font-medium text-bone transition-colors hover:text-floral disabled:opacity-50"
        >
          {loading ? "🔍 Investigando na web… (~2 min)" : "🔍 Investigar com IA"}
        </button>
      )}
      {loading && (
        <p className="mt-2 animate-pulse text-xs text-bone">
          A IA está pesquisando sócios, herdeiros, imprensa e quadro societário em fontes públicas…
        </p>
      )}
      {erro && <p className="mt-2 text-xs text-risk-high">{erro}</p>}

      {research && (
        <div className="space-y-3 rounded-lg border border-hairline bg-surface p-3">
          <div className="flex items-center justify-between">
            <span className="font-data text-[10px] font-medium uppercase tracking-wider text-bone">
              Investigação da IA
            </span>
            <span className="font-data text-[10px] text-olive">{PRESENCA_LABEL[research.presenca_digital]}</span>
          </div>

          {research.resumo && (
            <p className="text-sm leading-relaxed text-floral">{research.resumo}</p>
          )}

          {research.sinais.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {research.sinais.map((s, i) => (
                <li key={i} className="text-xs">
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-data text-[10px] font-medium tabular-nums ${
                        s.peso > 0
                          ? "bg-risk-high/15 text-risk-high"
                          : "bg-surface text-bone"
                      }`}
                    >
                      {s.peso > 0 ? `+${s.peso}` : s.peso}
                    </span>
                    <div>
                      <span className="font-medium text-floral">{s.rotulo}</span>
                      <span className="text-bone"> — {s.descricao}</span>
                      {s.fonte_url && (
                        <a
                          href={s.fonte_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-1 text-olive transition-colors hover:text-bone"
                        >
                          ↗ fonte
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-bone">Nenhum sinal qualitativo conclusivo encontrado.</p>
          )}
        </div>
      )}
    </div>
  );
}

function DossierPanel({ empresa }: { empresa: Empresa }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analise, setAnalise] = useState<DossierAnalise | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function gerar() {
    if (analise) {
      setOpen((v) => !v);
      return;
    }
    setLoading(true);
    setErro(null);
    setOpen(true);
    try {
      const r = await fetch("/api/dossier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId: empresa.id }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "erro ao gerar memo");
      setAnalise(data.analise);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 border-t border-hairline pt-3">
      <button
        onClick={gerar}
        disabled={loading}
        className="text-xs font-medium text-bone transition-colors hover:text-floral disabled:opacity-50"
      >
        {loading
          ? "Gerando memo…"
          : analise
            ? open ? "▾ Ocultar memo" : "▸ Ver memo"
            : "▸ Gerar memo de investimento"}
      </button>

      {erro && <p className="mt-2 text-xs text-risk-high">{erro}</p>}

      {open && analise && (
        <div className="mt-3 space-y-4 rounded-lg border border-hairline bg-surface p-4 text-sm">
          {/* Overview */}
          <p className="leading-relaxed text-floral">{analise.overview}</p>

          {/* Timeline societária (visual, determinística) */}
          <Timeline empresa={empresa} />

          {/* Análise sucessória */}
          <div>
            <h4 className="mb-1 font-data text-[10px] uppercase tracking-wider text-olive">
              Análise de risco sucessório
            </h4>
            <p className="leading-relaxed text-floral">{analise.analise_sucessoria}</p>
          </div>

          {/* Perguntas de abordagem */}
          {analise.perguntas_abordagem.length > 0 && (
            <div>
              <h4 className="mb-1 font-data text-[10px] uppercase tracking-wider text-olive">
                Perguntas para o primeiro contato
              </h4>
              <ul className="list-decimal space-y-1 pl-5 text-floral">
                {analise.perguntas_abordagem.map((p, i) => (
                  <li key={i} className="leading-relaxed">{p}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Tese de aproximação */}
          <div className="rounded-lg border border-hairline bg-surface p-3">
            <h4 className="mb-1 font-data text-[10px] uppercase tracking-wider text-olive">
              Tese de aproximação
            </h4>
            <p className="leading-relaxed text-floral">{analise.tese_aproximacao}</p>
          </div>
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
      <h4 className="mb-2 font-data text-[10px] uppercase tracking-wider text-olive">
        Linha do tempo societária
      </h4>
      <div
        className="relative h-px bg-hairline"
        style={{ marginTop: "2.4rem", marginBottom: "1.4rem" }}
      >
        {eventos.map((ev, i) => {
          const pct = ((ev.ano - anoFund) / span) * 100;
          // Alinhamento do label: borda esquerda alinha à esquerda, direita à direita.
          const align =
            pct <= 8 ? "left-0 items-start text-left"
            : pct >= 92 ? "right-0 items-end text-right"
            : "items-center text-center -translate-x-1/2";
          const isEdgeRight = pct >= 92;
          return (
            <div
              key={i}
              className={`absolute flex flex-col ${align}`}
              style={isEdgeRight ? { right: `${Math.max(100 - pct, 0)}%` } : { left: `${Math.min(pct, 100)}%` }}
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
      </div>
    </div>
  );
}
