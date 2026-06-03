"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  Oportunidade, EstagioOportunidade, ResultadoOportunidade, Interacao, TipoInteracao,
} from "@/lib/types";

const TIPOS_INTERACAO: { id: TipoInteracao; label: string }[] = [
  { id: "ligacao", label: "Ligação" },
  { id: "email", label: "Email" },
  { id: "reuniao", label: "Reunião" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "nota", label: "Nota" },
];

const ESTAGIOS: { id: EstagioOportunidade; label: string; cor: string; emptyMsg: string }[] = [
  { id: "identificado", label: "Identificado", cor: "text-bone",     emptyMsg: "Salve empresas da busca para começar." },
  { id: "abordado",     label: "Abordado",     cor: "text-floral",   emptyMsg: "Ninguém abordado ainda." },
  { id: "em_conversa",  label: "Em conversa",  cor: "text-risk-mid", emptyMsg: "Sem conversas em curso." },
  { id: "qualificado",  label: "Qualificado",  cor: "text-risk-mid", emptyMsg: "Nenhuma qualificada ainda." },
  { id: "entregue",     label: "Entregue",     cor: "text-floral",   emptyMsg: "Nada entregue à boutique." },
  { id: "arquivado",    label: "Arquivado",    cor: "text-olive",    emptyMsg: "Nada arquivado." },
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

  return (
    <div className="min-h-screen bg-smoky text-floral">
      <main className="mx-auto max-w-7xl px-6 py-12">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl tracking-tight">Pipeline de originação</h1>
            <p className="mt-1 text-sm text-bone">{ops.length} oportunidades no funil</p>
          </div>
          <a href="/" className="font-data text-sm text-bone transition-colors hover:text-floral">
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {ESTAGIOS.map((col) => {
              const lista = ops.filter((o) => o.estagio === col.id);
              return (
                <div key={col.id} className="flex flex-col gap-3 border-t-2 border-floral/15 pt-3">
                  <div className={`flex items-center justify-between font-data text-[10px] font-medium uppercase tracking-wider ${col.cor}`}>
                    <span>{col.label}</span>
                    <span className="tabular-nums text-olive">{lista.length}</span>
                  </div>
                  {lista.length === 0 && (
                    <p className="rounded border border-dashed border-hairline px-2 py-3 text-[11px] text-olive">
                      {col.emptyMsg}
                    </p>
                  )}
                  {lista.map((o) => (
                    <Card key={o.id} o={o} onPatch={patch} onRemove={remover} />
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

function Card({
  o,
  onPatch,
  onRemove,
}: {
  o: Oportunidade;
  onPatch: (id: string, campos: Partial<Oportunidade>) => void;
  onRemove: (id: string) => void;
}) {
  const atrasada = o.proxima_acao_em != null && o.proxima_acao_em < hoje();

  return (
    <div className="rounded-lg border border-hairline bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium leading-snug text-floral">{o.empresa.razao_social}</h3>
        {o.score_no_save != null && (
          <span
            className="shrink-0 rounded border border-hairline px-1.5 font-data text-[11px] tabular-nums text-bone"
            title="score de propensão quando salvou (previsto)"
          >
            {o.score_no_save}
          </span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-bone">
        {o.empresa.municipio} / {o.empresa.uf}
      </p>
      {o.empresa.cnae_principal_desc && (
        <p className="mt-1 text-[11px] leading-snug text-bone">{o.empresa.cnae_principal_desc}</p>
      )}
      {(o.empresa.telefone || o.empresa.email) && (
        <p className="mt-1 text-[11px] text-bone">{o.empresa.telefone ?? o.empresa.email}</p>
      )}

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
                    ? "border-risk-high/30 bg-smoky text-risk-high"
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
  );
}

function dataCurta(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
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
