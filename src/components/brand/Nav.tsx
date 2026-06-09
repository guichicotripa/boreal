"use client";

import { usePathname } from "next/navigation";
import { NavLogo } from "./NavLogo";

// Páginas do fluxo real do usuário — top-level.
const FLUXO: { href: string; label: string }[] = [
  { href: "/", label: "Início" },
  { href: "/pipeline", label: "Pipeline" },
];

// Páginas de metodologia/credibilidade — agrupadas no mega-menu (servem ao pitch, não ao dia a dia).
const METODOLOGIA: { href: string; label: string; desc: string }[] = [
  { href: "/validacao", label: "Validação", desc: "Recall do score em vendas reais" },
  { href: "/mercado", label: "Mercado", desc: "TAM e dinâmica de M&A" },
  { href: "/consolidadores", label: "Consolidadores", desc: "Quem compra e o que procura" },
  { href: "/setores", label: "Setores", desc: "Cobertura e lente por setor" },
];

function ativoEm(pathname: string, href: string): boolean {
  // "/" só casa exato; o resto casa a rota e sub-rotas.
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav() {
  const pathname = usePathname();
  const grupoAtivo = METODOLOGIA.some((m) => ativoEm(pathname, m.href));

  const linkCls = (ativo: boolean) =>
    `font-data text-[11px] uppercase tracking-wider transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 ${
      ativo ? "text-floral" : "text-bone/70 hover:text-bone"
    }`;

  return (
    <nav className="sticky top-0 z-50 border-b border-hairline bg-smoky px-6 py-4">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <NavLogo />
        <div className="flex items-center gap-5">
          {FLUXO.map(({ href, label }) => {
            const ativo = ativoEm(pathname, href);
            return (
              <a key={href} href={href} aria-current={ativo ? "page" : undefined} className={linkCls(ativo)}>
                {label}
              </a>
            );
          })}

          {/* Metodologia — mega-menu 2×2, abre no hover/foco (acessível por teclado e toque) */}
          <div className="group relative">
            <button
              type="button"
              aria-haspopup="true"
              className={`flex items-center gap-1 ${linkCls(grupoAtivo)}`}
            >
              Metodologia
              <svg
                aria-hidden="true"
                viewBox="0 0 10 10"
                fill="currentColor"
                className="h-[9px] w-[9px] transition-transform duration-200 group-hover:rotate-180 group-focus-within:rotate-180"
              >
                <path d="M1.5 2.5 L8.5 2.5 L5 7.5 Z" />
              </svg>
            </button>

            {/* outer: ponte de hover (pt-3 transparente, sem dead-zone) + animação de entrada */}
            <div
              role="menu"
              className="invisible absolute right-0 top-full -translate-y-1 pt-3 opacity-0 transition-all duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100"
            >
              {/* box visível */}
              <div className="relative grid w-[400px] grid-cols-2 gap-0.5 rounded-xl border border-hairline bg-smoky p-1.5 shadow-lg shadow-black/40">
                {/* rabinho — ancora a box no gatilho */}
                <span
                  aria-hidden="true"
                  className="absolute -top-[7px] right-[16px] h-[13px] w-[13px] rotate-45 border-l border-t border-hairline bg-smoky"
                />
                {METODOLOGIA.map(({ href, label, desc }) => {
                  const ativo = ativoEm(pathname, href);
                  return (
                    <a
                      key={href}
                      href={href}
                      role="menuitem"
                      aria-current={ativo ? "page" : undefined}
                      className={`block rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:bg-surface-hover ${
                        ativo ? "bg-surface-hover" : ""
                      }`}
                    >
                      <div className="font-sans text-[13px] font-medium text-floral">{label}</div>
                      <div className="mt-0.5 text-[11.5px] leading-snug text-bone/70">{desc}</div>
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
