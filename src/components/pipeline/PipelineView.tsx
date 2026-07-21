"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { storeEmpresa, storeOrigin, readScoresConhecidos, type ScoreConhecido } from "@/lib/empresa-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  Empresa, Oportunidade, EstagioOportunidade, ResultadoOportunidade, Interacao, TipoInteracao,
} from "@/lib/types";
import monitor from "@/lib/monitor.json";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";

// ── helpers ───────────────────────────────────────────────────────────────────

function formatTelefone(tel: string) {
  const d = tel.replace(/\D/g, "");
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  return tel;
}

function dataCurta(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function diasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

// Sócio mais velho (maior faixa_etaria) — geralmente o fundador/decisor.
function socioMain(socios?: { nome: string; faixa_etaria?: string | null }[]) {
  if (!socios?.length) return null;
  return [...socios].sort(
    (a, b) => Number(b.faixa_etaria ?? 0) - Number(a.faixa_etaria ?? 0)
  )[0];
}

// Data ISO mais recente num array de { criado_em }.
function ultimoToqueEm(interacoes?: { criado_em: string }[]): string | null {
  if (!interacoes?.length) return null;
  return interacoes.reduce((max, i) => (i.criado_em > max ? i.criado_em : max), "");
}

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function atrasou(o: Oportunidade) {
  return o.proxima_acao_em != null && o.proxima_acao_em < hoje();
}

// Prioridade: atrasadas primeiro → data mais cedo → maior score.
function porPrioridade(a: Oportunidade, b: Oportunidade) {
  const aA = atrasou(a) ? 0 : 1;
  const bA = atrasou(b) ? 0 : 1;
  if (aA !== bA) return aA - bA;
  const ad = a.proxima_acao_em ?? "9999-99-99";
  const bd = b.proxima_acao_em ?? "9999-99-99";
  if (ad !== bd) return ad < bd ? -1 : 1;
  return (b.score_no_save ?? -1) - (a.score_no_save ?? -1);
}

// ── constants ─────────────────────────────────────────────────────────────────

type Mudanca = { tipo: string; severidade: string; descricao: string };
const MUDANCAS = monitor.mudancas as Record<string, Mudanca>;
function mudancaDe(cnpj: string): Mudanca | null {
  return MUDANCAS[cnpj.slice(0, 8)] ?? null;
}

const TIPOS_INTERACAO: { id: TipoInteracao; label: string }[] = [
  { id: "ligacao",  label: "Ligação"  },
  { id: "email",    label: "Email"    },
  { id: "reuniao",  label: "Reunião"  },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "nota",     label: "Nota"     },
];

const ESTAGIOS: { id: EstagioOportunidade; label: string; emptyMsg: string }[] = [
  { id: "identificado", label: "Identificado", emptyMsg: "Salve empresas da busca para começar."  },
  { id: "abordado",     label: "Abordado",     emptyMsg: "Ninguém abordado ainda."               },
  { id: "em_conversa",  label: "Em conversa",  emptyMsg: "Sem conversas em curso."               },
  { id: "qualificado",  label: "Qualificado",  emptyMsg: "Nenhuma qualificada ainda."            },
  { id: "entregue",     label: "Entregue",     emptyMsg: "Nada entregue à boutique."             },
  { id: "arquivado",    label: "Arquivado",    emptyMsg: "Nada arquivado."                       },
];

const RESULTADOS: { id: ResultadoOportunidade; label: string }[] = [
  { id: "pendente",      label: "Aguardando retorno" },
  { id: "receptivo",     label: "Fundador receptivo" },
  { id: "nao_receptivo", label: "Não receptivo"      },
  { id: "deal_fechado",  label: "Deal fechado 🎉"    },
  { id: "perdido",       label: "Perdido"            },
];

