"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

/* Alternância de tema. Escuro é o default da marca (ver brand/BRAND.md: o nicho
   inteiro é claro/azul, e o Boreal se posiciona contra isso) — o claro é opção,
   não padrão. Quem nunca tocou aqui vê a identidade escura.

   A classe vive no <html>: `dark` (shadcn + default) ou `light`. A troca é
   aplicada antes do primeiro paint pelo script inline em layout.tsx; este
   componente só reflete e grava a escolha. */

export const TEMA_KEY = "boreal:tema";
export type Tema = "escuro" | "claro";

/** Tema atual, reativo à troca. Só para o que NÃO dá pra resolver em CSS —
 *  hoje a rampa de cor do heat-map/treemap, que é calculada em JS por tile. */
export function useTemaClaro(): boolean {
  const [claro, setClaro] = useState(false);
  useEffect(() => {
    const html = document.documentElement;
    const ler = () => setClaro(html.classList.contains("light"));
    ler();
    const obs = new MutationObserver(ler);
    obs.observe(html, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return claro;
}

function aplicar(tema: Tema) {
  const html = document.documentElement;
  html.classList.toggle("light", tema === "claro");
  html.classList.toggle("dark", tema === "escuro");
  // Barra do browser no mobile acompanha o fundo (senão fica preta sobre UI clara).
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", tema === "claro" ? "#fffbf4" : "#11120d");
}

export function TemaToggle({ compacta }: { compacta: boolean }) {
  // Começa em "escuro" (igual ao SSR) e corrige pós-mount lendo o DOM, que o
  // script inline já ajustou — evita mismatch de hidratação.
  const [tema, setTema] = useState<Tema>("escuro");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTema(document.documentElement.classList.contains("light") ? "claro" : "escuro");
  }, []);

  function alternar() {
    const proximo: Tema = tema === "claro" ? "escuro" : "claro";
    setTema(proximo);
    aplicar(proximo);
    try {
      localStorage.setItem(TEMA_KEY, proximo);
    } catch {
      // storage indisponível: a escolha vale só nesta navegação
    }
  }

  const Icone = tema === "claro" ? Moon : Sun;
  const rotulo = tema === "claro" ? "Tema escuro" : "Tema claro";

  return (
    <button
      type="button"
      onClick={alternar}
      title={compacta ? rotulo : undefined}
      aria-label={rotulo}
      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12px] text-ink-muted transition-colors hover:bg-surface hover:text-ink-soft focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50 ${
        compacta ? "justify-center" : ""
      }`}
    >
      <Icone aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.75} />
      {!compacta && <span>{rotulo}</span>}
    </button>
  );
}
