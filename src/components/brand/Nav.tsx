"use client";

import { usePathname } from "next/navigation";
import { NavLogo } from "./NavLogo";

// Itens do nav, na ordem de exibição.
const LINKS: { href: string; label: string }[] = [
  { href: "/setores", label: "Setores" },
  { href: "/worklist", label: "Worklist" },
  { href: "/validacao", label: "Validação" },
  { href: "/mercado", label: "Mercado" },
  { href: "/consolidadores", label: "Consolidadores" },
  { href: "/pipeline", label: "Pipeline" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 border-b border-hairline bg-smoky px-6 py-4">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <NavLogo />
        <div className="flex items-center gap-5">
          {LINKS.map(({ href, label }) => {
            // Ativo = rota atual (ou sub-rota). Floral fica reservado à página atual;
            // inativos vivem em Bone/70 e sobem só até Bone no hover.
            const ativo = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <a
                key={href}
                href={href}
                aria-current={ativo ? "page" : undefined}
                className={`font-data text-[11px] uppercase tracking-wider transition-colors ${
                  ativo ? "text-floral" : "text-bone/70 hover:text-bone"
                }`}
              >
                {label}
              </a>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
