"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import type { Empresa, Oportunidade } from "@/lib/types";
import { storeEmpresa, storeOrigin } from "@/lib/empresa-store";
import {
  COL, atrasou, diasDesde, formatTelefone, mudancaDe, socioMain, ultimoToqueEm,
} from "./helpers";
import { EstagioChip, ResultadoChip } from "./EstagioChips";
import { ProvenienciaBlock } from "./ProvenienciaBlock";
import { LogAtividade } from "./LogAtividade";

export function SortableRow({
  o,
  onPatch,
  onRemove,
  scoreOverride,
  context = "stage",
}: {
  o: Oportunidade;
  onPatch: (id: string, campos: Partial<Oportunidade>) => void;
  onRemove: (id: string) => void;
  scoreOverride?: number;
  context?: "stage" | "agenda";
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: o.id });

  return (
    <Row
      o={o}
      onPatch={onPatch}
      onRemove={onRemove}
      scoreOverride={scoreOverride}
      context={context}
      nodeRef={setNodeRef}
      dragHandle={{ ...listeners, ...attributes }}
      isDragging={isDragging}
      dragStyle={{
        transform: transform
          ? `translate3d(0px, ${Math.round(transform.y)}px, 0)`
          : undefined,
        transition: transition ?? undefined,
      }}
    />
  );
}

