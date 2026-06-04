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
  const [salvos, setSalvos] = useState<Set<string>>(new Set());

  async function carregar(s: string) {
    setLoading(true);
    const r = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setor: s }),
    });
    const d = await r.json();
    setRes(d);
    setLoading(false);
  }

  useEffect(() => {
    carregar(setor);
  }, [setor]);

  async function salvar(id: string) {
    setSalvos((prev) => new Set(prev).add(id));
    await fetch("/api/oportunidade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ empresaId: id }),
    });
  }

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
          <a href="/" className="font-data text-sm text-bone transition-colors hover:text-floral">
            ← Busca
          </a>
        </header>

        <p className="mb-5 max-w-2xl text-sm leading-relaxed text-bone">
          Alvos de <strong className="text-floral">perfil sucessório</strong> (onde o score vale 88–100%),
          com contato disponível, priorizados. Ligue de cima pra baixo — cada linha tem o porquê e o telefone.
        </p>

        {/* Seletor de setor */}
        <div className="mb-5 flex flex-wrap gap-2">
          {SETORES.map((s) => (
            <button
              key={s.id}
              onClick={() => setSetor(s.id)}
              className={`rounded border px-2.5 py-1 font-data text-[11px] uppercase tracking-wider transition-colors ${
                setor === s.id ? "border-floral/40 text-floral" : "border-hairline text-bone hover:text-floral"
              }`}
            >
              {s.nome}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-bone">Carregando…</p>
        ) : lista.length === 0 ? (
          <p className="text-sm text-bone">Nenhum alvo de perfil sucessório com contato neste setor.</p>
        ) : (
          <ol className="space-y-2">
            {lista.map((e, i) => {
              const salvo = salvos.has(e.id);
              return (
                <li key={e.id} className="flex items-start gap-3 rounded-lg border border-hairline bg-surface p-3">
                  <span className="mt-0.5 w-5 shrink-0 text-right font-data text-sm tabular-nums text-olive">
                    {i + 1}
                  </span>
                  <span className="mt-0.5 shrink-0 rounded border border-floral/30 px-1.5 font-data text-[11px] tabular-nums text-floral">
                    {e.score?.score ?? 0}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug text-floral">{e.razao_social}</p>
                    <p className="font-data text-[11px] text-olive">{e.municipio}/{e.uf}</p>
                    <p className="mt-1 text-[12px] leading-snug text-bone">{porQue(e)}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-data text-[11px]">
                      {e.telefone && (
                        <a href={`tel:${e.telefone.replace(/\D/g, "")}`} className="text-floral transition-colors hover:underline">
                          ☎ {formatTelefone(e.telefone)}
                        </a>
                      )}
                      {e.email && (
                        <a href={`mailto:${e.email}`} className="text-bone transition-colors hover:text-floral">
                          ✉ {e.email}
                        </a>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => salvar(e.id)}
                    disabled={salvo}
                    className={`shrink-0 rounded border px-2 py-1 font-data text-[11px] uppercase tracking-wider transition-colors ${
                      salvo ? "border-hairline text-olive" : "border-hairline text-bone hover:border-floral/40 hover:text-floral"
                    }`}
                  >
                    {salvo ? "✓ salvo" : "+ pipeline"}
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </main>
    </div>
  );
}
