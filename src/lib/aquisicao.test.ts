/* O detector de "já tem dono". O pior erro dele não é dizer "não sei": é chamar de vendida uma
   empresa que segue com a família, porque isso faz a Setter DESCARTAR um alvo bom. Os casos aqui
   reproduzem, com dado sintético, as formas reais que ele encontrou nas 31 salvas. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { classificaControle, ehSocioPJ } from "./aquisicao.ts";

const PJ = "12345678000199"; // 14 dígitos = pessoa jurídica
const PF = "***123456**";

test("pessoa jurídica é reconhecida pelo cadastro, não pelo nome", () => {
  assert.equal(ehSocioPJ({ nome: "PHAGELAB LLC", cpf_cnpj_mascarado: PJ }), true);
  assert.equal(ehSocioPJ({ nome: "QUALQUER", faixa_etaria: "0" }), true);
  // Nome com cara de empresa, mas é pessoa física: o cadastro manda.
  assert.equal(ehSocioPJ({ nome: "JOAO PARTICIPACOES", cpf_cnpj_mascarado: PF, faixa_etaria: "6" }), false);
});

test("sócia PJ sem sobrenome em comum é comprador de fora (forma da PROVET com a Petlove)", () => {
  const r = classificaControle([
    { nome: "MARIA FERREIRA COSTA", cpf_cnpj_mascarado: PF, faixa_etaria: "6", data_entrada_sociedade: "2010-01-01" },
    { nome: "PETSUPERMARKET COMERCIO DE PRODUTOS PARA ANIMAIS SA", cpf_cnpj_mascarado: PJ, data_entrada_sociedade: "2025-03-01" },
  ], "2008-05-01");
  assert.equal(r.veredito, "provavelmente comprada");
  assert.equal(r.confianca, "alta");
  assert.equal(r.holdingDesde, 2025);
});

test("holding com o sobrenome da família NÃO é venda (forma da SÃO FRANCISCO com a VILA)", () => {
  const r = classificaControle([
    { nome: "DANIEL SOARES VILA", cpf_cnpj_mascarado: PF, faixa_etaria: "5", data_entrada_sociedade: "1995-01-01" },
    { nome: "VILA PARTICIPACOES LTDA", cpf_cnpj_mascarado: PJ, data_entrada_sociedade: "2019-01-01" },
  ], "1990-01-01");
  assert.equal(r.veredito, "reorganização familiar");
  assert.notEqual(r.veredito, "provavelmente comprada");
});

test("sobrenome comum demais não prova parentesco", () => {
  // SILVA na PF e na PJ não pode virar "família": é o sobrenome mais comum do país.
  const r = classificaControle([
    { nome: "JOSE DA SILVA", cpf_cnpj_mascarado: PF, faixa_etaria: "6", data_entrada_sociedade: "2000-01-01" },
    { nome: "SILVA INVESTIMENTOS LTDA", cpf_cnpj_mascarado: PJ, data_entrada_sociedade: "2022-01-01" },
  ], "1998-01-01");
  assert.equal(r.veredito, "provavelmente comprada");
});

test("quadro inteiro trocado sem PJ é 'não sei', não 'comprada'", () => {
  const r = classificaControle([
    { nome: "ANA REGINA MOTTA", cpf_cnpj_mascarado: PF, faixa_etaria: "5", data_entrada_sociedade: "2017-01-01" },
  ], "2010-01-01");
  assert.equal(r.veredito, "não sei, mas o quadro mudou");
  assert.equal(r.confianca, "baixa");
});

test("sócios pessoa física desde a fundação é sem sinal de venda", () => {
  const r = classificaControle([
    { nome: "LUCAS BOTEGA SPINELLI", cpf_cnpj_mascarado: PF, faixa_etaria: "6", data_entrada_sociedade: "1997-01-01" },
  ], "1997-01-01");
  assert.equal(r.veredito, "sem sinal de venda");
  assert.equal(r.holding, null);
});

test("o veredito nunca carrega CPF, só razão social de PJ", () => {
  const r = classificaControle([
    { nome: "FULANO DE TAL", cpf_cnpj_mascarado: PF, faixa_etaria: "6", data_entrada_sociedade: "2000-01-01" },
    { nome: "COMPRADORA SA", cpf_cnpj_mascarado: PJ, data_entrada_sociedade: "2023-01-01" },
  ], "1999-01-01");
  assert.ok(!JSON.stringify(r).includes(PF), "o CPF mascarado vazou para o veredito");
  assert.ok(!JSON.stringify(r).includes(PJ), "o veredito não precisa do CNPJ da compradora");
});

test("anexaControle devolve o veredito e apaga o CPF dos sócios", async () => {
  const { anexaControle } = await import("./aquisicao.ts");
  const e = {
    data_inicio_atividade: "2000-01-01",
    socio: [
      { nome: "FULANO", cpf_cnpj_mascarado: PF, faixa_etaria: "6", data_entrada_sociedade: "2000-01-01" },
      { nome: "COMPRADORA SA", cpf_cnpj_mascarado: PJ, data_entrada_sociedade: "2023-01-01" },
    ],
  };
  const r = anexaControle(e);
  assert.equal(r.controle.veredito, "provavelmente comprada");
  for (const s of r.socio) assert.equal("cpf_cnpj_mascarado" in s, false, "CPF continuou no objeto");
});