export function Row({
  o,
  onPatch,
  onRemove,
  scoreOverride,
  context = "stage",
  nodeRef,
  dragHandle,
  isDragging,
  dragStyle,
}: {
  o: Oportunidade;
  onPatch: (id: string, campos: Partial<Oportunidade>) => void;
  onRemove: (id: string) => void;
  scoreOverride?: number;
  context?: "stage" | "agenda";
  nodeRef?: React.Ref<HTMLLIElement>;
  dragHandle?: React.HTMLAttributes<HTMLElement>;
  isDragging?: boolean;
  dragStyle?: React.CSSProperties;
}) {
  const [expanded, setExpanded] = useState(false);
  const atrasada = atrasou(o);
  const mudanca = mudancaDe(o.empresa.cnpj);
  const score = scoreOverride ?? o.score_no_save;
  const investigado = scoreOverride != null;
  const isEntregue = o.estagio === "entregue";
  const hasNota = o.notas != null && o.notas.trim() !== "";
  const socio = socioMain(o.empresa.socio);
  const ultimoToque = ultimoToqueEm(o.interacoes);
  const diasSemToque = ultimoToque ? diasDesde(ultimoToque) : diasDesde(o.created_at);
  const toqueAtrasado = diasSemToque > 21;

  function abrirEmpresa() {
    const emp = { ...o.empresa } as unknown as Empresa;
    if (emp.score == null && score != null) {
      emp.score = { score, sinais: [], perfil_sucessorio: false } as unknown as Empresa["score"];
    }
    storeEmpresa(emp);
    storeOrigin("pipeline");
  }

  return (
    <li
      ref={nodeRef}
      style={dragStyle}
      className={`rounded-lg border bg-surface transition-colors ${
        isDragging ? "relative z-10 opacity-50 shadow-lg shadow-black/40" : ""
      } ${mudanca ? "border-risk-high/40" : "border-hairline"}`}
    >
      {/* Main grid row */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={(e) => {
          const interactive = (e.target as HTMLElement).closest(
            "a, button, input, textarea, [data-radix-select-trigger]"
          );
          if (!interactive) setExpanded((v) => !v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            const interactive = (e.target as HTMLElement).closest(
              "a, button, input, textarea"
            );
            if (!interactive) { e.preventDefault(); setExpanded((v) => !v); }
          }
        }}
        className="group grid cursor-pointer items-center gap-x-4 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50"
        style={{ gridTemplateColumns: COL }}
      >
        {/* Col 0: Drag handle */}
        <div
          {...(dragHandle ?? {})}
          className={`flex touch-none items-center justify-center focus-visible:outline-none ${
            dragHandle
              ? "cursor-grab transition-opacity opacity-25 group-hover:opacity-50 hover:opacity-90 active:cursor-grabbing"
              : "pointer-events-none opacity-0"
          }`}
          aria-hidden={!dragHandle}
          onClick={(e) => e.stopPropagation()}
        >
          <svg viewBox="0 0 6 10" className="h-2.5 w-1.5 text-ink-soft" fill="currentColor">
            <circle cx="1.5" cy="1.5" r="1" />
            <circle cx="4.5" cy="1.5" r="1" />
            <circle cx="1.5" cy="5" r="1" />
            <circle cx="4.5" cy="5" r="1" />
            <circle cx="1.5" cy="8.5" r="1" />
            <circle cx="4.5" cy="8.5" r="1" />
          </svg>
        </div>

        {/* Col 1: Score */}
        <div className="flex items-center gap-1.5">
          {mudanca && (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-risk-high"
              title="Mudança societária detectada"
            />
          )}
          {score != null ? (
            <span
              className={`rounded border px-1.5 font-data text-[11px] tabular-nums font-medium ${
                score >= 80
                  ? "border-risk-high/40 text-risk-high"
                  : score >= 60
                  ? "border-risk-mid/40 text-risk-mid"
                  : "border-hairline text-ink-soft"
              }`}
              title={investigado ? "score atualizado pós-investigação" : "score previsto quando salvou"}
            >
              {score}
            </span>
          ) : (
            <span className="rounded border border-hairline px-1.5 font-data text-[11px] text-ink-muted">
              --
            </span>
          )}
        </div>

        {/* Col 2: Empresa */}
        <div className="min-w-0">
          <span className="flex min-w-0 items-center gap-1.5">
            <Link
              href={`/empresa/${o.empresa.id}`}
              onClick={(e) => { e.stopPropagation(); abrirEmpresa(); }}
              className="block truncate text-sm font-medium leading-snug text-ink transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50 rounded-sm"
            >
              {o.empresa.razao_social}
            </Link>
            {o.selado_em && (
              <span
                className={`shrink-0 rounded border px-1 text-[10px] font-medium ${
                  o.novo_para_setter === true
                    ? "border-ink/40 text-ink"
                    : "border-hairline text-ink-muted"
                }`}
                title={
                  o.novo_para_setter == null
                    ? "Selo emitido · CRM do parceiro não verificado"
                    : o.novo_para_setter
                    ? "Selo emitido · novo pro CRM do parceiro"
                    : "Selo emitido · já constava no CRM do parceiro"
                }
              >
                selo
              </span>
            )}
          </span>
          <p className="truncate text-[11px] text-ink-muted">
            {o.empresa.municipio}/{o.empresa.uf}
            {o.empresa.cnae_principal_desc ? ` · ${o.empresa.cnae_principal_desc}` : ""}
          </p>
          {socio && (
            <p className="truncate text-[11px] text-ink-muted">{socio.nome}</p>
          )}
        </div>

        {/* Col 3: Dono + Estágio / Resultado */}
        <div className="min-w-0 space-y-0.5 px-2" onClick={(e) => e.stopPropagation()}>
          <input
            defaultValue={o.dono ?? ""}
            onBlur={(e) => {
              if (e.target.value !== (o.dono ?? "")) onPatch(o.id, { dono: e.target.value });
            }}
            placeholder="sem dono"
            className="w-full bg-transparent pl-2.5 text-left text-[12px] text-ink-soft outline-none placeholder:text-ink-muted"
          />
          {isEntregue ? (
            <ResultadoChip o={o} onPatch={onPatch} />
          ) : (
            <EstagioChip o={o} onPatch={onPatch} />
          )}
        </div>

        {/* Col 4: Próxima ação + data */}
        <div className="min-w-0 space-y-0.5" onClick={(e) => e.stopPropagation()}>
          {!isEntregue && (
            <>
              <input
                defaultValue={o.proxima_acao ?? ""}
                onBlur={(e) => {
                  if (e.target.value !== (o.proxima_acao ?? ""))
                    onPatch(o.id, { proxima_acao: e.target.value });
                }}
                placeholder="próxima ação…"
                className="w-full bg-transparent text-[12px] text-ink-soft outline-none placeholder:text-ink-muted"
              />
              <DateInput
                defaultValue={o.proxima_acao_em ?? ""}
                onChange={(v) => onPatch(o.id, { proxima_acao_em: v })}
                atrasada={atrasada}
              />
            </>
          )}
        </div>

        {/* Col 5: Contato */}
        <div className="min-w-0 space-y-0.5" onClick={(e) => e.stopPropagation()}>
          {o.empresa.telefone ? (
            <a
              href={`tel:${o.empresa.telefone.replace(/\D/g, "")}`}
              className="block truncate rounded-sm font-data text-[11px] text-ink transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50"
            >
              {formatTelefone(o.empresa.telefone)}
            </a>
          ) : null}
          {o.empresa.email ? (
            <a
              href={`mailto:${o.empresa.email}`}
              className="block truncate rounded-sm font-data text-[11px] text-ink transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50"
            >
              {o.empresa.email}
            </a>
          ) : null}
          {!o.empresa.telefone && !o.empresa.email && (
            <span className="text-[11px] text-ink-muted">sem contato</span>
          )}
          {/* Indicador de último contato */}
          <p className={`font-data text-[10px] ${toqueAtrasado ? "text-risk-mid" : "text-ink-muted"}`}>
            {ultimoToque
              ? `contato ${diasDesde(ultimoToque)}d atrás`
              : `sem contato · ${diasSemToque}d`}
          </p>
        </div>

        {/* Col 6: Nota indicator */}
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
          className={`justify-self-start flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50 ${
            hasNota
              ? "border-hairline text-ink-soft hover:border-hairline-hover hover:text-ink"
              : "border-hairline/60 text-ink-muted hover:border-hairline hover:text-ink-soft"
          }`}
        >
          {hasNota && (
            <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-ink-soft/70" />
          )}
          <span>{hasNota ? "notas" : "+ nota"}</span>
        </button>

        {/* Col 7: Remove */}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(o.id); }}
          title="remover do pipeline"
          className="text-[12px] text-ink-muted transition-colors hover:text-risk-high focus-visible:outline-none"
        >
          ✕
        </button>
      </div>

      {/* Expanded: notas + (agenda) log de atividade */}
      {expanded && (
        <div className="border-t border-hairline px-3 pb-3 pt-2">
          {mudanca && (
            <p className="mb-2 text-[11px] font-medium text-risk-high">
              ⚠ Mudança societária: {mudanca.descricao}
            </p>
          )}
          <textarea
            defaultValue={o.notas ?? ""}
            onBlur={(e) => {
              if (e.target.value !== (o.notas ?? ""))
                onPatch(o.id, { notas: e.target.value });
            }}
            placeholder="anotações…"
            rows={2}
            className="w-full resize-none rounded border border-hairline bg-fill px-1.5 py-1 text-[12px] text-ink outline-none placeholder:text-ink-muted focus:border-hairline-hover"
          />
          <ProvenienciaBlock o={o} />
          {context === "agenda" && <LogAtividade oportunidadeId={o.id} />}
        </div>
      )}
    </li>
  );
}

