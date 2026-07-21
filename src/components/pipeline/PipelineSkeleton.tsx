// Loading = skeleton da estrutura real (não spinner/texto), conforme brand guide.
// Os blocos usam a família de superfícies em alpha; o pulse respeita prefers-reduced-motion.
export function PipelineSkeleton() {
  return (
    <div className="animate-pulse" role="status" aria-label="Carregando pipeline">
      {/* stats strip */}
      <div className="mb-6 h-[104px] rounded-xl border border-hairline bg-surface" />
      {/* tab nav */}
      <div className="flex gap-6 border-b border-hairline pb-2.5">
        {[60, 92, 104, 96, 84, 88].map((w, i) => (
          <div key={i} className="h-3 rounded bg-hairline" style={{ width: w }} />
        ))}
      </div>
      {/* filter bar */}
      <div className="my-3 flex gap-2">
        <div className="h-8 w-56 rounded bg-hairline" />
        <div className="h-8 w-40 rounded bg-hairline" />
        <div className="h-8 w-28 rounded bg-hairline" />
      </div>
      {/* rows */}
      <div className="flex flex-col gap-px">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[60px] rounded-lg border border-hairline bg-surface" />
        ))}
      </div>
    </div>
  );
}
