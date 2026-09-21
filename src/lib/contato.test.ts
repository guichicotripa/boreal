/* O contato é o que a Setter vai usar para ligar. Errar a classificação aqui não deixa a tela
   feia: faz o originador mandar a abordagem para o contador achando que é o dono, ou discar um
   número que não existe. Os dois custam uma tentativa, e a Setter tem poucas. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { procedenciaEmail, telefoneSuspeito, siteDeEmail } from "./contato.ts";

/* ── procedência do e-mail ─────────────────────────────────────────────────── */

test("webmail é linha pessoal, não defeito", () => {
  assert.equal(procedenciaEmail("joao@gmail.com"), "pessoal");
  assert.equal(procedenciaEmail("MARIA@HOTMAIL.COM.BR"), "pessoal");
  // A Receita devolve domínio com ponto final. Sem normalizar, viraria "empresa".
  assert.equal(procedenciaEmail("joao@gmail.com."), "pessoal");
});

test("quem se declara contabilidade é pego pelo nome, no domínio ou antes do @", () => {
  assert.equal(procedenciaEmail("contato@rissicontabilidade.com.br"), "contabilidade");
  assert.equal(procedenciaEmail("contabilidade@empresareal.com.br"), "contabilidade");
  assert.equal(procedenciaEmail("escritorio@algo.com.br"), "contabilidade");
});

test("domínio próprio sem lista continua institucional", () => {
  assert.equal(procedenciaEmail("contato@axysanalises.com.br"), "empresa");
});

/* Este é o caso que a regex sozinha não resolve, e é o motivo de a lista existir:
   os maiores intermediários do país não dizem no nome que são intermediários. */
test("domínio compartilhado vira intermediário só quando a lista é passada", () => {
  const lista = new Set(["laparo.com.br", "maismei.com.br", "netsite.com.br"]);
  assert.equal(procedenciaEmail("contato@laparo.com.br"), "empresa");
  assert.equal(procedenciaEmail("contato@laparo.com.br", lista), "intermediario");
});

test("webmail nunca vira intermediário, mesmo estando na lista", () => {
  // gmail.com atende 23 milhões de CNPJs e lidera a contagem nacional. Se a ordem das checagens
  // invertesse, metade da base viraria "intermediário" de uma vez.
  const lista = new Set(["gmail.com", "hotmail.com"]);
  assert.equal(procedenciaEmail("joao@gmail.com", lista), "pessoal");
});

test("contabilidade ganha do compartilhado, porque diz mais", () => {
  const lista = new Set(["rissicontabilidade.com.br"]);
  assert.equal(procedenciaEmail("contato@rissicontabilidade.com.br", lista), "contabilidade");
});

test("e-mail ausente ou sem domínio não vira classificação nenhuma", () => {
  assert.equal(procedenciaEmail(null), null);
  assert.equal(procedenciaEmail(""), null);
  assert.equal(procedenciaEmail("semarroba"), null);
});

/* ── telefone ──────────────────────────────────────────────────────────────── */

test("telefone de verdade passa, fixo e celular", () => {
  assert.equal(telefoneSuspeito("1144380877").suspeito, false);
  assert.equal(telefoneSuspeito("(85) 98811-2233").suspeito, false);
});

test("o número de preenchimento mais comum da base é pego", () => {
  // 1199999999 aparece em 167 empresas.
  const r = telefoneSuspeito("1199999999");
  assert.equal(r.suspeito, true);
  assert.match(r.motivo!, /dígitos iguais/);
});

test("DDD que não existe é pego", () => {
  const r = telefoneSuspeito("2012345678");
  assert.equal(r.suspeito, true);
  assert.match(r.motivo!, /DDD 20/);
});

test("comprimento errado é pego", () => {
  assert.equal(telefoneSuspeito("11443808").suspeito, true);
  assert.equal(telefoneSuspeito("114438087700").suspeito, true);
});

test("sequência inteira é preenchimento", () => {
  assert.equal(telefoneSuspeito("1112345678").suspeito, true);
  assert.equal(telefoneSuspeito("1187654321").suspeito, true);
});

test("ausência de telefone é dita como ausência, não como número ruim", () => {
  const r = telefoneSuspeito(null);
  assert.equal(r.suspeito, true);
  assert.match(r.motivo!, /sem telefone/);
});

/* ── site derivado ─────────────────────────────────────────────────────────── */

const AXYS = { razao_social: "AXYS ANALISES-DIAGNOSTICO VETERINARIO E COMERCIO LTDA", nome_fantasia: null };

test("site sai de domínio próprio quando o domínio casa com o nome", () => {
  assert.equal(siteDeEmail("contato@axysanalises.com.br", "empresa", AXYS), "https://axysanalises.com.br");
});

test("nunca deriva site de webmail, contabilidade ou compartilhado", () => {
  // O perigo aqui não é ficar sem site, é entregar o site do escritório de contabilidade
  // parecendo o site da empresa. Errado e convincente é pior que vazio.
  assert.equal(siteDeEmail("joao@gmail.com", "pessoal", AXYS), null);
  assert.equal(siteDeEmail("x@rissicontabilidade.com.br", "contabilidade", AXYS), null);
  assert.equal(siteDeEmail("x@laparo.com.br", "intermediario", AXYS), null);
  assert.equal(siteDeEmail("x@qualquer.com.br", null, AXYS), null);
});

/* O caso que me fez apertar a regra: a INTERNATIONAL PET tinha e-mail em `marciorene.eng.br`, que
   é domínio pessoal de um engenheiro, e a primeira versão entregava isso como site da empresa. */
test("domínio de terceiro que não casa com o nome não vira site", () => {
  const pet = { razao_social: "INTERNATIONAL PET LTDA.", nome_fantasia: "DR PET" };
  assert.equal(siteDeEmail("x@marciorene.eng.br", "empresa", pet), null);
  const clinica = { razao_social: "ASA CLINICA MEDICA SANTO ANDRE LTDA", nome_fantasia: null };
  assert.equal(siteDeEmail("x@olimarcontail.com.br", "empresa", clinica), null);
});

test("o nome fantasia também vale, porque o domínio costuma usar a marca", () => {
  const nucleo = { razao_social: "NUCLEO DIAGNOSTICO VETERINARIO MARINGA LTDA", nome_fantasia: "PRONTODOG" };
  assert.equal(siteDeEmail("x@prontodog.vet.br", "empresa", nucleo), "https://prontodog.vet.br");
});

test("palavra genérica do setor não conta como casamento", () => {
  // Sem isto, `clinicavet.com.br` casaria com qualquer clínica veterinária do país.
  const qualquer = { razao_social: "CLINICA VETERINARIA SAO JORGE LTDA", nome_fantasia: null };
  assert.equal(siteDeEmail("x@clinicavet.com.br", "empresa", qualquer), null);
});

test("sem nome para comparar, não deriva", () => {
  // Chamar sem os nomes é o caso em que não dá para checar, e aí a resposta certa é "não sei".
  assert.equal(siteDeEmail("contato@axysanalises.com.br", "empresa"), null);
});

test("domínio malformado não vira URL", () => {
  assert.equal(siteDeEmail("x@dominio", "empresa", AXYS), null);
  assert.equal(siteDeEmail("x@-ruim.com", "empresa", AXYS), null);
});
