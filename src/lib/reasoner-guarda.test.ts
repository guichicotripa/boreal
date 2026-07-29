import { test } from "node:test";
import assert from "node:assert/strict";
import { filtrarInsight, violaLinguagem } from "./reasoner-guarda.ts";

/* O reasoner escreve sobre empresas e pessoas REAIS, nominalmente, numa tela que
   o cliente lê. Os dois primeiros casos saíram de verdade na geração de
   25/07/2026 — não são hipóteses. */

test("barra termo clínico sobre idade (caso real: 'duplo risco senil')", () => {
  const r = filtrarInsight(
    {
      empresa_id: "1",
      one_liner: "Olídio (80+) opera desde 1984 ao lado de Suzete (71-80).",
      flags: ["duplo risco senil", "sem próxima geração", "42 anos operação"],
    },
    "SANTA ELISA AGROPECUARIA DE VOTUPORANGA LTDA."
  );
  assert.ok(r, "a frase principal não viola — o insight deve sobreviver");
  assert.deepEqual(r.flags, ["sem próxima geração", "42 anos operação"]);
});

test("barra insinuação de irregularidade (caso real: 'entrada suspeita 2023')", () => {
  const r = filtrarInsight(
    {
      empresa_id: "2",
      one_liner: "Maria é sócia fundadora desde 1984; Oswaldo (80+) entrou em 2023.",
      flags: ["sócio 80+ tardio", "entrada suspeita 2023"],
    },
    "EXTERNATO ELVIRA RAMOS LTDA."
  );
  assert.ok(r);
  assert.deepEqual(r.flags, ["sócio 80+ tardio"]);
});

test("frase principal com termo proibido descarta o insight inteiro", () => {
  const r = filtrarInsight(
    { empresa_id: "3", one_liner: "Sócio senil no comando desde 1970.", flags: ["quadro travado"] },
    "X LTDA"
  );
  assert.equal(r, null, "melhor sem comentário do que com comentário que ofende");
});

/* Falso positivo que o filtro TEM que evitar: existe um "Colégio Augusto Laranja"
   na base, e "laranja" é termo proibido no sentido de testa de ferro. Barrar o
   insight por causa do sobrenome de quem fundou o negócio seria trocar um defeito
   por outro. */
test("nome próprio da empresa não dispara o filtro", () => {
  const r = filtrarInsight(
    {
      empresa_id: "4",
      one_liner: "Casal Arlete e Almir Laranja (ambos 80+, sócios desde 1966) controla o colégio.",
      flags: ["casal fundador 80+", "herdeiro tardio 2024"],
    },
    "COLEGIO AUGUSTO LARANJA LTDA"
  );
  assert.ok(r, "não pode descartar por causa do sobrenome");
  assert.deepEqual(r.flags, ["casal fundador 80+", "herdeiro tardio 2024"]);
});

/* A regra não pode castrar a análise: inferência de negócio apoiada no dado é
   exatamente o que diferencia isto de uma lista filtrada. */
test("inferência de negócio apoiada no dado passa", () => {
  const r = filtrarInsight(
    {
      empresa_id: "5",
      one_liner: "Entrada simultânea de duas holdings em 2017 sugere estruturação pré-saída.",
      flags: ["2 holdings 2017", "transição iniciada"],
    },
    "CLINICA E NEFROLOGIA LESTE LTDA."
  );
  assert.ok(r);
  assert.equal(r.flags.length, 2);
});

test("violaLinguagem cobre as famílias de termo, não só as palavras exatas", () => {
  for (const t of ["senilidade avançada", "sócio decrépito", "quadro caduco", "possível fraude", "má-fé do sócio", "demência"]) {
    assert.ok(violaLinguagem(t), `deveria barrar: ${t}`);
  }
  for (const t of ["sócio 80+", "quadro travado 40 anos", "fundador único", "porte sweet spot", "entrada tardia de herdeiros"]) {
    assert.ok(!violaLinguagem(t), `não deveria barrar: ${t}`);
  }
});
