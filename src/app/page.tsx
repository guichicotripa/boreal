"use client";

import { useState } from "react";
import type { SearchResponse, Empresa, DossierAnalise } from "@/lib/types";
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto max-w-4xl px-6 py-16">
        {/* Header */}
        <header className="mb-10">
          <h1 className="text-4xl font-semibold tracking-tight">Boreal</h1>
          <p className="mt-2 text-zinc-400">
            Deal sourcing para PE/M&amp;A — metalmecânica com risco sucessório.
            Descreva o que procura em linguagem natural.
          </p>
        </header>

        {/* Search box */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            buscar(texto);
          }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="ex: metalmecânica no interior de SP com sócios acima de 60 anos"
            className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm outline-none placeholder:text-zinc-600 focus:border-zinc-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-zinc-100 px-6 py-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-white disabled:opacity-50"
          >
            {loading ? "Buscando…" : "Buscar"}
          </button>
        </form>

        {/* Exemplos */}
        <div className="mt-3 flex flex-wrap gap-2">
          {EXEMPLOS.map((ex) => (
            <button
              key={ex}
              onClick={() => {
                setTexto(ex);
                buscar(ex);
              }}
              className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
            >
              {ex}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="mt-10 animate-pulse text-sm text-zinc-500">
            Interpretando consulta, filtrando empresas e analisando o top 15…
          </div>
        )}

        {/* Erro */}
        {erro && (
          <div className="mt-10 rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            {erro}
          </div>
        )}

        {/* Resultados */}
        {res && !loading && (
          <section className="mt-10">
            <div className="mb-4 flex items-center justify-between text-sm text-zinc-500">
              <span>
                {res.count} empresa{res.count === 1 ? "" : "s"}
                {res.reasoned && res.reasonedCount && (
                  <span className="ml-2 text-emerald-500">
                    · top {res.reasonedCount} analisadas por IA
                  </span>
                )}
              </span>
              <span className="flex gap-2">
                {res.filters.cnaePrefixes.map((c) => (
                  <span key={c} className="rounded bg-zinc-900 px-2 py-0.5">
                    CNAE {c}
                  </span>
                ))}
                {res.filters.minFaixaEtaria != null && (
                  <span className="rounded bg-zinc-900 px-2 py-0.5">
                    sócios {FAIXA_LABEL[String(res.filters.minFaixaEtaria)]}+
                  </span>
                )}
                {res.filters.maxAnoFundacao != null && (
                  <span className="rounded bg-zinc-900 px-2 py-0.5">
                    até {res.filters.maxAnoFundacao}
                  </span>
                )}
                <span className="rounded bg-zinc-800 px-2 py-0.5 text-zinc-400">
                  {res.parsedBy === "llm" ? "interpretado por IA" : "heurístico"}
                </span>
              </span>
            </div>

            <ul className="flex flex-col gap-3">
              {res.empresas.map((e) => (
                <EmpresaCard key={e.id} empresa={e} />
              ))}
            </ul>

            {res.count === 0 && (
              <p className="text-sm text-zinc-500">
                Nenhuma empresa bateu com os filtros. Tente afrouxar a consulta.
              </p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

const TIER_STYLES = {
  alto:  { box: "border-red-900/60 bg-red-950/20",     text: "text-red-300",    label: "Alto risco sucessório" },
  medio: { box: "border-amber-900/60 bg-amber-950/20", text: "text-amber-300",  label: "Risco moderado" },
  baixo: { box: "border-zinc-800 bg-zinc-900/30",      text: "text-zinc-400",   label: "Risco baixo" },
} as const;

function EmpresaCard({ empresa: e }: { empresa: Empresa }) {
  const socios = e.socio ?? [];
  const score = e.score?.score ?? 0;
  const tier = scoreTier(score);
  const tierStyle = TIER_STYLES[tier];
  const sinais = e.score?.sinais ?? [];

  return (
    <li className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      {/* Header com score em destaque */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {/* Score badge */}
          <div className={`shrink-0 rounded-lg border ${tierStyle.box} px-3 py-2 text-center`}>
            <div className={`text-2xl font-semibold tabular-nums ${tierStyle.text}`}>
              {score}
            </div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-500">
              score
            </div>
          </div>
          {/* Nome + tier */}
          <div>
            <h3 className="font-medium text-zinc-100">{e.razao_social}</h3>
            {e.nome_fantasia && (
              <p className="text-sm text-zinc-500">{e.nome_fantasia}</p>
            )}
            <p className={`mt-1 text-xs ${tierStyle.text}`}>{tierStyle.label}</p>
          </div>
        </div>
        <span className="shrink-0 font-mono text-xs text-zinc-600">
          {formatCnpj(e.cnpj)}
        </span>
      </div>

      {/* One-liner do reasoner LLM (se rodou) */}
      {e.insight?.one_liner && (
        <p className="mt-3 text-sm italic leading-relaxed text-zinc-300">
          &ldquo;{e.insight.one_liner}&rdquo;
        </p>
      )}

      {/* Flags do reasoner */}
      {e.insight?.flags && e.insight.flags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {e.insight.flags.map((f, i) => (
            <span
              key={i}
              className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-300"
            >
              {f}
            </span>
          ))}
        </div>
      )}

      {/* Sinais do score determinístico (bullets curtos) */}
      {sinais.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
          {sinais.map((s, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-zinc-600" />
              {s}
            </li>
          ))}
        </ul>
      )}

      {/* Setor (descrição legível do CNAE) */}
      {e.cnae_principal_desc && (
        <p className="mt-3 text-xs text-zinc-400">{e.cnae_principal_desc}</p>
      )}

      {/* Metadados da empresa */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
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
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {e.telefone && (
            <span className="text-emerald-400">☎ {formatTelefone(e.telefone)}</span>
          )}
          {e.email && <span className="text-emerald-400">✉ {e.email}</span>}
        </div>
      )}

      {/* Sócios */}
      {socios.length > 0 && (
        <div className="mt-3 border-t border-zinc-800 pt-3">
          <p className="mb-1 text-xs uppercase tracking-wide text-zinc-600">
            Sócios
          </p>
          <ul className="flex flex-col gap-1">
            {socios.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-sm">
                <span className="text-zinc-300">{s.nome}</span>
                {s.faixa_etaria && FAIXA_LABEL[s.faixa_etaria] && (
                  <span className="rounded bg-amber-950/50 px-1.5 py-0.5 text-xs text-amber-400">
                    {FAIXA_LABEL[s.faixa_etaria]} anos
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Dossiê — memo instantâneo sob demanda */}
      <DossierPanel empresa={e} />
    </li>
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
    <div className="mt-4 border-t border-zinc-800 pt-3">
      <button
        onClick={gerar}
        disabled={loading}
        className="text-xs font-medium text-zinc-300 transition-colors hover:text-white disabled:opacity-50"
      >
        {loading
          ? "Gerando memo…"
          : analise
            ? open ? "▾ Ocultar memo" : "▸ Ver memo"
            : "▸ Gerar memo de investimento"}
      </button>

      {erro && <p className="mt-2 text-xs text-red-400">{erro}</p>}

      {open && analise && (
        <div className="mt-3 space-y-4 rounded-lg bg-zinc-950/60 p-4 text-sm">
          {/* Overview */}
          <p className="leading-relaxed text-zinc-300">{analise.overview}</p>

          {/* Timeline societária (visual, determinística) */}
          <Timeline empresa={empresa} />

          {/* Análise sucessória */}
          <div>
            <h4 className="mb-1 text-xs uppercase tracking-wider text-zinc-500">
              Análise de risco sucessório
            </h4>
            <p className="leading-relaxed text-zinc-300">{analise.analise_sucessoria}</p>
          </div>

          {/* Perguntas de abordagem */}
          {analise.perguntas_abordagem.length > 0 && (
            <div>
              <h4 className="mb-1 text-xs uppercase tracking-wider text-zinc-500">
                Perguntas para o primeiro contato
              </h4>
              <ul className="list-decimal space-y-1 pl-5 text-zinc-300">
                {analise.perguntas_abordagem.map((p, i) => (
                  <li key={i} className="leading-relaxed">{p}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Tese de aproximação */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
            <h4 className="mb-1 text-xs uppercase tracking-wider text-zinc-500">
              Tese de aproximação
            </h4>
            <p className="leading-relaxed text-zinc-200">{analise.tese_aproximacao}</p>
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
      <h4 className="mb-2 text-xs uppercase tracking-wider text-zinc-500">
        Linha do tempo societária
      </h4>
      <div
        className="relative h-px bg-zinc-700"
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
              <span className="absolute -top-7 max-w-[8rem] truncate whitespace-nowrap text-[10px] text-zinc-400">
                {ev.label}
              </span>
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span className="absolute top-3 text-[10px] tabular-nums text-zinc-600">
                {ev.ano}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
