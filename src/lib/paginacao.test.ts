/* Janela do paginador. Lógica pequena e cheia de off-by-one: primeira e última sempre presentes,
   reticências só quando existe buraco, e nada fora de [0, maxConhecida]. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { janelaDePaginas } from "./paginacao.ts";

test("uma página só não vira paginador", () => {
  assert.deepEqual(janelaDePaginas(0, 0), [0]);
});

test("poucas páginas aparecem todas, sem reticências", () => {
  assert.deepEqual(janelaDePaginas(0, 2), [0, 1, 2]);
  assert.deepEqual(janelaDePaginas(1, 3), [0, 1, 2, 3]);
});

/* O "…" não pode esconder UMA página: ocuparia o mesmo espaço do número que substitui. */
test("salto de exatamente uma página mostra o número, não reticências", () => {
  assert.deepEqual(janelaDePaginas(0, 3), [0, 1, 2, 3]);
});

test("no meio de muitas, primeira e última continuam alcançáveis", () => {
  assert.deepEqual(janelaDePaginas(10, 20), [0, null, 9, 10, 11, null, 20]);
});

test("nas pontas a janela não vaza pra fora do intervalo", () => {
  assert.deepEqual(janelaDePaginas(0, 20), [0, 1, null, 20]);
  assert.deepEqual(janelaDePaginas(20, 20), [0, null, 19, 20]);
});

test("nenhum índice fora de [0, maxConhecida], em nenhuma posição", () => {
  for (let max = 0; max <= 40; max++) {
    for (let atual = 0; atual <= max; atual++) {
      for (const p of janelaDePaginas(atual, max)) {
        if (p === null) continue;
        assert.ok(p >= 0 && p <= max, `pagina ${p} fora de [0, ${max}] (atual ${atual})`);
      }
    }
  }
});

test("a página atual está sempre na janela", () => {
  for (let max = 0; max <= 40; max++) {
    for (let atual = 0; atual <= max; atual++) {
      assert.ok(janelaDePaginas(atual, max).includes(atual), `atual ${atual} sumiu (max ${max})`);
    }
  }
});
