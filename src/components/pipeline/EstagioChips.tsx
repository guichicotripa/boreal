"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Oportunidade, EstagioOportunidade, ResultadoOportunidade } from "@/lib/types";
import { ESTAGIOS, RESULTADOS } from "./helpers";

export function EstagioChip({
  o,
  onPatch,
}: {
  o: Oportunidade;
  onPatch: (id: string, campos: Partial<Oportunidade>) => void;
}) {
  return (
    <Select
      value={o.estagio}
      onValueChange={(v) => onPatch(o.id, { estagio: v as EstagioOportunidade })}
    >
      <SelectTrigger className="relative h-auto w-fit max-w-full justify-start border-0 bg-transparent pl-2.5 pr-5 py-0.5 text-[11px] text-ink-soft/60 transition-colors hover:text-ink-soft focus:ring-0 focus-visible:ring-1 focus-visible:ring-ink/50 [&>svg]:absolute [&>svg]:right-1 [&>svg]:top-1/2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:-translate-y-1/2 [&>svg]:opacity-40">
        <SelectValue className="flex-none text-left">
          {ESTAGIOS.find((s) => s.id === o.estagio)?.label ?? o.estagio}
        </SelectValue>
      </SelectTrigger>
      <SelectContent sideOffset={4} className="border-hairline bg-overlay text-ink">
        {ESTAGIOS.map((s) => (
          <SelectItem
            key={s.id}
            value={s.id}
            className="text-[11px] text-ink focus:bg-surface-hover focus:text-ink"
          >
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ResultadoChip({
  o,
  onPatch,
}: {
  o: Oportunidade;
  onPatch: (id: string, campos: Partial<Oportunidade>) => void;
}) {
  const colorClass =
    o.resultado === "deal_fechado"  ? "text-ink" :
    o.resultado === "receptivo"     ? "text-ink-soft"   :
    o.resultado === "nao_receptivo" ? "text-ink-soft/60" :
    o.resultado === "perdido"       ? "text-ink-soft/45" :
    "text-ink-soft/70";

  return (
    <Select
      value={o.resultado}
      onValueChange={(v) => onPatch(o.id, { resultado: v as ResultadoOportunidade })}
    >
      <SelectTrigger
        className={`relative h-auto w-fit max-w-full justify-start border-0 bg-transparent pl-2.5 pr-5 py-0.5 text-[11px] font-medium transition-colors hover:text-ink-soft focus:ring-0 focus-visible:ring-1 focus-visible:ring-ink/50 [&>svg]:absolute [&>svg]:right-1 [&>svg]:top-1/2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:-translate-y-1/2 [&>svg]:opacity-40 ${colorClass}`}
      >
        <SelectValue className="flex-none text-left">
          {RESULTADOS.find((r) => r.id === o.resultado)?.label ?? o.resultado}
        </SelectValue>
      </SelectTrigger>
      <SelectContent sideOffset={4} className="border-hairline bg-overlay text-ink">
        {RESULTADOS.map((r) => (
          <SelectItem
            key={r.id}
            value={r.id}
            className="text-[11px] text-ink focus:bg-surface-hover focus:text-ink"
          >
            {r.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
