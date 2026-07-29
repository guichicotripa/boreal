// Referência CNAE 2.0 — nomes curtos por divisão (2 díg) e seção econômica por faixa.
// Usado pelo heat-map pra rotular e agrupar as divisões. Dado estável (CONCLA/IBGE).

import { SETORES } from "./setores";

export const NOME_DIVISAO: Record<string, string> = {
  "01": "Agricultura", "02": "Silvicultura", "03": "Pesca",
  "05": "Carvão", "06": "Petróleo e gás", "07": "Minerais metálicos", "08": "Extração não-met.", "09": "Apoio à extração",
  "10": "Alimentos", "11": "Bebidas", "12": "Fumo", "13": "Têxtil", "14": "Vestuário", "15": "Couro e calçados",
  "16": "Madeira", "17": "Papel e celulose", "18": "Impressão", "19": "Coque e petróleo", "20": "Química",
  "21": "Farmacêutica", "22": "Borracha e plástico", "23": "Prod. minerais não-met.", "24": "Metalurgia", "25": "Produtos de metal",
  "26": "Informática e eletrônicos", "27": "Equip. elétricos", "28": "Máquinas e equip.", "29": "Veículos",
  "30": "Outros transportes", "31": "Móveis", "32": "Prod. diversos", "33": "Manut. e reparação",
  "35": "Eletricidade e gás", "36": "Água", "37": "Esgoto", "38": "Resíduos", "39": "Descontaminação",
  "41": "Construção de edifícios", "42": "Obras de infraestrutura", "43": "Serviços de construção",
  "45": "Comércio de veículos", "46": "Comércio atacado", "47": "Comércio varejo",
  "49": "Transporte terrestre", "50": "Transporte aquaviário", "51": "Transporte aéreo", "52": "Armazenagem", "53": "Correio",
  "55": "Alojamento", "56": "Alimentação", "58": "Edição", "59": "Áudio e vídeo", "60": "Rádio e TV", "61": "Telecom",
  "62": "TI e software", "63": "Serviços de informação", "64": "Serviços financeiros", "65": "Seguros", "66": "Aux. financeiros",
  "68": "Imobiliárias", "69": "Jurídico e contábil", "70": "Consultoria", "71": "Arquitetura e engenharia",
  "72": "Pesquisa e dev.", "73": "Publicidade", "74": "Prof. científicas", "75": "Veterinária",
  "77": "Aluguéis", "78": "Seleção de pessoal", "79": "Agências de viagem", "80": "Vigilância", "81": "Serviços a edifícios",
  "82": "Serviços a empresas", "84": "Adm. pública", "85": "Educação", "86": "Saúde humana",
  "87": "Assist. social c/ alojamento", "88": "Assist. social", "90": "Artes e espetáculos", "91": "Cultura",
  "92": "Jogos e apostas", "93": "Esporte e lazer", "94": "Org. associativas", "95": "Reparação de bens",
  "96": "Serviços pessoais", "97": "Serviços domésticos", "99": "Org. internacionais",
};

export type Secao = { sigla: string; nome: string };

// Seção econômica pela faixa de divisão (CNAE 2.0, seções A–U).
export function secaoDe(div: string): Secao {
  const n = Number(div);
  if (n >= 1 && n <= 3) return { sigla: "A", nome: "Agropecuária" };
  if (n >= 5 && n <= 9) return { sigla: "B", nome: "Extrativas" };
  if (n >= 10 && n <= 33) return { sigla: "C", nome: "Indústria de transformação" };
  if (n === 35) return { sigla: "D", nome: "Eletricidade e gás" };
  if (n >= 36 && n <= 39) return { sigla: "E", nome: "Água e saneamento" };
  if (n >= 41 && n <= 43) return { sigla: "F", nome: "Construção" };
  if (n >= 45 && n <= 47) return { sigla: "G", nome: "Comércio" };
  if (n >= 49 && n <= 53) return { sigla: "H", nome: "Transporte" };
  if (n >= 55 && n <= 56) return { sigla: "I", nome: "Alojamento e alimentação" };
  if (n >= 58 && n <= 63) return { sigla: "J", nome: "Informação e comunicação" };
  if (n >= 64 && n <= 66) return { sigla: "K", nome: "Finanças e seguros" };
  if (n === 68) return { sigla: "L", nome: "Imobiliárias" };
  if (n >= 69 && n <= 75) return { sigla: "M", nome: "Profissionais e científicas" };
  if (n >= 77 && n <= 82) return { sigla: "N", nome: "Serviços administrativos" };
  if (n === 84) return { sigla: "O", nome: "Administração pública" };
  if (n === 85) return { sigla: "P", nome: "Educação" };
  if (n >= 86 && n <= 88) return { sigla: "Q", nome: "Saúde e assistência social" };
  if (n >= 90 && n <= 93) return { sigla: "R", nome: "Artes e cultura" };
  if (n >= 94 && n <= 96) return { sigla: "S", nome: "Outros serviços" };
  if (n === 97) return { sigla: "T", nome: "Serviços domésticos" };
  return { sigla: "U", nome: "Outros" };
}

export function nomeDivisao(div: string): string {
  return NOME_DIVISAO[div] ?? `CNAE ${div}`;
}

// Divisões dos setores com SCORE validado — ganham marcador no heat-map.
// Derivado do registry: era uma cópia à mão que precisava ser lembrada a cada
// setor novo, e um esquecimento não quebra nada visível (o marcador só some).
export const DIVISOES_VALIDADAS = new Set(
  SETORES.flatMap((s) => s.cnaes.map((c) => c.slice(0, 2)))
);

// UF → região, pro filtro do heat-map.
export const UF_REGIAO: Record<string, string> = {
  AC: "N", AP: "N", AM: "N", PA: "N", RO: "N", RR: "N", TO: "N",
  AL: "NE", BA: "NE", CE: "NE", MA: "NE", PB: "NE", PE: "NE", PI: "NE", RN: "NE", SE: "NE",
  DF: "CO", GO: "CO", MT: "CO", MS: "CO",
  ES: "SE", MG: "SE", RJ: "SE", SP: "SE",
  PR: "S", RS: "S", SC: "S",
};

export const REGIOES: { id: string; nome: string }[] = [
  { id: "BR", nome: "Brasil" },
  { id: "SE", nome: "Sudeste" },
  { id: "S", nome: "Sul" },
  { id: "NE", nome: "Nordeste" },
  { id: "CO", nome: "Centro-Oeste" },
  { id: "N", nome: "Norte" },
];
