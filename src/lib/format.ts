// Helpers de formatação e constantes de apresentação compartilhados entre a home
// (lista de cards) e a página da empresa. Centralizados aqui para que o vocabulário
// visual (badge de score, faixa etária, CNPJ) seja idêntico em toda superfície.

export const FAIXA_LABEL: Record<string, string> = {
  "1": "0–12", "2": "13–20", "3": "21–30", "4": "31–40", "5": "41–50",
  "6": "51–60", "7": "61–70", "8": "71–80", "9": "80+",
};

// Cor da faixa etária — quente (risco) só nas faixas que sinalizam sucessão.
export const FAIXA_COLOR: Record<string, string> = {
  "9": "bg-risk-high/15 text-risk-high", // 80+
  "8": "bg-risk-high/15 text-risk-high", // 71–80
  "7": "bg-risk-mid/15 text-risk-mid",   // 61–70
  "6": "bg-surface text-ink-soft",           // 51–60
};

// Estilo do badge de score por tier. Único lugar onde a cor de risco vive (regra do brand v3).
export const TIER_STYLES = {
  alto:  { badge: "border-risk-high/40 bg-risk-high/5", text: "text-risk-high", bar: "bg-risk-high/70", label: "ALTO"  },
  medio: { badge: "border-risk-mid/40 bg-risk-mid/5",   text: "text-risk-mid",  bar: "bg-risk-mid/70",  label: "MÉD"   },
  baixo: { badge: "border-hairline bg-surface",         text: "text-ink-soft",      bar: "bg-ink-soft/60",      label: "BAIXO" },
} as const;

export const PRESENCA_LABEL: Record<string, string> = {
  alta: "presença digital alta", media: "presença digital média",
  baixa: "presença digital baixa", nenhuma: "sem presença digital",
};

export function formatCnpj(cnpj: string): string {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export function formatTelefone(tel: string): string {
  const d = tel.replace(/\D/g, "");
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  return tel;
}

// Capital compacto — bem mais varrível que o valor cheio (R$ 52,5 mi vs R$ 52.500.000).
export function formatCapitalCompact(v: number | null): string | null {
  if (v == null) return null;
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  return `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

// Ano de fundação + anos de operação a partir de data_inicio_atividade (YYYY-MM-DD).
export function anosOperacao(dataInicio: string | null): { ano: string; anos: number | null } {
  if (!dataInicio) return { ano: "—", anos: null };
  const ano = dataInicio.slice(0, 4);
  const n = Number(ano);
  return { ano, anos: Number.isFinite(n) ? new Date().getFullYear() - n : null };
}

// Faixa etária do sócio mais velho (pessoa física: faixa 1–9), legível.
export function socioMaisVelhoLabel(faixas: (string | null)[]): string | null {
  const pf = faixas
    .map((f) => Number(f))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 9);
  return pf.length ? FAIXA_LABEL[String(Math.max(...pf))] : null;
}
