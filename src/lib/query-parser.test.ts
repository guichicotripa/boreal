import { test } from "node:test";
import assert from "node:assert/strict";
import { ufsDaConsulta, resolverSetor } from "./query-parser.ts";

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

/* Resolução de setor. O defeito original: quando nada era reconhecido, o parser
   virava metalmecânica em silêncio — "clínicas com sócios idosos" devolvia
   metalúrgicas, e "construtoras" também. Três comportamentos distintos agora:
     · setor indexado      → filtra por ele
     · setor não indexado  → zero + nome do setor (nunca troca por outro)
     · setor não citado    → busca ampla (sem recorte) */
const CASOS_SETOR: [string, { ids: string[]; foraDaBase: string | null }][] = [
  ["clínicas com sócios acima de 60 anos", { ids: ["saude"], foraDaBase: null }],
  ["laboratórios de diagnóstico em SP", { ids: ["saude"], foraDaBase: null }],
  ["escolas familiares com donos idosos", { ids: ["educacao"], foraDaBase: null }],
  ["colégios fundados antes de 1990", { ids: ["educacao"], foraDaBase: null }],
  ["metalmecânica no interior de SP", { ids: ["metalmec"], foraDaBase: null }],
  ["serralherias e caldeirarias", { ids: ["metalmec"], foraDaBase: null }],
  ["fabricantes de máquinas", { ids: ["metalmec"], foraDaBase: null }],
  // Fora da base: nunca pode cair em metalmec
  ["construtoras de edifícios no RS", { ids: [], foraDaBase: "construção" }],
  ["transportadoras com sócios idosos", { ids: [], foraDaBase: "transporte e logística" }],
  ["empresas de tecnologia em SP", { ids: [], foraDaBase: "tecnologia" }],
  ["frigoríficos tradicionais", { ids: [], foraDaBase: "alimentos" }],
  // Sem setor citado: busca ampla, sem recorte e sem alarme falso
  ["empresas com sócios acima de 70 anos", { ids: [], foraDaBase: null }],
  ["negócios familiares fundados antes de 1980", { ids: [], foraDaBase: null }],
];

for (const [consulta, esperado] of CASOS_SETOR) {
  test(`resolverSetor: ${consulta}`, () => {
    const r = resolverSetor(consulta);
    assert.deepEqual(r.ids.slice().sort(), esperado.ids.slice().sort());
    assert.equal(r.foraDaBase, esperado.foraDaBase);
    // Invariante que o bug violava: setor fora da base nunca vira CNAE de outro.
    if (esperado.foraDaBase) assert.deepEqual(r.cnaes, []);
  });
}
