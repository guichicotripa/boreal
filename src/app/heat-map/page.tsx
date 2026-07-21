import type { Metadata } from "next";
import { MapaSetores } from "@/components/MapaSetores";

export const metadata: Metadata = {
  title: "Heat-map de setores",
  description:
    "Treemap de atividade de M&A por setor (divisão CNAE), filtrável por região do Brasil. Tamanho por volume de aquisições, cor por intensidade. Para priorizar onde o mercado está quente.",
};

export default function HeatMap() {
  return <MapaSetores />;
}
