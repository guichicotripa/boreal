import type { SinalControle } from "@/lib/aquisicao";

/* "Essa já tem dono?", numa palavra, na linha da busca, no painel lateral e no pipeline.
 *
 * "Sem sinal de venda" NÃO vira chip. É o caso comum (635 das 1.031 conferidas), e marcar o caso
 * comum treina o olho a ignorar a marca. Só aparece o que muda a decisão de ligar.
 *
 * Os rótulos são curtos e NÃO afirmam venda. O detector lê o quadro societário, e quadro societário
 * é indício: por isso "sócia PJ de fora" e não "vendida". O porquê completo fica no hover e na
 * página da empresa. */
const ESTILO: Record<SinalControle["veredito"], { rotulo: string; classe: string } | null> = {
  "provavelmente comprada": { rotulo: "sócia PJ de fora", classe: "bg-risk-mid/15 text-risk-mid" },
  "reorganização familiar": { rotulo: "holding da família", classe: "text-ink-muted" },
  "não sei, mas o quadro mudou": { rotulo: "quadro mudou", classe: "text-ink-muted" },
  "sem sinal de venda": null,
};

export function ControleChip({ controle }: { controle: SinalControle | null | undefined }) {
  if (!controle) return null;
  const e = ESTILO[controle.veredito];
  if (!e) return null;
  return (
    <span
      title={`${controle.veredito}: ${controle.porque}. Lido do quadro societário da Receita, não é confirmação de negócio.`}
      className={`inline-flex cursor-help items-center rounded px-1.5 py-0.5 text-[10px] ${e.classe}`}
    >
      {e.rotulo}
    </span>
  );
}
