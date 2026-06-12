import Link from "next/link";
import { Mark } from "@/components/brand/Mark";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-start justify-center px-6 py-16">
      {/* Mark com tamanho fixo via style inline (independe do JIT do Tailwind);
          w-full/h-full no SVG são utilities já no bundle. Sem isso, o SVG inline
          estica pra largura do container e estoura a viewport. */}
      <span
        className="block shrink-0 text-olive"
        style={{ width: 48, height: 48 }}
      >
        <Mark className="h-full w-full" />
      </span>

      {/* Overline */}
      <p className="mt-8 font-data text-[11px] uppercase tracking-[0.2em] text-bone">
        <span className="text-floral">404</span>{" "}
        <span className="text-olive">·</span>{" "}
        <span>Página não encontrada</span>
      </p>

      {/* Headline */}
      <h1 className="mt-5 max-w-xl font-display text-3xl leading-[1.1] tracking-tight text-floral md:text-[40px]">
        Essa trilha não leva a lugar nenhum.
      </h1>

      {/* Subhead */}
      <p className="mt-4 max-w-md text-[15px] leading-relaxed text-bone">
        O endereço que você buscou não existe ou foi movido. Volte para o início
        e descreva uma tese para encontrar empresas.
      </p>

      <Link
        href="/"
        className="group/voltar mt-8 inline-flex items-center gap-1 font-display text-floral transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 rounded-sm"
      >
        <span className="inline-block transition-transform duration-200 group-hover/voltar:-translate-x-0.5">
          ←
        </span>{" "}
        Voltar ao início
      </Link>
    </main>
  );
}
