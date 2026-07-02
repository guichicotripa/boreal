// Testa o score de sucessão — o IP determinístico do Boreal. Trava o comportamento CALIBRADO por
// validação retroativa, pra pegar regressão silenciosa quando o score evoluir (ex: nova dimensão).
// Runner nativo do Node (sem dependência): npm test  (node --test --experimental-strip-types).
import { test } from "node:test";
import assert from "node:assert/strict";
import { calcScore, perfilSucessorio, scoreTier } from "./scoring.ts";
import type { Empresa, Socio } from "./types.ts";

// Empresa mínima: o score só lê data_inicio_atividade, porte e socio.
function emp(over: Partial<Empresa>): Empresa {
  return { data_inicio_atividade: null, porte: null, socio: [], ...over } as Empresa;
}
const pf = (faixa: number): Socio =>
  ({ id: "s", nome: "x", qualificacao: null, faixa_etaria: String(faixa), data_entrada_sociedade: null });
const pj: Socio = { id: "j", nome: "PJ", qualificacao: null, faixa_etaria: "0", data_entrada_sociedade: null };

test("empresa antiga, sócio idoso, porte relevante, quadro plural → score máximo", () => {
  const e = emp({ data_inicio_atividade: "1980-01-01", porte: "DEMAIS", socio: [pf(9), pf(8)] });
  const r = calcScore(e);
  assert.equal(r.breakdown.idade_socios, 30);
  assert.equal(r.breakdown.antiguidade_empresa, 30);
  assert.equal(r.breakdown.porte_relevancia, 30);
  assert.equal(r.breakdown.quadro_plural, 10);
  assert.equal(r.score, 100);
  assert.equal(scoreTier(r.score), "alto");
  assert.equal(r.perfil_sucessorio, true);
});

test("empresa nova, sócio jovem, micro, sócio único → score baixo", () => {
  const r = calcScore(emp({ data_inicio_atividade: "2015-01-01", porte: "ME", socio: [pf(5)] }));
  assert.equal(r.score, 5); // ME=5, resto 0
  assert.equal(scoreTier(r.score), "baixo");
  assert.equal(r.perfil_sucessorio, false);
});

test("antiguidade — faixas 40+/25+/15+", () => {
  assert.equal(calcScore(emp({ data_inicio_atividade: "1986-01-01" })).breakdown.antiguidade_empresa, 30); // 40 anos
  assert.equal(calcScore(emp({ data_inicio_atividade: "2001-01-01" })).breakdown.antiguidade_empresa, 22); // 25 anos
  assert.equal(calcScore(emp({ data_inicio_atividade: "2011-01-01" })).breakdown.antiguidade_empresa, 10); // 15 anos
  assert.equal(calcScore(emp({ data_inicio_atividade: "2020-01-01" })).breakdown.antiguidade_empresa, 0);
});

test("idade do sócio — só a faixa mais velha conta; PJ é ignorado", () => {
  assert.equal(calcScore(emp({ socio: [pf(7), pj] })).breakdown.idade_socios, 20); // 61-70 → 20
  assert.equal(calcScore(emp({ socio: [pf(6)] })).breakdown.idade_socios, 10); // 51-60 → 10
  assert.equal(calcScore(emp({ socio: [pf(5)] })).breakdown.idade_socios, 0); // <51 → 0
  assert.equal(calcScore(emp({ socio: [pj] })).breakdown.idade_socios, 0); // só PJ → 0
});

test("porte — EPP e DEMAIS pontuam; ME quase nada", () => {
  assert.equal(calcScore(emp({ porte: "EPP" })).breakdown.porte_relevancia, 15);
  assert.equal(calcScore(emp({ porte: "DEMAIS" })).breakdown.porte_relevancia, 30);
  assert.equal(calcScore(emp({ porte: "ME" })).breakdown.porte_relevancia, 5);
});

test("quadro plural — sócio único não pontua (lift ~0)", () => {
  assert.equal(calcScore(emp({ socio: [pf(9), pf(7)] })).breakdown.quadro_plural, 10);
  assert.equal(calcScore(emp({ socio: [pf(9)] })).breakdown.quadro_plural, 0);
});

test("perfil sucessório exige sócio 61+ E empresa 25+", () => {
  assert.equal(perfilSucessorio(emp({ data_inicio_atividade: "1990-01-01", socio: [pf(7)] })), true);
  assert.equal(perfilSucessorio(emp({ data_inicio_atividade: "1990-01-01", socio: [pf(6)] })), false); // sócio jovem
  assert.equal(perfilSucessorio(emp({ data_inicio_atividade: "2010-01-01", socio: [pf(9)] })), false); // empresa nova
});

test("sinais ordenados por peso, sem nulos", () => {
  const r = calcScore(emp({ data_inicio_atividade: "1980-01-01", porte: "ME", socio: [pf(9)] }));
  // idade 30 e antiguidade 30 na frente; ME (5) não gera sinal (null); sócio único não gera bônus
  assert.ok(r.sinais.length >= 2);
  assert.ok(/faixa 80\+/.test(r.sinais[0]) || /anos de opera/.test(r.sinais[0]));
});
