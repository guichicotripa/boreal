"use client";

import { useState } from "react";

/* Registra que o titular pediu para não ser contatado (LGPD art. 18 §2º).
 *
 * Fica escondido atrás de um link discreto, e não num botão, porque é ação rara e grave: acontece
 * quando alguém ligou e ouviu "não me liguem mais". Não é para ser clicado por engano no meio de
 * uma triagem.
 *
 * DOIS PASSOS, porque não tem desfazer pela tela. Registrado o pedido, o banco apaga o contato e
 * impede que ele volte (migration 0021), e só a Boreal reverte. Um clique acidental apagaria o
 * telefone de um alvo bom sem que ninguém da Setter conseguisse trazer de volta.
 *
 * O que a tela faz depois é espelhar o banco: `onRegistrado` apaga o contato do estado local para a
 * página refletir na hora o que o trigger já fez, sem recarregar. */
export function RegistrarOposicao({
  empresaId,
  onRegistrado,
}: {
  empresaId: string;
  onRegistrado: () => void;
}) {
  const [etapa, setEtapa] = useState<"fechado" | "confirmando" | "enviando">("fechado");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function registrar() {
    setEtapa("enviando");
    setErro(null);
    const r = await fetch(`/api/empresa/${empresaId}/oposicao`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo: motivo.trim() || undefined }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setErro(d.error ?? "não foi possível registrar");
      setEtapa("confirmando");
      return;
    }
    onRegistrado();
  }

  if (etapa === "fechado") {
    return (
      <button
        onClick={() => setEtapa("confirmando")}
        className="mt-2 text-[10.5px] text-ink-muted underline decoration-dotted underline-offset-2 transition-colors hover:text-ink-soft"
      >
        O titular pediu para não ser contatado
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-2 rounded border border-risk-high/30 bg-risk-high/5 p-2.5">
      <p className="text-[11px] leading-snug text-ink-soft">
        O contato desta empresa será <strong>apagado da base</strong> e não volta nas recargas da
        Receita. Só a Boreal consegue reverter.
      </p>
      <input
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="como o pedido chegou (opcional)"
        maxLength={500}
        className="w-full rounded border border-hairline bg-fill px-1.5 py-1 text-[11px] text-ink outline-none placeholder:text-ink-muted focus:border-hairline-hover"
      />
      {erro && <p className="text-[10.5px] text-risk-high">{erro}</p>}
      <div className="flex gap-2">
        <button
          onClick={registrar}
          disabled={etapa === "enviando"}
          className="rounded border border-risk-high/40 px-2 py-0.5 text-[11px] font-medium text-risk-high transition-colors hover:bg-risk-high/10 disabled:opacity-50"
        >
          {etapa === "enviando" ? "Registrando…" : "Registrar pedido"}
        </button>
        <button
          onClick={() => { setEtapa("fechado"); setErro(null); }}
          disabled={etapa === "enviando"}
          className="rounded px-2 py-0.5 text-[11px] text-ink-muted transition-colors hover:text-ink"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
