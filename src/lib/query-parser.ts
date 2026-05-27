// Parser heurístico (por palavra-chave) — fallback quando o LLM não responde.
// Determinístico, sem dependência externa. Garante que a demo nunca quebra.
import type { SearchFilters } from "./types";

export function parseQueryHeuristic(texto: string): SearchFilters {
  const t = texto.toLowerCase();

  // ── CNAE ──────────────────────────────────────────────────────────────────
  let cnaePrefixes: string[] = [];
  if (/metalurgia|metal[úu]rgic/.test(t)) cnaePrefixes.push("24");
  if (/esquadria|estrutura|serralh|caldeiraria|produto.*metal/.test(t)) cnaePrefixes.push("25");
  if (/m[áa]quina|equipamento/.test(t)) cnaePrefixes.push("28");
  // "metalmecânica" genérico ou nada reconhecido → os três grupos
  if (cnaePrefixes.length === 0 || /metalmec[âa]nic/.test(t)) cnaePrefixes = ["24", "25", "28"];

  // ── Idade dos sócios → faixa_etaria (1=0-12 … 6=51-60, 7=61-70, 8=71-80, 9=80+) ──
  let minFaixaEtaria: number | null = null;
  const idade = t.match(/(\d{2})\s*anos/);
  if (idade) {
    const n = parseInt(idade[1], 10);
    if (n >= 80) minFaixaEtaria = 9;
    else if (n >= 70) minFaixaEtaria = 8;
    else if (n >= 60) minFaixaEtaria = 7;
    else if (n >= 50) minFaixaEtaria = 6;
    else if (n >= 40) minFaixaEtaria = 5;
  } else if (/idoso|idosa|aposentad|envelhec|sucess[ãa]o/.test(t)) {
    minFaixaEtaria = 7; // 61+ como proxy de risco sucessório
  }

  // ── Idade da empresa → ano máximo de fundação ───────────────────────────────
  let maxAnoFundacao: number | null = null;
  const antes = t.match(/antes de (\d{4})/);
  const maisAnos = t.match(/mais de (\d{1,3})\s*anos/);
  if (antes) {
    maxAnoFundacao = parseInt(antes[1], 10);
  } else if (maisAnos && /empresa|fundad|mercado|atividade|opera/.test(t)) {
    maxAnoFundacao = new Date().getFullYear() - parseInt(maisAnos[1], 10);
  } else if (/antiga|tradicional|d[ée]cadas/.test(t)) {
    maxAnoFundacao = new Date().getFullYear() - 25;
  }

  return { cnaePrefixes, minFaixaEtaria, maxAnoFundacao, limit: 50 };
}
