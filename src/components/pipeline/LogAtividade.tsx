"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Interacao, TipoInteracao } from "@/lib/types";
import { TIPOS_INTERACAO, dataCurta } from "./helpers";

export function LogAtividade({ oportunidadeId }: { oportunidadeId: string }) {
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
          <span className="text-[11px] font-medium text-ink-soft">
            {total > 0 ? `Contatos · ${total}` : "Contatos"}
          </span>
          <span className="text-[11px] text-ink-soft/45">
            ligações, emails, reuniões…
          </span>
        </div>
        <button
          onClick={toggle}
          className="flex h-5 items-center gap-1 rounded border border-hairline px-1.5 text-[11px] text-ink-soft transition-colors hover:border-hairline-hover hover:text-ink focus-visible:outline-none"
        >
          <span>{aberto ? "−" : "+"}</span>
          {!aberto && <span className="text-ink-soft/60">registrar</span>}
        </button>
      </div>

      {aberto && (
        <div className="mt-2 space-y-2">
          <div className="flex gap-1">
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoInteracao)}>
              <SelectTrigger className="h-auto w-24 shrink-0 border-hairline px-1.5 py-1 text-[11px] text-ink focus:ring-0 focus-visible:ring-1 focus-visible:ring-ink/50 focus:border-hairline-hover">
                <SelectValue>{TIPOS_INTERACAO.find((t) => t.id === tipo)?.label}</SelectValue>
              </SelectTrigger>
              <SelectContent sideOffset={0} className="border-hairline bg-overlay text-ink">
                {TIPOS_INTERACAO.map((t) => (
                  <SelectItem
                    key={t.id}
                    value={t.id}
                    className="text-[11px] text-ink focus:bg-surface-hover focus:text-ink"
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
              className="min-w-0 flex-1 rounded border border-hairline bg-surface px-1.5 py-1 text-[11px] text-ink outline-none placeholder:text-ink-soft/45 focus:border-hairline-hover"
            />
            <button
              onClick={adicionar}
              className="shrink-0 rounded border border-hairline px-2 text-[11px] font-medium text-ink transition-colors hover:border-hairline-hover"
            >
              +
            </button>
          </div>

          {itens && itens.length > 0 ? (
            <ul className="space-y-1.5">
              {itens.map((it) => (
                <li key={it.id} className="text-[11px] leading-snug">
                  <span className="font-data text-ink-soft/60">{dataCurta(it.criado_em)}</span>{" "}
                  <span className="font-medium text-ink-soft/60">
                    {TIPOS_INTERACAO.find((t) => t.id === it.tipo)?.label ?? it.tipo}
                  </span>
                  <span className="text-ink-soft"> — {it.descricao}</span>
                </li>
              ))}
            </ul>
          ) : itens ? (
            <p className="text-[11px] text-ink-soft/60">Nenhum contato registrado.</p>
          ) : (
            <p className="text-[11px] text-ink-soft/60">Carregando…</p>
          )}
        </div>
      )}
    </div>
  );
}
