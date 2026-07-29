/**
 * Dá acesso a uma pessoa. É o único jeito de entrar no Boreal: não existe
 * auto-cadastro, e autenticar no Supabase sem uma linha em `membro` não abre nada.
 *
 *   node --experimental-strip-types --env-file=.env.local scripts/convidar.ts --listar
 *   node --experimental-strip-types --env-file=.env.local scripts/convidar.ts --email=x@setter.com.br --nome="Fulano" --org=setter
 *   node --experimental-strip-types --env-file=.env.local scripts/convidar.ts --email=x@setter.com.br --org=setter --papel=admin
 *
 * IDEMPOTENTE: rodar duas vezes com o mesmo email não duplica nem quebra. Se a
 * pessoa já existe no Auth, reaproveita o usuário e só garante o vínculo.
 *
 * A pessoa não recebe senha nenhuma. Ela entra em /acesso, digita o email e o
 * magic link chega na caixa dela.
 */
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const flag = (n: string, p: string | null = null) => {
  const a = args.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3).trim() : p;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

if (args.includes("--listar")) {
  const { data, error } = await supabase
    .from("membro")
    .select("user_id, nome, papel, org:org_id (nome, slug)")
    .order("created_at");
  if (error) { console.error("FAIL:", error.message); process.exit(1); }

  const { data: auth } = await supabase.auth.admin.listUsers();
  const emailPorId = new Map((auth?.users ?? []).map((u) => [u.id, u.email ?? "?"]));

  if (!data?.length) { console.log("Nenhum membro cadastrado."); process.exit(0); }
  console.log(`${data.length} membro(s):\n`);
  for (const m of data as unknown as { user_id: string; nome: string | null; papel: string; org: { nome: string; slug: string } }[]) {
    console.log(`  ${(emailPorId.get(m.user_id) ?? "?").padEnd(34)} ${(m.nome ?? "").padEnd(22)} ${m.papel.padEnd(12)} ${m.org?.nome ?? "?"}`);
  }
  process.exit(0);
}

const email = flag("email");
const nome = flag("nome");
const orgSlug = flag("org", "setter")!;
const papel = flag("papel", "originador")!;

if (!email) {
  console.error("uso: --email=pessoa@firma.com [--nome=\"Nome\"] [--org=setter] [--papel=originador|admin]");
  console.error("     --listar  para ver quem já tem acesso");
  process.exit(1);
}
if (!["originador", "admin"].includes(papel)) {
  console.error(`papel inválido: ${papel} (use originador ou admin)`);
  process.exit(1);
}

const { data: org, error: errOrg } = await supabase
  .from("org").select("id, nome").eq("slug", orgSlug).maybeSingle();
if (errOrg || !org) {
  console.error(`org "${orgSlug}" não existe. Crie antes, ou use --org=setter.`);
  process.exit(1);
}

/* createUser com email_confirm: true. Sem isso o Supabase manda um email de
   confirmação e o magic link do primeiro acesso falha silenciosamente, porque o
   endereço ainda não está verificado. Quem chega aqui foi convidado por uma
   pessoa, então o email já é confiável. */
let userId: string;
const { data: criado, error: errCriar } = await supabase.auth.admin.createUser({
  email,
  email_confirm: true,
});

if (criado?.user) {
  userId = criado.user.id;
  console.log(`usuário criado no Auth: ${email}`);
} else {
  // Já existe: reaproveita em vez de falhar (o script é idempotente).
  const { data: lista } = await supabase.auth.admin.listUsers();
  const achado = (lista?.users ?? []).find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!achado) { console.error("FAIL ao criar usuário:", errCriar?.message); process.exit(1); }
  userId = achado.id;
  console.log(`usuário já existia no Auth: ${email}`);
}

const { error: errMembro } = await supabase
  .from("membro")
  .upsert({ user_id: userId, org_id: org.id, nome, papel }, { onConflict: "user_id" });
if (errMembro) { console.error("FAIL ao vincular à org:", errMembro.message); process.exit(1); }

console.log(`✓ ${email} → ${org.nome} como ${papel}`);
console.log(`  Peça pra pessoa entrar em /acesso e pedir o link com esse email.`);
