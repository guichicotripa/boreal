// Gate de acesso do piloto — torna o app privado sem depender de Supabase Auth.
// O cookie de sessão guarda uma assinatura HMAC (não a senha). O middleware recomputa e compara.
// LIGA só quando BOREAL_GATE_PASSWORD está setada; sem ela o app fica aberto (dev/local intactos).
// Usa Web Crypto (disponível no Edge do middleware E no runtime nodejs das rotas).

const SECRET = process.env.BOREAL_GATE_SECRET ?? "boreal-dev-secret-troque-em-prod";
export const GATE_COOKIE = "boreal_gate";

export async function gateToken(): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("boreal-gate-v1"));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
