"use client";

import { useState } from "react";

/* Botão "salvar no pipeline" — usado na linha da tabela (variante `linha`, discreta)
   e no peek panel (variante `primario`: o botão sólido padrão do workbench — um por tela).
   Estado local só rastreia a transição; "já salvo" é verdade externa (prop). */
export function SalvarButton({
  empresaId,
  jaSalvo,
  variante = "linha",
  onSalvo,
}: {
  empresaId: string;
  jaSalvo?: boolean;
  variante?: "linha" | "primario";
  onSalvo?: () => void;
}) {
  const [acao, setAcao] = useState<"idle" | "salvando" | "salvo">("idle");
  const estado: "idle" | "salvando" | "salvo" =
    jaSalvo || acao === "salvo" ? "salvo" : acao;

  async function salvar() {
    if (estado !== "idle") return;
    setAcao("salvando");
    try {
      const r = await fetch("/api/oportunidade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId }),
      });
      if (!r.ok) throw new Error();
      setAcao("salvo");
      onSalvo?.();
    } catch {
      setAcao("idle");
    }
  }

  const rotulo =
    estado === "salvo" ? "✓ no pipeline" : estado === "salvando" ? "Salvando…" : "Salvar no pipeline";

  if (variante === "primario") {
    return (
      <button
        onClick={salvar}
        disabled={estado !== "idle"}
        className={`shrink-0 rounded-md px-3.5 py-2 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 ${
          estado === "salvo"
            ? "border border-hairline text-floral"
            : "bg-floral text-smoky hover:bg-floral/90 disabled:opacity-60"
        }`}
      >
        {rotulo}
      </button>
    );
  }

  return (
    <button
      onClick={salvar}
      disabled={estado !== "idle"}
      className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 ${
        estado === "salvo"
          ? "text-floral"
          : "border border-hairline text-bone hover:border-hairline-hover hover:text-floral"
      }`}
    >
      {rotulo}
    </button>
  );
}
