"use client";

import { PipelineView } from "@/components/pipeline/PipelineView";

// Agenda — a fila do dia (atrasadas → data → score), como rota própria.
// É a tela de abertura do dia do analista; o funil completo vive em /pipeline.
export default function AgendaPage() {
  return <PipelineView modo="agenda" />;
}
