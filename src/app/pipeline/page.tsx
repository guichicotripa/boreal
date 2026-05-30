"use client";

import { useEffect, useState } from "react";
import type { Oportunidade, EstagioOportunidade, ResultadoOportunidade } from "@/lib/types";

const ESTAGIOS: { id: EstagioOportunidade; label: string; cor: string }[] = [
  { id: "a_analisar", label: "A analisar", cor: "text-floral" },
  { id: "qualificada", label: "Qualificada", cor: "text-risk-mid" },
  { id: "apresentada", label: "Apresentada à boutique", cor: "text-floral" },
  { id: "descartada", label: "Descartada", cor: "text-olive" },
];

const RESULTADOS: { id: ResultadoOportunidade; label: string }[] = [
  { id: "pendente", label: "Aguardando retorno" },
  { id: "receptivo", label: "Fundador receptivo" },
  { id: "nao_receptivo", label: "Não receptivo" },
  { id: "deal_fechado", label: "Deal fechado 🎉" },
  { id: "perdido", label: "Perdido" },
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

  async function atualizar(id: string, patch: Partial<Pick<Oportunidade, "resultado" | "notas">>) {
    setOps((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o))); // otimista
    await fetch("/api/oportunidade", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
  }

  async function remover(id: string) {
    setOps((prev) => prev.filter((o) => o.id !== id));
    await fetch(`/api/oportunidade?id=${id}`, { method: "DELETE" });
  }

  return (
    <div className="min-h-screen bg-smoky text-floral">
      <main className="mx-auto max-w-6xl px-6 py-12">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl tracking-tight">Pipeline de originação</h1>
            <p className="mt-1 text-sm text-bone">
              Oportunidades curadas · {ops.length} no total
            </p>
          </div>
          <a href="/" className="text-sm text-bone transition-colors hover:text-floral">
            ← Voltar à busca
          </a>
        </header>

        {loading ? (
          <p className="text-sm text-bone">Carregando…</p>
        ) : ops.length === 0 ? (
          <p className="text-sm text-bone">
            Nenhuma oportunidade salva ainda. Volte à busca e clique em &ldquo;+ salvar&rdquo; numa empresa.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {ESTAGIOS.map((col) => {
              const lista = ops.filter((o) => o.estagio === col.id);
              return (
                <div key={col.id} className="flex flex-col gap-3">
                  <div className={`flex items-center justify-between font-data text-[10px] font-medium uppercase tracking-wider ${col.cor}`}>
                    <span>{col.label}</span>
                    <span className="tabular-nums text-olive">{lista.length}</span>
                  </div>
                  {lista.map((o) => (
                    <div key={o.id} className="rounded-lg border border-hairline bg-surface p-3">
                      <h3 className="text-sm font-medium text-floral">{o.empresa.razao_social}</h3>
                      <p className="mt-0.5 text-xs text-bone">
                        {o.empresa.municipio} / {o.empresa.uf}
                      </p>
                      {o.empresa.cnae_principal_desc && (
                        <p className="mt-1 text-[11px] leading-snug text-bone">
                          {o.empresa.cnae_principal_desc}
                        </p>
                      )}
                      {(o.empresa.telefone || o.empresa.email) && (
                        <p className="mt-1 text-[11px] text-bone">
                          {o.empresa.telefone ?? o.empresa.email}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <select
                          value={o.estagio}
                          onChange={(e) => mover(o.id, e.target.value as EstagioOportunidade)}
                          className="flex-1 rounded border border-hairline bg-surface px-1.5 py-1 text-[11px] text-floral outline-none focus:border-hairline-hover"
                        >
                          {ESTAGIOS.map((s) => (
                            <option key={s.id} value={s.id}>{s.label}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => remover(o.id)}
                          className="text-[11px] text-olive transition-colors hover:text-risk-high"
                          title="remover do pipeline"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Resultado (ground truth) — só faz sentido após apresentar */}
                      {o.estagio === "apresentada" && (
                        <select
                          value={o.resultado}
                          onChange={(e) => atualizar(o.id, { resultado: e.target.value as ResultadoOportunidade })}
                          className={`mt-2 w-full rounded border px-1.5 py-1 text-[11px] outline-none ${
                            o.resultado === "deal_fechado"
                              ? "border-floral/30 bg-surface text-floral"
                              : o.resultado === "receptivo"
                                ? "border-hairline bg-surface text-floral"
                                : o.resultado === "nao_receptivo" || o.resultado === "perdido"
                                  ? "border-risk-high/30 bg-surface text-risk-high"
                                  : "border-hairline bg-surface text-bone"
                          }`}
                        >
                          {RESULTADOS.map((r) => (
                            <option key={r.id} value={r.id}>{r.label}</option>
                          ))}
                        </select>
                      )}

                      {/* Notas — registro do julgamento do analista */}
                      <textarea
                        defaultValue={o.notas ?? ""}
                        onBlur={(e) => {
                          if (e.target.value !== (o.notas ?? "")) atualizar(o.id, { notas: e.target.value });
                        }}
                        placeholder="anotações…"
                        rows={2}
                        className="mt-2 w-full resize-none rounded border border-hairline bg-surface px-1.5 py-1 text-[11px] text-floral outline-none placeholder:text-olive focus:border-hairline-hover"
                      />
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
