"use client";

import { useEffect, useState } from "react";
import type { Oportunidade, EstagioOportunidade } from "@/lib/types";

const ESTAGIOS: { id: EstagioOportunidade; label: string; cor: string }[] = [
  { id: "a_analisar", label: "A analisar", cor: "text-zinc-300" },
  { id: "qualificada", label: "Qualificada", cor: "text-amber-300" },
  { id: "apresentada", label: "Apresentada à boutique", cor: "text-sky-300" },
  { id: "descartada", label: "Descartada", cor: "text-zinc-500" },
];

function formatCnpj(cnpj: string) {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export default function Pipeline() {
  const [ops, setOps] = useState<Oportunidade[]>([]);
  const [loading, setLoading] = useState(true);

  async function carregar() {
    setLoading(true);
    const r = await fetch("/api/oportunidade");
    const d = await r.json();
    setOps(d.oportunidades ?? []);
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function mover(id: string, estagio: EstagioOportunidade) {
    setOps((prev) => prev.map((o) => (o.id === id ? { ...o, estagio } : o))); // otimista
    await fetch("/api/oportunidade", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, estagio }),
    });
  }

  async function remover(id: string) {
    setOps((prev) => prev.filter((o) => o.id !== id));
    await fetch(`/api/oportunidade?id=${id}`, { method: "DELETE" });
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto max-w-6xl px-6 py-12">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Pipeline de originação</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Oportunidades curadas · {ops.length} no total
            </p>
          </div>
          <a href="/" className="text-sm text-zinc-400 transition-colors hover:text-white">
            ← Voltar à busca
          </a>
        </header>

        {loading ? (
          <p className="text-sm text-zinc-500">Carregando…</p>
        ) : ops.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Nenhuma oportunidade salva ainda. Volte à busca e clique em &ldquo;+ salvar&rdquo; numa empresa.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {ESTAGIOS.map((col) => {
              const lista = ops.filter((o) => o.estagio === col.id);
              return (
                <div key={col.id} className="flex flex-col gap-3">
                  <div className={`flex items-center justify-between text-xs font-medium uppercase tracking-wider ${col.cor}`}>
                    <span>{col.label}</span>
                    <span className="text-zinc-600">{lista.length}</span>
                  </div>
                  {lista.map((o) => (
                    <div key={o.id} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                      <h3 className="text-sm font-medium text-zinc-100">{o.empresa.razao_social}</h3>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {o.empresa.municipio} / {o.empresa.uf}
                      </p>
                      {o.empresa.cnae_principal_desc && (
                        <p className="mt-1 text-[11px] leading-snug text-zinc-500">
                          {o.empresa.cnae_principal_desc}
                        </p>
                      )}
                      {(o.empresa.telefone || o.empresa.email) && (
                        <p className="mt-1 text-[11px] text-emerald-500">
                          {o.empresa.telefone ?? o.empresa.email}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <select
                          value={o.estagio}
                          onChange={(e) => mover(o.id, e.target.value as EstagioOportunidade)}
                          className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-[11px] text-zinc-300 outline-none"
                        >
                          {ESTAGIOS.map((s) => (
                            <option key={s.id} value={s.id}>{s.label}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => remover(o.id)}
                          className="text-[11px] text-zinc-600 transition-colors hover:text-red-400"
                          title="remover do pipeline"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
