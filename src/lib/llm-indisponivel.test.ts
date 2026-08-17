/* O classificador separa "acabou o crédito" de "deu bug", e a distinção decide o que a tela
   oferece: sem crédito, o botão de tentar de novo é uma mentira; congestionado, é a ação certa.
   Erro mal classificado volta a mostrar "falha na investigação" para um fato administrativo. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { motivoIndisponivel, mensagemIndisponivel, valeTentarDeNovo } from "./llm-indisponivel.ts";

/* Formato real do SDK: a mensagem de crédito chega como 400, NÃO como 402. Classificar por status
   sozinho poria isto no mesmo balde de "requisição malformada". */
test("saldo insuficiente é reconhecido, mesmo vindo como 400", () => {
  const err = Object.assign(new Error("400 {\"type\":\"error\",\"error\":{\"type\":\"invalid_request_error\",\"message\":\"Your credit balance is too low to access the Anthropic API, please go to Plans & Billing to upgrade or purchase credits.\"}}"), { status: 400 });
  assert.equal(motivoIndisponivel(err), "sem_credito");
});

/* Chave ausente estoura na CONSTRUÇÃO do cliente, antes de haver request: não existe status. */
test("chave ausente é reconhecida sem status HTTP", () => {
  const err = new Error("The ANTHROPIC_API_KEY environment variable is missing or empty; either provide it, or instantiate the Anthropic client with an apiKey option.");
  assert.equal(motivoIndisponivel(err), "sem_chave");
});

test("401 e 403 caem em sem_chave", () => {
  assert.equal(motivoIndisponivel(Object.assign(new Error("authentication_error"), { status: 401 })), "sem_chave");
  assert.equal(motivoIndisponivel(Object.assign(new Error("forbidden"), { status: 403 })), "sem_chave");
});

test("429 e overloaded são limite, não falta de crédito", () => {
  assert.equal(motivoIndisponivel(Object.assign(new Error("rate_limit_error"), { status: 429 })), "limite");
  assert.equal(motivoIndisponivel(Object.assign(new Error("Overloaded"), { status: 529 })), "limite");
});

/* O caso que NÃO pode ser capturado: bug de verdade tem que continuar sendo 500 com "tentar de
   novo", senão um defeito nosso passa a ser reportado ao cliente como "sem crédito". */
test("falha comum não vira indisponibilidade", () => {
  assert.equal(motivoIndisponivel(new Error("Research: resposta sem JSON: <html>...")), null);
  assert.equal(motivoIndisponivel(new Error("fetch failed")), null);
  assert.equal(motivoIndisponivel(Object.assign(new Error("server error"), { status: 500 })), null);
  assert.equal(motivoIndisponivel(undefined), null);
  assert.equal(motivoIndisponivel(null), null);
});

test("só o congestionamento vale tentar de novo", () => {
  assert.equal(valeTentarDeNovo("limite"), true);
  assert.equal(valeTentarDeNovo("sem_credito"), false);
  assert.equal(valeTentarDeNovo("sem_chave"), false);
  assert.equal(valeTentarDeNovo(null), false);
});

/* A mensagem tem que dizer que o problema NÃO é a empresa nem a busca. Sem isso o originador
   conclui que a ferramenta não sabe nada sobre aquele alvo, que é o oposto do que houve. */
test("a mensagem sem crédito isenta a empresa e a busca", () => {
  const m = mensagemIndisponivel("sem_credito", "investigação");
  assert.match(m, /crédito/);
  assert.match(m, /não é falha desta empresa/i);
  assert.doesNotMatch(m, /tente de novo/i);
});

test("a mensagem de congestionamento manda tentar de novo", () => {
  assert.match(mensagemIndisponivel("limite", "memo"), /tente de novo/i);
});
