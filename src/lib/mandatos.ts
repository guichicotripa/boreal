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
};

export const MANDATOS: Mandato[] = [
  {
    id: "foco-a-vet-lab",
    nome: "Diagnóstico veterinário",
    descricao: "Foco A da Setter. Laboratórios dentro do CNAE de atividades veterinárias.",
    empresas: 1671,
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
    recortes: [{ cnaes: ["9603", "65111"], nomes: [] }],
  },
];

export function mandatoPorId(id: string): Mandato | undefined {
  return MANDATOS.find((m) => m.id === id);
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
