import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

/* O antigo createBrowserClient daqui saiu: era baseado no supabase-js, que guarda
   a sessão em localStorage — invisível pro servidor. Quem precisa de cliente no
   navegador usa `supabase-browser.ts` (@supabase/ssr, sessão em cookie). Estava
   sem nenhum uso, então a remoção não muda comportamento. */

/**
 * Admin client — server-only. Uses the service role key and bypasses RLS.
 * Used by the data pipeline (CNPJ ingest, scoring writes). Never import in a client component.
 *
 * NÃO use em rota de app: service_role ignora as policies da migration 0011, e o
 * isolamento entre firmas deixa de existir. Rota de app usa createUserClient().
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
