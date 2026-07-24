import { test } from "node:test";
import assert from "node:assert/strict";
import { ufsDaConsulta } from "./query-parser.ts";

/* Extração de praça. Antes de existir, a UF da tese era ignorada e a busca
   devolvia outra região em silêncio ("construtoras no RS" → metalmecânicas de SP).

   Os casos abaixo não são decorativos: cada um quebrou numa versão anterior.
     · "paraná"  casava "para" (PA) por substring
     · "para"    preposição comum virava o estado do Pará
     · "pará"    não casava com \bpará\b porque "á" não é \w no regex do JS
     · "mato grosso do sul" casava "mato grosso" */
const CASOS: [string, string[] | null][] = [
  ["construtoras de edificios no rio grande do sul", ["RS"]],
  ["metalmecânica no interior de SP", ["SP"]],
  ["clínicas em MG e PR", ["MG", "PR"]],
  ["empresas no mato grosso do sul", ["MS"]],
  ["empresas no mato grosso", ["MT"]],
  ["fabricantes com sócios acima de 60 anos", null],
  ["escolas no Paraná fundadas antes de 1990", ["PR"]],
  ["indústrias no Rio de Janeiro", ["RJ"]],
  ["empresas para aquisição com sócios idosos", null],
  ["madeireiras no Pará", ["PA"]],
  ["escolas na Paraíba", ["PB"]],
  ["clínicas no Rio Grande do Norte", ["RN"]],
  ["serralherias em Santa Catarina e no Paraná", ["SC", "PR"]],
];

for (const [consulta, esperado] of CASOS) {
  test(`ufsDaConsulta: ${consulta}`, () => {
    const obtido = ufsDaConsulta(consulta);
    assert.deepEqual(
      (obtido ?? []).slice().sort(),
      (esperado ?? []).slice().sort()
    );
  });
}
