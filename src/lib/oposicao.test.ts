/* O direito de oposição (LGPD art. 18 §2º) conferido contra o banco de verdade.
 *
 * POR QUE CONTRA O BANCO: a regra mora num trigger (migration 0021), e trigger não tem teste de
 * unidade possível. O que precisa ser provado é comportamento de banco: que o contato some, que
 * NÃO VOLTA quando alguém tenta gravar de novo (é o que o backfill da Receita faz a cada recarga),
 * e que volta a ser aceito quando a oposição é retirada.
 *
 * USA UMA EMPRESA SINTÉTICA, criada e apagada pelo próprio teste. Testar em empresa real apagaria
 * o contato dela de verdade, e o trigger não devolve o que apagou (de propósito: guardar o contato
 * "para o caso de reverter" anularia a oposição).
 *
 * Roda só com credencial; sem ela, pula em vez de dar falso verde.
 */
import { test, skip, after } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

// CNPJ que não existe: 14 dígitos que não passam no dígito verificador, então nunca colide com
// empresa real ingerida da Receita.
const CNPJ_TESTE = "00000000000191";

if (!url || !key) {
  skip("oposição de contato: sem credencial do Supabase (rode com --env-file=.env.local)");
} else {
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const limpa = async () => {
    await sb.from("oposicao_contato").delete().eq("cnpj", CNPJ_TESTE);
    await sb.from("empresa").delete().eq("cnpj", CNPJ_TESTE);
  };
  const le = async () => {
    const { data, error } = await sb.from("empresa")
      .select("telefone, email, site, nao_contatar").eq("cnpj", CNPJ_TESTE).single();
    assert.equal(error, null, error?.message);
    return data!;
  };

  after(limpa);

  test("oposição apaga o contato, impede que ele volte, e retirá-la volta a aceitar", async () => {
    await limpa();
    const { error: e1 } = await sb.from("empresa").insert({
      cnpj: CNPJ_TESTE, razao_social: "EMPRESA SINTETICA DE TESTE DE OPOSICAO LTDA",
      telefone: "1144380877", email: "dono@exemplo.com.br", site: "https://exemplo.com.br",
    });
    assert.equal(e1, null, e1?.message);
    const antes = await le();
    assert.equal(antes.telefone, "1144380877");
    assert.equal(antes.nao_contatar, false);

    // 1. O pedido chega: o contato some da linha que já existia.
    const { error: e2 } = await sb.from("oposicao_contato").insert({ cnpj: CNPJ_TESTE, motivo: "teste", canal: "telefone" });
    assert.equal(e2, null, e2?.message);
    const depois = await le();
    assert.equal(depois.telefone, null, "telefone continuou na linha");
    assert.equal(depois.email, null, "e-mail continuou na linha");
    assert.equal(depois.site, null, "site continuou na linha");
    assert.equal(depois.nao_contatar, true, "a tela não saberia explicar o vazio");

    // 2. A recarga da Receita tenta gravar o contato de novo. É o furo que motivou a migration.
    await sb.from("empresa").update({ telefone: "1144380877", email: "dono@exemplo.com.br" }).eq("cnpj", CNPJ_TESTE);
    const recarga = await le();
    assert.equal(recarga.telefone, null, "a recarga devolveu o telefone de quem se opôs");
    assert.equal(recarga.email, null, "a recarga devolveu o e-mail de quem se opôs");

    // 3. Oposição retirada: a marca sai, e o contato volta a ser aceito na próxima gravação.
    await sb.from("oposicao_contato").delete().eq("cnpj", CNPJ_TESTE);
    assert.equal((await le()).nao_contatar, false);
    await sb.from("empresa").update({ telefone: "1144380877" }).eq("cnpj", CNPJ_TESTE);
    assert.equal((await le()).telefone, "1144380877", "sem oposição, o contato deveria voltar a ser aceito");
  });

  test("empresa sem oposição não é tocada pelo trigger", async () => {
    await limpa();
    await sb.from("empresa").insert({
      cnpj: CNPJ_TESTE, razao_social: "EMPRESA SINTETICA DE TESTE DE OPOSICAO LTDA", telefone: "1144380877",
    });
    const r = await le();
    assert.equal(r.telefone, "1144380877");
    assert.equal(r.nao_contatar, false);
  });
}
