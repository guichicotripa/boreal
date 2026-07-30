import { test } from "node:test";
import assert from "node:assert/strict";
import { parseResearch } from "./research.ts";

/* O parse do v1 é onde o LLM deixa de mandar e o código passa a decidir o número.
   Estes testes cobrem o que já quebrou de verdade em produção. */

function resposta(sinais: unknown[]) {
  return JSON.stringify({ presenca_digital: "baixa", resumo: "x", sinais });
}

test("sucessor familiar atuando SOBE o score; herdeiro fora do negócio DESCE", () => {
  /* Os dois valiam o contrário até 29/07/2026 (-25 e +8), codificando a tese ingênua de
     sucessão. O lift condicional derrubou: sucessor presente 2,14x, ausência 0,58x, z = 9,5 nos
     dois. Este teste existe para quebrar se alguém "consertar" os sinais de volta por achar que
     estão errados. Se você discordar, meça de novo e mostre o número. */
  const comSucessor = parseResearch(
    resposta([{ tipo: "sucessor_familiar_ativo", descricao: "filha assumiu a direção", fonte_url: "https://a.com" }]),
    50
  );
  const semSucessor = parseResearch(
    resposta([{ tipo: "herdeiro_fora_carreira", descricao: "filhos são médicos, fora da empresa", fonte_url: "https://b.com" }]),
    50
  );
  assert.equal(comSucessor.score_v1, 62, "sucessor atuando é sinal POSITIVO");
  assert.equal(semSucessor.score_v1, 42, "herdeiro longe do negócio é sinal NEGATIVO");
  assert.ok(comSucessor.score_v1 > semSucessor.score_v1);
});

test("peso conta uma vez por TIPO, não por ocorrência", () => {
  // Aconteceu com uma empresa real: dois `sucessor_familiar_ativo` viraram o dobro do peso.
  // Base 50 e não 100 de propósito: no teto o clamp esconderia a soma dupla.
  const r = parseResearch(
    resposta([
      { tipo: "sucessor_familiar_ativo", descricao: "filho é diretor", fonte_url: "https://a.com" },
      { tipo: "sucessor_familiar_ativo", descricao: "outra fonte diz o mesmo", fonte_url: "https://b.com" },
    ]),
    50
  );
  assert.equal(r.score_v1, 62, "+12 aplicado uma vez, não duas");
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
    resposta([{ tipo: "herdeiro_fora_carreira", descricao: "x", fonte_url: "https://a.com" }]),
    5
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
