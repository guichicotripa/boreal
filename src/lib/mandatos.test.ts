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
  const semNome = dc.recortes.find((r) => r.cnaes.includes("9603"))!;
  assert.equal(semNome.nomes.length, 0, "funerária (9603) entra pelo CNAE, sem filtro de nome");
  assert.match(filtroOr(dc), /cnae_principal\.like\.9603\*/);
});

/* Seguradora de vida (6511101) dentro do death care foi o defeito de 24/08 a 23/09/2026: 92
   seguradoras em 676 empresas na tela. O prefixo `65111` pegava os dois CNAEs. Estas duas
   asserções impedem a volta, que seria fácil: bastaria alguém "simplificar" o recorte. */
test("death care nunca usa o prefixo 65111, que junta seguro de vida com auxílio funeral", () => {
  const dc = mandatoPorId("death-care")!;
  const todos = dc.recortes.flatMap((r) => r.cnaes);
  assert.ok(!todos.includes("65111"), "65111 como prefixo traz seguradora de vida");
  assert.ok(todos.includes("6511102"), "auxílio funeral entra");
});

test("seguro de vida (6511101) só entra no death care com nome funerário", () => {
  const dc = mandatoPorId("death-care")!;
  const vida = dc.recortes.find((r) => r.cnaes.includes("6511101"));
  assert.ok(vida, "o recorte existe, para não perder a PAX CAROLINA");
  assert.ok(vida!.nomes.length > 0, "6511101 sem filtro de nome traz as 91 seguradoras de volta");
  assert.ok(vida!.nomes.includes("PAX"));
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
