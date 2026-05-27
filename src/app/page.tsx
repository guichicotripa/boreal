"use client";

import { useState } from "react";
import type { SearchResponse, Empresa } from "@/lib/types";

const EXEMPLOS = [
  "metalmecânica no interior de SP com sócios acima de 60 anos",
  "fabricantes de máquinas e equipamentos fundados antes de 1990",
  "empresas de esquadrias e estruturas metálicas com donos idosos",
];

const FAIXA_LABEL: Record<string, string> = {
  "1": "0–12", "2": "13–20", "3": "21–30", "4": "31–40", "5": "41–50",
  "6": "51–60", "7": "61–70", "8": "71–80", "9": "80+",
};

function formatCnpj(cnpj: string) {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
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
            Interpretando a consulta e filtrando empresas…
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

function EmpresaCard({ empresa: e }: { empresa: Empresa }) {
  const socios = e.socio ?? [];
  return (
    <li className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-medium text-zinc-100">{e.razao_social}</h3>
          {e.nome_fantasia && (
            <p className="text-sm text-zinc-500">{e.nome_fantasia}</p>
          )}
        </div>
        <span className="shrink-0 font-mono text-xs text-zinc-600">
          {formatCnpj(e.cnpj)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
        <span>CNAE {e.cnae_principal}</span>
        <span>Mun. {e.municipio} / {e.uf}</span>
        <span>Fundada em {anoFundacao(e.data_inicio_atividade)}</span>
        {e.capital_social != null && (
          <span>
            Capital R$ {Number(e.capital_social).toLocaleString("pt-BR")}
          </span>
        )}
      </div>

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
    </li>
  );
}
