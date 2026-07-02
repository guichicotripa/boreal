// Selo de proveniência — prova assinada de que um lead veio do Boreal (destrava o success fee).
// O hash é um HMAC-SHA256 sobre (cnpj | data_origem | score) com o secret do servidor: só o Boreal
// consegue emitir um selo válido, então o selo prova a origem e a data, e não pode ser forjado nem
// retroagido pelo parceiro. Reusa BOREAL_GATE_SECRET (segredo estável do servidor).

const SECRET = process.env.BOREAL_GATE_SECRET ?? "boreal-dev-secret-troque-em-prod";

export type Certificado = {
  oportunidade_id: string;
  cnpj: string;
  razao_social: string;
  origem: string;
  data_origem: string;           // ISO — quando o lead entrou no pipeline do Boreal
  score_origem: number | null;   // score de propensão no momento
  novo_para_setter: boolean | null; // true = não estava no CRM incumbente do parceiro
  selado_em: string;
  hash: string;
  valido: boolean;               // recomputa o hash e confere (tamper-evidence)
};

export async function selaHash(cnpj: string, dataOrigem: string, score: number | null): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const msg = `${cnpj}|${dataOrigem}|${score ?? ""}`;
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Só dígitos do CNPJ (a lista do parceiro e o banco podem vir formatados). */
export function normalizaCnpj(cnpj: string): string {
  return (cnpj ?? "").replace(/\D/g, "");
}
