/* As duas regras que decidem o que a bancada desenha, e as duas são contraintuitivas.
 *
 *   setor vazio   = TODOS os setores   (contrato sem recorte de setor)
 *   mandato vazio = NENHUM mandato     (mandato é universo sob encomenda, default é não ver)
 *
 * E a que junta as duas: firma COM mandato contratado passa a ler `setores` literalmente, então
 * `setores: []` vira "nenhum setor" em vez de "todos". É o caso da Setter, que fechou piloto por
 * três mandatos. Sem essa linha o switcher continuaria oferecendo os quatro setores validados,
 * que o banco nega desde a migration 0014 — botão que sempre devolve vazio.
 *
 * Puro, sem banco: são funções de decisão, não de acesso. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { universoDaOrg, setorPermitido, mandatoPermitido, type Permissoes } from "./contrato.ts";
import { tesesDe, TESES_POR_MANDATO, TESES_POR_SETOR } from "./teses.ts";

const SETORES = [{ id: "metalmec" }, { id: "saude" }, { id: "agro" }, { id: "educacao" }];
const MANDATOS = [{ id: "foco-a-vet-lab" }, { id: "foco-b-plano-pet" }, { id: "death-care" }];

const perm = (p: Partial<Permissoes> = {}): Permissoes => ({
  setores: [], mandatos: [], ufs: [], modulos: [], staff: false, ...p,
});

test("firma sem contrato nenhum vê todos os setores e nenhum mandato", () => {
  const u = universoDaOrg(perm(), SETORES, MANDATOS);
  assert.deepEqual(u.setores, ["metalmec", "saude", "agro", "educacao"]);
  assert.deepEqual(u.mandatos, []);
});

test("Setter: três mandatos e NENHUM setor, mesmo com org_setor vazia", () => {
  const u = universoDaOrg(
    perm({ mandatos: ["foco-a-vet-lab", "foco-b-plano-pet", "death-care"] }),
    SETORES, MANDATOS
  );
  assert.deepEqual(u.setores, [], "org_setor vazia + mandato contratado tem que dar zero setor");
  assert.deepEqual(u.mandatos, ["foco-a-vet-lab", "foco-b-plano-pet", "death-care"]);
});

test("contrato misto: os setores comprados mais os mandatos comprados", () => {
  const u = universoDaOrg(perm({ setores: ["saude"], mandatos: ["death-care"] }), SETORES, MANDATOS);
  assert.deepEqual(u.setores, ["saude"]);
  assert.deepEqual(u.mandatos, ["death-care"]);
});

test("staff enxerga tudo, contrato nenhum", () => {
  const u = universoDaOrg(perm({ staff: true }), SETORES, MANDATOS);
  assert.equal(u.setores.length, 4);
  assert.equal(u.mandatos.length, 3);
});

test("mandato não contratado é negado; setor sem restrição é liberado", () => {
  const p = perm({ mandatos: ["death-care"] });
  assert.equal(mandatoPermitido(p, "death-care"), true);
  assert.equal(mandatoPermitido(p, "foco-a-vet-lab"), false, "mandato vazio/ausente = negado");
  assert.equal(setorPermitido(perm(), "saude"), true, "setor vazio = liberado");
});

/* O defeito que isto trava: abrir um mandato e receber os atalhos de metalmecânica. Clicar num
   deles trocava a busca de universo em silêncio, com a lista do mandato ainda na tela. */
test("cada mandato tem atalho próprio, e nenhum cai no fallback de metalmecânica", () => {
  for (const m of MANDATOS) {
    const t = tesesDe(m.id);
    assert.ok(t.length > 0, `mandato ${m.id} sem tese`);
    assert.notDeepEqual(t, TESES_POR_SETOR.metalmec, `mandato ${m.id} caiu no fallback`);
    assert.deepEqual(t, TESES_POR_MANDATO[m.id]);
  }
});

test("setor continua resolvendo pelo registry, e id desconhecido cai em metalmecânica", () => {
  assert.deepEqual(tesesDe("saude"), TESES_POR_SETOR.saude);
  assert.deepEqual(tesesDe(null), TESES_POR_SETOR.metalmec);
  assert.deepEqual(tesesDe("nao-existe"), TESES_POR_SETOR.metalmec);
});

/* Tese que isola UM subsegmento do mandato mente: dentro do mandato o CNAE já está fixado pelo
   chip, e o texto não estreita mais. "Planos funerários fundados antes de 1990" devolveria
   funerária e cemitério junto, porque `planos funerários` não é filtro nenhum para o parser.

   Nomear TODOS os segmentos que o mandato cobre é outra coisa e é permitido: "funerárias e
   cemitérios com sócios acima de 70 anos" descreve o universo e filtra por idade, que o parser
   sabe fazer. A primeira versão deste teste barrava essa frase e estava errada. */
test("nenhuma tese de mandato isola um subsegmento que o filtro não aplica", () => {
  const proibidos = [
    /\bplanos? funer[áa]ri/i,      // subsegmento do death care (CNAE 65111 dentro do mandato)
    /\bs[óo] (cemit|funer|cremat)/i,
    /\bsomente\b/i,
    /\bapenas\b/i,
    /\bcremat[óo]rios? (com|de|em|fundad)/i,  // crematório sozinho como se fosse recorte
  ];
  for (const [id, teses] of Object.entries(TESES_POR_MANDATO)) {
    for (const t of teses) {
      for (const p of proibidos) {
        assert.ok(!p.test(t), `tese de ${id} isola subsegmento que o filtro não aplica: "${t}"`);
      }
    }
  }
});

/* Todo atalho tem que casar com alguma dimensão que o parser LÊ (idade, ano ou UF), senão ele
   devolve o mandato inteiro e os três botões viram o mesmo botão. Medido em 12/08 antes de
   escrever as frases: os nove atalhos retornam de 78 a 1.739 empresas. */
test("todo atalho de mandato aciona ao menos um filtro real", () => {
  const dimensoes = [/\b\d{2}\s*anos\b/i, /\bantes de \d{4}\b/i, /\bs[ãa]o paulo\b/i];
  for (const [id, teses] of Object.entries(TESES_POR_MANDATO)) {
    for (const t of teses) {
      assert.ok(
        dimensoes.some((d) => d.test(t)),
        `tese de ${id} não aciona idade, ano nem praça, então devolve o mandato inteiro: "${t}"`
      );
    }
  }
});
