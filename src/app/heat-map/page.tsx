import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapaSetores } from "@/components/MapaSetores";
import { permissoesAtuais, temModulo } from "@/lib/permissoes";

export const metadata: Metadata = {
  title: "Heat-map de setores",
  description:
    "Treemap de atividade de M&A por setor (divisão CNAE), filtrável por região do Brasil. Tamanho por volume de aquisições, cor por intensidade. Para priorizar onde o mercado está quente.",
};

/* Módulo vendido à parte: inteligência de mercado cross-setor, não a lista de
   alvos. Diferente de setor e praça, que delimitam um universo, aqui o default é
   DESLIGADO — quem não comprou não vê.

   notFound() em vez de uma tela de "faça upgrade": os dados do heat-map vêm de
   JSON empacotado no app, fora do alcance da RLS, então a única barreira é esta.
   Vitrine de produto pago é decisão comercial, e não é minha para tomar. */
export default async function HeatMap() {
  if (!temModulo(await permissoesAtuais(), "heatmap")) notFound();
  return <MapaSetores />;
}
