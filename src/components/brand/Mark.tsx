/**
 * Boreal — mark (onda dupla 3a).
 * Geometria fiel ao SVG canônico em /brand/logo/mark-floral.svg.
 * Cor via `currentColor` — herda do text-* do pai.
 */
export function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      role="img"
      aria-label="Boreal"
      fill="none"
      stroke="currentColor"
    >
      <g transform="translate(0 -15)">
        <path strokeWidth={7} d="M8 60 C 30 42 46 42 60 60 C 74 78 90 78 112 60" />
      </g>
      <g transform="translate(7 16)">
        <path strokeWidth={13} d="M8 60 C 30 42 46 42 60 60 C 74 78 90 78 112 60" />
      </g>
    </svg>
  );
}
