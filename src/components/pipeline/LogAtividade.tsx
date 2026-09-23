"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Interacao, TipoInteracao, DesfechoInteracao } from "@/lib/types";
import { TIPOS_INTERACAO, DESFECHOS, TIPOS_COM_DESFECHO, dataCurta } from "./helpers";

/* `telefone` e `email` entram como prop porque `contato_usado` guarda o VALOR que estava na tela
   na hora, e não uma referência: o contato da empresa muda, e a pergunta que o desfecho responde
   é sobre o que foi discado naquele dia. Mesmo princípio do selo de proveniência. */
export function LogAtividade({
  oportunidadeId,
  telefone,
  email,
}: {
  oportunidadeId: string;
  telefone?: string | null;
  email?: string | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState<Interacao[] | null>(null);
  const [tipo, setTipo] = useState<TipoInteracao>("ligacao");
  const [texto, setTexto] = useState("");
  /* O desfecho é o dado que faz a qualidade do contato APRENDER: sem ele, a hierarquia que a
     plataforma supõe (domínio próprio > webmail > compartilhado) nunca é testada contra o que
     aconteceu de verdade na ligação. Começa vazio de propósito, porque "não registrei" é uma
     resposta diferente de "não atenderam". */
  const [desfecho, setDesfecho] = useState<DesfechoInteracao | "">("");
  /* Aviso de que a recusa mudou o estado da oportunidade. Consequência automática que ninguém vê
     é consequência que ninguém entende: a pessoa registra "disseram não" e depois estranha a
     oportunidade aparecendo como não receptiva. */
  const [aviso, setAviso] = useState<string | null>(null);

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
      body: JSON.stringify({
        oportunidade_id: oportunidadeId,
        tipo,
        descricao,
        // Só manda desfecho quando o tipo comporta um. Reunião e nota não são tentativa de contato.
        desfecho: pedeDesfecho && desfecho ? desfecho : undefined,
        contato_tipo: pedeDesfecho ? canal : undefined,
        contato_usado: pedeDesfecho ? (contatoUsado ?? undefined) : undefined,
      }),
    });
    const d = await r.json();
    if (d.interacao) {
      setItens((p) => [d.interacao, ...(p ?? [])]);
      setTexto("");
      setDesfecho("");
      setAviso(d.resultadoAtualizado ? "Oportunidade marcada como não receptiva." : null);
    }
  }

  const total = itens?.length ?? 0;
  const pedeDesfecho = TIPOS_COM_DESFECHO.has(tipo);
  const canal = tipo === "email" ? "email" : tipo === "whatsapp" ? "whatsapp" : "telefone";
  const contatoUsado = canal === "email" ? (email ?? null) : (telefone ?? null);

  return (
    <div className="mt-2 rounded border border-hairline px-2.5 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-ink-soft">
            {total > 0 ? `Contatos · ${total}` : "Contatos"}
          </span>
          <span className="text-[11px] text-ink-muted">
            ligações, emails, reuniões…
          </span>
        </div>
        <button
          onClick={toggle}
          className="flex h-5 items-center gap-1 rounded border border-hairline px-1.5 text-[11px] text-ink-soft transition-colors hover:border-hairline-hover hover:text-ink focus-visible:outline-none"
        >
          <span>{aberto ? "−" : "+"}</span>
          {!aberto && <span className="text-ink-muted">registrar</span>}
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
              className="min-w-0 flex-1 rounded border border-hairline bg-fill px-1.5 py-1 text-[11px] text-ink outline-none placeholder:text-ink-muted focus:border-hairline-hover"
            />
            <button
              onClick={adicionar}
              className="shrink-0 rounded border border-hairline px-2 text-[11px] font-medium text-ink transition-colors hover:border-hairline-hover"
            >
              +
            </button>
          </div>

          {/* Só para tentativa de contato. Opcional de propósito: obrigar a escolher faria a
              pessoa marcar qualquer coisa para o formulário passar, e um rótulo inventado é pior
              que rótulo ausente. */}
          {pedeDesfecho && (
            <div className="flex flex-wrap gap-1">
              {DESFECHOS.map((d) => (
                <button
                  key={d.id}
                  title={d.ajuda}
                  onClick={() => setDesfecho(desfecho === d.id ? "" : d.id)}
                  className={`rounded border px-1.5 py-0.5 text-[10px] transition-colors ${
                    desfecho === d.id
                      ? "border-ink/40 bg-surface-hover text-ink"
                      : "border-hairline text-ink-muted hover:border-hairline-hover hover:text-ink-soft"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          )}

          {aviso && <p className="text-[10.5px] text-ink-muted">{aviso}</p>}

          {itens && itens.length > 0 ? (
            <ul className="space-y-1.5">
              {itens.map((it) => (
                <li key={it.id} className="text-[11px] leading-snug">
                  <span className="tabular-nums text-ink-muted">{dataCurta(it.criado_em)}</span>{" "}
                  <span className="font-medium text-ink-muted">
                    {TIPOS_INTERACAO.find((t) => t.id === it.tipo)?.label ?? it.tipo}
                  </span>
                  <span className="text-ink-soft"> — {it.descricao}</span>
                  {it.desfecho && (
                    <span className="ml-1 rounded bg-fill px-1 py-px text-[10px] text-ink-muted">
                      {DESFECHOS.find((d) => d.id === it.desfecho)?.label ?? it.desfecho}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : itens ? (
            <p className="text-[11px] text-ink-muted">Nenhum contato registrado.</p>
          ) : (
            <p className="text-[11px] text-ink-muted">Carregando…</p>
          )}
        </div>
      )}
    </div>
  );
}
