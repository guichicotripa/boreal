// Testa o score de sucessão — o IP determinístico do Boreal. Trava o comportamento MEDIDO em
// scripts/validacao-score-v1.mjs, pra pegar regressão silenciosa quando o score evoluir.
// Runner nativo do Node (sem dependência): npm test  (node --test --experimental-strip-types).
import { test } from "node:test";
import assert from "node:assert/strict";
import { calcScore, perfilSucessorio, scoreTier, EIXOS } from "./scoring.ts";
import percentis from "./capital-percentis.json" with { type: "json" };
import type { Empresa, Socio } from "./types.ts";

const ANO = new Date().getFullYear();

function emp(over: Partial<Empresa>): Empresa {
  return {
    data_inicio_atividade: null, capital_social: null, cnae_principal: null, socio: [], ...over,
  } as Empresa;
}
// Sócio PF: faixa etária e, opcionalmente, quantos anos atrás entrou no quadro.
const pf = (faixa: number, entrouHaAnos?: number): Socio => ({
  id: "s", nome: "x", qualificacao: null, faixa_etaria: String(faixa),
  data_entrada_sociedade: entrouHaAnos == null ? null : `${ANO - entrouHaAnos}-01-01`,
});
const pj: Socio = { id: "j", nome: "PJ", qualificacao: null, faixa_etaria: "0", data_entrada_sociedade: null };

// Metalmec: p95 = 3.000.000. Capital acima disso = topo do eixo de escala.
const METALMEC = "2511700";
const capTopo = percentis.verticais.metalmec.p95 + 1;

test("os cinco eixos somam exatamente 100 no teto", () => {
  assert.equal(EIXOS.reduce((a, e) => a + e.max, 0), 100);
});

test("empresa no teto de todos os eixos → 100", () => {
  const e = emp({
    cnae_principal: METALMEC, capital_social: capTopo, data_inicio_atividade: "1980-01-01",
    socio: [pf(9, 2), pf(4), pf(6), pf(7), pf(5)], // 5 sócios, um de até 50, quadro mexeu há 2 anos
  });
  const r = calcScore(e);
  assert.equal(r.breakdown.escala_capital, 34);
  assert.equal(r.breakdown.idade_controle, 28);
  assert.equal(r.breakdown.sucessor_aparente, 14);
  assert.equal(r.breakdown.quadro_plural, 13);
  assert.equal(r.breakdown.movimento_societario, 11);
  assert.equal(r.score, 100);
  assert.equal(scoreTier(r.score), "alto");
  assert.equal(r.perfil_sucessorio, true);
});

test("antiguidade NÃO pontua — ela filtra (perfilSucessorio), não ordena", () => {
  // Tirar antiguidade do score melhorou o recall no holdout (+1,9pp): empresa antiga também
  // é empresa grande, e o eixo de capital já captura isso.
  const velha = calcScore(emp({ data_inicio_atividade: "1950-01-01", socio: [pf(7)] }));
  const nova = calcScore(emp({ data_inicio_atividade: "2024-01-01", socio: [pf(7)] }));
  assert.equal(velha.score, nova.score, "a data de fundação não move o score");
  assert.equal(velha.perfil_sucessorio, true, "mas continua sendo porta de entrada da tese");
  assert.equal(nova.perfil_sucessorio, false);
});

test("sucessor aparente PREMIA (lift 2,14x) — é o eixo contraintuitivo", () => {
  // A tese ingênua castigaria isto. O dado diz o contrário, e por isso o teste existe:
  // se alguém "consertar" o sinal de volta pro negativo, quebra aqui.
  const comHerdeiro = calcScore(emp({ socio: [pf(9), pf(4)] }));
  const semHerdeiro = calcScore(emp({ socio: [pf(9), pf(8)] }));
  assert.equal(comHerdeiro.breakdown.sucessor_aparente, 14);
  assert.equal(semHerdeiro.breakdown.sucessor_aparente, 0);
  assert.ok(comHerdeiro.score > semHerdeiro.score);
});

test("acumular octogenário não acumula ponto (2+ na faixa 80+ tem lift 0,50x)", () => {
  const um = calcScore(emp({ socio: [pf(9), pf(4)] }));
  const cinco = calcScore(emp({ socio: [pf(9), pf(9), pf(9), pf(9), pf(4)] }));
  assert.equal(um.breakdown.idade_controle, cinco.breakdown.idade_controle);
});

