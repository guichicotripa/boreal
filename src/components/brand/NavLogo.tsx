"use client";

import { usePathname, useRouter } from "next/navigation";
import { Logo } from "./Logo";

/**
 * Logo na navbar — comportamento dependente da rota:
 * - Homepage (/): scroll suave ao topo, sem navegar (preserva estado da busca)
 * - Outras rotas: navega para / (homepage limpa)
 */
export function NavLogo() {
  const pathname = usePathname();
  const router = useRouter();

  function handleClick() {
    if (pathname === "/") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      router.push("/");
    }
  }

  return (
    <button
      onClick={handleClick}
      className="transition-opacity hover:opacity-70"
      aria-label={pathname === "/" ? "Voltar ao topo" : "Ir para a homepage"}
    >
      <Logo />
    </button>
  );
}
