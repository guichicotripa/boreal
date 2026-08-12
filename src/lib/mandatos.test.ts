import { test } from "node:test";
import assert from "node:assert/strict";
import { MANDATOS, mandatoPorId, filtroOr } from "./mandatos.ts";

/* O filtro é montado à mão como string do PostgREST, então erro de sintaxe aqui não quebra o
   build: vira uma lista errada em produção. Estes testes travam a forma.
   A checagem de que os NÚMEROS batem exige o banco e vive em scripts/check-mandatos.ts. */

test("todo mandato tem id único e ao menos um recorte", () => {
  const ids = MANDATOS.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const m of MANDATOS) {
    assert.ok(m.recortes.length > 0, `${m.id} sem recorte`);
    for (const r of m.recortes) assert.ok(r.cnaes.length > 0, `${m.id} com recorte sem CNAE`);
  }
});

test("recorte sem nomes filtra só por CNAE", () => {
  const dc = mandatoPorId("death-care")!;
  const f = filtroOr(dc);
  assert.match(f, /cnae_principal\.like\.9603\*/);
  assert.ok(!f.includes("razao_social"), "death care não deve filtrar por nome");
});

test("recorte com nomes gera and(cnae, or(nomes)) e casa razão social e fantasia", () => {
  const f = filtroOr(mandatoPorId("foco-a-vet-lab")!);
  assert.match(f, /^and\(cnae_principal\.like\.7500\*,or\(/);
  assert.match(f, /razao_social\.ilike\.\*LABORAT\*/);
  assert.match(f, /nome_fantasia\.ilike\.\*LABORAT\*/);
});

/* Foco A e foco B vivem no MESMO CNAE 7500 e só se distinguem pelo nome. Se os dois filtros
   ficarem iguais, a tela mostra duas abas com a mesma lista e ninguém percebe. */
test("foco A e foco B não produzem o mesmo filtro", () => {
  assert.notEqual(filtroOr(mandatoPorId("foco-a-vet-lab")!), filtroOr(mandatoPorId("foco-b-plano-pet")!));
});

/* Vírgula e parêntese dentro de um fragmento quebrariam a expressão do PostgREST, e o erro
   apareceria como lista vazia, não como exceção. */
test("nenhum fragmento de nome tem caractere que quebra a expressão", () => {
  for (const m of MANDATOS)
    for (const r of m.recortes)
      for (const n of r.nomes)
        assert.ok(!/[,()]/.test(n), `${m.id}: fragmento inválido "${n}"`);
});
