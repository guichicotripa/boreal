"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Empresa } from "@/lib/types";
import { scoreTier } from "@/lib/scoring";
import { TIER_STYLES, formatCapitalCompact } from "@/lib/format";
import { storeEmpresa, storeOrigin } from "@/lib/empresa-store";
import { RotateCcw, ArrowUpRight } from "lucide-react";

/* Tela das descartadas — a rede de segurança do descarte no Radar.
   O toast de desfazer dura 8s; passado isso, é aqui que se restaura.
   Também é o único lugar onde o `motivo` gravado no descarte aparece. */

type Descartada = {
  empresa_id: string;
  motivo: string | null;
  created_at: string;
  empresa: Empresa | null;
};

/* Nota do descarte, editável inline.
   Mora AQUI e não no momento do descarte de propósito: pedir o motivo no clique
   mataria a triagem de um toque, que é o ponto do descarte. Aqui é revisão, com
   tempo — e é o único sinal rotulado de NEGATIVO que o sistema coleta (o score
   hoje só aprende com o que é salvo).

   Salva no blur e no Enter. Reusa o POST /api/descarte, que é upsert idempotente:
   reescrever um descarte existente só atualiza o motivo. */
function CampoNota({
  empresaId,
  inicial,
  onSalvo,
}: {
  empresaId: string;
  inicial: string | null;
  onSalvo: (v: string | null) => void;
}) {
  const [valor, setValor] = useState(inicial ?? "");
  const [estado, setEstado] = useState<"idle" | "salvando" | "salvo" | "erro">("idle");
  // Último valor confirmado pelo servidor — evita salvar quando nada mudou.
  const confirmado = useRef(inicial ?? "");

  async function salvar() {
    const limpo = valor.trim();
    if (limpo === confirmado.current) {
      setEstado("idle");
      return;
    }
    setEstado("salvando");
    try {
      const r = await fetch("/api/descarte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId, motivo: limpo || null }),
      });
      if (!r.ok) throw new Error();
      confirmado.current = limpo;
      onSalvo(limpo || null);
      setEstado("salvo");
      window.setTimeout(() => setEstado((e) => (e === "salvo" ? "idle" : e)), 1600);
    } catch {
      setEstado("erro");
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        value={valor}
        onChange={(e) => {
          setValor(e.target.value);
          if (estado !== "idle") setEstado("idle");
        }}
        onBlur={salvar}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setValor(confirmado.current);
            e.currentTarget.blur();
          }
        }}
        placeholder="Por quê?"
        aria-label="Nota do descarte"
        className={`min-w-0 flex-1 rounded border bg-transparent px-1.5 py-1 text-[12px] text-ink-soft outline-none transition-colors placeholder:text-ink-faint focus:border-ink/30 focus:text-ink ${
          estado === "erro" ? "border-risk-high/50" : "border-transparent hover:border-hairline"
        }`}
      />
      {estado === "salvando" && (
        <span className="shrink-0 text-[10px] text-ink-faint">…</span>
      )}
      {estado === "salvo" && (
        <span className="shrink-0 text-[10px] text-ink-muted" role="status">
          salvo
        </span>
      )}
      {estado === "erro" && (
        <button
          type="button"
          onClick={salvar}
          className="shrink-0 rounded text-[10px] text-risk-high underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50"
        >
          repetir
        </button>
      )}
    </div>
  );
}

