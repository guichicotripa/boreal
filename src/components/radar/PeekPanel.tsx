"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { Empresa } from "@/lib/types";
import { scoreTier } from "@/lib/scoring";
import { TIER_STYLES, FAIXA_LABEL, formatCnpj, formatTelefone, formatCapitalCompact } from "@/lib/format";
import { storeEmpresa, storeOrigin, type ScoreConhecido } from "@/lib/empresa-store";
import { SalvarButton } from "./SalvarButton";
import { X, ArrowUpRight, Phone, Mail, EyeOff } from "lucide-react";

/* Peek panel — preview da empresa SEM sair da lista (padrão Attio).
   Clique na linha abre; Esc/X fecha; "Abrir empresa" navega pra página completa.
   Corta o ida-e-volta de navegação de quem tria dezenas de empresas. */

const BREAKDOWN_META: { key: "idade_socios" | "antiguidade_empresa" | "porte_relevancia" | "quadro_plural"; label: string; max: number }[] = [
  { key: "idade_socios", label: "Idade dos sócios", max: 30 },
  { key: "antiguidade_empresa", label: "Antiguidade", max: 30 },
  { key: "porte_relevancia", label: "Porte", max: 30 },
  { key: "quadro_plural", label: "Quadro plural", max: 10 },
];

