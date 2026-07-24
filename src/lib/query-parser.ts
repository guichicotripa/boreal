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

  return { cnaePrefixes, minFaixaEtaria, maxAnoFundacao, ufs: ufsDaConsulta(texto), limit: 50 };
}

// ── Praça ───────────────────────────────────────────────────────────────────
// Antes a UF era ignorada: "construtoras no Rio Grande do Sul" devolvia empresas
// de SP sem avisar. Devolver a região errada em silêncio é pior que devolver
// nada — com o filtro, uma praça não indexada dá zero e o estado vazio explica.
const UF_POR_NOME: Record<string, string> = {
  acre: "AC", alagoas: "AL", amapa: "AP", amazonas: "AM", bahia: "BA",
  ceara: "CE", "distrito federal": "DF", "espirito santo": "ES", goias: "GO",
  maranhao: "MA", "mato grosso do sul": "MS", "mato grosso": "MT",
  "minas gerais": "MG", para: "PA", paraiba: "PB", parana: "PR",
  pernambuco: "PE", piaui: "PI", "rio de janeiro": "RJ",
  "rio grande do norte": "RN", "rio grande do sul": "RS", rondonia: "RO",
  roraima: "RR", "santa catarina": "SC", "sao paulo": "SP", sergipe: "SE",
  tocantins: "TO",
};
const SIGLAS = new Set(Object.values(UF_POR_NOME));

/** Extrai UFs citadas por nome ("no Paraná") ou sigla ("em MG"). */
export function ufsDaConsulta(texto: string): string[] | null {
  const original = texto.toLowerCase();
  const t = original.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const achadas = new Set<string>();

  // Do nome mais longo pro mais curto: sem isso "parana" casa "para" (PA) e
  // "mato grosso do sul" casa "mato grosso". Fronteira de palavra pelo mesmo motivo.
  const nomes = Object.entries(UF_POR_NOME).sort((a, b) => b[0].length - a[0].length);
  let restante = t;
  for (const [nome, sigla] of nomes) {
    // "para" é preposição comum em português ("empresas PARA aquisição"); só vale
    // como estado se vier acentuado no texto original.
    // Sem \b final: no regex do JS o "á" não é caractere de palavra, então
    // "\bpará\b" nunca casa. "\bpará" basta — não pega "paraná" nem "paraíba",
    // que têm outra letra no lugar do acento.
    if (nome === "para" && !/\bpará/.test(original)) continue;
    const re = new RegExp(`\\b${nome}\\b`);
    if (re.test(restante)) {
      achadas.add(sigla);
      restante = restante.replace(re, " ");
    }
  }
  // Sigla solta: fronteira de palavra pra não pegar dentro de outra palavra.
  for (const m of t.matchAll(/\b([a-z]{2})\b/g)) {
    const s = m[1].toUpperCase();
    if (SIGLAS.has(s)) achadas.add(s);
  }
  return achadas.size ? [...achadas] : null;
}
