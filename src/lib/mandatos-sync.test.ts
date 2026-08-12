/* A tabela `mandato` no banco é ESPELHO de src/lib/mandatos.ts, porque a policy da migration 0014
   precisa dos prefixos de CNAE e o Postgres não lê o bundle. Irmão de setores-sync.test.ts, e pelo
   mesmo motivo: espelho sem guarda é drift esperando acontecer.

   Aqui o drift é mais caro que no de setores. Prefixo faltando no espelho não deixa a tela feia:
   deixa o originador da firma sem enxergar as empresas do mandato que ele contratou, porque a
   policy nega antes de qualquer código nosso rodar. Falha silenciosa que parece base vazia.

   Roda contra o banco só quando há credencial; sem ela, pula em vez de dar falso verde. */
import { test, skip } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { MANDATOS, prefixosDe } from "./mandatos.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  skip("espelho de mandatos: sem credencial do Supabase (rode com --env-file=.env.local)");
} else {
  test("tabela `mandato` bate com src/lib/mandatos.ts", async () => {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase.from("mandato").select("id, nome, prefixos").order("id");
    assert.equal(error, null, `leitura falhou: ${error?.message}`);

    const noBanco = new Map((data ?? []).map((r) => [r.id as string, r as { nome: string; prefixos: string[] }]));
    const dica = "rode: node --experimental-strip-types --env-file=.env.local scripts/sync-mandatos.ts";

    for (const m of MANDATOS) {
      const espelho = noBanco.get(m.id);
      assert.ok(espelho, `mandato "${m.id}" está no código e não no banco. ${dica}`);
      assert.deepEqual(
        [...espelho.prefixos].sort(),
        prefixosDe(m),
        `prefixos de "${m.id}" divergem (banco ${espelho.prefixos} × código ${prefixosDe(m)}). ${dica}`
      );
    }

    /* Sobra no banco é pior que falta: permissão que continua valendo pra um mandato que o código
       não conhece mais. */
    const idsCodigo = new Set(MANDATOS.map((m) => m.id));
    const orfaos = [...noBanco.keys()].filter((id) => !idsCodigo.has(id));
    assert.deepEqual(orfaos, [], `mandatos no banco que sumiram do código: ${orfaos.join(", ")}. ${dica}`);
  });
}
