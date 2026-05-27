// Smoke test de conectividade. Roda: node --env-file=.env.local scripts/check-supabase.mjs
// Confirma que as chaves do .env.local estão presentes e que o service role autentica no Supabase.
// Não imprime nenhum valor de secret.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anthropic = process.env.ANTHROPIC_API_KEY;

console.log("NEXT_PUBLIC_SUPABASE_URL set:      ", !!url);
console.log("NEXT_PUBLIC_SUPABASE_ANON_KEY set: ", !!anon);
console.log("SUPABASE_SERVICE_ROLE_KEY set:     ", !!service);
console.log("ANTHROPIC_API_KEY set:             ", !!anthropic);

if (!url || !service) {
  console.error("FAIL: faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, service, { auth: { persistSession: false } });
const { error } = await supabase.from("__connectivity_check__").select("*").limit(1);

if (!error) {
  console.log("CONN: OK (tabela de teste existe — inesperado mas conexão funciona)");
} else if (error.code === "42P01" || error.code === "PGRST205" || /could not find the table|does not exist/i.test(error.message)) {
  console.log("CONN: OK — service role autenticou, tabela ausente como esperado (banco vazio)");
} else if (/invalid api key|jwt|unauthorized/i.test(error.message)) {
  console.error("FAIL: chave inválida —", error.message);
  process.exit(2);
} else {
  console.error("CONN: erro inesperado —", error.code, error.message);
  process.exit(3);
}
