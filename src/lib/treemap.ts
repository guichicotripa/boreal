// Squarified treemap (Bruls, Huizing, van Wijk 2000) — layout puro, sem dependência.
// Preenche um retângulo com sub-retângulos de área proporcional ao `value`, mantendo o
// aspect ratio perto de 1 (tiles quadrados, legíveis). Suporta 2 níveis (grupo → tiles).

export type Rect = { x: number; y: number; w: number; h: number };
export type Sized<T> = T & { value: number };
export type Placed<T> = Sized<T> & Rect;

// Pior aspect ratio de uma linha de áreas dispostas ao longo de um lado `side`.
function worstRatio(areas: number[], side: number, sum: number): number {
  const max = Math.max(...areas);
  const min = Math.min(...areas);
  const s2 = sum * sum;
  const side2 = side * side;
  return Math.max((side2 * max) / s2, s2 / (side2 * min));
}

export function squarify<T>(items: Sized<T>[], rect: Rect): Placed<T>[] {
  const positivos = items.filter((i) => i.value > 0);
  const total = positivos.reduce((s, i) => s + i.value, 0);
  if (total <= 0 || rect.w <= 0 || rect.h <= 0) return [];

  const area = rect.w * rect.h;
  const nodes = positivos.map((it) => ({ it, area: (it.value / total) * area }));
  const placed: Placed<T>[] = [];
  let free: Rect = { ...rect };

  let i = 0;
  while (i < nodes.length) {
    const side = Math.min(free.w, free.h);
    const row: { it: Sized<T>; area: number }[] = [];
    let rowSum = 0;

    // Cresce a linha enquanto o pior aspect ratio não piorar.
    while (i < nodes.length) {
      const areasAtuais = row.map((n) => n.area);
      const atual = row.length ? worstRatio(areasAtuais, side, rowSum) : Infinity;
      const proximo = worstRatio([...areasAtuais, nodes[i].area], side, rowSum + nodes[i].area);
      if (row.length === 0 || proximo <= atual) {
        row.push(nodes[i]);
        rowSum += nodes[i].area;
        i++;
      } else break;
    }

    const espessura = rowSum / side; // dimensão da faixa perpendicular ao lado curto
    if (free.w >= free.h) {
      // faixa é uma COLUNA à esquerda; empilha os tiles verticalmente
      let oy = free.y;
      for (const n of row) {
        const hh = (n.area / rowSum) * side;
        placed.push({ ...n.it, x: free.x, y: oy, w: espessura, h: hh });
        oy += hh;
      }
      free = { x: free.x + espessura, y: free.y, w: free.w - espessura, h: free.h };
    } else {
      // faixa é uma LINHA no topo; dispõe os tiles horizontalmente
      let ox = free.x;
      for (const n of row) {
        const ww = (n.area / rowSum) * side;
        placed.push({ ...n.it, x: ox, y: free.y, w: ww, h: espessura });
        ox += ww;
      }
      free = { x: free.x, y: free.y + espessura, w: free.w, h: free.h - espessura };
    }
  }
  return placed;
}

// Treemap de 2 níveis: cada grupo vira um bloco (com header pro rótulo) e seus filhos
// são dispostos dentro. Retorna os grupos posicionados + os tiles de cada um.
export type Grupo<G, T> = Sized<G> & { itens: Sized<T>[] };
export type GrupoLayout<G, T> = { grupo: Placed<G>; tiles: Placed<T>[] };

export function treemapAgrupado<G, T>(
  grupos: Grupo<G, T>[],
  rect: Rect,
  opts: { header: number; gap: number },
): GrupoLayout<G, T>[] {
  const blocos = squarify(grupos, rect);
  return blocos.map((bloco) => {
    const itens = (bloco as unknown as Grupo<G, T>).itens;
    const inner: Rect = {
      x: bloco.x + opts.gap,
      y: bloco.y + opts.header,
      w: bloco.w - 2 * opts.gap,
      h: bloco.h - opts.header - opts.gap,
    };
    const tiles = inner.w > 0 && inner.h > 0 ? squarify(itens, inner) : [];
    return { grupo: bloco, tiles };
  });
}
