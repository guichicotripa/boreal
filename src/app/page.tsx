/* Casca de servidor do Radar. Existe por um motivo só: o contrato da firma mora no banco e a
 * bancada é client component.
 *
 * Antes desta divisão, `page.tsx` era o "use client" inteiro e desenhava `SETORES` fixo do
 * registry. Resultado: a Setter, que fechou piloto por três mandatos, via os quatro setores
 * validados no switcher. Depois da migration 0014 o banco passa a NEGAR esses setores pra ela, e
 * botão que sempre devolve lista vazia é pior que botão ausente — parece produto quebrado.
 *
 * Aqui a divisão é rasa de propósito: este arquivo só lê a permissão e resolve o universo; toda a
 * interação continua num arquivo só, em RadarClient. */
import { permissoesAtuais, universoDaOrg } from "@/lib/permissoes";
import { SETORES } from "@/lib/setores";
import { MANDATOS } from "@/lib/mandatos";
import RadarClient from "@/components/radar/RadarClient";

export default async function Page() {
  const perm = await permissoesAtuais();
  const universo = universoDaOrg(perm, SETORES, MANDATOS);

  return (
    <RadarClient
      setores={SETORES.filter((s) => universo.setores.includes(s.id))}
      mandatos={MANDATOS.filter((m) => universo.mandatos.includes(m.id))}
    />
  );
}
