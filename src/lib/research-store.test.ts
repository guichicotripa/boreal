import { test } from "node:test";
import assert from "node:assert/strict";
import { aplicarV1 } from "./research-store.ts";
import type { Empresa } from "./types.ts";

/* O desempate por ajuste bruto existe porque o score satura em 100 e a evidência não.
   Medido em 30/07/2026: ajustes de +12, +12, +18, +24, +30 e +30 viraram todos o mesmo
   +3 depois do teto, e a lista perdeu a ordem exatamente no topo, que é onde o
   originador começa a trabalhar. */

const emp = (id: string, v0: number): Empresa =>
  ({ id, score: { score: v0, breakdown: {}, sinais: [], perfil_sucessorio: true } } as unknown as Empresa);

test("no teto, mais evidência fica na frente", () => {
  const lista = [
    emp("pouca", 97),
    emp("muita", 97),
  ];
  const ordenada = aplicarV1(lista, {
    pouca: { score: 100, investigado_em: "2026-07-30", ajuste_bruto: 12 },
    muita: { score: 100, investigado_em: "2026-07-30", ajuste_bruto: 30 },
  });
  assert.equal(ordenada[0].id, "muita", "as duas exibem 100; quem tem +30 de evidência vem antes");
  assert.equal(ordenada[0].score_v1?.score, 100, "a tela continua mostrando 100, sem estourar a escala");
  assert.equal(ordenada[1].score_v1?.score, 100);
});

test("o ajuste bruto NÃO passa na frente de um score maior", () => {
  // É desempate, não eixo: score é sempre o critério primário.
  const ordenada = aplicarV1([emp("baixa", 60), emp("alta", 95)], {
    baixa: { score: 90, investigado_em: "x", ajuste_bruto: 30 },
    alta: { score: 95, investigado_em: "x", ajuste_bruto: 0 },
  });
  assert.equal(ordenada[0].id, "alta");
});

test("empresa sem investigação não é penalizada nem promovida pelo desempate", () => {
  const ordenada = aplicarV1([emp("semV1", 100), emp("comV1", 90)], {
    comV1: { score: 100, investigado_em: "x", ajuste_bruto: 24 },
  });
  // Empatam em 100; a investigada tem evidência e sobe. A sem v1 conta como ajuste 0.
  assert.equal(ordenada[0].id, "comV1");
  assert.equal(ordenada[1].score_v1, undefined);
});

test("delta é recalculado contra o v0 de agora, não congelado", () => {
  // O v0 é determinístico e muda (sócio envelhece, heurística nova). Um delta gravado
  // no dia da investigação mentiria depois de qualquer recalibração do score.
  const ordenada = aplicarV1([emp("x", 70)], {
    x: { score: 85, investigado_em: "x", ajuste_bruto: 15 },
  });
  assert.equal(ordenada[0].score_v1?.delta, 15);
});
