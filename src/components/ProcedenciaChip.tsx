import { procedenciaEmail, PROCEDENCIA_LABEL, PROCEDENCIA_TITULO } from "@/lib/contato";

/* Chip de procedência do e-mail. Compartilhado entre a página da empresa, o peek
   do Radar e a linha do pipeline — as três superfícies de onde alguém dispara
   uma abordagem.

   Só a de contabilidade ganha cor de risco (ocre): é a única que muda a decisão
   de quem escreve. As outras duas são informação neutra, em texto apagado. */
export function ProcedenciaChip({ email }: { email: string | null | undefined }) {
  const p = procedenciaEmail(email);
  if (!p) return null;
  return (
    <span
      title={PROCEDENCIA_TITULO[p]}
      className={`inline-flex cursor-help items-center rounded px-1.5 py-0.5 text-[10px] ${
        p === "contabilidade" ? "bg-risk-mid/15 text-risk-mid" : "text-ink-muted"
      }`}
    >
      {PROCEDENCIA_LABEL[p]}
    </span>
  );
}
