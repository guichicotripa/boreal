import { NextRequest, NextResponse } from "next/server";
import { BigQuery } from "@google-cloud/bigquery";
import { createAdminClient } from "@/lib/supabase";
import trajetoriaCache from "@/lib/trajetoria-cache.json";
import path from "path";

export const runtime = "nodejs";
export const maxDuration = 30;

// Cache das empresas dos demos → clique instantâneo e confiável no Loom (sem ida ao BigQuery).
// Regenerar: node --env-file=.env.local scripts/build-trajetoria-cache.mjs
const CACHE = trajetoriaCache as Record<string, { pontos: unknown[]; eventos: unknown[] }>;

// Pontos no tempo (anuais + atual) pra ver a sucessão EM MOVIMENTO, não só um retrato.
const SNAPSHOTS = ["2022-01-08", "2023-01-15", "2024-01-16", "2025-01-14", "2025-11-09"];
const FAIXA: Record<number, string> = { 9: "80+", 8: "71–80", 7: "61–70", 6: "51–60", 5: "41–50", 4: "31–40", 3: "21–30", 2: "13–20", 1: "0–12" };

let _bq: BigQuery | null = null;
function bq() {
  if (!_bq) _bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID, keyFilename: path.resolve(process.env.GCP_KEY_PATH!) });
  return _bq;
}

// POST {empresaId} — trajetória do quadro societário no CNPJ ao longo de 4 anos.
export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }
  const empresaId = String((body as { empresaId?: string })?.empresaId ?? "").trim();
  if (!empresaId) return NextResponse.json({ error: "empresaId vazio" }, { status: 400 });

  // Cache hit → resposta instantânea (empresas-top dos demos pré-computadas).
  const skipCache = req.nextUrl.searchParams.get("fresh") === "1";
  if (!skipCache && CACHE[empresaId]) {
    return NextResponse.json({ ...CACHE[empresaId], cached: true });
  }

  const sb = createAdminClient();
  const { data: emp } = await sb.from("empresa").select("cnpj").eq("id", empresaId).single();
  if (!emp?.cnpj) return NextResponse.json({ error: "empresa não encontrada" }, { status: 404 });
  const basico = String(emp.cnpj).slice(0, 8);

  const inList = SNAPSHOTS.map((d) => `'${d}'`).join(",");
  const sql = `
    SELECT data, tipo, nome, SAFE_CAST(faixa_etaria AS INT64) AS faixa
    FROM \`basedosdados.br_me_cnpj.socios\`
    WHERE cnpj_basico='${basico}' AND data IN (${inList})
    ORDER BY data`;
  let rows;
  try {
    [rows] = await bq().query({ query: sql, location: "US" });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  // Agrupa por snapshot.
  const porData = new Map<string, { nome: string; tipo: string; faixa: number | null }[]>();
  for (const d of SNAPSHOTS) porData.set(d, []);
  for (const r of rows) {
    const d = typeof r.data === "object" ? r.data.value : r.data;
    porData.get(d)?.push({ nome: r.nome, tipo: String(r.tipo), faixa: r.faixa ?? null });
  }

  const pontos = SNAPSHOTS.filter((d) => (porData.get(d)?.length ?? 0) > 0).map((d) => {
    const socios = porData.get(d)!;
    const faixas = socios.map((s) => s.faixa).filter((f): f is number => f != null && f >= 1);
    return {
      ano: Number(d.slice(0, 4)),
      data: d,
      n_pf: socios.filter((s) => s.tipo === "2").length,
      n_pj: socios.filter((s) => s.tipo === "1").length,
      faixa_max: faixas.length ? FAIXA[Math.max(...faixas)] ?? null : null,
    };
  });

  // Eventos entre snapshots consecutivos (entrou / saiu / envelheceu).
  const eventos: { ano: number; texto: string; tipo: "entrou" | "saiu" | "envelheceu" }[] = [];
  const datasComDados = SNAPSHOTS.filter((d) => (porData.get(d)?.length ?? 0) > 0);
  for (let i = 1; i < datasComDados.length; i++) {
    const antes = porData.get(datasComDados[i - 1])!;
    const depois = porData.get(datasComDados[i])!;
    const ano = Number(datasComDados[i].slice(0, 4));
    const nomesAntes = new Set(antes.map((s) => s.nome));
    const nomesDepois = new Set(depois.map((s) => s.nome));
    for (const s of depois) if (!nomesAntes.has(s.nome)) {
      eventos.push({ ano, tipo: "entrou", texto: `Entrou ${s.nome}${s.tipo === "1" ? " (PJ)" : s.faixa ? ` (${FAIXA[s.faixa] ?? "?"})` : ""}` });
    }
    for (const s of antes) if (!nomesDepois.has(s.nome)) {
      eventos.push({ ano, tipo: "saiu", texto: `Saiu ${s.nome}` });
    }
    for (const s of depois) {
      const a = antes.find((x) => x.nome === s.nome);
      if (a && a.faixa != null && s.faixa != null && s.faixa > a.faixa) {
        eventos.push({ ano, tipo: "envelheceu", texto: `${s.nome}: ${FAIXA[a.faixa] ?? "?"} → ${FAIXA[s.faixa] ?? "?"}` });
      }
    }
  }

  return NextResponse.json({ pontos, eventos });
}
