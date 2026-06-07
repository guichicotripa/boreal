"use client";

import { useEffect, useState } from "react";
import type { SearchResponse, Empresa } from "@/lib/types";
import { SETORES } from "@/lib/setores";

function formatTelefone(tel: string) {
  const d = tel.replace(/\D/g, "");
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  return tel;
}

// "Por que ligar": o one-liner do reasoner, ou o sinal mais forte do score.
function porQue(e: Empresa): string {
  if (e.insight?.one_liner) return e.insight.one_liner;
  return e.score?.sinais?.[0] ?? "Perfil sucessório";
}

export default function Worklist() {
  const [setor, setSetor] = useState("metalmec");
  const [res, setRes] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);

  async function carregar(s: string) {
    setLoading(true);
    setErro(false);
    try {
      const r = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setor: s }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setRes(d);
    } catch {
      setErro(true);
      setRes(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar(setor);
  }, [setor]);

  // O worklist: perfil sucessório (onde a lente vale) + com contato (acionável agora), por score.
  const lista = (res?.empresas ?? [])
    .filter((e) => e.score?.perfil_sucessorio && (e.telefone || e.email))
    .slice(0, 20);

  return (
    <div className="min-h-screen bg-smoky text-floral">
      <main className="mx-auto max-w-4xl px-6 py-12">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <p className="font-data text-[11px] uppercase tracking-wider text-olive">Ligar hoje</p>
            <h1 className="mt-2 font-display text-3xl tracking-tight md:text-4xl">Worklist</h1>
          </div>
          <a
            href="/"
            className="group flex items-center gap-2 font-data text-[11px] uppercase tracking-wider text-floral transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 rounded-sm"
          >
            <span className="transition-transform duration-200 group-hover:-translate-x-1">←</span>
            <span>Voltar à busca</span>
          </a>
        </header>

        <p className="mb-5 max-w-2xl text-[15px] leading-relaxed text-bone">
          Alvos de <strong>perfil sucessório</strong> onde o score vale 88–100%,
          com contato disponível, priorizados. Ligue de cima para baixo, cada linha tem o porquê e o telefone.
        </p>

        {/* Seletor de setor */}
        <div className="mb-5 flex flex-wrap gap-2">
          {SETORES.map((s) => (
            <button
              key={s.id}
              onClick={() => setSetor(s.id)}
              aria-pressed={setor === s.id}
              className={`rounded border px-2.5 py-1 font-data text-[11px] uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 ${
                setor === s.id ? "border-floral/40 text-floral" : "border-hairline text-bone hover:text-floral"
              }`}
            >
              {s.nome}
            </button>
          ))}
        </div>

        <div aria-live="polite" aria-busy={loading}>
        {erro ? (
          <div>
            <p className="text-[15px] leading-relaxed text-bone">
              Não consegui carregar os alvos. Verifique a conexão e tente de novo.
            </p>
            <button
              onClick={() => carregar(setor)}
              className="mt-3 inline-flex items-center gap-2 rounded border border-hairline px-3 py-2 font-data text-[11px] uppercase tracking-wider text-bone transition-colors hover:border-floral/40 hover:text-floral focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50"
            >
              <span aria-hidden="true">↻</span> Tentar de novo
            </button>
          </div>
        ) : loading ? (
          <p className="text-sm text-bone/70">Carregando…</p>
        ) : lista.length === 0 ? (
          <p className="text-sm text-olive">Nenhum alvo de perfil sucessório com contato neste setor.</p>
        ) : (
          <ol className="space-y-2">
            {lista.map((e) => {
              return (
                <li key={e.id} className="flex items-start gap-3 rounded-lg border border-hairline bg-surface p-3">
                  <span
                    title="score de sucessão"
                    className="mt-0.5 shrink-0 rounded border border-hairline px-1.5 font-data text-[11px] tabular-nums text-floral"
                  >
                    {e.score?.score ?? 0}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-sm leading-snug text-floral">{e.razao_social}</p>
                    <p className="font-data text-[11px] text-bone/70">{e.municipio}/{e.uf}</p>
                    <p className="mt-1 text-xs leading-snug text-bone">{porQue(e)}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-data text-[11px]">
                      {e.telefone && (
                        <a
                          href={`tel:${e.telefone.replace(/\D/g, "")}`}
                          className="text-floral transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 rounded-sm"
                        >
                          {formatTelefone(e.telefone)}
                        </a>
                      )}
                      {e.email && (
                        <a
                          href={`mailto:${e.email}`}
                          className="text-floral transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 rounded-sm"
                        >
                          {e.email}
                        </a>
                      )}
                    </div>
                  </div>
                  <SalvarButton empresaId={e.id} />
                </li>
              );
            })}
          </ol>
        )}
        </div>
      </main>
    </div>
  );
}

// Mesmo padrão dos cards da home (page.tsx): 3 estados com rollback se a API falha.
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
