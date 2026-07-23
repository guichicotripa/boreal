"use client";

import Link from "next/link";
import type { Empresa } from "@/lib/types";
import { scoreTier } from "@/lib/scoring";
import { TIER_STYLES, FAIXA_LABEL, formatCapitalCompact } from "@/lib/format";
import { storeEmpresa, storeOrigin, type ScoreConhecido } from "@/lib/empresa-store";
import { SalvarButton } from "./SalvarButton";
import { ArrowUpRight } from "lucide-react";

/* Tabela densa de resultados — a superfície padrão de triagem do Radar.
   Padrão Attio: linha ~40px, header sticky, hover com quick actions, clique
   na linha abre o peek panel (a navegação completa fica no ícone ↗ / no peek). */

function anoDe(data: string | null): string {
  return data ? data.slice(0, 4) : "—";
}

function faixaMax(e: Empresa): string | null {
  const faixas = (e.socio ?? [])
    .map((s) => Number(s.faixa_etaria))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 9);
  return faixas.length ? FAIXA_LABEL[String(Math.max(...faixas))] : null;
}

export function ResultsTable({
  empresas,
  scoreOverrides,
  savedIds,
  peekId,
  onPeek,
}: {
  empresas: Empresa[];
  scoreOverrides: Record<string, ScoreConhecido>;
  savedIds: Set<string>;
  peekId: string | null;
  onPeek: (e: Empresa) => void;
}) {
  // overflow-x só quando a tela é estreita: um scroll container mata o
  // position:sticky do header (ele gruda no container, não na página — era o
  // bug da 1ª linha coberta). Em xl+ o container fica visible e o header
  // gruda logo abaixo do topbar (top-14).
  return (
    <div className="overflow-x-auto rounded-lg border border-hairline bg-surface xl:overflow-x-visible">
      <table className="w-full min-w-[820px] border-collapse text-left">
        <thead>
          <tr>
            {["Empresa", "Score", "Perfil", "Porte", "Fundada", "Capital", "Sócio +", ""].map(
              (h, i) => (
                <th
                  key={i}
                  className={`z-10 bg-canvas px-3 py-2 text-[11px] font-medium text-ink-muted shadow-[inset_0_-1px_0_var(--color-hairline)] xl:sticky xl:top-14 ${
                    h === "Capital" ? "text-right" : ""
                  }`}
                >
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {empresas.map((e) => {
            const inv = scoreOverrides[e.id];
            const score = inv?.score ?? e.score?.score ?? 0;
            const delta = inv?.delta ?? null;
            const t = TIER_STYLES[scoreTier(score)];
            const socioTop = faixaMax(e);
            const aberta = peekId === e.id;
            return (
              <tr
                key={e.id}
                onClick={(ev) => {
                  if ((ev.target as HTMLElement).closest("a, button")) return;
                  if ((window.getSelection()?.toString().trim().length ?? 0) > 0) return;
                  onPeek(e);
                }}
                aria-selected={aberta}
                className={`group cursor-pointer border-b border-hairline last:border-b-0 transition-colors ${
                  aberta ? "bg-surface-hover" : "hover:bg-surface"
                }`}
              >
                {/* Empresa */}
                <td className="max-w-[300px] px-3 py-2">
                  <button
                    type="button"
                    onClick={() => onPeek(e)}
                    className="block max-w-full truncate text-left text-[13px] font-medium text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50 rounded-sm"
                  >
                    {e.razao_social}
                  </button>
                  <p className="truncate text-[11px] text-ink-muted">
                    {e.municipio}/{e.uf}
                    {e.cnae_principal_desc ? ` · ${e.cnae_principal_desc}` : ""}
                  </p>
                </td>
                {/* Score — número mono + mini-barra + delta de investigação */}
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className={`font-data text-[13px] tabular-nums ${t.text}`}>{score}</span>
                    <span className="h-1 w-9 overflow-hidden rounded-full bg-hairline">
                      <span className={`block h-full ${t.bar}`} style={{ width: `${score}%` }} />
                    </span>
                    {delta != null && (
                      <span
                        className={`font-data text-[10px] tabular-nums ${
                          delta > 0 ? "text-risk-high" : delta < 0 ? "text-ink-muted" : "text-ink-muted"
                        }`}
                        title="ajuste após investigação com IA"
                      >
                        {delta > 0 ? `↑${delta}` : delta < 0 ? `↓${Math.abs(delta)}` : "✓"}
                      </span>
                    )}
                  </div>
                </td>
                {/* Perfil sucessório — onde a lente vale (alta confiança) */}
                <td className="px-3 py-2">
                  {e.score?.perfil_sucessorio ? (
                    <span className="whitespace-nowrap text-[11px] font-medium text-ink">
                      ● Sucessório
                    </span>
                  ) : (
                    <span className="text-[11px] text-ink-muted">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-[12px] text-ink-soft">{e.porte ?? "—"}</td>
                <td className="whitespace-nowrap px-3 py-2 font-data text-[12px] tabular-nums text-ink-soft">
                  {anoDe(e.data_inicio_atividade)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-data text-[12px] tabular-nums text-ink-soft">
                  {formatCapitalCompact(e.capital_social) ?? "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-data text-[12px] text-ink-soft">
                  {socioTop ?? "—"}
                </td>
                {/* Ações — aparecem no hover (padrão quick actions) */}
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <span className="inline-flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    <SalvarButton empresaId={e.id} jaSalvo={savedIds.has(e.id)} />
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
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex items-center justify-between border-t border-hairline px-3 py-1.5 text-[11px] text-ink-muted">
        <span>{empresas.length} {empresas.length === 1 ? "empresa" : "empresas"}</span>
        <span className="hidden font-data text-[10px] md:inline" aria-hidden="true">
          j/k navega · ⏎ abre
        </span>
      </div>
    </div>
  );
}
