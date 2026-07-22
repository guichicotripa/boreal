"use client";

import { useState } from "react";
import Link from "next/link";
import type { Oportunidade } from "@/lib/types";

// Emite/mostra o selo de proveniência — a prova de origem que destrava o success fee.
// Selar no momento da entrega carimba origem + data + score + "novo pro CRM do parceiro".
export function ProvenienciaBlock({ o }: { o: Oportunidade }) {
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
        <p className="text-[11px] font-medium text-ink-soft">Selo de proveniência</p>
        <p className="text-[11px] text-ink-soft/60">
          {selado
            ? `selado${novo == null ? " · CRM não verificado" : novo ? " · novo pro CRM do parceiro" : " · já constava no CRM"}`
            : "prova de origem — carimba antes de entregar à boutique"}
        </p>
      </div>
      {selado ? (
        <Link
          href={`/proveniencia/${o.id}`}
          target="_blank"
          className="shrink-0 rounded border border-hairline px-2 py-1 text-[11px] font-medium text-ink transition-colors hover:border-hairline-hover"
        >
          Ver certificado
        </Link>
      ) : (
        <button
          onClick={selar}
          disabled={selando}
          className="shrink-0 rounded border border-hairline px-2 py-1 text-[11px] font-medium text-ink-soft transition-colors hover:border-hairline-hover hover:text-ink disabled:opacity-40"
        >
          {selando ? "Selando…" : "Emitir selo"}
        </button>
      )}
    </div>
  );
}
