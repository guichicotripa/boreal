"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { storeEmpresa, storeOrigin } from "@/lib/empresa-store";
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

type Mudanca = { tipo: string; severidade: string; descricao: string };
const MUDANCAS = monitor.mudancas as Record<string, Mudanca>;
function mudancaDe(cnpj: string): Mudanca | null {
  return MUDANCAS[cnpj.slice(0, 8)] ?? null;
}

const TIPOS_INTERACAO: { id: TipoInteracao; label: string }[] = [
  { id: "ligacao", label: "Ligação" },
  { id: "email", label: "Email" },
  { id: "reuniao", label: "Reunião" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "nota", label: "Nota" },
];

const ESTAGIOS: { id: EstagioOportunidade; label: string; cor: string; emptyMsg: string }[] = [
  { id: "identificado", label: "Identificado", cor: "text-bone", emptyMsg: "Salve empresas da busca para começar." },
  { id: "abordado",     label: "Abordado",     cor: "text-bone", emptyMsg: "Ninguém abordado ainda." },
  { id: "em_conversa",  label: "Em conversa",  cor: "text-bone", emptyMsg: "Sem conversas em curso." },
  { id: "qualificado",  label: "Qualificado",  cor: "text-bone", emptyMsg: "Nenhuma qualificada ainda." },
  { id: "entregue",     label: "Entregue",     cor: "text-bone", emptyMsg: "Nada entregue à boutique." },
  { id: "arquivado",    label: "Arquivado",    cor: "text-olive",   emptyMsg: "Nada arquivado." },
];

const RESULTADOS: { id: ResultadoOportunidade; label: string }[] = [
  { id: "pendente", label: "Aguardando retorno" },
  { id: "receptivo", label: "Fundador receptivo" },
  { id: "nao_receptivo", label: "Não receptivo" },
  { id: "deal_fechado", label: "Deal fechado 🎉" },
  { id: "perdido", label: "Perdido" },
];

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function atrasou(o: Oportunidade) {
  return o.proxima_acao_em != null && o.proxima_acao_em < hoje();
}

// Prioridade dentro da coluna: atrasadas primeiro → próxima ação mais cedo → maior score.
function porPrioridade(a: Oportunidade, b: Oportunidade) {
  const aA = atrasou(a) ? 0 : 1;
  const bA = atrasou(b) ? 0 : 1;
  if (aA !== bA) return aA - bA;
  const ad = a.proxima_acao_em ?? "9999-99-99";
  const bd = b.proxima_acao_em ?? "9999-99-99";
  if (ad !== bd) return ad < bd ? -1 : 1;
  return (b.score_no_save ?? -1) - (a.score_no_save ?? -1);
}

