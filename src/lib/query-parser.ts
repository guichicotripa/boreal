// Parser heurístico (por palavra-chave) — fallback quando o LLM não responde.
// Determinístico, sem dependência externa. Garante que a demo nunca quebra.
import type { SearchFilters } from "./types";
// Com extensão: o `node --test` nativo (usado pelo npm test) não resolve
// import sem extensão, embora o bundler do Next resolva.
import { SETORES } from "./setores.ts";

export function parseQueryHeuristic(texto: string): SearchFilters {
  const t = texto.toLowerCase();
  const setor = resolverSetor(texto);

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

  return {
    cnaePrefixes: setor.cnaes,
    minFaixaEtaria,
    maxAnoFundacao,
    ufs: ufsDaConsulta(texto),
    setorForaDaBase: setor.foraDaBase,
    limit: 50,
  };
}

// ── Setor ───────────────────────────────────────────────────────────────────
// Antes: quando nada era reconhecido, o parser SILENCIOSAMENTE virava
// metalmecânica ("cnaePrefixes = ['24','25','28']"). Consequência: "clínicas com
// sócios idosos" devolvia metalúrgicas, e "construtoras" também. Igual ao bug da
// praça — responder outra coisa calado é pior que não responder.
//
// Agora o vocabulário sai do registry (setores.json), então setor novo ingerido
// passa a ser buscável sem tocar aqui, e o que NÃO está na base é dito na cara.

/** Termos que apontam pra um setor indexado. Chave = id no registry. */
const TERMOS_POR_SETOR: Record<string, RegExp> = {
  metalmec:
    /metalmec[âa]nic|metalurgia|metal[úu]rgic|esquadria|serralh|caldeiraria|usinagem|fundi[çc][ãa]o|produto.*metal|m[áa]quina|equipamento/,
  saude:
    /sa[úu]de|cl[íi]nic|hospital|laborat[óo]ri|diagn[óo]stic|odontol[óo]gic|dentist|m[ée]dic|fisioterap|imagem/,
  educacao:
    /educa[çc][ãa]o|escola|col[ée]gio|creche|ensino|educandári|infantil|pr[ée]-escola|curso/,
  agro:
    /agro|agroneg[óo]ci|agr[íi]col|agropecu[áa]ri|fazenda|pecu[áa]ri|lavoura|cultivo|planta[çc][ãa]o|gado|rebanho|safra|gr[ãa]os|soja|milho|cana-de-a[çc][úu]car|caf[ée]|citricultur|silvicultur|florestal|reflorestamen|aquicultur|piscicultur|pesca/,
};

/* Setor no registry sem termos aqui é buscável por CNAE mas INVISÍVEL pra
   consulta em texto livre — falha silenciosa que só aparece quando o cliente
   digita o nome do setor e recebe zero. O teste `query-parser.test.ts` trava
   esse esquecimento; esta constante existe pra ele poder checar. */
export const IDS_COM_TERMOS = Object.keys(TERMOS_POR_SETOR);

/* RECORTES DE MANDATO — universo ingerido que NÃO é um setor validado.

   Vive aqui e não em setores.json de propósito. O registry carrega recall, universo e nº de
   aquisições, e é o que alimenta /setores, /validacao e /mercado. Um recorte de mandato não tem
   nenhuma dessas métricas, e inventar zero ali sujaria três páginas que existem justamente pra
   dizer o que é medido. Ficar de fora do registry é a afirmação correta: está na base, dá pra
   buscar, e NÃO tem recall validado.

   Primeiro caso real: os focos que a Setter pediu em 12/08/2026, mais death care. Sem esta tabela
   a busca por "laboratório de diagnóstico veterinário" casava o regex de `saude` (que tem
   `laboratóri|diagnóstic`), filtrava pra CNAE 86 e devolvia laboratório humano, escondendo
   exatamente as 1.671 empresas recém-ingeridas. Errado e em silêncio, que é o pior modo. */
