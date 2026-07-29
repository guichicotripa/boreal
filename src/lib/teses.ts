// Teses de exemplo por setor — os atalhos que aparecem embaixo da busca.
//
// Moradia única de propósito. Elas viviam dentro de src/app/page.tsx e o script de
// cache tinha a própria cópia, com os filtros (faixa etária, ano) escritos à mão
// em paralelo. Resultado: para o cache valer, a frase tinha que ser idêntica nos
// dois arquivos — e o cache é servido por chave de texto normalizado, então um
// acento a mais num lado e o atalho da home deixa de bater no cache em silêncio.
//
// O parse (faixa, ano, praça) NÃO mora aqui: sai de parseQueryHeuristic, o mesmo
// que a busca usa. Uma tese é só a frase; o significado dela é responsabilidade
// do parser.

export const TESES_POR_SETOR: Record<string, string[]> = {
  metalmec: [
    "metalmecânica no interior de SP com sócios acima de 60 anos",
    "fabricantes de máquinas e equipamentos fundados antes de 1990",
    "fabricantes de máquinas no interior de SP",
  ],
  saude: [
    "clínicas com sócios acima de 70 anos",
    "laboratórios fundados antes de 1990",
    // Era "consultórios com sócio único idoso" — removida em 25/07/2026 por prometer
    // o que o produto não faz E o oposto do que ele recomenda. Não existe filtro de
    // sócio único na busca, então o termo era ignorado calado; e o score dá 0 de 10
    // em quadro plural para sócio único (lift medido: 0×, praticamente nunca é
    // adquirido), então a ordenação empurra esses casos para fora. Resultado medido:
    // ZERO das 50 empresas devolvidas tinham sócio único — uma tinha 72.
    "clínicas odontológicas com sócios acima de 60 anos",
  ],
  educacao: [
    "escolas familiares com sócios acima de 70 anos",
    "colégios fundados antes de 1990",
    "creches e educação infantil de dono idoso",
  ],
  // Agro entrou em jul/2026. As teses evitam recorte por ano de fundação de
  // propósito: no agro a data do CNPJ não mede idade do negócio (formalização em
  // massa de produtor rural entre 2006 e 2010), então "fundada antes de X" seria
  // um filtro que parece significar uma coisa e mede outra. Ver setores.ts.
  agro: [
    "fazendas com sócios acima de 70 anos",
    "produtores de cana e café com sócios idosos",
    "pecuária com sócios acima de 60 anos",
  ],
};

/** Normalização de consulta — a MESMA da rota de busca (chave do demo-cache). */
export function normalizeQuery(q: string): string {
  return q
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* Chave do demo-cache. Metalmecânica é o setor default da home, que manda a
   consulta sem prefixo de setor; os outros vêm com "setor|". Esta função existe
   para o builder de cache e a rota não discordarem sobre a forma da chave. */
export function chaveDemoCache(setorId: string, texto: string): string {
  const q = normalizeQuery(texto);
  return setorId === "metalmec" ? q : `${setorId}|${q}`;
}