function quando(iso: string): string {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias === 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 30) return `${dias} dias atrás`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default function Descartadas() {
  const [itens, setItens] = useState<Descartada[] | null>(null);
  const [erro, setErro] = useState(false);
  const [restaurando, setRestaurando] = useState<Set<string>>(new Set());

  const carregar = useCallback(async () => {
    setErro(false);
    try {
      const r = await fetch("/api/descarte");
      if (!r.ok) throw new Error();
      const d = await r.json();
      setItens(d.descartadas ?? []);
    } catch {
      setErro(true);
      setItens([]);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function restaurar(id: string) {
    setRestaurando((s) => new Set(s).add(id));
    try {
      const r = await fetch("/api/descarte", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId: id }),
      });
      if (!r.ok) throw new Error();
      setItens((cur) => (cur ?? []).filter((i) => i.empresa_id !== id));
    } catch {
      // Falhou: solta o botão pra permitir nova tentativa (a linha continua na lista).
      setRestaurando((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Link
          href="/"
          className="group inline-flex items-center gap-2 rounded-sm text-[12px] font-medium text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50"
        >
          <span className="transition-transform duration-200 group-hover:-translate-x-0.5">←</span>
          Radar
        </Link>

        <h1 className="mt-3 font-display text-2xl leading-tight tracking-tight text-ink md:text-[28px]">
          Descartadas
        </h1>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-ink-soft">
          Empresas que você tirou do Radar. Elas não aparecem nas buscas enquanto estiverem aqui.
          Restaurar devolve a empresa à lista.
        </p>

        {itens === null && (
          <div className="mt-8 space-y-2" aria-busy="true">
            <div className="h-12 animate-pulse rounded-lg bg-surface-hover" />
            <div className="h-12 animate-pulse rounded-lg bg-surface-hover" />
          </div>
        )}

        {erro && (
          <div className="mt-8">
            <p className="text-[13px] text-ink-muted">Não foi possível carregar as descartadas.</p>
            <button
              type="button"
              onClick={carregar}
              className="mt-2 inline-flex items-center gap-2 rounded border border-hairline px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-hairline-hover hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50"
            >
              <span aria-hidden="true">↻</span> Tentar de novo
            </button>
          </div>
        )}

        {itens !== null && !erro && itens.length === 0 && (
          <div className="mt-8 rounded-lg border border-hairline py-14 text-center">
            <p className="font-display text-lg text-ink">Nada descartado.</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">
              Quando você descartar uma empresa no Radar, ela aparece aqui e pode ser restaurada.
            </p>
          </div>
        )}

        {itens !== null && itens.length > 0 && (
          <div className="mt-6 overflow-x-auto rounded-lg border border-hairline bg-surface">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr>
                  {["Empresa", "Score", "Descartada", "Motivo", ""].map((h) => (
                    <th
                      key={h}
                      className="bg-canvas px-3 py-2 text-[11px] font-medium text-ink-muted shadow-[inset_0_-1px_0_var(--color-hairline)]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {itens.map((d) => {
                  const e = d.empresa;
                  const score = e?.score?.score ?? 0;
                  const t = TIER_STYLES[scoreTier(score)];
                  const ocupado = restaurando.has(d.empresa_id);
                  return (
                    <tr key={d.empresa_id} className="border-b border-hairline last:border-b-0">
                      <td className="max-w-[320px] px-3 py-2.5">
                        {e ? (
                          <>
                            <Link
                              href={`/empresa/${e.id}`}
                              onClick={() => {
                                storeEmpresa(e);
                                storeOrigin("busca");
                              }}
                              className="block max-w-full truncate rounded-sm text-[13px] font-medium text-ink transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50"
                            >
                              {e.razao_social}
                            </Link>
                            <p className="truncate text-[11px] text-ink-muted">
                              {e.municipio}/{e.uf}
                              {e.cnae_principal_desc ? ` · ${e.cnae_principal_desc}` : ""}
                              {e.capital_social
                                ? ` · ${formatCapitalCompact(e.capital_social)}`
                                : ""}
                            </p>
                          </>
                        ) : (
                          // A empresa saiu da base (o FK é on delete cascade, então é raro).
                          <span className="text-[12px] text-ink-muted">
                            Empresa não encontrada na base
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {e ? (
                          <span className={`text-[13px] tabular-nums ${t.text}`}>{score}</span>
                        ) : (
                          <span className="text-[12px] text-ink-muted">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-[12px] tabular-nums text-ink-soft">
                        {quando(d.created_at)}
                      </td>
                      <td className="max-w-[220px] px-3 py-2.5">
                        <CampoNota
                          empresaId={d.empresa_id}
                          inicial={d.motivo}
                          onSalvo={(v) =>
                            setItens((cur) =>
                              (cur ?? []).map((i) =>
                                i.empresa_id === d.empresa_id ? { ...i, motivo: v } : i
                              )
                            )
                          }
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">
                        <span className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => restaurar(d.empresa_id)}
                            disabled={ocupado}
                            className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-2 py-1 text-[11px] font-medium text-ink-soft transition-colors hover:border-hairline-hover hover:text-ink disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50"
                          >
                            <RotateCcw aria-hidden="true" className="h-3 w-3" strokeWidth={1.75} />
                            {ocupado ? "Restaurando…" : "Restaurar"}
                          </button>
                          {e && (
                            <Link
                              href={`/empresa/${e.id}`}
                              onClick={() => {
                                storeEmpresa(e);
                                storeOrigin("busca");
                              }}
                              aria-label={`Abrir página de ${e.razao_social}`}
                              className="rounded-md border border-hairline p-1.5 text-ink-soft transition-colors hover:border-hairline-hover hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50"
                            >
                              <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
                            </Link>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="border-t border-hairline px-3 py-1.5 text-[11px] text-ink-muted">
              {itens.length} {itens.length === 1 ? "empresa descartada" : "empresas descartadas"}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
