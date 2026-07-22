import { Mark } from "./Mark";

/**
 * Boreal — lockup horizontal (mark + wordmark).
 * Wordmark: Archivo Medium, caps, tracking 0.10em (fonte de verdade: /brand).
 * Cor padrão = `ink` (texto primário do tema: Floral no escuro, Smoky no claro).
 * Sobrescreva passando text-* no className.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 text-ink ${className ?? ""}`}>
      <Mark className="h-6 w-6 shrink-0" />
      <span className="font-display text-lg font-medium uppercase tracking-[0.1em]">
        Boreal
      </span>
    </span>
  );
}
