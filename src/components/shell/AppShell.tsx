"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Crosshair,
  Table2,
  CalendarClock,
  Flame,
  LayoutGrid,
  BadgeCheck,
  ChartNoAxesColumn,
  Building2,
  Menu,
  X,
  ChevronDown,
  PanelLeftClose,
  PanelLeft,
  type LucideIcon,
} from "lucide-react";
import { NavLogo } from "@/components/brand/NavLogo";
import { Mark } from "@/components/brand/Mark";
import { CommandPalette } from "./CommandPalette";
import { TemaToggle } from "./TemaToggle";

/* ── Estrutura de navegação do workbench ─────────────────────────────────
   Três grupos: Trabalho (o dia a dia do analista), Inteligência (mapas de
   mercado) e Prova (as páginas de metodologia/credibilidade — servem ao
   pitch, ficam colapsadas por default). Agenda vira rota própria na F3. */

export type NavItem = { href: string; label: string; icon: LucideIcon };
export type NavGrupo = { label: string; items: NavItem[]; colapsavel?: boolean };

export const NAV_GRUPOS: NavGrupo[] = [
  {
    label: "Trabalho",
    items: [
      { href: "/", label: "Radar", icon: Crosshair },
      { href: "/pipeline", label: "Pipeline", icon: Table2 },
      { href: "/agenda", label: "Agenda", icon: CalendarClock },
    ],
  },
  {
    label: "Inteligência",
    items: [
      { href: "/heat-map", label: "Heat-map", icon: Flame },
      { href: "/setores", label: "Setores", icon: LayoutGrid },
    ],
  },
  {
    label: "Prova",
    colapsavel: true,
    items: [
      { href: "/validacao", label: "Validação", icon: BadgeCheck },
      { href: "/mercado", label: "Mercado", icon: ChartNoAxesColumn },
      { href: "/consolidadores", label: "Consolidadores", icon: Building2 },
    ],
  },
];