export default function Pipeline() {
  const [ops, setOps] = useState<Oportunidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroDono, setFiltroDono] = useState("todos");
  const [soAtrasadas, setSoAtrasadas] = useState(false);

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

  async function patch(id: string, campos: Partial<Oportunidade>) {
    setOps((prev) => prev.map((o) => (o.id === id ? { ...o, ...campos } : o)));
    await fetch("/api/oportunidade", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...campos }),
    });
  }

  async function remover(id: string) {
    setOps((prev) => prev.filter((o) => o.id !== id));
    await fetch(`/api/oportunidade?id=${id}`, { method: "DELETE" });
  }

  const donos = Array.from(new Set(ops.map((o) => o.dono).filter((d): d is string => !!d))).sort();
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

  return (
    <div className="min-h-screen bg-smoky text-floral">
      <main className="mx-auto max-w-7xl px-6 py-12">
        <header className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl tracking-tight">Pipeline de originação</h1>
            <p className="mt-1 text-sm text-bone">
              {filtroAtivo ? `${filtradas.length} de ${ops.length}` : ops.length} oportunidades no funil
            </p>
          </div>
          <a href="/" className="group flex items-center gap-2 font-data text-[11px] uppercase tracking-wider text-floral transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 rounded-sm">
            <span className="transition-transform duration-200 group-hover:-translate-x-1">←</span>
            <span>Voltar à busca</span>
          </a>
        </header>

        {loading ? (
          <p className="text-sm text-bone">Carregando…</p>
        ) : ops.length === 0 ? (
          <p className="text-sm text-bone">
            Nenhuma oportunidade salva ainda. Volte à busca e clique em &ldquo;+ salvar&rdquo; numa empresa.
          </p>
        ) : (
          <>
            <Dashboard ops={ops} />

            {/* Controles — busca, dono, só atrasadas */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="buscar empresa, cidade, setor…"
                className="w-56 rounded border border-hairline bg-surface px-2 py-1.5 text-xs text-floral outline-none placeholder:text-olive focus:border-hairline-hover"
              />
              <select
                value={filtroDono}
                onChange={(e) => setFiltroDono(e.target.value)}
                className="rounded border border-hairline bg-surface px-2 py-1.5 text-xs text-floral outline-none focus:border-hairline-hover"
              >
                <option value="todos">Todos os donos</option>
                {donos.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <button
                onClick={() => setSoAtrasadas((v) => !v)}
                className={`rounded border px-2 py-1.5 font-data text-[11px] uppercase tracking-wider transition-colors ${
                  soAtrasadas ? "border-risk-high/50 text-risk-high" : "border-hairline text-bone hover:text-floral"
                }`}
              >
                Só atrasadas
              </button>
              {filtroAtivo && (
                <button
                  onClick={() => { setBusca(""); setFiltroDono("todos"); setSoAtrasadas(false); }}
                  className="font-data text-[11px] uppercase tracking-wider text-olive transition-colors hover:text-bone"
                >
                  limpar
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {ESTAGIOS.map((col) => {
              const lista = filtradas.filter((o) => o.estagio === col.id).sort(porPrioridade);
              return (
                <div key={col.id} className="flex flex-col gap-3 border-t-2 border-floral/15 pt-3">
                  <div className={`flex items-center justify-between font-data text-[10px] font-medium uppercase tracking-wider ${col.cor}`}>
                    <span>{col.label}</span>
                    <span className="tabular-nums text-olive">{lista.length}</span>
                  </div>
                  {lista.length === 0 && (
                    <p className="rounded border border-dashed border-hairline px-2 py-3 text-[11px] text-olive">
                      {filtroAtivo ? "Nada no filtro." : col.emptyMsg}
                    </p>
                  )}
                  {lista.map((o) => (
                    <Card key={o.id} o={o} onPatch={patch} onRemove={remover} />
                  ))}
                </div>
              );
            })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Card({
  o,
  onPatch,
  onRemove,
}: {
  o: Oportunidade;
  onPatch: (id: string, campos: Partial<Oportunidade>) => void;
  onRemove: (id: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const atrasada = atrasou(o);
  const dataCompacta = o.proxima_acao_em ? `${o.proxima_acao_em.slice(8, 10)}/${o.proxima_acao_em.slice(5, 7)}` : null;
  const mudanca = mudancaDe(o.empresa.cnpj);

  return (
    <div
      className={`rounded-lg border bg-surface ${
        mudanca ? "border-risk-high/40" : atrasada ? "border-hairline border-l-2 border-l-risk-high/60" : "border-hairline"
      }`}
    >
      {/* Alerta de monitor — mudança societária detectada (o sensor forward) */}
      {mudanca && (
        <div className="rounded-t-lg border-b border-risk-high/30 bg-risk-high/10 px-3 py-1.5">
          <p className="font-data text-[10px] uppercase tracking-wider text-risk-high">
            ⚠ Mudança societária detectada
          </p>
          {aberto && <p className="mt-0.5 text-[11px] leading-snug text-bone">{mudanca.descricao}</p>}
        </div>
      )}

      {/* Header colapsável — resumo escaneável */}
      <button onClick={() => setAberto((v) => !v)} className="flex w-full items-start gap-2 p-3 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-sm font-medium leading-snug text-floral">{o.empresa.razao_social}</h3>
            {o.score_no_save != null && (
              <span
                className="shrink-0 rounded border border-hairline px-1.5 font-data text-[11px] tabular-nums text-bone"
                title="score de propensão quando salvou (previsto)"
              >
                {o.score_no_save}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-bone">
            {o.empresa.municipio} / {o.empresa.uf}
          </p>
          {/* resumo: dono · próxima ação */}
          <p className="mt-1 text-[11px] leading-snug">
            {o.dono ? <span className="text-bone">{o.dono}</span> : <span className="text-olive">sem dono</span>}
            <span className="text-olive"> · </span>
            {o.proxima_acao || dataCompacta ? (
              <span className={atrasada ? "text-risk-high" : "text-bone"}>
                {o.proxima_acao || "ação"}
                {dataCompacta ? ` (${dataCompacta})` : ""}
              </span>
            ) : (
              <span className="text-olive">sem ação</span>
            )}
          </p>
        </div>
        <span className="mt-0.5 shrink-0 font-data text-[11px] text-olive">{aberto ? "−" : "+"}</span>
      </button>

      {/* Detalhe — expandido */}
      {!aberto ? null : (
      <div className="border-t border-hairline px-3 pb-3 pt-2">
      {o.empresa.cnae_principal_desc && (
        <p className="text-[11px] leading-snug text-bone">{o.empresa.cnae_principal_desc}</p>
      )}
      {(o.empresa.telefone || o.empresa.email) && (
        <p className="mt-1 text-[11px] text-bone">{o.empresa.telefone ?? o.empresa.email}</p>
      )}

      {/* Link para o perfil completo */}
      <Link
        href={`/empresa/${o.empresa.id}`}
        onClick={() => { storeEmpresa(o.empresa as unknown as Empresa); storeOrigin("pipeline"); }}
        className="mt-2 inline-flex items-center gap-1 font-data text-[10px] uppercase tracking-wider text-floral transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 rounded-sm"
      >
        Ver perfil completo <span aria-hidden="true">→</span>
      </Link>

      {/* Estágio + remover */}
      <div className="mt-2 flex items-center gap-2">
        <Select value={o.estagio} onValueChange={(v) => onPatch(o.id, { estagio: v as EstagioOportunidade })}>
          <SelectTrigger className="h-auto flex-1 border-hairline px-1.5 py-1 text-[11px] text-floral focus:ring-0 focus:border-hairline-hover">
            <SelectValue>{ESTAGIOS.find((s) => s.id === o.estagio)?.label ?? o.estagio}</SelectValue>
          </SelectTrigger>
          <SelectContent sideOffset={0} className="border-hairline bg-[#1c1d17] text-floral">
            {ESTAGIOS.map((s) => (
              <SelectItem key={s.id} value={s.id} className="text-[11px] text-floral focus:bg-surface-hover focus:text-floral">
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button onClick={() => onRemove(o.id)} className="text-[11px] text-olive transition-colors hover:text-risk-high" title="remover do pipeline">
          ✕
        </button>
      </div>

      {/* DRI */}
      <input
        defaultValue={o.dono ?? ""}
        onBlur={(e) => {
          if (e.target.value !== (o.dono ?? "")) onPatch(o.id, { dono: e.target.value });
        }}
        placeholder="dono (DRI)…"
        className="mt-2 w-full rounded border border-hairline bg-surface px-1.5 py-1 text-[11px] text-floral outline-none placeholder:text-olive focus:border-hairline-hover"
      />

      {/* Próxima ação + data */}
      <input
        defaultValue={o.proxima_acao ?? ""}
        onBlur={(e) => {
          if (e.target.value !== (o.proxima_acao ?? "")) onPatch(o.id, { proxima_acao: e.target.value });
        }}
        placeholder="próxima ação…"
        className="mt-1.5 w-full rounded border border-hairline bg-surface px-1.5 py-1 text-[11px] text-floral outline-none placeholder:text-olive focus:border-hairline-hover"
      />
      <input
        type="date"
        defaultValue={o.proxima_acao_em ?? ""}
        onChange={(e) => onPatch(o.id, { proxima_acao_em: e.target.value || null })}
        className={`mt-1.5 w-full rounded border bg-surface px-1.5 py-1 font-data text-[11px] outline-none focus:border-hairline-hover ${
          atrasada ? "border-risk-high/50 text-risk-high" : "border-hairline text-bone"
        }`}
        title={atrasada ? "ação atrasada" : "quando"}
      />

      {/* Resultado — só quando entregue */}
      {o.estagio === "entregue" && (
        <Select value={o.resultado} onValueChange={(v) => onPatch(o.id, { resultado: v as ResultadoOportunidade })}>
          <SelectTrigger
            className={`mt-2 h-auto w-full px-1.5 py-1 text-[11px] focus:ring-0 ${
              o.resultado === "deal_fechado"
                ? "border-floral/30 bg-smoky text-floral"
                : o.resultado === "receptivo"
                  ? "border-hairline bg-smoky text-floral"
                  : o.resultado === "nao_receptivo" || o.resultado === "perdido"
                    ? "border-hairline bg-smoky text-olive"
                    : "border-hairline bg-smoky text-bone"
            }`}
          >
            <SelectValue>{RESULTADOS.find((r) => r.id === o.resultado)?.label ?? o.resultado}</SelectValue>
          </SelectTrigger>
          <SelectContent sideOffset={0} className="border-hairline bg-[#1c1d17] text-floral">
            {RESULTADOS.map((r) => (
              <SelectItem key={r.id} value={r.id} className="text-[11px] text-floral focus:bg-surface-hover focus:text-floral">
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Notas */}
      <textarea
        defaultValue={o.notas ?? ""}
        onBlur={(e) => {
          if (e.target.value !== (o.notas ?? "")) onPatch(o.id, { notas: e.target.value });
        }}
        placeholder="anotações…"
        rows={2}
        className="mt-2 w-full resize-none rounded border border-hairline bg-surface px-1.5 py-1 text-[11px] text-floral outline-none placeholder:text-olive focus:border-hairline-hover"
      />

      {/* Log de atividade (toques) */}
      <LogAtividade oportunidadeId={o.id} />
      </div>
      )}
    </div>
  );
}

function dataCurta(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// O LOOP DE OUTCOME (o moat): compara o score PREVISTO (no save) com o DESFECHO real.
// Se as oportunidades que viraram receptivo/deal tinham score médio maior que as perdidas,
// o score prevê o resultado do mundo real — e isso é training data que recalibra o modelo.
function Dashboard({ ops }: { ops: Oportunidade[] }) {
  const contatados = ops.filter((o) => ["abordado", "em_conversa", "entregue"].includes(o.estagio)).length;
  const positivos = ops.filter((o) => o.resultado === "receptivo" || o.resultado === "deal_fechado");
  const negativos = ops.filter((o) => o.resultado === "nao_receptivo" || o.resultado === "perdido");
  const deals = ops.filter((o) => o.resultado === "deal_fechado").length;
  const comDesfecho = positivos.length + negativos.length;
  const hitReal = comDesfecho > 0 ? Math.round((positivos.length / comDesfecho) * 100) : null;

  const media = (arr: Oportunidade[]) => {
    const s = arr.map((o) => o.score_no_save).filter((n): n is number => n != null);
    return s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : null;
  };
  const scorePos = media(positivos);
  const scoreNeg = media(negativos);
  const loopFecha = scorePos != null && scoreNeg != null && scorePos > scoreNeg;

  const Stat = ({ n, label }: { n: number | string; label: string }) => (
    <div>
      <p className="font-display text-2xl tabular-nums text-floral">{n}</p>
      <p className="font-data text-[10px] uppercase tracking-wider text-olive">{label}</p>
    </div>
  );

  return (
    <section className="mb-8 rounded-xl border border-hairline bg-surface p-5">
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-5">
        <Stat n={ops.length} label="No funil" />
        <Stat n={contatados} label="Contatados" />
        <Stat n={positivos.length} label="Receptivos" />
        <Stat n={deals} label="Deals" />
        <Stat n={hitReal != null ? `${hitReal}%` : "—"} label="Hit rate real" />
      </div>

      {/* O loop: previsto × realizado */}
      <div className="mt-5 border-t border-hairline pt-4">
        <p className="font-data text-[10px] uppercase tracking-wider text-olive">
          Loop de outcome · score previsto × desfecho real
        </p>
        {scorePos != null || scoreNeg != null ? (
          <>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm text-bone">
              <span><strong>Desfecho positivo</strong>: score médio{" "}
                <span className="font-data text-floral">{scorePos ?? "—"}</span>
              </span>
              <span><strong>Desfecho negativo</strong>: score médio{" "}
                <span className="font-data text-floral">{scoreNeg ?? "—"}</span>
              </span>
            </div>
            <p className="mt-2 text-xs leading-snug text-olive">
              {loopFecha
                ? "As empresas que reagiram bem tinham score maior — o score prevê o desfecho real. É o ground truth que recalibra o modelo (o moat)."
                : "Conforme os desfechos entram, comparamos previsto × real. Se o positivo superar o negativo, o score se confirma — e vira training data."}
            </p>
          </>
        ) : (
          <p className="mt-2 text-xs leading-snug text-olive">
            Ainda sem desfechos registrados. Mova oportunidades para &ldquo;Entregue&rdquo; e marque o
            resultado — o loop começa a medir previsto × real.
          </p>
        )}
      </div>
    </section>
  );
}

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
    <div className="mt-2 border-t border-hairline pt-2">
      <button
        onClick={toggle}
        className="flex w-full items-center justify-between font-data text-[10px] uppercase tracking-wider text-olive transition-colors hover:text-bone"
      >
        <span>Atividade{total > 0 ? ` · ${total}` : ""}</span>
        <span>{aberto ? "−" : "+"}</span>
      </button>

      {aberto && (
        <div className="mt-2 space-y-2">
          <div className="flex gap-1">
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoInteracao)}>
              <SelectTrigger className="h-auto w-24 shrink-0 border-hairline px-1.5 py-1 text-[11px] text-floral focus:ring-0 focus:border-hairline-hover">
                <SelectValue>{TIPOS_INTERACAO.find((t) => t.id === tipo)?.label}</SelectValue>
              </SelectTrigger>
              <SelectContent sideOffset={0} className="border-hairline bg-[#1c1d17] text-floral">
                {TIPOS_INTERACAO.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="text-[11px] text-floral focus:bg-surface-hover focus:text-floral">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") adicionar();
              }}
              placeholder="registrar toque…"
              className="min-w-0 flex-1 rounded border border-hairline bg-surface px-1.5 py-1 text-[11px] text-floral outline-none placeholder:text-olive focus:border-hairline-hover"
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
                  <span className="font-data text-olive">{dataCurta(it.criado_em)}</span>{" "}
                  <span className="font-data uppercase tracking-wide text-bone/55">
                    {TIPOS_INTERACAO.find((t) => t.id === it.tipo)?.label ?? it.tipo}
                  </span>
                  <span className="text-bone"> — {it.descricao}</span>
                </li>
              ))}
            </ul>
          ) : itens ? (
            <p className="text-[11px] text-olive">Nenhum toque registrado.</p>
          ) : (
            <p className="text-[11px] text-olive">Carregando…</p>
          )}
        </div>
      )}
    </div>
  );
}
