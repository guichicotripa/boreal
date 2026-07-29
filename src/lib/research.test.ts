import { test } from "node:test";
import assert from "node:assert/strict";
import { parseResearch } from "./research.ts";

/* O parse do v1 é onde o LLM deixa de mandar e o código passa a decidir o número.
   Estes testes cobrem o que já quebrou de verdade em produção. */

function resposta(sinais: unknown[]) {
  return JSON.stringify({ presenca_digital: "baixa", resumo: "x", sinais });
}

test("peso conta uma vez por TIPO, não por ocorrência", () => {
  // Aconteceu com uma empresa real: dois `sucessor_familiar_ativo` viraram -50.
  const r = parseResearch(
    resposta([
      { tipo: "sucessor_familiar_ativo", descricao: "filho é diretor", fonte_url: "https://a.com" },
      { tipo: "sucessor_familiar_ativo", descricao: "outra fonte diz o mesmo", fonte_url: "https://b.com" },
    ]),
    100
  );
  assert.equal(r.score_v1, 75, "-25 aplicado uma vez, não duas");
  assert.equal(r.sinais.length, 2, "os dois sinais FICAM: cada um tem fonte própria");
});

test("tipos diferentes somam normalmente", () => {
  const r = parseResearch(
    resposta([
      { tipo: "banco_investimento", descricao: "contratou assessor", fonte_url: "https://a.com" },
      { tipo: "mencao_sucessao_venda", descricao: "notícia de venda", fonte_url: "https://b.com" },
    ]),
    50
  );
  assert.equal(r.score_v1, 77, "+15 e +12 são fatos distintos e somam");
});

test("tipo desconhecido é descartado, não vira peso zero silencioso", () => {
  const r = parseResearch(
    resposta([
      { tipo: "empresa parece antiga", descricao: "título livre em vez do identificador", fonte_url: "https://a.com" },
      { tipo: "big4_auditoria", descricao: "auditada pela KPMG", fonte_url: "https://b.com" },
    ]),
    60
  );
  assert.equal(r.sinais.length, 1);
  assert.equal(r.score_v1, 65);
});

test("score fica preso entre 0 e 100", () => {
  const alto = parseResearch(
    resposta([{ tipo: "banco_investimento", descricao: "x", fonte_url: "https://a.com" }]),
    95
  );
  assert.equal(alto.score_v1, 100, "não passa de 100");

  const baixo = parseResearch(
    resposta([{ tipo: "sucessor_familiar_ativo", descricao: "x", fonte_url: "https://a.com" }]),
    10
  );
  assert.equal(baixo.score_v1, 0, "não fica negativo");
});

test("fonte que não é URL vira null em vez de texto solto", () => {
  const r = parseResearch(
    resposta([{ tipo: "big4_auditoria", descricao: "x", fonte_url: "achei no LinkedIn" }]),
    50
  );
  assert.equal(r.sinais[0].fonte_url, null, "sem URL real, o indício é fraco e precisa parecer fraco");
});

test("sem gatilho, a mensagem de abordagem é descartada", () => {
  // Mensagem sem motivo de timing é genérica, e genérica é pior que nenhuma.
  const raw = JSON.stringify({
    presenca_digital: "baixa",
    resumo: "x",
    sinais: [],
    gatilho: null,
    mensagem_abordagem: "Prezado, gostaria de conversar sobre o futuro da sua empresa.",
  });
  const r = parseResearch(raw, 50);
  assert.equal(r.gatilho, null);
  assert.equal(r.mensagem_abordagem, null);
});
