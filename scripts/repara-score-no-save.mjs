/**
 * Recalcula `oportunidade.score_no_save` das oportunidades gravadas com o select incompleto.
 *
 *   node --env-file=.env.local scripts/repara-score-no-save.mjs          # mostra, não grava
 *   node --env-file=.env.local scripts/repara-score-no-save.mjs --gravar
 *
 * POR QUE EXISTE: de 24/08 a 23/09/2026 o `POST /api/oportunidade` calculava o score sem
 * `capital_social`, `cnae_principal` e `razao_social`. O eixo de escala valia sempre 0 e o valor
 * gravado ficou abaixo do que o originador viu na busca. Corrigir o endpoint não conserta o que já
 * estava gravado.
 *
 * POR QUE REESCREVER UM RÓTULO HISTÓRICO É CORRETO AQUI: `score_no_save` quer dizer "o score que a
 * empresa tinha quando foi escolhida". O que está gravado não é isso, é um número que nunca foi
 * exibido para ninguém. E os pesos do `scoring.ts` não mudaram desde os saves (a proposta de
 * recalibração de 11/08 segue sem aplicar), então o `calcScore` de hoje devolve o mesmo que a
 * busca mostrou naquele dia. Se os pesos mudarem, este script deixa de ser válido.
 *
 * O ANTES FICA REGISTRADO: a saída lista valor velho e novo de cada linha, e o `--gravar` imprime
 * a mesma tabela antes de escrever, para o valor original não se perder.
 */
import { createClient } from "@supabase/supabase-js";
import { calcScore } from "../src/lib/scoring.ts";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const GRAVAR = process.argv.includes("--gravar");

const { data: ops, error } = await supabase
  .from("oportunidade")
  .select(`id, score_no_save, empresa:empresa_id (id, razao_social, cnae_principal, capital_social,
           data_inicio_atividade, porte, socio(faixa_etaria, data_entrada_sociedade))`);
if (error) { console.error(error.message); process.exit(1); }

const mudancas = [];
for (const o of ops) {
  if (!o.empresa) continue;
  const novo = calcScore(o.empresa).score;
  if (novo !== o.score_no_save) mudancas.push({ id: o.id, nome: o.empresa.razao_social, velho: o.score_no_save, novo });
}

console.log(`${ops.length} oportunidades, ${mudancas.length} com score_no_save divergente\n`);
console.log("antes  depois  empresa");
for (const m of mudancas.sort((a, b) => b.novo - b.velho - (a.novo - a.velho))) {
  console.log(`${String(m.velho).padStart(5)}  ${String(m.novo).padStart(6)}  ${m.nome.slice(0, 55)}`);
}
if (mudancas.length) {
  const dif = mudancas.map((m) => m.novo - (m.velho ?? 0));
  console.log(`\ndiferença média: +${(dif.reduce((a, b) => a + b, 0) / dif.length).toFixed(1)} pontos`);
}

if (!GRAVAR) { console.log("\nSem --gravar: nada foi escrito."); process.exit(0); }
for (const m of mudancas) {
  const { error: e } = await supabase.from("oportunidade").update({ score_no_save: m.novo }).eq("id", m.id);
  if (e) { console.error(`ERRO em ${m.id}: ${e.message}`); process.exit(1); }
}
console.log(`\n${mudancas.length} linhas corrigidas.`);
