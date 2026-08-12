import { test } from "node:test";
import assert from "node:assert/strict";
import { ufsDaConsulta, resolverSetor, IDS_COM_TERMOS } from "./query-parser.ts";
import { SETORES } from "./setores.ts";

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
  // Recortes de mandato (12/08/2026). Vencem o setor do registry quando casam: sem isto,
  // "laboratório de diagnóstico veterinário" caía no regex de `saude` e devolvia lab humano.
  ["laboratório de diagnóstico veterinário", { ids: ["veterinaria"], foraDaBase: null }],
  ["clínicas veterinárias com donos idosos", { ids: ["veterinaria"], foraDaBase: null }],
  ["operadoras de plano de saúde pet", { ids: ["veterinaria"], foraDaBase: null }],
  ["funerárias e cemitérios", { ids: ["deathcare"], foraDaBase: null }],
  ["empresas de death care no interior", { ids: ["deathcare"], foraDaBase: null }],
  ["serviços de cremação", { ids: ["deathcare"], foraDaBase: null }],
  ["escolas familiares com donos idosos", { ids: ["educacao"], foraDaBase: null }],
  ["colégios fundados antes de 1990", { ids: ["educacao"], foraDaBase: null }],
  ["metalmecânica no interior de SP", { ids: ["metalmec"], foraDaBase: null }],
  ["serralherias e caldeirarias", { ids: ["metalmec"], foraDaBase: null }],
  ["fabricantes de máquinas", { ids: ["metalmec"], foraDaBase: null }],
  // Agro: ingerido em jul/2026. Antes disso "fazendas" caía em TERMOS_FORA_DA_BASE
  // e a busca negava um setor que a base passou a cobrir.
  ["fazendas com sócios idosos", { ids: ["agro"], foraDaBase: null }],
  ["agronegócio em SP", { ids: ["agro"], foraDaBase: null }],
  ["produtores de cana-de-açúcar", { ids: ["agro"], foraDaBase: null }],
  ["empresas de pecuária tradicionais", { ids: ["agro"], foraDaBase: null }],
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

/* Guarda estrutural, não caso de uso. Ingerir um setor tem três passos (registry,
   termos de busca, sair da lista de fora-da-base) e esquecer o segundo não quebra
   nada visível: o setor fica buscável por CNAE e mudo em texto livre. Este teste
   falha no momento em que o registry cresce sem o vocabulário correspondente. */
test("todo setor do registry tem termos de busca em texto livre", () => {
  const semTermos = SETORES.map((s) => s.id).filter((id) => !IDS_COM_TERMOS.includes(id));
  assert.deepEqual(
    semTermos, [],
    `setor(es) no registry sem entrada em TERMOS_POR_SETOR: ${semTermos.join(", ")}. ` +
    `Buscável por CNAE, invisível pra consulta em texto livre.`
  );
});

/* O outro lado do mesmo esquecimento: o setor entrou no registry mas continuou
   na lista de "não temos", então a busca nega o que a base cobre. Aqui usamos o
   NOME do setor como consulta — se ele resolver pra fora-da-base, há colisão. */
test("nenhum setor indexado é declarado fora da base", () => {
  for (const s of SETORES) {
    const r = resolverSetor(s.nome);
    assert.equal(
      r.foraDaBase, null,
      `"${s.nome}" está no registry mas resolveu como fora da base (${r.foraDaBase})`
    );
    assert.ok(r.ids.includes(s.id), `"${s.nome}" não resolveu pro próprio setor (${s.id})`);
  }
});
