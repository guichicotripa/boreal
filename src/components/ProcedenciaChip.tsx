import { procedenciaEmail, PROCEDENCIA_LABEL, PROCEDENCIA_TITULO } from "@/lib/contato";
import type { ProcedenciaEmail } from "@/lib/contato";

/* Chip de procedência do e-mail. Compartilhado entre a página da empresa, o peek
   do Radar e a linha do pipeline — as três superfícies de onde alguém dispara
   uma abordagem.

   Contabilidade e compartilhado ganham cor de risco (ocre): são os dois casos em que a abordagem
   provavelmente não chega em quem decide, e é isso que muda a decisão de quem escreve. Os outros
   dois são informação neutra, em texto apagado.

   PREFERE A COLUNA À REGEX. `empresa.email_procedencia` é gravada pelo backfill, que classifica
   com a lista de 32 mil domínios compartilhados do CNPJ nacional. Essa lista tem quase 1 MB e
   nunca vai para o browser, então a regex de `procedenciaEmail()` só serve de reserva: ela acha
   quem SE DECLARA contabilidade no nome e não acha os maiores, que não se declaram. Enquanto a
   coluna estiver nula (empresa recém-ingerida, backfill ainda não rodou), a reserva vale. */
export function ProcedenciaChip({
  email,
  procedencia,
}: {
  email: string | null | undefined;
  procedencia?: ProcedenciaEmail | null;
}) {
  const p = procedencia ?? procedenciaEmail(email);
  if (!p) return null;
  const alerta = p === "contabilidade" || p === "intermediario";
  return (
    <span
      title={PROCEDENCIA_TITULO[p]}
      className={`inline-flex cursor-help items-center rounded px-1.5 py-0.5 text-[10px] ${
        alerta ? "bg-risk-mid/15 text-risk-mid" : "text-ink-muted"
      }`}
    >
      {PROCEDENCIA_LABEL[p]}
    </span>
  );
}

/* Quantas empresas no Brasil dividem o mesmo contato.

   É o número que mais muda a decisão de ligar, e é por isso que ele aparece como aviso e não
   como detalhe: medido nas 31 do piloto da Setter, 16 dividem o telefone com 5 ou mais empresas
   e uma delas com 454. Dentro da nossa base as mesmas linhas pareciam exclusivas.

   NÃO DIZ QUE O CONTATO É RUIM. Diz quantas empresas usam aquele número, que é verificável.
   Quem decide o que fazer com isso é quem liga. Um número de escritório pode ser o único caminho
   que existe, e nesse caso saber que é de escritório muda o roteiro da ligação, não a decisão de
   fazê-la. */
export function CompartilhamentoChip({ empresas }: { empresas: number | null | undefined }) {
  // 1 é exclusivo e não merece ruído na tela. `null` é "ainda não aferido", que também não merece.
  if (empresas == null || empresas <= 1) return null;
  const grave = empresas >= 5;
  return (
    <span
      title={`Este mesmo contato aparece em ${empresas} empresas no CNPJ do Brasil inteiro. Quanto mais empresas, maior a chance de ser de escritório de contabilidade ou de prestador, e não da empresa.`}
      className={`inline-flex cursor-help items-center rounded px-1.5 py-0.5 text-[10px] tabular-nums ${
        grave ? "bg-risk-mid/15 text-risk-mid" : "text-ink-muted"
      }`}
    >
      atende {empresas} empresas
    </span>
  );
}

/* Número que nem vale discar: comprimento errado, DDD que não existe, dígito de preenchimento.
   Diferente de compartilhado, que é um número real atendendo muita gente. Aqui o número não
   existe, e a linha só serve para a Setter não gastar a tentativa. */
export function TelefoneSuspeitoChip({ suspeito }: { suspeito: boolean | null | undefined }) {
  if (!suspeito) return null;
  return (
    <span
      title="O número não tem forma de telefone brasileiro válido: comprimento errado, DDD inexistente ou dígitos de preenchimento. Provavelmente ninguém preencheu o cadastro de verdade."
      className="inline-flex cursor-help items-center rounded bg-risk-high/15 px-1.5 py-0.5 text-[10px] text-risk-high"
    >
      número inválido
    </span>
  );
}

/* O titular pediu para não ser contatado. Cor mais forte da tela, porque é o único aviso aqui que
   não é informação para decidir: é decisão já tomada, por outra pessoa, com base na LGPD. */
export function NaoContatarChip({ ativo }: { ativo: boolean | null | undefined }) {
  if (!ativo) return null;
  return (
    <span
      title="O titular pediu para não ser contatado (LGPD, art. 18). O contato foi apagado da base e não volta nas recargas da Receita. Não procure o número em outra fonte."
      className="inline-flex cursor-help items-center rounded bg-risk-high/15 px-1.5 py-0.5 text-[10px] font-medium text-risk-high"
    >
      não contatar
    </span>
  );
}

/* Os três juntos, na ordem em que importam para quem vai abordar.

   Aceita a FORMA dos campos, e não `Empresa` inteira, porque a linha do pipeline trabalha com um
   `Pick` da empresa e não com o registro completo. Exigir `Empresa` obrigaria a linha a carregar
   campos que ela não usa só para satisfazer o tipo. */
type ContatoDaEmpresa = {
  email: string | null;
  nao_contatar?: boolean | null;
  email_procedencia?: ProcedenciaEmail | null;
  telefone_empresas_br?: number | null;
  telefone_suspeito?: boolean | null;
};

export function ContatoChips({ empresa }: { empresa: ContatoDaEmpresa }) {
  // Com oposição, os outros avisos não fazem sentido: não há contato para qualificar.
  if (empresa.nao_contatar) return <NaoContatarChip ativo />;
  return (
    <>
      <TelefoneSuspeitoChip suspeito={empresa.telefone_suspeito} />
      <CompartilhamentoChip empresas={empresa.telefone_empresas_br} />
      {empresa.email && (
        <ProcedenciaChip email={empresa.email} procedencia={empresa.email_procedencia} />
      )}
    </>
  );
}
