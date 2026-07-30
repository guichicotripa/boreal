/**
 * Recalcula o score das investigações JÁ PERSISTIDAS, sem reinvestigar nada.
 *
 * Uma linha de `score_run` guarda duas coisas de naturezas diferentes: o ACHADO qualitativo do
 * LLM (caro, ~100s de inferência por empresa, e continua válido) e a ARITMÉTICA que transforma
 * esse achado em número (barata, e envelhece toda vez que o score muda). Quando o v0 virou v1 e
 * os pesos do research foram corrigidos, as 43 linhas passaram a servir número de fórmula
 * aposentada — e como a busca sobrepõe o score investigado por cima do determinístico, uma
 * empresa investigada apareceria com a régua antiga no meio de uma lista com a régua nova.
 *
 * Apagar resolveria e jogaria fora a parte cara. Este script refaz só a aritmética:
 *   score = calcScore(empresa)  +  ajusteDeSinais(sinais gravados)
 *
 *   node --experimental-strip-types --env-file=.env.local scripts/recalcula-research.ts
 *   node --experimental-strip-types --env-file=.env.local scripts/recalcula-research.ts --aplicar
 *
 * Sem `--aplicar` só mostra o diff. RODAR DEPOIS DE TODA MUDANÇA em scoring.ts ou em PESOS.
 */
import { createClient } from "@supabase/supabase-js";
import { calcScore } from "../src/lib/scoring.ts";
import { ajusteDeSinais } from "../src/lib/research.ts";
import type { Empresa, Socio } from "../src/lib/types.ts";

const aplicar = process.argv.includes("--aplicar");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

type Run = {
  id: string;
  empresa_id: string;
  score: number | null;
  sinais: { tipo: string }[] | null;
};

const { data: runs, error } = await supabase
  .from("score_run")
  .select("id, empresa_id, score, sinais")
  .order("created_at");
if (error) { console.error("FAIL leitura de score_run:", error.message); process.exit(1); }
if (!runs?.length) { console.log("score_run vazia, nada a fazer."); process.exit(0); }

// As empresas em lote: recalcular o v0 exige capital, cnae e o quadro societário completo.
const ids = [...new Set(runs.map((r) => (r as Run).empresa_id))];
const { data: empresas, error: e2 } = await supabase
  .from("empresa")
  .select("id, cnae_principal, capital_social, data_inicio_atividade, socio(faixa_etaria, data_entrada_sociedade)")
  .in("id", ids);
if (e2) { console.error("FAIL leitura de empresa:", e2.message); process.exit(1); }
const porId = new Map(empresas!.map((e) => [e.id, e]));

console.log(`${runs.length} investigações · ${ids.length} empresas\n`);
console.log("  score              ajuste   sinais");
const updates: { id: string; score: number }[] = [];

for (const r of runs as Run[]) {
  const emp = porId.get(r.empresa_id);
  if (!emp) {
    // Empresa apagada depois da investigação: a linha órfã não tem como ser recalculada.
    console.log(`  ${String(r.score).padStart(3)} → (empresa ausente)`);
    continue;
  }
  const v0 = calcScore(emp as unknown as Empresa, (emp.socio ?? []) as Socio[]).score;
  const sinais = r.sinais ?? [];
  const ajuste = ajusteDeSinais(sinais);
  const novo = Math.max(0, Math.min(100, v0 + ajuste));
  if (novo !== r.score) updates.push({ id: r.id, score: novo });
  const seta = novo === r.score ? "=" : novo > (r.score ?? 0) ? "↑" : "↓";
  console.log(
    `  ${String(r.score).padStart(3)} → ${String(novo).padStart(3)} ${seta}  ` +
    `v0=${String(v0).padStart(3)} ${(ajuste >= 0 ? "+" : "") + ajuste}`.padEnd(18) +
    (sinais.map((s) => s.tipo).join(", ") || "sem sinal")
  );
}

console.log(`\n${updates.length} de ${runs.length} mudam de score.`);
if (!aplicar) { console.log("Rode com --aplicar para gravar."); process.exit(0); }

let n = 0;
for (const u of updates) {
  const { error: e3 } = await supabase.from("score_run").update({ score: u.score }).eq("id", u.id);
  if (e3) { console.error("\nFAIL update:", e3.message); process.exit(2); }
  process.stdout.write(`\r  gravadas ${++n}/${updates.length}`);
}
console.log(`\n\n✓ ${n} investigações recalculadas.`);
