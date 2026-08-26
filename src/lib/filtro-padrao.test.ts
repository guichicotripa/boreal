/* O corte padrão é a primeira coisa que o cliente vê da lista, e ele REMOVE 94% do universo.
   Errar aqui não deixa a tela feia: entrega uma lista que parece completa e não é. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { comFiltroPadrao, filtroPadraoAtivo, descreveFiltroPadrao, regimeTributario } from "./filtro-padrao.ts";
import { MANDATOS } from "./mandatos.ts";
import type { SearchFilters } from "./types.ts";

const VAZIO: SearchFilters = {
  cnaePrefixes: [], minFaixaEtaria: null, maxAnoFundacao: null, ufs: null, setorForaDaBase: null, limit: 50,
};
const PADRAO = { portes: ["DEMAIS"], maxAnoFundacao: 2019 };

test("sem padrão declarado, os filtros passam intactos", () => {
  const r = comFiltroPadrao(VAZIO, undefined);
  assert.deepEqual(r, VAZIO);
  assert.equal(r.portes ?? null, null);
});

test("com padrão, aplica porte e ano", () => {
  const r = comFiltroPadrao(VAZIO, PADRAO);
  assert.deepEqual(r.portes, ["DEMAIS"]);
  assert.equal(r.maxAnoFundacao, 2019);
});

/* O desligar é o que impede que `porte` desatualizado da Receita vire alvo perdido em silêncio.
   Se ele não devolver o universo cheio, o botão da tela mente. */
test("desligado devolve exatamente os filtros originais", () => {
  const r = comFiltroPadrao(VAZIO, PADRAO, true);
  assert.equal(r.portes ?? null, null);
  assert.equal(r.maxAnoFundacao, null);
});

/* Quem escreve "fundadas antes de 1990" está sendo MAIS restritivo de propósito. Afrouxar pra
   2019 seria desobedecer a consulta em nome de um default. */
test("filtro escrito à mão vence o padrão, e nunca é afrouxado", () => {
  const r = comFiltroPadrao({ ...VAZIO, maxAnoFundacao: 1990 }, PADRAO);
  assert.equal(r.maxAnoFundacao, 1990);
  assert.deepEqual(r.portes, ["DEMAIS"], "o porte do padrão continua valendo");
});

test("o padrão não mexe em nada além de porte e ano", () => {
  const base: SearchFilters = { ...VAZIO, cnaePrefixes: ["7500"], minFaixaEtaria: 7, ufs: ["SP"], limit: 50 };
  const r = comFiltroPadrao(base, PADRAO);
  assert.deepEqual(r.cnaePrefixes, ["7500"]);
  assert.equal(r.minFaixaEtaria, 7);
  assert.deepEqual(r.ufs, ["SP"]);
  assert.equal(r.limit, 50);
});

test("filtroPadraoAtivo acompanha o desligar", () => {
  assert.equal(filtroPadraoAtivo(PADRAO), true);
  assert.equal(filtroPadraoAtivo(PADRAO, true), false);
  assert.equal(filtroPadraoAtivo(undefined), false);
});

/* A frase vai pra tela do cliente. "porte DEMAIS" é jargão de tabela da Receita e não diz nada
   pra quem opera; o rótulo tem que descrever o efeito. */
test("a descrição fala do efeito, não do nome do campo", () => {
  const t = descreveFiltroPadrao(PADRAO);
  assert.match(t, /acima de EPP/);
  assert.match(t, /2019/);
  assert.doesNotMatch(t, /DEMAIS/);
});

/* CAPITAL SOCIAL FICA DE FORA. Ela foi explícita ("não descarto uma empresa por ela ter capital
   social pequeno") e salvou uma de R$ 150 mil. Se alguém acrescentar capital ao corte, este teste
   quebra e obriga a reler a fonte antes. */
test("nenhum mandato corta por capital social", () => {
  /* Asserção sobre o CONCEITO e não sobre a lista de chaves: dimensão nova e legítima (o corte do
     Simples entrou em 26/08) não pode quebrar o teste, mas capital tem que continuar barrado. */
  for (const m of MANDATOS) {
    if (!m.filtroPadrao) continue;
    for (const chave of Object.keys(m.filtroPadrao)) {
      assert.doesNotMatch(
        chave,
        /capital/i,
        `${m.id}: capital social não pode ser critério de CORTE (ela disse que capital pequeno não descarta). Ordenação, sim.`
      );
    }
  }
});