const RECORTES_DE_MANDATO: { id: string; cnaes: string[]; termos: RegExp }[] = [
  {
    id: "veterinaria",
    cnaes: ["7500", "6550", "6512"],
    termos: /veterinari|\bvet\b|\bpet\b|\bpets\b|animal|animais/,
  },
  {
    id: "deathcare",
    cnaes: ["9603", "65111"],
    termos: /funerari|funeral|funerap|cemiteri|cremac|crematori|sepultamen|jazigo|luto|death ?care|somatoconserv/,
  },
];

/** Ids dos recortes de mandato. Exportado pra o teste travar o par termos/CNAE. */
export const IDS_DE_MANDATO = RECORTES_DE_MANDATO.map((r) => r.id);

/* Setores que o usuário pode pedir e que NÃO estão indexados. Não é uma lista
   fechada do mundo — é o suficiente pra distinguir "pediu algo que não temos"
   de "não citou setor nenhum". Falso negativo aqui degrada pro comportamento
   antigo de buscar amplo, que é aceitável; falso positivo seria pior.

   Ao INGERIR um setor que está aqui, a entrada tem que sair desta lista no mesmo
   commit — senão a busca passa a negar um setor que a base já cobre. Foi o que
   aconteceu com agro: entrou no registry e saiu daqui junto. */
const TERMOS_FORA_DA_BASE: [RegExp, string][] = [
  [/constru[çc][ãa]o|construtor|empreiteir|incorporador/, "construção"],
  [/imobili[áa]ri|corretor/, "imobiliário"],
  [/transporte|log[íi]stic|transportador|frete/, "transporte e logística"],
  [/varejo|com[ée]rcio varejista|loja|supermercad|mercearia/, "varejo"],
  [/alimento|aliment[íi]ci|frigor[íi]fic|latic[íi]ni|padaria/, "alimentos"],
  [/tecnologia|software|ti\b|startup|sistemas|desenvolvimento de software/, "tecnologia"],
  [/t[êe]xtil|confec[çc][ãa]o|vestu[áa]ri|roupa/, "têxtil e confecção"],
  [/qu[íi]mic|farmac[êe]utic|cosm[ée]tic/, "química e farmacêutica"],
  [/hotel|turismo|pousada|restaurante|bar\b/, "hotelaria e alimentação fora do lar"],
  [/contabil|advocaci|jur[íi]dic|consultori/, "serviços profissionais"],
  [/energia|el[ée]tric|solar|petr[óo]le/, "energia"],
];

/** Rótulos dos setores não indexados — o prompt do LLM lê daqui, não de uma cópia. */
export const ROTULOS_FORA_DA_BASE = TERMOS_FORA_DA_BASE.map(([, rotulo]) => rotulo);

export type SetorResolvido = {
  /** Prefixos CNAE a filtrar. Vazio = sem recorte de setor. */
  cnaes: string[];
  /** Setores do registry que casaram. */
  ids: string[];
  /** Termo que o usuário pediu e a base não cobre, ou null. */
  foraDaBase: string | null;
};

export function resolverSetor(texto: string): SetorResolvido {
  const t = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

  /* Recorte de mandato VENCE o setor do registry quando casa, em vez de somar. "veterinário" e
     "funerária" são termos específicos; se o usuário disse um deles, ele não quer a união com
     saúde. Somar devolveria laboratório humano junto do veterinário, que num universo de mandato
     de 1.671 empresas é ruído que engole o sinal. */
  for (const r of RECORTES_DE_MANDATO) {
    if (r.termos.test(t)) return { cnaes: [...r.cnaes], ids: [r.id], foraDaBase: null };
  }

  const ids: string[] = [];
  const cnaes = new Set<string>();
  for (const setor of SETORES) {
    const re = TERMOS_POR_SETOR[setor.id];
    if (re && re.test(t)) {
      ids.push(setor.id);
      for (const c of setor.cnaes) cnaes.add(c);
    }
  }
  if (ids.length > 0) return { cnaes: [...cnaes], ids, foraDaBase: null };

  // Nenhum setor coberto casou. Pediu algo que não temos, ou não citou setor?
  for (const [re, rotulo] of TERMOS_FORA_DA_BASE) {
    if (re.test(t)) return { cnaes: [], ids: [], foraDaBase: rotulo };
  }
  // Não citou setor: busca ampla em tudo que está indexado (sem recorte de CNAE).
  return { cnaes: [], ids: [], foraDaBase: null };
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