export function PeekPanel({
  empresa: e,
  investigacao,
  jaSalvo,
  onClose,
  onDescartar,
}: {
  empresa: Empresa | null;
  investigacao?: ScoreConhecido;
  jaSalvo?: boolean;
  onClose: () => void;
  onDescartar: (e: Empresa) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!e) return;
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [e, onClose]);

  if (!e) return null;

  const score = investigacao?.score ?? e.score?.score ?? 0;
  const delta = investigacao?.delta ?? null;
  const t = TIER_STYLES[scoreTier(score)];
  const socios = e.socio ?? [];
  const anoFund = e.data_inicio_atividade ? e.data_inicio_atividade.slice(0, 4) : "—";
  const anosOp = e.data_inicio_atividade
    ? new Date().getFullYear() - Number(e.data_inicio_atividade.slice(0, 4))
    : null;

  return (
    <aside
      ref={panelRef}
      tabIndex={-1}
      role="complementary"
      aria-label={`Preview de ${e.razao_social}`}
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[440px] flex-col border-l border-hairline bg-overlay shadow-2xl shadow-black/60 outline-none"
    >
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-hairline p-4">
        <div className={`shrink-0 rounded border ${t.badge} px-2 py-1 text-center`}>
          <div className={`text-lg tabular-nums leading-none ${t.text}`}>{score}</div>
          <div className={`text-[10px] font-medium ${t.text} opacity-70`}>
            {t.label}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[17px] leading-tight text-ink">{e.razao_social}</h2>
          <p className="mt-0.5 text-[11px] tabular-nums text-ink-muted">
            {formatCnpj(e.cnpj)} · {e.municipio}/{e.uf}
          </p>
          {delta != null && (
            <p className="mt-0.5 text-[11px] text-ink-muted">
              investigada com IA: {delta > 0 ? `↑${delta}` : delta < 0 ? `↓${Math.abs(delta)}` : "sem ajuste"}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar preview"
          className="rounded-md p-1.5 text-ink-soft transition-colors hover:bg-surface-hover hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50"
        >
          <X aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>

      {/* Corpo scrollável */}
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        {e.insight?.one_liner && (
          <p className="font-display text-sm leading-relaxed text-ink">{e.insight.one_liner}</p>
        )}

        {/* Composição do score */}
        {e.score?.breakdown && (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[11px] font-medium text-ink-muted">
                Composição do score
              </h3>
              {e.score.perfil_sucessorio && (
                <span className="text-[11px] font-medium text-ink">● Perfil sucessório</span>
              )}
            </div>
            <ul className="space-y-1.5">
              {BREAKDOWN_META.map(({ key, label, max }) => {
                const v = e.score!.breakdown[key];
                return (
                  <li key={key} className="flex items-center gap-2">
                    <span className="w-32 shrink-0 text-[12px] text-ink-soft">{label}</span>
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-hairline">
                      <span className="block h-full bg-ink-soft/60" style={{ width: `${(v / max) * 100}%` }} />
                    </span>
                    <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-ink-soft">
                      {v}/{max}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Sinais */}
        {e.score?.sinais && e.score.sinais.length > 0 && (
          <section>
            <h3 className="mb-2 text-[11px] font-medium text-ink-muted">
              Sinais
            </h3>
            <ul className="space-y-1">
              {e.score.sinais.slice(0, 5).map((s) => (
                <li key={s} className="text-[12.5px] leading-relaxed text-ink-soft">
                  · {s}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Dados */}
        <section>
          <h3 className="mb-2 text-[11px] font-medium text-ink-muted">Dados</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            {[
              ["Porte", e.porte ?? "—"],
              ["Capital", formatCapitalCompact(e.capital_social) ?? "—"],
              ["Fundada", anosOp != null ? `${anoFund} · ${anosOp}a` : anoFund],
              ["Natureza", e.natureza_juridica ?? "—"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[10.5px] font-medium text-ink-muted">{k}</dt>
                <dd className="mt-0.5 text-[12.5px] tabular-nums text-ink-soft">{v}</dd>
              </div>
            ))}
          </dl>
          {e.cnae_principal_desc && (
            <p className="mt-2 text-[12px] leading-snug text-ink-muted">{e.cnae_principal_desc}</p>
          )}
        </section>

        {/* Sócios */}
        {socios.length > 0 && (
          <section>
            <h3 className="mb-2 text-[11px] font-medium text-ink-muted">
              Sócios ({socios.length})
            </h3>
            <ul className="space-y-1.5">
              {socios.slice(0, 6).map((s) => (
                <li key={s.id} className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-[12.5px] text-ink-soft">{s.nome}</span>
                  <span className="shrink-0 text-[11px] text-ink-muted">
                    {s.faixa_etaria && FAIXA_LABEL[s.faixa_etaria] ? FAIXA_LABEL[s.faixa_etaria] : "—"}
                  </span>
                </li>
              ))}
              {socios.length > 6 && (
                <li className="text-[11px] text-ink-muted">+{socios.length - 6} na página completa</li>
              )}
            </ul>
          </section>
        )}

        {/* Contato */}
        {(e.telefone || e.email) && (
          <section>
            <h3 className="mb-2 text-[11px] font-medium text-ink-muted">
              Contato
            </h3>
            <div className="flex flex-wrap gap-2">
              {e.telefone && (
                <a
                  href={`tel:${e.telefone.replace(/\D/g, "")}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-2.5 py-1.5 text-[11px] text-ink-soft transition-colors hover:border-hairline-hover hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50"
                >
                  <Phone aria-hidden="true" className="h-3 w-3" strokeWidth={1.75} />
                  {formatTelefone(e.telefone)}
                </a>
              )}
              {e.email && (
                <a
                  href={`mailto:${e.email}`}
                  className="inline-flex max-w-full items-center gap-1.5 truncate rounded-md border border-hairline px-2.5 py-1.5 text-[11px] text-ink-soft transition-colors hover:border-hairline-hover hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50"
                >
                  <Mail aria-hidden="true" className="h-3 w-3 shrink-0" strokeWidth={1.75} />
                  <span className="truncate">{e.email.toLowerCase()}</span>
                </a>
              )}
            </div>
          </section>
        )}
      </div>

      {/* Ações — footer fixo do painel */}
      <div className="flex items-center gap-2 border-t border-hairline p-4">
        <SalvarButton empresaId={e.id} jaSalvo={jaSalvo} variante="primario" />
        <Link
          href={`/empresa/${e.id}`}
          onClick={() => {
            storeEmpresa(e);
            storeOrigin("busca");
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-3.5 py-2 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-hairline-hover hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50"
        >
          Abrir empresa
          <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
        </Link>
        <button
          type="button"
          onClick={() => onDescartar(e)}
          title="Descartar — some do Radar"
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-hairline px-2.5 py-2 text-[12.5px] font-medium text-ink-muted transition-colors hover:border-hairline-hover hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50"
        >
          <EyeOff aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
          Descartar
        </button>
      </div>
    </aside>
  );
}