/* O corte do Simples é a outra metade da pergunta "fatura acima de R$ 4,8 MM?": `porte = DEMAIS`
   diz que a Receita classificou acima do teto, e a opção pelo Simples diz que a empresa declara
   estar abaixo. Sem os dois juntos, 28% do Foco A era ruído. */
test("todo mandato que corta por porte também tira os optantes do Simples", () => {
  for (const m of MANDATOS) {
    if (!m.filtroPadrao?.portes.length) continue;
    assert.equal(
      m.filtroPadrao.excluirSimples,
      true,
      `${m.id}: cortar por porte sem tirar optante do Simples deixa entrar quem fatura < R$ 4,8 MM`
    );
  }
});

test("o corte do Simples aparece no rótulo da tela", () => {
  assert.match(descreveFiltroPadrao({ ...PADRAO, excluirSimples: true }), /fora do Simples/);
  assert.doesNotMatch(descreveFiltroPadrao(PADRAO), /Simples/);
});

test("desligar o padrão desliga também o corte do Simples", () => {
  const r = comFiltroPadrao(VAZIO, { ...PADRAO, excluirSimples: true }, true);
  assert.notEqual(r.excluirSimples, true);
});

test("todo mandato com corte declara quantas sobram, e sobra menos que o universo", () => {
  for (const m of MANDATOS) {
    if (!m.filtroPadrao) continue;
    assert.equal(typeof m.empresasFiltradas, "number", `${m.id}: falta empresasFiltradas`);
    assert.ok(m.empresasFiltradas! > 0, `${m.id}: contagem filtrada zerada`);
    assert.ok(
      m.empresasFiltradas! < m.empresas,
      `${m.id}: filtrado (${m.empresasFiltradas}) não pode ser >= universo (${m.empresas})`
    );
  }
});

/* ARMADILHA CONHECIDA: a rota serve `setorCache.porSetor[setorId]` ANTES de montar a query, e
   mandato chega pelo mesmo campo `setor`. Se um dia alguém pré-cachear um mandato, a lista sai do
   JSON do bundle e o corte padrão nunca roda — a tela continuaria dizendo "72 de 1.671" servindo
   as 1.671. É irmão do defeito de 12/08, em que o cache estático furava o contrato da firma.
   Guarda barata para um erro caro e silencioso. */
test("nenhum mandato tem cache estático de setor (o cache pularia o corte padrão)", async () => {
  const cache = (await import("./setor-cache.json", { with: { type: "json" } })).default as {
    porSetor?: Record<string, unknown>;
  };
  const chaves = Object.keys(cache.porSetor ?? {});
  for (const m of MANDATOS) {
    assert.ok(
      !chaves.includes(m.id),
      `mandato "${m.id}" tem cache de setor: a busca serviria o JSON e o filtroPadrao seria ignorado`
    );
  }
});

/* ── regimeTributario: o que a tela AFIRMA sobre a empresa ────────────────────
   Rótulo errado aqui não é cosmético: é a plataforma dizendo a um cliente pagante que uma empresa
   fatura acima de R$ 4,8 MM quando ela não fatura, ou o contrário. */
test("optante é marcado como Simples e tratado como negativo", () => {
  const r = regimeTributario({ opcao_simples: true, data_exclusao_simples: null });
  assert.equal(r?.tom, "negativo");
  assert.match(r!.rotulo, /Simples Nacional/);
});

test("quem saiu do Simples mostra o ano e é positivo", () => {
  const r = regimeTributario({ opcao_simples: false, data_exclusao_simples: "2024-03-31" });
  assert.equal(r?.tom, "positivo");
  assert.match(r!.rotulo, /2024/);
});

/* A LC 123 proíbe sócio PJ no Simples, então sair também acontece por aquisição, por débito
   tributário, por CNAE vedado ou por opção. Afirmar faturamento seria inventar. */
test("o rótulo NUNCA afirma faturamento, porque sair do Simples tem várias causas", () => {
  const r = regimeTributario({ opcao_simples: false, data_exclusao_simples: "2024-03-31" });
  assert.doesNotMatch(r!.rotulo, /4,8|fatura|receita/i);
});

test("nunca optou é neutro, não positivo", () => {
  const r = regimeTributario({ opcao_simples: false, data_exclusao_simples: null });
  assert.equal(r?.tom, "neutro");
});

/* NULL é "não verificado", não "não é optante". Rótulo aqui faria a tela afirmar o que o banco
   não sabe — e antes do backfill da 0015 a base inteira estava neste estado. */
test("não verificado não vira rótulo nenhum", () => {
  assert.equal(regimeTributario({ opcao_simples: null, data_exclusao_simples: null }), null);
  assert.equal(regimeTributario({}), null);
});
