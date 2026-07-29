import { NextRequest, NextResponse } from "next/server";
import { createUserClient } from "@/lib/supabase-server";
import { selaHash, normalizaCnpj, type Certificado } from "@/lib/proveniencia";

export const runtime = "nodejs";

type Row = {
  id: string;
  origem: string | null;
  selado_em: string | null;
  proveniencia_hash: string | null;
  novo_para_setter: boolean | null;
  score_no_save: number | null;
  created_at: string;
  empresa: { cnpj: string; razao_social: string } | null;
};

const SELECT =
  "id, origem, selado_em, proveniencia_hash, novo_para_setter, score_no_save, created_at, empresa:empresa_id (cnpj, razao_social)";

async function certificadoDe(row: Row, novoOverride?: boolean | null): Promise<Certificado> {
  const cnpj = normalizaCnpj(row.empresa?.cnpj ?? "");
  const novo = novoOverride ?? row.novo_para_setter;
  const hash = await selaHash(cnpj, row.created_at, row.score_no_save);
  return {
    oportunidade_id: row.id,
    cnpj,
    razao_social: row.empresa?.razao_social ?? "",
    origem: row.origem ?? "boreal",
    data_origem: row.created_at,
    score_origem: row.score_no_save,
    novo_para_setter: novo,
    selado_em: row.selado_em ?? new Date().toISOString(),
    hash,
    // válido quando o hash recomputado bate com o gravado (se já selado).
    valido: row.proveniencia_hash ? row.proveniencia_hash === hash : true,
  };
}

// POST { id } — emite (ou reemite) o selo: checa o CRM incumbente, grava hash + novidade + data.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const id = String((body as { id?: string })?.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "id vazio" }, { status: 400 });

  const supabase = await createUserClient();
  const { data: row, error } = await supabase.from("oportunidade").select(SELECT).eq("id", id).single();
  if (error || !row) return NextResponse.json({ error: error?.message ?? "não encontrada" }, { status: 404 });

  const r = row as unknown as Row;
  const cnpj = normalizaCnpj(r.empresa?.cnpj ?? "");

  // Novidade: o CNPJ NÃO está no CRM incumbente do parceiro. SÓ afirma se a lista foi carregada —
  // com a tabela vazia não checamos nada, então novo = null ("não verificado") em vez de fingir "novo".
  const { count } = await supabase.from("crm_incumbente").select("cnpj", { count: "exact", head: true });
  let novo: boolean | null = null;
  if ((count ?? 0) > 0) {
    const { data: incumbente } = await supabase.from("crm_incumbente").select("cnpj").eq("cnpj", cnpj).maybeSingle();
    novo = !incumbente;
  }

  const hash = await selaHash(cnpj, r.created_at, r.score_no_save);
  const selado_em = new Date().toISOString();
  const { error: upErr } = await supabase
    .from("oportunidade")
    .update({ origem: r.origem ?? "boreal", selado_em, proveniencia_hash: hash, novo_para_setter: novo })
    .eq("id", id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({ certificado: await certificadoDe({ ...r, selado_em, proveniencia_hash: hash }, novo) });
}

// GET ?id= — retorna o certificado e verifica o hash (tamper-evidence).
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id vazio" }, { status: 400 });

  const supabase = await createUserClient();
  const { data: row, error } = await supabase.from("oportunidade").select(SELECT).eq("id", id).single();
  if (error || !row) return NextResponse.json({ error: error?.message ?? "não encontrada" }, { status: 404 });

  const r = row as unknown as Row;
  if (!r.proveniencia_hash) return NextResponse.json({ selado: false }, { status: 200 });
  return NextResponse.json({ certificado: await certificadoDe(r) });
}