// ── DateInput ─────────────────────────────────────────────────────────────────

function DateInput({
  defaultValue,
  onChange,
  atrasada,
}: {
  defaultValue: string;
  onChange: (v: string | null) => void;
  atrasada: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);

  function openPicker(e: React.MouseEvent) {
    e.stopPropagation();
    try { ref.current?.showPicker(); } catch {}
  }

  return (
    <div className="flex items-center gap-1">
      <input
        ref={ref}
        type="date"
        defaultValue={defaultValue}
        onChange={(e) => onChange(e.target.value || null)}
        title={atrasada ? "ação atrasada" : "data da próxima ação"}
        className={`bg-transparent font-data text-[10px] outline-none [&::-webkit-calendar-picker-indicator]:hidden ${
          atrasada ? "text-risk-high" : "text-ink-muted"
        }`}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={openPicker}
        title="Abrir calendário"
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors hover:bg-hairline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50 ${
          atrasada
            ? "text-risk-high/50 hover:text-risk-high"
            : "text-ink-soft hover:text-ink"
        }`}
      >
        <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
          <rect x="1" y="2.5" width="10" height="8.5" rx="1" />
          <path d="M4 1v3M8 1v3" />
          <path d="M1 5.5h10" />
        </svg>
      </button>
    </div>
  );
}