// 14px grip | 48px score | 1fr empresa | 144px dono+estagio | 128px proxima acao | 175px contato | 92px notas | 28px remove
// Notas é FIXA (92px), não `auto`: como `auto` mede o conteúdo (texto curto no header, botão largo nas linhas),
// ela roubava largura da 1fr e desalinhava todas as colunas após Empresa entre header e linhas.
const COL = "14px 48px 1fr 144px 128px 175px 92px 28px";

type ActiveTab = "agenda" | EstagioOportunidade;
type ScoreSort = "asc" | "desc" | null;
type UndoAction =
  | { type: "patch"; id: string; previousCampos: Partial<Oportunidade> }
  | { type: "remove"; oportunidade: Oportunidade };

// ── PipelineSkeleton ──────────────────────────────────────────────────────────

// Loading = skeleton da estrutura real (não spinner/texto), conforme brand guide.
// Os blocos usam a família de superfícies em alpha; o pulse respeita prefers-reduced-motion.
function PipelineSkeleton() {
  return (
    <div className="animate-pulse" role="status" aria-label="Carregando pipeline">
      {/* stats strip */}
      <div className="mb-6 h-[104px] rounded-xl border border-hairline bg-surface" />
      {/* tab nav */}
      <div className="flex gap-6 border-b border-hairline pb-2.5">
        {[60, 92, 104, 96, 84, 88].map((w, i) => (
          <div key={i} className="h-3 rounded bg-hairline" style={{ width: w }} />
        ))}
      </div>
      {/* filter bar */}
      <div className="my-3 flex gap-2">
        <div className="h-8 w-56 rounded bg-hairline" />
        <div className="h-8 w-40 rounded bg-hairline" />
        <div className="h-8 w-28 rounded bg-hairline" />
      </div>
      {/* rows */}
      <div className="flex flex-col gap-px">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[60px] rounded-lg border border-hairline bg-surface" />
        ))}
      </div>
    </div>
  );
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

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
    <div className="min-h-screen bg-smoky text-floral">
      <main className="mx-auto max-w-6xl px-6 py-8">

        {/* Header */}
        <header className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl tracking-tight">
              {modo === "agenda" ? "Agenda" : "Pipeline de originação"}
            </h1>
            <p className="mt-1 text-sm text-bone">
              {modo === "agenda"
                ? `${agendaList.length} ${agendaList.length === 1 ? "ação" : "ações"} na fila · atrasadas primeiro`
                : `${filtroAtivo ? `${filtradas.length} de ${ops.length}` : ops.length} oportunidades no funil`}
            </p>
          </div>
          <Link
            href="/"
            className="group flex items-center gap-2 rounded-sm font-data text-[11px] uppercase tracking-wider text-floral transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50"
          >
            <span className="transition-transform duration-200 group-hover:-translate-x-1">←</span>
            <span>Voltar à busca</span>
          </Link>
        </header>

        {loading ? (
          <PipelineSkeleton />
        ) : ops.length === 0 ? (
          <div className="rounded-lg border border-hairline py-14 text-center">
            <p className="font-display text-lg text-floral">
              {modo === "agenda" ? "Nada na fila ainda." : "Pipeline vazio."}
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-bone">
              Busque uma tese no Radar e salve as empresas boas — elas entram aqui como oportunidades.
            </p>
            <Link
              href="/"
              className="mt-5 inline-block rounded-lg bg-floral px-4 py-2.5 font-data text-[11px] uppercase tracking-wider text-smoky transition-colors hover:bg-floral/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-floral/50"
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
                className="w-56 rounded border border-hairline bg-surface px-2 py-1.5 text-xs text-floral outline-none placeholder:text-bone/45 focus:border-hairline-hover"
              />
              {/* Filtro dono — Radix Select para manter o dark theme */}
              <Select value={filtroDono} onValueChange={(v) => setFiltroDono(v ?? "todos")}>
                <SelectTrigger className="h-auto w-40 rounded border border-hairline bg-surface px-2 py-1.5 font-sans text-xs text-floral outline-none focus:ring-0 focus-visible:ring-1 focus-visible:ring-floral/50 focus:border-hairline-hover [&>svg]:opacity-40 [&>svg]:h-3 [&>svg]:w-3">
                  <SelectValue>
                    {filtroDono === "todos" ? "Todos os donos" : filtroDono}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent sideOffset={4} className="border-hairline bg-overlay text-floral">
                  <SelectItem value="todos" className="text-[11px] text-floral focus:bg-surface-hover focus:text-floral">
                    Todos os donos
                  </SelectItem>
                  {donos.map((d) => (
                    <SelectItem key={d} value={d} className="text-[11px] text-floral focus:bg-surface-hover focus:text-floral">
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                onClick={() => setSoAtrasadas((v) => !v)}
                aria-pressed={soAtrasadas}
                className={`rounded border px-2 py-1.5 font-data text-[11px] uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 ${
                  soAtrasadas
                    ? "border-risk-high/50 text-risk-high"
                    : "border-hairline text-bone hover:text-floral"
                }`}
              >
                Só atrasadas
              </button>
              {filtroAtivo && (
                <button
                  onClick={() => { setBusca(""); setFiltroDono("todos"); setSoAtrasadas(false); }}
                  className="rounded-sm font-data text-[11px] uppercase tracking-wider text-bone/60 transition-colors hover:text-bone focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50"
                >
                  limpar
                </button>
              )}
            </div>

            {/* Row list */}
            {currentList.length === 0 ? (
              <p className="mt-2 rounded border border-dashed border-hairline px-3 py-6 text-center text-[11px] text-bone/60">
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
          <span className="whitespace-nowrap font-data text-[11px] text-bone">{toast}</span>
          <button
            onClick={performUndo}
            className="shrink-0 font-data text-[10px] uppercase tracking-wider text-bone/60 transition-colors hover:text-floral focus-visible:outline-none"
          >
            Desfazer
          </button>
        </div>
      )}
    </div>
  );
}

// ── TabButton ─────────────────────────────────────────────────────────────────

function TabButton({
  label,
  count,
  active,
  onClick,
  icon,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`mr-2 flex shrink-0 items-center gap-1.5 border-b-2 pl-1.5 pr-0 pb-2.5 pt-1 font-data text-[11px] uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 ${
        active ? "border-floral text-floral" : "border-transparent text-bone hover:text-floral"
      }`}
    >
      {icon}
      {label}
      <span
        className={`rounded-full border px-1.5 py-px font-data text-[10px] tabular-nums ${
          active ? "border-hairline-hover text-bone" : "border-hairline text-bone/60"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

// ── ColHeader ─────────────────────────────────────────────────────────────────

function ColHeader({
  isEntregue,
  scoreSort,
  onScoreSort,
  donoSort,
  onDonoSort,
  acaoSort,
  onAcaoSort,
}: {
  isEntregue: boolean;
  scoreSort: ScoreSort;
  onScoreSort: () => void;
  donoSort: boolean;
  onDonoSort: () => void;
  acaoSort: ScoreSort;
  onAcaoSort: () => void;
}) {
  return (
    <div
      className="mb-0.5 grid items-center gap-x-4 border-x border-x-transparent border-b border-b-hairline/40 px-3 pb-1.5 font-data text-[10px] uppercase tracking-wider text-bone/60"
      style={{ gridTemplateColumns: COL }}
    >
      {/* grip placeholder */}
      <span />
      <button
        onClick={onScoreSort}
        className="flex items-center gap-1 transition-colors hover:text-bone focus-visible:outline-none"
        title={
          scoreSort === "asc" ? "ordenar decrescente" :
          scoreSort === "desc" ? "remover ordenação" :
          "ordenar crescente"
        }
      >
        Score
        {scoreSort === "asc" && <span className="text-floral">↑</span>}
        {scoreSort === "desc" && <span className="text-floral">↓</span>}
      </button>
      <span>Empresa</span>
      {/* pl-[18px] = px-2 (8px) do container + pl-2.5 (10px) do input/chip — alinha o título com o texto "dono" abaixo */}
      <button
        onClick={onDonoSort}
        className="flex items-center gap-1 pl-[18px] transition-colors hover:text-bone focus-visible:outline-none"
        title={donoSort ? "remover ordenação" : "ordenar por dono"}
      >
        {isEntregue ? "Dono · Resultado" : "Dono · Estágio"}
        {donoSort && <span className="text-floral">↑</span>}
      </button>
      {isEntregue ? (
        <span />
      ) : (
        <button
          onClick={onAcaoSort}
          className="flex items-center gap-1 transition-colors hover:text-bone focus-visible:outline-none"
          title={
            acaoSort === "asc" ? "ordenar decrescente" :
            acaoSort === "desc" ? "remover ordenação" :
            "ordenar crescente"
          }
        >
          Próxima ação
          {acaoSort === "asc" && <span className="text-floral">↑</span>}
          {acaoSort === "desc" && <span className="text-floral">↓</span>}
        </button>
      )}
      <span>Contato</span>
      <span>Notas</span>
      <span />
    </div>
  );
}

// ── SortableRow ───────────────────────────────────────────────────────────────

function SortableRow({
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

// ── Row ───────────────────────────────────────────────────────────────────────

function Row({
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
        className="group grid cursor-pointer items-center gap-x-4 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50"
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
          <svg viewBox="0 0 6 10" className="h-2.5 w-1.5 text-bone" fill="currentColor">
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
                  : "border-hairline text-bone"
              }`}
              title={investigado ? "score atualizado pós-investigação" : "score previsto quando salvou"}
            >
              {score}
            </span>
          ) : (
            <span className="rounded border border-hairline px-1.5 font-data text-[11px] text-bone/45">
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
              className="block truncate text-sm font-medium leading-snug text-floral transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 rounded-sm"
            >
              {o.empresa.razao_social}
            </Link>
            {o.selado_em && (
              <span
                className={`shrink-0 rounded border px-1 font-data text-[9px] uppercase tracking-wide ${
                  o.novo_para_setter === true
                    ? "border-floral/40 text-floral"
                    : "border-hairline text-bone/60"
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
          <p className="truncate font-data text-[10px] text-bone/60">
            {o.empresa.municipio}/{o.empresa.uf}
            {o.empresa.cnae_principal_desc ? ` · ${o.empresa.cnae_principal_desc}` : ""}
          </p>
          {socio && (
            <p className="truncate font-data text-[10px] text-bone/60">{socio.nome}</p>
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
            className="w-full bg-transparent pl-2.5 text-left text-[12px] text-bone outline-none placeholder:text-bone/45"
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
                className="w-full bg-transparent text-[12px] text-bone outline-none placeholder:text-bone/45"
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
              className="block truncate rounded-sm font-data text-[11px] text-floral transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50"
            >
              {formatTelefone(o.empresa.telefone)}
            </a>
          ) : null}
          {o.empresa.email ? (
            <a
              href={`mailto:${o.empresa.email}`}
              className="block truncate rounded-sm font-data text-[11px] text-floral transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50"
            >
              {o.empresa.email}
            </a>
          ) : null}
          {!o.empresa.telefone && !o.empresa.email && (
            <span className="font-data text-[11px] text-bone/60">sem contato</span>
          )}
          {/* Indicador de último contato */}
          <p className={`font-data text-[10px] ${toqueAtrasado ? "text-risk-mid" : "text-bone/60"}`}>
            {ultimoToque
              ? `contato ${diasDesde(ultimoToque)}d atrás`
              : `sem contato · ${diasSemToque}d`}
          </p>
        </div>

        {/* Col 6: Nota indicator */}
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
          className={`justify-self-start flex items-center gap-1.5 rounded border px-2 py-1 font-data text-[10px] uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 ${
            hasNota
              ? "border-hairline text-bone hover:border-hairline-hover hover:text-floral"
              : "border-hairline/60 text-bone/60 hover:border-hairline hover:text-bone"
          }`}
        >
          {hasNota && (
            <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-bone/70" />
          )}
          <span>{hasNota ? "notas" : "+ nota"}</span>
        </button>

        {/* Col 7: Remove */}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(o.id); }}
          title="remover do pipeline"
          className="text-[12px] text-bone/45 transition-colors hover:text-risk-high focus-visible:outline-none"
        >
          ✕
        </button>
      </div>

      {/* Expanded: notas + (agenda) log de atividade */}
      {expanded && (
        <div className="border-t border-hairline px-3 pb-3 pt-2">
          {mudanca && (
            <p className="mb-2 font-data text-[10px] uppercase tracking-wider text-risk-high">
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
            className="w-full resize-none rounded border border-hairline bg-surface px-1.5 py-1 text-[12px] text-floral outline-none placeholder:text-bone/45 focus:border-hairline-hover"
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
          atrasada ? "text-risk-high" : "text-bone/60"
        }`}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={openPicker}
        title="Abrir calendário"
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors hover:bg-hairline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 ${
          atrasada
            ? "text-risk-high/50 hover:text-risk-high"
            : "text-bone hover:text-floral"
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

// ── EstagioChip ───────────────────────────────────────────────────────────────

function EstagioChip({
  o,
  onPatch,
}: {
  o: Oportunidade;
  onPatch: (id: string, campos: Partial<Oportunidade>) => void;
}) {
  return (
    <Select
      value={o.estagio}
      onValueChange={(v) => onPatch(o.id, { estagio: v as EstagioOportunidade })}
    >
      <SelectTrigger className="relative h-auto w-fit max-w-full justify-start border-0 bg-transparent pl-2.5 pr-5 py-0.5 font-data text-[10px] uppercase tracking-wider text-bone/60 transition-colors hover:text-bone focus:ring-0 focus-visible:ring-1 focus-visible:ring-floral/50 [&>svg]:absolute [&>svg]:right-1 [&>svg]:top-1/2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:-translate-y-1/2 [&>svg]:opacity-40">
        <SelectValue className="flex-none text-left">
          {ESTAGIOS.find((s) => s.id === o.estagio)?.label ?? o.estagio}
        </SelectValue>
      </SelectTrigger>
      <SelectContent sideOffset={4} className="border-hairline bg-overlay text-floral">
        {ESTAGIOS.map((s) => (
          <SelectItem
            key={s.id}
            value={s.id}
            className="text-[11px] text-floral focus:bg-surface-hover focus:text-floral"
          >
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ── ResultadoChip ─────────────────────────────────────────────────────────────

function ResultadoChip({
  o,
  onPatch,
}: {
  o: Oportunidade;
  onPatch: (id: string, campos: Partial<Oportunidade>) => void;
}) {
  const colorClass =
    o.resultado === "deal_fechado"  ? "text-floral" :
    o.resultado === "receptivo"     ? "text-bone"   :
    o.resultado === "nao_receptivo" ? "text-bone/60" :
    o.resultado === "perdido"       ? "text-bone/45" :
    "text-bone/70";

  return (
    <Select
      value={o.resultado}
      onValueChange={(v) => onPatch(o.id, { resultado: v as ResultadoOportunidade })}
    >
      <SelectTrigger
        className={`relative h-auto w-fit max-w-full justify-start border-0 bg-transparent pl-2.5 pr-5 py-0.5 font-data text-[10px] uppercase tracking-wider transition-colors hover:text-bone focus:ring-0 focus-visible:ring-1 focus-visible:ring-floral/50 [&>svg]:absolute [&>svg]:right-1 [&>svg]:top-1/2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:-translate-y-1/2 [&>svg]:opacity-40 ${colorClass}`}
      >
        <SelectValue className="flex-none text-left">
          {RESULTADOS.find((r) => r.id === o.resultado)?.label ?? o.resultado}
        </SelectValue>
      </SelectTrigger>
      <SelectContent sideOffset={4} className="border-hairline bg-overlay text-floral">
        {RESULTADOS.map((r) => (
          <SelectItem
            key={r.id}
            value={r.id}
            className="text-[11px] text-floral focus:bg-surface-hover focus:text-floral"
          >
            {r.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function Chevron({ up }: { up: boolean }) {
  return (
    <svg
      viewBox="0 0 10 10"
      fill="currentColor"
      className={`h-[9px] w-[9px] transition-transform duration-200 ${up ? "rotate-180" : ""}`}
    >
      <path d="M1.5 2.5 L8.5 2.5 L5 7.5 Z" />
    </svg>
  );
}

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <div>
      <p className="font-display text-2xl tabular-nums text-floral">{n}</p>
      <p className="font-data text-[10px] uppercase tracking-wider text-bone/60">{label}</p>
    </div>
  );
}

// O LOOP DE OUTCOME (o moat): compara o score PREVISTO (no save) com o DESFECHO real.
// Se as oportunidades que viraram receptivo/deal tinham score médio maior que as perdidas,
// o score prevê o resultado do mundo real — e isso é training data que recalibra o modelo.
function Dashboard({
  ops,
  collapsed,
  onToggle,
}: {
  ops: Oportunidade[];
  collapsed: boolean;
  onToggle: () => void;
}) {
  const contatados = ops.filter((o) =>
    ["abordado", "em_conversa", "entregue"].includes(o.estagio)
  ).length;
  const positivos = ops.filter(
    (o) => o.resultado === "receptivo" || o.resultado === "deal_fechado"
  );
  const negativos = ops.filter(
    (o) => o.resultado === "nao_receptivo" || o.resultado === "perdido"
  );
  const deals = ops.filter((o) => o.resultado === "deal_fechado").length;
  const comDesfecho = positivos.length + negativos.length;
  const hitReal =
    comDesfecho > 0 ? Math.round((positivos.length / comDesfecho) * 100) : null;

  const media = (arr: Oportunidade[]) => {
    const s = arr.map((o) => o.score_no_save).filter((n): n is number => n != null);
    return s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : null;
  };
  const scorePos = media(positivos);
  const scoreNeg = media(negativos);
  const loopFecha = scorePos != null && scoreNeg != null && scorePos > scoreNeg;

  if (collapsed) {
    return (
      <div
        className="mb-4 flex cursor-pointer items-center justify-between rounded-lg border border-hairline bg-surface px-4 py-2.5 transition-colors hover:border-hairline-hover"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggle(); }}
        aria-label="Expandir estatísticas"
      >
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 pointer-events-none">
          <span className="font-data text-[10px] uppercase tracking-wider text-bone/60">
            Estatísticas
          </span>
          <span className="font-data text-[11px] tabular-nums text-bone">
            {ops.length} no funil
            {deals > 0 ? ` · ${deals} deal${deals > 1 ? "s" : ""}` : ""}
            {hitReal != null ? ` · ${hitReal}% hit rate` : ""}
          </span>
        </div>
        <div className="ml-4 shrink-0 text-olive pointer-events-none">
          <Chevron up={false} />
        </div>
      </div>
    );
  }

  return (
    <section className="mb-6 rounded-xl border border-hairline bg-surface p-5">
      {/* Stats row — clicking anywhere here collapses */}
      <div
        className="flex cursor-pointer items-start gap-4 transition-opacity hover:opacity-80"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggle(); }}
        aria-label="Recolher estatísticas"
      >
        <div className="grid flex-1 grid-cols-3 gap-4 sm:grid-cols-5 pointer-events-none">
          <Stat n={ops.length} label="No funil" />
          <Stat n={contatados} label="Contatados" />
          <Stat n={positivos.length} label="Receptivos" />
          <Stat n={deals} label="Deals" />
          <Stat n={hitReal != null ? `${hitReal}%` : "--"} label="Hit rate real" />
        </div>
        <div className="shrink-0 text-olive pointer-events-none">
          <Chevron up={true} />
        </div>
      </div>

      {/* O loop: previsto x realizado */}
      <div className="mt-5 border-t border-hairline pt-4">
        <p className="font-data text-[10px] uppercase tracking-wider text-bone/60">
          Loop de outcome · score previsto × desfecho real
        </p>
        {scorePos != null || scoreNeg != null ? (
          <>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm text-bone">
              <span>
                <strong>Desfecho positivo</strong>: score médio{" "}
                <span className="font-data text-floral">{scorePos ?? "--"}</span>
              </span>
              <span>
                <strong>Desfecho negativo</strong>: score médio{" "}
                <span className="font-data text-floral">{scoreNeg ?? "--"}</span>
              </span>
            </div>
            <p className="mt-2 text-xs leading-snug text-bone/60">
              {loopFecha
                ? "As empresas que reagiram bem tinham score maior — o score prevê o desfecho real. É o ground truth que recalibra o modelo (o moat)."
                : "Conforme os desfechos entram, comparamos previsto × real. Se o positivo superar o negativo, o score se confirma — e vira training data."}
            </p>
          </>
        ) : (
          <p className="mt-2 text-xs leading-snug text-bone/60">
            Ainda sem desfechos registrados. Mova oportunidades para &ldquo;Entregue&rdquo; e marque o
            resultado — o loop começa a medir previsto × real.
          </p>
        )}
      </div>
    </section>
  );
}

// ── ProvenienciaBlock ─────────────────────────────────────────────────────────
// Emite/mostra o selo de proveniência — a prova de origem que destrava o success fee.
// Selar no momento da entrega carimba origem + data + score + "novo pro CRM do parceiro".

function ProvenienciaBlock({ o }: { o: Oportunidade }) {
  const [selado, setSelado] = useState(!!o.selado_em);
  const [novo, setNovo] = useState<boolean | null>(o.novo_para_setter ?? null);
  const [selando, setSelando] = useState(false);

  async function selar() {
    if (selando) return;
    setSelando(true);
    try {
      const r = await fetch("/api/proveniencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: o.id }),
      });
      const d = await r.json();
      if (r.ok && d.certificado) {
        setSelado(true);
        setNovo(d.certificado.novo_para_setter ?? null);
      }
    } catch {
      /* falha silenciosa — o botão volta ao estado idle */
    } finally {
      setSelando(false);
    }
  }

  return (
    <div className="mt-2 flex items-center justify-between gap-3 rounded border border-hairline px-2.5 py-2">
      <div className="min-w-0">
        <p className="font-data text-[10px] uppercase tracking-wider text-bone">Selo de proveniência</p>
        <p className="font-data text-[10px] text-bone/50">
          {selado
            ? `selado${novo == null ? " · CRM não verificado" : novo ? " · novo pro CRM do parceiro" : " · já constava no CRM"}`
            : "prova de origem — carimba antes de entregar à boutique"}
        </p>
      </div>
      {selado ? (
        <Link
          href={`/proveniencia/${o.id}`}
          target="_blank"
          className="shrink-0 rounded border border-hairline px-2 py-1 font-data text-[10px] uppercase tracking-wider text-floral transition-colors hover:border-hairline-hover"
        >
          Ver certificado
        </Link>
      ) : (
        <button
          onClick={selar}
          disabled={selando}
          className="shrink-0 rounded border border-hairline px-2 py-1 font-data text-[10px] uppercase tracking-wider text-bone transition-colors hover:border-hairline-hover hover:text-floral disabled:opacity-40"
        >
          {selando ? "Selando…" : "Emitir selo"}
        </button>
      )}
    </div>
  );
}

// ── LogAtividade ──────────────────────────────────────────────────────────────

function LogAtividade({ oportunidadeId }: { oportunidadeId: string }) {
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState<Interacao[] | null>(null);
  const [tipo, setTipo] = useState<TipoInteracao>("ligacao");
  const [texto, setTexto] = useState("");

  async function carregar() {
    const r = await fetch(`/api/interacao?oportunidade_id=${oportunidadeId}`);
    const d = await r.json();
    setItens(d.interacoes ?? []);
  }

  function toggle() {
    const novo = !aberto;
    setAberto(novo);
    if (novo && itens === null) carregar();
  }

  async function adicionar() {
    const descricao = texto.trim();
    if (!descricao) return;
    const r = await fetch("/api/interacao", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oportunidade_id: oportunidadeId, tipo, descricao }),
    });
    const d = await r.json();
    if (d.interacao) {
      setItens((p) => [d.interacao, ...(p ?? [])]);
      setTexto("");
    }
  }

  const total = itens?.length ?? 0;

  return (
    <div className="mt-2 rounded border border-hairline px-2.5 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-data text-[10px] uppercase tracking-wider text-bone">
            {total > 0 ? `Contatos · ${total}` : "Contatos"}
          </span>
          <span className="font-data text-[10px] text-bone/45">
            ligações, emails, reuniões…
          </span>
        </div>
        <button
          onClick={toggle}
          className="flex h-5 items-center gap-1 rounded border border-hairline px-1.5 font-data text-[10px] text-bone transition-colors hover:border-hairline-hover hover:text-floral focus-visible:outline-none"
        >
          <span>{aberto ? "−" : "+"}</span>
          {!aberto && <span className="text-bone/60">registrar</span>}
        </button>
      </div>

      {aberto && (
        <div className="mt-2 space-y-2">
          <div className="flex gap-1">
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoInteracao)}>
              <SelectTrigger className="h-auto w-24 shrink-0 border-hairline px-1.5 py-1 text-[11px] text-floral focus:ring-0 focus-visible:ring-1 focus-visible:ring-floral/50 focus:border-hairline-hover">
                <SelectValue>{TIPOS_INTERACAO.find((t) => t.id === tipo)?.label}</SelectValue>
              </SelectTrigger>
              <SelectContent sideOffset={0} className="border-hairline bg-overlay text-floral">
                {TIPOS_INTERACAO.map((t) => (
                  <SelectItem
                    key={t.id}
                    value={t.id}
                    className="text-[11px] text-floral focus:bg-surface-hover focus:text-floral"
                  >
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") adicionar(); }}
              placeholder="registrar contato…"
              className="min-w-0 flex-1 rounded border border-hairline bg-surface px-1.5 py-1 text-[11px] text-floral outline-none placeholder:text-bone/45 focus:border-hairline-hover"
            />
            <button
              onClick={adicionar}
              className="shrink-0 rounded border border-hairline px-2 font-data text-[11px] text-floral transition-colors hover:border-hairline-hover"
            >
              +
            </button>
          </div>

          {itens && itens.length > 0 ? (
            <ul className="space-y-1.5">
              {itens.map((it) => (
                <li key={it.id} className="text-[11px] leading-snug">
                  <span className="font-data text-bone/60">{dataCurta(it.criado_em)}</span>{" "}
                  <span className="font-data uppercase tracking-wide text-bone/60">
                    {TIPOS_INTERACAO.find((t) => t.id === it.tipo)?.label ?? it.tipo}
                  </span>
                  <span className="text-bone"> — {it.descricao}</span>
                </li>
              ))}
            </ul>
          ) : itens ? (
            <p className="text-[11px] text-bone/60">Nenhum contato registrado.</p>
          ) : (
            <p className="text-[11px] text-bone/60">Carregando…</p>
          )}
        </div>
      )}
    </div>
  );
}
