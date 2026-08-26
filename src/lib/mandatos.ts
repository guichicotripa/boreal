/* MANDATOS — universos ingeridos que NÃO são setores validados.
 *
 * Por que isto não vive em `setores.json`: o registry carrega recall, universo e nº de aquisições,
 * e é o que alimenta /setores, /validacao e /mercado. Um mandato de boutique não tem nenhuma dessas
 * métricas e não vai ter tão cedo (são universos pequenos demais pra o proxy de aquisição render
 * N que sustente recall). Pôr zero no registry sujaria três páginas que existem justamente pra
 * dizer o que é medido. Ficar de fora é a afirmação correta: está na base, dá pra listar, e NÃO
 * tem validação.
 *
 * Por que `recortes` é uma lista de pares, e não CNAE + nomes soltos: mandato quase nunca coincide
 * com um CNAE, e o filtro de nome que vale pra um CNAE não vale pro outro. "Operadora de plano de
 * saúde pet" é, dentro do 7500, quem tem PLANO/ASSISTÊNCIA no nome; dentro do 6550/6512 é o CNAE
 * inteiro, porque só as 90 empresas pet foram ingeridas ali. Achatar isso num OR único traria toda
 * clínica veterinária com "ANIMAL" no nome, que é quase todas.
 *
 * ACENTO: `razao_social` é gravada como vem da Receita, com acento, e `ilike` não normaliza. Por
 * isso as variantes acentuadas aparecem explícitas na lista. Feio e correto; a alternativa seria
 * uma coluna normalizada no banco, que é mudança de schema pra ganhar elegância.
 *
 * Contagens conferidas no Supabase em 2026-08-12, logo após a ingestão.
 */

import type { FiltroPadrao } from "./filtro-padrao";

export type Recorte = {
  /** Prefixos de CNAE. */
  cnaes: string[];
  /** Fragmentos casados contra razão social e nome fantasia. Vazio = o CNAE inteiro. */
  nomes: string[];
};

export type Mandato = {
  id: string;
  nome: string;
  /** Uma linha, mostrada abaixo do chip. Diz o que é e de onde veio. */
  descricao: string;
  recortes: Recorte[];
  /** Quantas empresas havia na ingestão. Serve pra flagrar divergência na tela. */
  empresas: number;
  /* Corte que a lista já nasce aplicando, desligável na tela. Vive no mandato e não na rota
     porque é DADO: mandato novo declara o próprio corte e a rota não muda. Ver
     src/lib/filtro-padrao.ts para a origem (áudio da Fernanda, 24/08/2026) e o porquê de ser
     porte e não capital social. */
  filtroPadrao?: FiltroPadrao;
  /* Quantas sobram depois do `filtroPadrao`. Vai PARA A TELA do cliente ("72 de 1.671"), então
     não pode ser chute: `mandatos-contagem.test.ts` confere os dois números contra o banco. */
  empresasFiltradas?: number;
};

export const MANDATOS: Mandato[] = [
  {
    id: "foco-a-vet-lab",
    nome: "Diagnóstico veterinário",
    descricao: "Foco A da Setter. Laboratórios dentro do CNAE de atividades veterinárias.",
    empresas: 1671,
    /* Porte acima de EPP, fundada até 2019 e fora do Simples: 52 das 1.671. Sem o corte do
       Simples seriam 72, e 20 delas faturam menos de R$ 4,8 MM. Ver filtro-padrao.ts. */
    filtroPadrao: { portes: ["DEMAIS"], maxAnoFundacao: 2019, excluirSimples: true },
    empresasFiltradas: 52,
    recortes: [
      {
        cnaes: ["7500"],
        nomes: ["LABORAT", "DIAGN", "PATOLOG", "ANALIS", "ANÁLIS", "CITOPATOL", "HEMATOLOG"],
      },
    ],
  },
  {
    id: "foco-b-plano-pet",
    nome: "Plano de saúde pet",
    descricao: "Foco B da Setter. Operadoras e planos, dentro de veterinária e de planos de saúde.",
    empresas: 1119,
    /* 20 das 1.119 sobrevivem ao corte (eram 31 antes de tirar os optantes do Simples). */
    filtroPadrao: { portes: ["DEMAIS"], maxAnoFundacao: 2019, excluirSimples: true },
    empresasFiltradas: 20,
    recortes: [
      {
        cnaes: ["7500"],
        nomes: ["PLANO", "ASSISTENC", "ASSISTÊNC", "SAUDE ANIMAL", "SAÚDE ANIMAL", "SAUDE PET", "SAÚDE PET", "OPERADORA"],
      },
      // 6550/6512: só as 90 empresas pet foram ingeridas, então o CNAE já é o recorte.
      { cnaes: ["6550", "6512"], nomes: [] },
    ],
  },
  {
    id: "death-care",
    nome: "Death care",
    descricao: "Funerárias, cemitérios, cremação e planos de auxílio funeral. CNAE limpo.",
    empresas: 11712,
    /* 676 das 11.712 (eram 777 antes do corte do Simples). Mandato ainda sem dono na Setter; o
       padrão vale igual, e é aqui que ele mais poupa tela: o universo é 7x o dos dois de pet. */
    filtroPadrao: { portes: ["DEMAIS"], maxAnoFundacao: 2019, excluirSimples: true },
    empresasFiltradas: 676,
    recortes: [{ cnaes: ["9603", "65111"], nomes: [] }],
  },
];

export function mandatoPorId(id: string): Mandato | undefined {
  return MANDATOS.find((m) => m.id === id);
}

/* Prefixos de CNAE do mandato, sem os filtros de nome. É o que a tabela-espelho `mandato` guarda
   e o que a policy de RLS consegue expressar (regex de prefixo; nome não cabe ali).

   A CONSEQUÊNCIA, declarada de propósito: o contrato protege no nível do CNAE, a tela recorta no
   nível do mandato. Uma firma contratada em `foco-a-vet-lab` fica com o 7500 inteiro liberado no
   banco, e não só os 1.671 laboratórios. Isso é sobra de leitura, não vazamento entre clientes,
   e a alternativa (levar o filtro de nome pra dentro da policy) escreveria a mesma regra em dois
   lugares, com o custo por linha e o risco de divergência que isso traz. Se um dia a sobra
   incomodar comercialmente, o recorte certo é ingerir o mandato num setor próprio do registry. */
export function prefixosDe(m: Mandato): string[] {
  return [...new Set(m.recortes.flatMap((r) => r.cnaes))].sort();
}

/* Monta o filtro do PostgREST. Cada recorte vira `and(cnae, or(nomes))`, e os recortes viram um
   OR entre si. No `.or()` do PostgREST o coringa é `*` e não `%`, e vírgula dentro de valor
   quebraria a expressão — daí o guard. */
export function filtroOr(m: Mandato): string {
  const partes = m.recortes.map((r) => {
    const cnae = r.cnaes.map((c) => `cnae_principal.like.${c}*`).join(",");
    const cnaeExpr = r.cnaes.length > 1 ? `or(${cnae})` : cnae;
    if (!r.nomes.length) return `and(${cnaeExpr})`;
    const nomes = r.nomes
      .filter((n) => !n.includes(",") && !n.includes("(") && !n.includes(")"))
      .flatMap((n) => [`razao_social.ilike.*${n}*`, `nome_fantasia.ilike.*${n}*`])
      .join(",");
    return `and(${cnaeExpr},or(${nomes}))`;
  });
  return partes.length > 1 ? partes.join(",") : partes[0];
}
