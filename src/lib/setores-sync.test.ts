/* A tabela `setor` no banco é ESPELHO de src/lib/setores.json, porque as policies
   da migration 0012 precisam dos prefixos de CNAE e o Postgres não lê o bundle.
   Espelho sem guarda é drift esperando acontecer: foi assim que o id de modelo
   ficou preso na geração 4 em seis arquivos ao mesmo tempo.

   Este teste falha quando o registry mudou e o banco não. Roda contra o banco só
   quando há credencial (CI local / máquina do dev); sem ela, pula em vez de dar
   falso verde, porque teste que "passa" sem ter olhado nada é pior que teste
   nenhum. */
import { test, skip } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { SETORES } from "./setores.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  skip("espelho de setores: sem credencial do Supabase (rode com --env-file=.env.local)");
} else {
  test("tabela `setor` bate com o registry", async () => {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase.from("setor").select("id, nome, prefixos").order("id");
    assert.equal(error, null, `leitura falhou: ${error?.message}`);

    const noBanco = new Map((data ?? []).map((r) => [r.id as string, r as { nome: string; prefixos: string[] }]));
    const dica = "rode: node --experimental-strip-types --env-file=.env.local scripts/sync-setores.ts";

    for (const s of SETORES) {
      const espelho = noBanco.get(s.id);
      assert.ok(espelho, `setor "${s.id}" está no registry e não no banco. ${dica}`);
      assert.deepEqual(
        [...espelho.prefixos].sort(),
        [...s.cnaes].sort(),
        `prefixos de "${s.id}" divergem (banco ${espelho.prefixos} × registry ${s.cnaes}). ${dica}`
      );
    }

    /* Sobra no banco é pior que falta: permissão que continua valendo pra um
       setor que o registry não conhece mais. */
    const idsRegistry = new Set(SETORES.map((s) => s.id));
    const orfaos = [...noBanco.keys()].filter((id) => !idsRegistry.has(id));
    assert.deepEqual(orfaos, [], `setores no banco que sumiram do registry: ${orfaos.join(", ")}. ${dica}`);
  });
}
