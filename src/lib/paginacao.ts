/* A janela de páginas do paginador.
 *
 * Por que não listar todas: a busca aceita até 41 páginas (0 a 40, teto da rota), e 41 botões numa
 * linha viram uma régua ilegível. Por que não só "anterior/próxima": sem número o originador perde
 * o endereço, que é justamente o motivo de a rolagem infinita ter saído.
 *
 * A lista de páginas conhecidas CRESCE conforme se navega. O servidor não devolve total de linhas
 * de propósito (um `count()` sobre a base filtrada custa mais que a própria busca), então a única
 * coisa que se sabe é "existe a próxima" (`temMais`). Consequência aceita: o paginador não mostra
 * "de 24 páginas" no primeiro clique, e o último número visível avança à medida que se anda.
 *
 * Devolve índices 0-based, com `null` no lugar das reticências.
 */
export function janelaDePaginas(atual: number, maxConhecida: number, vizinhos = 1): (number | null)[] {
  if (maxConhecida <= 0) return [0];

  const fixas = new Set<number>([0, maxConhecida]);
  for (let p = atual - vizinhos; p <= atual + vizinhos; p++) {
    if (p >= 0 && p <= maxConhecida) fixas.add(p);
  }

  const ordenadas = [...fixas].sort((a, b) => a - b);
  const saida: (number | null)[] = [];
  for (let i = 0; i < ordenadas.length; i++) {
    if (i > 0) {
      const salto = ordenadas[i] - ordenadas[i - 1];
      /* Reticências só quando escondem MAIS DE UMA página. Escondendo uma só, o "…" ocupa o mesmo
         espaço do número que substitui e ainda tira um destino clicável: pior em tudo. Então com
         salto de exatamente 2 o número do meio entra no lugar das reticências. */
      if (salto === 2) saida.push(ordenadas[i] - 1);
      else if (salto > 2) saida.push(null);
    }
    saida.push(ordenadas[i]);
  }
  return saida;
}
