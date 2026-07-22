"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft } from "lucide-react";
import { NAV_GRUPOS } from "./AppShell";

/* ── Paleta de comandos (Ctrl/Cmd+K) ─────────────────────────────────────
   Hand-rolled, sem dependência nova. F1: navegação entre rotas. Ações de
   contexto (salvar, selar, buscar empresa por nome) entram nas fases
   seguintes — a estrutura de `Item` já comporta. */

type Item = { id: string; label: string; grupo: string; run: () => void };

// Busca tolerante a acento/caixa ("valida" acha "Validação").
function normaliza(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function CommandPalette({
  aberta,
  onOpenChange,
}: {
  aberta: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [ativo, setAtivo] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const itens: Item[] = useMemo(
    () =>
      NAV_GRUPOS.flatMap((g) =>
        g.items.map((i) => ({
          id: i.href,
          label: i.label,
          grupo: g.label,
          run: () => router.push(i.href),
        }))
      ),
    [router]
  );

  const filtrados = useMemo(() => {
    const q = normaliza(query.trim());
    if (!q) return itens;
    return itens.filter((i) => normaliza(i.label).includes(q) || normaliza(i.grupo).includes(q));
  }, [itens, query]);

  // Atalho global — Ctrl/Cmd+K abre/fecha de qualquer lugar do app.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!aberta);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberta, onOpenChange]);

  // Abrir = focar input e zerar estado anterior.
  useEffect(() => {
    if (aberta) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery("");
      setAtivo(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [aberta]);

  if (!aberta) return null;

  function executar(item: Item | undefined) {
    if (!item) return;
    onOpenChange(false);
    item.run();
  }

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") onOpenChange(false);
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setAtivo((a) => Math.min(a + 1, filtrados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      executar(filtrados[ativo]);
    }
  }

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Paleta de comandos">
      <button
        type="button"
        aria-label="Fechar paleta"
        onClick={() => onOpenChange(false)}
        className="absolute inset-0 bg-black/60"
      />
      <div className="relative mx-auto mt-[16vh] w-full max-w-md px-4">
        <div className="overflow-hidden rounded-xl border border-hairline bg-overlay shadow-2xl shadow-black/50">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setAtivo(0);
            }}
            onKeyDown={onInputKey}
            placeholder="Ir para…"
            aria-label="Buscar destino"
            className="w-full border-b border-hairline bg-transparent px-4 py-3 text-sm text-floral outline-none placeholder:text-olive"
          />
          <ul role="listbox" aria-label="Destinos" className="max-h-[300px] overflow-y-auto p-1.5">
            {filtrados.length === 0 && (
              <li className="px-3 py-6 text-center text-[13px] text-bone/60">Nada encontrado.</li>
            )}
            {filtrados.map((item, idx) => (
              <li key={item.id} role="option" aria-selected={idx === ativo}>
                <button
                  type="button"
                  onMouseEnter={() => setAtivo(idx)}
                  onClick={() => executar(item)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors ${
                    idx === ativo ? "bg-surface-hover text-floral" : "text-bone"
                  }`}
                >
                  <span className="text-[13px]">{item.label}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-[11px] text-bone/60">{item.grupo}</span>
                    {idx === ativo && (
                      <CornerDownLeft aria-hidden="true" className="h-3 w-3 text-bone/40" />
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
