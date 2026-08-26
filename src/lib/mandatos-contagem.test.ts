/* Os dois números que a tela do cliente mostra ("72 de 1.671") conferidos contra o banco.
 *
 * POR QUE ISTO EXISTE: `empresas` e `empresasFiltradas` são constantes no bundle. Ninguém percebe
 * quando envelhecem, e envelhecer aqui não é detalhe estético: é a firma lendo "72 de 1.671" numa
 * lista que na verdade tem outra coisa, e usando esse número numa conversa com o cliente dela.
 * Contagem que vai pra tela e não tem guarda é afirmação sem fonte.
 *
 * A consulta REPETE a forma que src/app/api/search/route.ts usa (`filtroOr` + `.eq(porte)` +
 * `.lte(data_inicio_atividade)`), de propósito: o teste tem que quebrar se a rota mudar de regra,
 * não só se o banco mudar de conteúdo.
 *
 * Roda só quando há credencial; sem ela, pula em vez de dar falso verde.
 */
import { test, skip } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { MANDATOS, filtroOr } from "./mandatos.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

/* Ingestão nova ou baixa de dados move a contagem legitimamente. A guarda é contra DRIFT, não
   contra variação: 2% de folga deixa o número respirar e ainda pega mudança de regra. */
const FOLGA = 0.02;

if (!url || !key) {
  skip("contagem de mandatos: sem credencial do Supabase (rode com --env-file=.env.local)");
} else {
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  for (const m of MANDATOS) {
    test(`${m.nome}: universo e recorte filtrado batem com o banco`, async () => {
      const universo = await supabase
        .from("empresa").select("id", { count: "exact", head: true }).or(filtroOr(m));
      assert.equal(universo.error, null, `leitura falhou: ${universo.error?.message}`);
      const perto = (real: number, declarado: number) =>
        Math.abs(real - declarado) <= Math.max(1, declarado * FOLGA);

      assert.ok(
        perto(universo.count!, m.empresas),
        `${m.id}: universo declarado ${m.empresas}, banco tem ${universo.count}`
      );

      if (!m.filtroPadrao) return;

      let q = supabase.from("empresa").select("id", { count: "exact", head: true }).or(filtroOr(m));
      q = q.in("porte", m.filtroPadrao.portes);
      q = q.lte("data_inicio_atividade", `${m.filtroPadrao.maxAnoFundacao}-12-31`);
      const filtrado = await q;
      assert.equal(filtrado.error, null, `leitura falhou: ${filtrado.error?.message}`);

      assert.ok(
        perto(filtrado.count!, m.empresasFiltradas!),
        `${m.id}: filtrado declarado ${m.empresasFiltradas}, banco tem ${filtrado.count}`
      );

      /* O corte tem que CORTAR. Padrão que não remove nada é padrão quebrado (prefixo errado,
         valor de porte que não existe na base), e passaria despercebido porque a tela continua
         mostrando uma lista. */
      assert.ok(
        filtrado.count! < universo.count!,
        `${m.id}: o corte padrão não removeu nada (${filtrado.count} de ${universo.count})`
      );
    });
  }
}
