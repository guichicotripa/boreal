/* A qualificação diz para quem ligar. Errar aqui manda o originador para quem não decide. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { descreveQualificacao, temGestao, qualificacaoSucessoria, QUALIFICACAO } from "./qualificacao.ts";

test("os códigos que existem nas 31 salvas da Setter viram texto da Receita", () => {
  assert.equal(descreveQualificacao("49"), "Sócio-Administrador");
  assert.equal(descreveQualificacao("22"), "Sócio");
  assert.equal(descreveQualificacao("5"), "Administrador");
  assert.equal(descreveQualificacao("10"), "Diretor");
  assert.equal(descreveQualificacao("16"), "Presidente");
  assert.equal(descreveQualificacao("8"), "Conselheiro de Administração");
  assert.equal(descreveQualificacao("30"), "Sócio ou Acionista Menor (Assistido/Representado)");
});

test("código com zero à esquerda ou espaço também resolve", () => {
  assert.equal(descreveQualificacao("05"), "Administrador");
  assert.equal(descreveQualificacao(" 49 "), "Sócio-Administrador");
  assert.equal(descreveQualificacao(49), "Sócio-Administrador");
});

test("código desconhecido ou ausente não vira número solto na tela", () => {
  assert.equal(descreveQualificacao("999"), null);
  assert.equal(descreveQualificacao(null), null);
  assert.equal(descreveQualificacao(""), null);
  assert.equal(descreveQualificacao("Sócio"), null, "texto já traduzido não é código");
});

test("quem administra é separado de quem só tem quota", () => {
  assert.equal(temGestao("49"), true);
  assert.equal(temGestao("5"), true);
  assert.equal(temGestao("16"), true);
  // Sócio sem cargo tem quota mas não assina. Ligar para ele é ligar para quem repassa.
  assert.equal(temGestao("22"), false);
  assert.equal(temGestao("8"), false, "conselheiro não é gestão executiva");
});

test("inventariante e herdeiro menor são sinal de sucessão em curso", () => {
  assert.equal(qualificacaoSucessoria("12"), true);
  assert.equal(qualificacaoSucessoria("30"), true);
  assert.equal(qualificacaoSucessoria("35"), true, "tutor aparece para representar o menor");
  assert.equal(qualificacaoSucessoria("49"), false);
  assert.equal(qualificacaoSucessoria("22"), false);
});

test("a tabela cobre de 1 a 79 sem buraco, como a da Receita", () => {
  for (let c = 1; c <= 79; c++) assert.ok(QUALIFICACAO[c], `código ${c} faltando`);
});
