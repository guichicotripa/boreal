import type {
  Oportunidade, EstagioOportunidade, ResultadoOportunidade, TipoInteracao,
} from "@/lib/types";
import monitor from "@/lib/monitor.json";

/* Helpers e constantes compartilhados pelas peças do pipeline (View, Row,
   ColHeader, chips, log). Puro — sem React. */

export function formatTelefone(tel: string) {
  const d = tel.replace(/\D/g, "");
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  return tel;
}

export function dataCurta(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function diasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

// Sócio mais velho (maior faixa_etaria) — geralmente o fundador/decisor.
export function socioMain(socios?: { nome: string; faixa_etaria?: string | null }[]) {
  if (!socios?.length) return null;
  return [...socios].sort(
    (a, b) => Number(b.faixa_etaria ?? 0) - Number(a.faixa_etaria ?? 0)
  )[0];
}

// Data ISO mais recente num array de { criado_em }.
export function ultimoToqueEm(interacoes?: { criado_em: string }[]): string | null {
  if (!interacoes?.length) return null;
  return interacoes.reduce((max, i) => (i.criado_em > max ? i.criado_em : max), "");
}

export function hoje() {
  return new Date().toISOString().slice(0, 10);
}

export function atrasou(o: Oportunidade) {
  return o.proxima_acao_em != null && o.proxima_acao_em < hoje();
}

// Prioridade: atrasadas primeiro → data mais cedo → maior score.
export function porPrioridade(a: Oportunidade, b: Oportunidade) {
  const aA = atrasou(a) ? 0 : 1;
  const bA = atrasou(b) ? 0 : 1;
  if (aA !== bA) return aA - bA;
  const ad = a.proxima_acao_em ?? "9999-99-99";
  const bd = b.proxima_acao_em ?? "9999-99-99";
  if (ad !== bd) return ad < bd ? -1 : 1;
  return (b.score_no_save ?? -1) - (a.score_no_save ?? -1);
}

export type Mudanca = { tipo: string; severidade: string; descricao: string };
const MUDANCAS = monitor.mudancas as Record<string, Mudanca>;
export function mudancaDe(cnpj: string): Mudanca | null {
  return MUDANCAS[cnpj.slice(0, 8)] ?? null;
}

export const TIPOS_INTERACAO: { id: TipoInteracao; label: string }[] = [
  { id: "ligacao",  label: "Ligação"  },
  { id: "email",    label: "Email"    },
  { id: "reuniao",  label: "Reunião"  },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "nota",     label: "Nota"     },
];

export const ESTAGIOS: { id: EstagioOportunidade; label: string; emptyMsg: string }[] = [
  { id: "identificado", label: "Identificado", emptyMsg: "Salve empresas da busca para começar."  },
  { id: "abordado",     label: "Abordado",     emptyMsg: "Ninguém abordado ainda."               },
  { id: "em_conversa",  label: "Em conversa",  emptyMsg: "Sem conversas em curso."               },
  { id: "qualificado",  label: "Qualificado",  emptyMsg: "Nenhuma qualificada ainda."            },
  { id: "entregue",     label: "Entregue",     emptyMsg: "Nada entregue à boutique."             },
  { id: "arquivado",    label: "Arquivado",    emptyMsg: "Nada arquivado."                       },
];

export const RESULTADOS: { id: ResultadoOportunidade; label: string }[] = [
  { id: "pendente",      label: "Aguardando retorno" },
  { id: "receptivo",     label: "Fundador receptivo" },
  { id: "nao_receptivo", label: "Não receptivo"      },
  { id: "deal_fechado",  label: "Deal fechado 🎉"    },
  { id: "perdido",       label: "Perdido"            },
];

// 14px grip | 48px score | 1fr empresa | 144px dono+estagio | 128px proxima acao | 175px contato | 92px notas | 28px remove
// Notas é FIXA (92px), não `auto`: como `auto` mede o conteúdo (texto curto no header, botão largo nas linhas),
// ela roubava largura da 1fr e desalinhava todas as colunas após Empresa entre header e linhas.
export const COL = "14px 48px 1fr 144px 128px 175px 92px 28px";