function ativoEm(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Título da rota atual pro topbar (rotas fora da sidebar têm fallback próprio).
function tituloDaRota(pathname: string): string {
  for (const g of NAV_GRUPOS) {
    for (const item of g.items) {
      if (ativoEm(pathname, item.href)) return item.label;
    }
  }
  if (pathname.startsWith("/empresa")) return "Empresa";
  return "Boreal";
}

const SIDEBAR_KEY = "boreal:sidebar-colapsada";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [provaAberta, setProvaAberta] = useState(false);
  const [colapsada, setColapsada] = useState(false);
  const [paletteAberta, setPaletteAberta] = useState(false);

  // Preferência de sidebar colapsada — lida pós-mount (evita mismatch de hydration).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setColapsada(localStorage.getItem(SIDEBAR_KEY) === "1");
  }, []);

  // Grupo Prova abre sozinho quando a rota ativa mora dentro dele.
  useEffect(() => {
    const dentroDeProva = NAV_GRUPOS.find((g) => g.colapsavel)?.items.some((i) =>
      ativoEm(pathname, i.href)
    );
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (dentroDeProva) setProvaAberta(true);
    setDrawerAberto(false); // navegação fecha o drawer mobile
  }, [pathname]);

  function toggleColapsada() {
    setColapsada((c) => {
      localStorage.setItem(SIDEBAR_KEY, c ? "0" : "1");
      return !c;
    });
  }

  // Certificado de proveniência e gate de acesso vivem FORA do shell:
  // o primeiro é artefato client-facing (look editorial próprio), o segundo é pré-login.
  if (pathname.startsWith("/proveniencia") || pathname.startsWith("/acesso")) {
    return <>{children}</>;
  }

  const itemCls = (ativo: boolean) =>
    `group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50 ${
      ativo
        ? "bg-surface-hover text-ink"
        : "text-ink-muted hover:bg-surface hover:text-ink-soft"
    }`;

  // `compacta` = só ícones (sidebar colapsada). O drawer mobile SEMPRE mostra labels.
  const linksDoGrupo = (grupo: NavGrupo, compacta: boolean, aposClicar?: () => void) =>
    grupo.items.map((item) => {
      const ativo = ativoEm(pathname, item.href);
      const Icon = item.icon;
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={aposClicar}
          aria-current={ativo ? "page" : undefined}
          title={compacta ? item.label : undefined}
          className={itemCls(ativo)}
        >
          <Icon aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          {!compacta && <span className="truncate">{item.label}</span>}
        </Link>
      );
    });

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* ── Sidebar (desktop) ─────────────────────────────────────────── */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-hairline md:flex ${
          colapsada ? "w-14" : "w-[220px]"
        }`}
      >
        <div className={`flex h-14 items-center border-b border-hairline ${colapsada ? "justify-center" : "px-4"}`}>
          {colapsada ? (
            <Link href="/" aria-label="Ir para o Radar" className="transition-opacity hover:opacity-70">
              <Mark className="h-5 w-5 text-ink" />
            </Link>
          ) : (
            <NavLogo />
          )}
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-4">
          {NAV_GRUPOS.map((grupo) => {
            const aberto = !grupo.colapsavel || provaAberta || colapsada;
            return (
              <div key={grupo.label}>
                {!colapsada &&
                  (grupo.colapsavel ? (
                    <button
                      type="button"
                      onClick={() => setProvaAberta((a) => !a)}
                      aria-expanded={provaAberta}
                      className="mb-1 flex w-full items-center justify-between rounded px-2.5 text-[11px] font-medium text-ink-muted transition-colors hover:text-ink-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50"
                    >
                      {grupo.label}
                      <ChevronDown
                        aria-hidden="true"
                        className={`h-3 w-3 transition-transform ${provaAberta ? "rotate-180" : ""}`}
                      />
                    </button>
                  ) : (
                    <p className="mb-1 px-2.5 text-[11px] font-medium text-ink-muted">
                      {grupo.label}
                    </p>
                  ))}
                {aberto && <div className="space-y-0.5">{linksDoGrupo(grupo, colapsada)}</div>}
              </div>
            );
          })}
        </nav>

        <div className="space-y-0.5 border-t border-hairline p-2">
          <TemaToggle compacta={colapsada} />
          <button
            type="button"
            onClick={toggleColapsada}
            className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12px] text-ink-muted transition-colors hover:bg-surface hover:text-ink-soft focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50 ${colapsada ? "justify-center" : ""}`}
            aria-label={colapsada ? "Expandir sidebar" : "Colapsar sidebar"}
          >
            {colapsada ? (
              <PanelLeft aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
            ) : (
              <>
                <PanelLeftClose aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
                <span>Colapsar</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* ── Área de trabalho ──────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-hairline bg-canvas px-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerAberto(true)}
              className="rounded-md p-1.5 text-ink-soft transition-colors hover:bg-surface-hover hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50 md:hidden"
              aria-label="Abrir menu"
            >
              <Menu aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
            </button>
            <span className="md:hidden">
              <NavLogo />
            </span>
            <span className="hidden text-[13px] font-medium text-ink-soft md:inline">
              {tituloDaRota(pathname)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setPaletteAberta(true)}
            className="flex items-center gap-2 rounded-md border border-hairline px-2.5 py-1.5 text-[12px] text-ink-muted transition-colors hover:border-hairline-hover hover:text-ink-soft focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50"
            aria-label="Abrir paleta de comandos"
          >
            <span className="hidden sm:inline">Ir para…</span>
            <kbd className="rounded border border-hairline bg-surface px-1 py-0.5 font-data text-[10px] text-ink-soft">
              Ctrl K
            </kbd>
          </button>
        </header>

        {/* div, não <main> — cada página já traz o seu <main> (evita landmark duplicado) */}
        <div className="min-w-0 flex-1">{children}</div>
      </div>

      {/* ── Drawer (mobile) ───────────────────────────────────────────── */}
      {drawerAberto && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setDrawerAberto(false)}
            className="absolute inset-0 bg-black/60"
          />
          <div className="absolute inset-y-0 left-0 flex w-[260px] flex-col border-r border-hairline bg-canvas">
            <div className="flex h-14 items-center justify-between border-b border-hairline px-4">
              <NavLogo />
              <button
                type="button"
                onClick={() => setDrawerAberto(false)}
                className="rounded-md p-1.5 text-ink-soft transition-colors hover:bg-surface-hover hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50"
                aria-label="Fechar menu"
              >
                <X aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </div>
            <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-4">
              {NAV_GRUPOS.map((grupo) => (
                <div key={grupo.label}>
                  <p className="mb-1 px-2.5 text-[11px] font-medium text-ink-muted">
                    {grupo.label}
                  </p>
                  <div className="space-y-0.5">{linksDoGrupo(grupo, false, () => setDrawerAberto(false))}</div>
                </div>
              ))}
            </nav>
          </div>
        </div>
      )}

      <CommandPalette aberta={paletteAberta} onOpenChange={setPaletteAberta} />
    </div>
  );
}