test("movimento societário — recente pontua, parado não", () => {
  assert.equal(calcScore(emp({ socio: [pf(7, 2)] })).breakdown.movimento_societario, 11);
  assert.equal(calcScore(emp({ socio: [pf(7, 7)] })).breakdown.movimento_societario, 6);
  assert.equal(calcScore(emp({ socio: [pf(7, 20)] })).breakdown.movimento_societario, 0);
  assert.equal(calcScore(emp({ socio: [pf(7)] })).breakdown.movimento_societario, 0, "sem data, sem ponto");
});

test("escala usa percentil DO SETOR, não valor absoluto", () => {
  // R$ 200 mil: topo em saúde (p95 = 108.091), medianía em metalmec (p85 = 360.000).
  const cap = 200_000;
  const saude = calcScore(emp({ cnae_principal: "8610101", capital_social: cap }));
  const metal = calcScore(emp({ cnae_principal: METALMEC, capital_social: cap }));
  assert.equal(saude.breakdown.escala_capital, 34);
  assert.equal(metal.breakdown.escala_capital, 19);
});

test("capital zero ou ausente não pontua escala", () => {
  assert.equal(calcScore(emp({ cnae_principal: METALMEC, capital_social: 0 })).breakdown.escala_capital, 0);
  assert.equal(calcScore(emp({ cnae_principal: METALMEC, capital_social: null })).breakdown.escala_capital, 0);
});

test("CNAE fora dos setores cobertos cai no corte geral em vez de zerar", () => {
  const r = calcScore(emp({ cnae_principal: "4711302", capital_social: percentis.geral.p95 + 1 }));
  assert.equal(r.breakdown.escala_capital, 34);
});

test("idade do controle — só a faixa mais velha conta; PJ é ignorado", () => {
  assert.equal(calcScore(emp({ socio: [pf(7), pj] })).breakdown.idade_controle, 19);
  assert.equal(calcScore(emp({ socio: [pf(6)] })).breakdown.idade_controle, 10);
  assert.equal(calcScore(emp({ socio: [pf(5)] })).breakdown.idade_controle, 0);
  assert.equal(calcScore(emp({ socio: [pj] })).breakdown.idade_controle, 0);
});

test("quadro plural — 5+ vale mais que 2; sócio único não pontua", () => {
  assert.equal(calcScore(emp({ socio: [pf(9), pf(8), pf(7), pf(6), pf(5)] })).breakdown.quadro_plural, 13);
  assert.equal(calcScore(emp({ socio: [pf(9), pf(7)] })).breakdown.quadro_plural, 7);
  assert.equal(calcScore(emp({ socio: [pf(9)] })).breakdown.quadro_plural, 0);
});

test("perfil sucessório exige sócio 61+ E empresa 25+", () => {
  assert.equal(perfilSucessorio(emp({ data_inicio_atividade: "1990-01-01", socio: [pf(7)] })), true);
  assert.equal(perfilSucessorio(emp({ data_inicio_atividade: "1990-01-01", socio: [pf(6)] })), false);
  assert.equal(perfilSucessorio(emp({ data_inicio_atividade: "2010-01-01", socio: [pf(9)] })), false);
});

test("empresa sem nada pontuável → 0, e nenhum eixo negativo", () => {
  const r = calcScore(emp({}));
  assert.equal(r.score, 0);
  assert.ok(Object.values(r.breakdown).every((v) => v >= 0));
});

test("sinais ordenados por peso, sem nulos", () => {
  const r = calcScore(emp({ cnae_principal: METALMEC, capital_social: capTopo, socio: [pf(9), pf(4)] }));
  assert.ok(r.sinais.length >= 3);
  assert.ok(/Capital/.test(r.sinais[0]), "escala (34) vem antes de idade (28)");
  assert.ok(r.sinais.every((s) => typeof s === "string" && s.length > 0));
});

test("ausência de sucessor vira sinal explicado, não silêncio", () => {
  // Vale 0 ponto mas precisa APARECER: é a diferença entre "não achamos" e "achamos o oposto".
  const r = calcScore(emp({ socio: [pf(9), pf(8)] }));
  assert.ok(r.sinais.some((s) => /Nenhum sócio até 50/.test(s)));
});
