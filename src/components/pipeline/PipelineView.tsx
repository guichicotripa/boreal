"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { readScoresConhecidos, type ScoreConhecido } from "@/lib/empresa-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Oportunidade, EstagioOportunidade } from "@/lib/types";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { ESTAGIOS, atrasou, porPrioridade } from "./helpers";
import { PipelineSkeleton } from "./PipelineSkeleton";
import { TabButton } from "./TabButton";
import { ColHeader, type ScoreSort } from "./ColHeader";
import { Dashboard } from "./Dashboard";
import { SortableRow } from "./Row";

/* Orquestração do pipeline: estado, fetch, filtros/sort, undo/toast e layout.
   As peças visuais (Row, Dashboard, ColHeader, chips, log, selo) vivem em
   arquivos próprios nesta pasta. */

type ActiveTab = "agenda" | EstagioOportunidade;
type UndoAction =
  | { type: "patch"; id: string; previousCampos: Partial<Oportunidade> }
  | { type: "remove"; oportunidade: Oportunidade };

// `modo` — "pipeline": funil completo com tabs de estágio + dashboard.
//          "agenda": rota /agenda — só a fila do dia (atrasadas → data → score).
export function PipelineView({ modo = "pipeline" }: { modo?: "pipeline" | "agenda" }) {
  const [ops, setOps] = useState<Oportunidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>(modo === "agenda" ? "agenda" : "identificado");
  const [dashboardCollapsed, setDashboardCollapsed] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroDono, setFiltroDono] = useState("todos");
  const [soAtrasadas, setSoAtrasadas] = useState(false);
  const [scoreOverrides, setScoreOverrides] = useState<Record<string, ScoreConhecido>>({});

  // Sorting
  const [scoreSort, setScoreSort] = useState<ScoreSort>(null);
  const [donoSort, setDonoSort] = useState(false);
  const [acaoSort, setAcaoSort] = useState<ScoreSort>(null);

  // Undo (single-level) — ref evita stale closure no keydown handler
  const lastActionRef = useRef<UndoAction | null>(null);

  // Toast de feedback
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  }

  // Custom drag order per stage — persisted to localStorage
  const [customOrder, setCustomOrder] = useState<Record<string, string[]>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem("pipeline-order") ?? "{}"); }
    catch { return {}; }
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useEffect(() => {
    let ativo = true;
    (async () => {
      const r = await fetch("/api/oportunidade");
      const d = await r.json();
      if (!ativo) return;
      setOps(d.oportunidades ?? []);
      setLoading(false);
    })();
    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    const refresh = () => setScoreOverrides(readScoresConhecidos());
    refresh();
    window.addEventListener("pageshow", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  // Aplica patch sem registrar undo (usado internamente pelo undo).
  async function patchSilente(id: string, campos: Partial<Oportunidade>) {
    setOps((prev) => prev.map((o) => (o.id === id ? { ...o, ...campos } : o)));
    await fetch("/api/oportunidade", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...campos }),
    });
  }

  async function patch(id: string, campos: Partial<Oportunidade>) {
    const prev = ops.find((o) => o.id === id);
    if (prev) {
      const previousCampos = Object.fromEntries(
        Object.keys(campos).map((k) => [k, prev[k as keyof Oportunidade]])
      ) as Partial<Oportunidade>;
      lastActionRef.current = { type: "patch", id, previousCampos };
    }
    await patchSilente(id, campos);
  }

  async function remover(id: string) {
    const op = ops.find((o) => o.id === id);
    if (op) {
      lastActionRef.current = { type: "remove", oportunidade: op };
      showToast(`${op.empresa.razao_social} removida · Ctrl+Z desfaz`);
    }
    setOps((prev) => prev.filter((o) => o.id !== id));
    await fetch(`/api/oportunidade?id=${id}`, { method: "DELETE" });
  }

  async function undoRemove(op: Oportunidade) {
    setOps((prev) => [op, ...prev]);
    try {
      const r = await fetch("/api/oportunidade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId: op.empresa.id }),
      });
      const d = await r.json();
      const newId: string | undefined = d.oportunidade?.id;
      if (newId) {
        await fetch("/api/oportunidade", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: newId,
            estagio: op.estagio,
            resultado: op.resultado,
            ...(op.notas != null   && { notas: op.notas }),
            ...(op.dono != null    && { dono: op.dono }),
            ...(op.proxima_acao != null    && { proxima_acao: op.proxima_acao }),
            ...(op.proxima_acao_em != null && { proxima_acao_em: op.proxima_acao_em }),
          }),
        });
        setOps((prev) => prev.map((o) => o.id === op.id ? { ...o, id: newId } : o));
      }
    } catch { /* falha silenciosa — restauração local já aplicada */ }
  }

  function performUndo() {
    const action = lastActionRef.current;
    if (!action) return;
    lastActionRef.current = null;
    setToast(null);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    if (action.type === "patch") patchSilente(action.id, action.previousCampos);
    else undoRemove(action.oportunidade);
  }

  const donos = Array.from(
    new Set(ops.map((o) => o.dono).filter((d): d is string => !!d))
  ).sort();

  const q = busca.trim().toLowerCase();
  const filtradas = ops.filter((o) => {
    if (soAtrasadas && !atrasou(o)) return false;
    if (filtroDono !== "todos" && (o.dono ?? "") !== filtroDono) return false;
    if (q) {
      const hay = `${o.empresa.razao_social} ${o.empresa.municipio ?? ""} ${o.empresa.cnae_principal_desc ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const filtroAtivo = soAtrasadas || filtroDono !== "todos" || q !== "";

  const agendaList = filtradas
    .filter((o) => o.proxima_acao_em != null || (o.proxima_acao != null && o.proxima_acao.trim() !== ""))
    .sort(porPrioridade);

  function tabList(tab: ActiveTab): Oportunidade[] {
    let base: Oportunidade[];

    const sourceList = tab === "agenda"
      ? agendaList
      : filtradas.filter((o) => o.estagio === tab);

    if (!scoreSort && !donoSort) {
      const order = customOrder[tab];
      if (order?.length) {
        const map = new Map(order.map((id, i) => [id, i]));
        base = [...sourceList].sort((a, b) => (map.get(a.id) ?? 9999) - (map.get(b.id) ?? 9999));
      } else {
        base = tab === "agenda" ? sourceList : [...sourceList].sort(porPrioridade);
      }
    } else {
      base = sourceList;
    }

    if (scoreSort) {
      // Ordena pelo MESMO score que a linha exibe (Row: scoreOverride ?? score_no_save),
      // senão empresa investigada mostra 81 mas ordena como 100.
      const scoreDe = (o: Oportunidade) =>
        scoreOverrides[o.empresa.id]?.score ?? o.score_no_save ?? -1;
      return [...base].sort((a, b) => {
        const aS = scoreDe(a), bS = scoreDe(b);
        return scoreSort === "asc" ? aS - bS : bS - aS;
      });
    }
    if (donoSort) {
      return [...base].sort((a, b) => (a.dono ?? "").localeCompare(b.dono ?? ""));
    }
    if (acaoSort) {
      return [...base].sort((a, b) => {
        const aD = a.proxima_acao_em ?? "9999-99-99";
        const bD = b.proxima_acao_em ?? "9999-99-99";
        return acaoSort === "asc" ? aD.localeCompare(bD) : bD.localeCompare(aD);
      });
    }
    return base;
  }

  const currentList = tabList(activeTab);
  const isAgenda = activeTab === "agenda";
  const isEntregue = activeTab === "entregue";

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const tab: string = activeTab;
    // `currentList` já reflete o sort ativo (se houver). Arrastar congela essa
    // ordem visível como baseline manual e aplica o move por cima.
    const ids = currentList.map((o) => o.id);
    const oldIdx = ids.indexOf(String(active.id));
    const newIdx = ids.indexOf(String(over.id));
    if (oldIdx === -1 || newIdx === -1) return;
    const newOrder = arrayMove(ids, oldIdx, newIdx);
    const next = { ...customOrder, [tab]: newOrder };
    setCustomOrder(next);
    try { localStorage.setItem("pipeline-order", JSON.stringify(next)); } catch {}
    // Desfaz a imposição do sort: a ordem passa a ser filtro + mudança do usuário.
    if (scoreSort || donoSort || acaoSort) {
      setScoreSort(null);
      setDonoSort(false);
      setAcaoSort(null);
    }
  }

  // Atalhos de teclado: setas navegam abas, Ctrl+Z desfaz
  useEffect(() => {
    const ALL_TABS: ActiveTab[] = ["agenda", ...ESTAGIOS.map((s) => s.id)];

    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const inInput = !!target.closest("input, textarea, select");

      if (!inInput && modo !== "agenda") {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          const idx = ALL_TABS.indexOf(activeTab);
          if (e.key === "ArrowLeft"  && idx > 0)                    setActiveTab(ALL_TABS[idx - 1]);
          if (e.key === "ArrowRight" && idx < ALL_TABS.length - 1)  setActiveTab(ALL_TABS[idx + 1]);
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        if (lastActionRef.current) { e.preventDefault(); performUndo(); }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, modo]);

  // Limpa timer do toast ao desmontar
  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  function handleScoreSort() {
    setScoreSort((s) => s === null ? "asc" : s === "asc" ? "desc" : null);
    setDonoSort(false);
    setAcaoSort(null);
  }
  function handleDonoSort() {
    setDonoSort((v) => !v);
    setScoreSort(null);
    setAcaoSort(null);
  }
  function handleAcaoSort() {
    setAcaoSort((s) => s === null ? "asc" : s === "asc" ? "desc" : null);
    setScoreSort(null);
    setDonoSort(false);
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <main className="mx-auto max-w-6xl px-6 py-8">

        {/* Header */}
        <header className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl tracking-tight">
              {modo === "agenda" ? "Agenda" : "Pipeline de originação"}
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              {modo === "agenda"
                ? `${agendaList.length} ${agendaList.length === 1 ? "ação" : "ações"} na fila · atrasadas primeiro`
                : `${filtroAtivo ? `${filtradas.length} de ${ops.length}` : ops.length} oportunidades no funil`}
            </p>
          </div>
          <Link
            href="/"
            className="group flex items-center gap-2 rounded-sm text-[12px] font-medium text-ink transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50"
          >
            <span className="transition-transform duration-200 group-hover:-translate-x-1">←</span>
            <span>Voltar à busca</span>
          </Link>
        </header>

        {loading ? (
          <PipelineSkeleton />
        ) : ops.length === 0 ? (
          <div className="rounded-lg border border-hairline py-14 text-center">
            <p className="font-display text-lg text-ink">
              {modo === "agenda" ? "Nada na fila ainda." : "Pipeline vazio."}
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
              Busque uma tese no Radar e salve as empresas boas — elas entram aqui como oportunidades.
            </p>
            <Link
              href="/"
              className="mt-5 inline-block rounded-lg bg-ink px-4 py-2.5 text-[13px] font-medium text-canvas transition-colors hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/50"
            >
              Ir pro Radar
            </Link>
          </div>
        ) : (
          <>
            {/* Dashboard — collapsível (só no funil; a agenda é fila de execução) */}
            {modo !== "agenda" && (
            <Dashboard
              ops={ops}
              collapsed={dashboardCollapsed}
              onToggle={() => setDashboardCollapsed((v) => !v)}
            />
            )}

            {/* Tab nav — só no funil; /agenda É a aba agenda, sem navegação de estágios */}
            {modo !== "agenda" && (
            <nav
              role="tablist"
              aria-label="Estágios do pipeline"
              className="flex overflow-x-auto border-b border-hairline"
              style={{ scrollbarWidth: "none" }}
            >
              <TabButton
                label="Agenda"
                count={agendaList.length}
                active={isAgenda}
                onClick={() => setActiveTab("agenda")}
                icon={
                  <svg
                    viewBox="0 0 14 14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    className="h-3 w-3 -translate-y-px"
                    aria-hidden
                  >
                    <rect x="1.75" y="2.75" width="10.5" height="9.5" rx="1.5" />
                    <path d="M1.75 5.5 H12.25" />
                    <path d="M4.5 1.25 V3.5 M9.5 1.25 V3.5" />
                  </svg>
                }
              />
              <span className="mx-3 h-4 self-center border-r border-hairline" aria-hidden />
              {ESTAGIOS.map((s) => (
                <TabButton
                  key={s.id}
                  label={s.label}
                  count={filtradas.filter((o) => o.estagio === s.id).length}
                  active={activeTab === s.id}
                  onClick={() => setActiveTab(s.id)}
                />
              ))}
            </nav>
            )}

            {/* Filter bar */}
            <div className="my-3 flex flex-wrap items-center gap-2">
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="buscar empresa, cidade, setor…"
                className="w-56 rounded border border-hairline bg-surface px-2 py-1.5 text-xs text-ink outline-none placeholder:text-ink-muted focus:border-hairline-hover"
              />
              {/* Filtro dono — Radix Select para manter o dark theme */}
              <Select value={filtroDono} onValueChange={(v) => setFiltroDono(v ?? "todos")}>
                <SelectTrigger className="h-auto w-40 rounded border border-hairline bg-surface px-2 py-1.5 font-sans text-xs text-ink outline-none focus:ring-0 focus-visible:ring-1 focus-visible:ring-ink/50 focus:border-hairline-hover [&>svg]:opacity-40 [&>svg]:h-3 [&>svg]:w-3">
                  <SelectValue>
                    {filtroDono === "todos" ? "Todos os donos" : filtroDono}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent sideOffset={4} className="border-hairline bg-overlay text-ink">
                  <SelectItem value="todos" className="text-[11px] text-ink focus:bg-surface-hover focus:text-ink">
                    Todos os donos
                  </SelectItem>
                  {donos.map((d) => (
                    <SelectItem key={d} value={d} className="text-[11px] text-ink focus:bg-surface-hover focus:text-ink">
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                onClick={() => setSoAtrasadas((v) => !v)}
                aria-pressed={soAtrasadas}
                className={`rounded border px-2 py-1.5 text-[11.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50 ${
                  soAtrasadas
                    ? "border-risk-high/50 text-risk-high"
                    : "border-hairline text-ink-soft hover:text-ink"
                }`}
              >
                Só atrasadas
              </button>
              {filtroAtivo && (
                <button
                  onClick={() => { setBusca(""); setFiltroDono("todos"); setSoAtrasadas(false); }}
                  className="rounded-sm text-[11.5px] font-medium text-ink-muted transition-colors hover:text-ink-soft focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50"
                >
                  limpar
                </button>
              )}
            </div>

            {/* Row list */}
            {currentList.length === 0 ? (
              <p className="mt-2 rounded border border-dashed border-hairline px-3 py-6 text-center text-[11px] text-ink-muted">
                {filtroAtivo
                  ? "Nenhuma empresa neste filtro."
                  : isAgenda
                  ? "Nenhuma ação planejada. Preencha o campo próxima ação em qualquer card."
                  : ESTAGIOS.find((s) => s.id === activeTab)?.emptyMsg ?? "Vazio."}
              </p>
            ) : (
              <>
                <ColHeader
                  isEntregue={isEntregue}
                  scoreSort={scoreSort}
                  onScoreSort={handleScoreSort}
                  donoSort={donoSort}
                  onDonoSort={handleDonoSort}
                  acaoSort={acaoSort}
                  onAcaoSort={handleAcaoSort}
                />
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={currentList.map((o) => o.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <ol className="flex flex-col gap-px" aria-live="polite">
                      {currentList.map((o) => (
                        <SortableRow
                          key={o.id}
                          o={o}
                          onPatch={patch}
                          onRemove={remover}
                          scoreOverride={scoreOverrides[o.empresa.id]?.score}
                          context={isAgenda ? "agenda" : "stage"}
                        />
                      ))}
                    </ol>
                  </SortableContext>
                </DndContext>
              </>
            )}
          </>
        )}
      </main>

      {/* Toast de feedback */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-lg border border-hairline bg-overlay px-4 py-2.5 shadow-lg shadow-black/40">
          <span className="whitespace-nowrap text-[12px] text-ink-soft">{toast}</span>
          <button
            onClick={performUndo}
            className="shrink-0 text-[11px] font-medium text-ink-muted transition-colors hover:text-ink focus-visible:outline-none"
          >
            Desfazer
          </button>
        </div>
      )}
    </div>
  );
}
