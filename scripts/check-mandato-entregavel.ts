/**
 * O que o Henrique vai VER quando abrir cada mandato?
 *
 *   node --experimental-strip-types --env-file=.env.local scripts/check-mandato-entregavel.ts
 *
 * CONTEXTO. O piloto e julgado pela primeira tela, nao pelo holdout. Os numeros de recall que
 * publicamos valem para empresa com 2+ socios PF, que e 31% da base nos quatro setores validados.
 * Nos mandatos da Setter isso nunca foi medido, e a decisao de desenho do piloto depende disso:
 *
 *   · muitas empresas com 2+ socios  -> o score tem onde trabalhar, entregar lista rankeada
 *   · muitas com 1 socio ou nenhum   -> o score nao discrimina (medido: 1,1x contra sorteio),
 *                                       entregar censo enriquecido e nao ranking
 *
 * Devolve, por mandato: quadro societario, porte, e a distribuicao do score REAL do produto
 * (importado de scoring.ts, nao replicado), incluindo quantas empresas ficam em zero.
 */
import { createClient } from "@supabase/supabase-js";
import { MANDATOS, filtroOr } from "../src/lib/mandatos.ts";
import { calcScore, perfilSucessorio } from "../src/lib/scoring.ts";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const SEL = "id,razao_social,data_inicio_atividade,porte,capital_social,cnae_principal,municipio,uf,socio(nome,faixa_etaria,data_entrada_sociedade,qualificacao,cpf_cnpj_mascarado)";

for (const m of MANDATOS) {
  const linhas: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("empresa").select(SEL).or(filtroOr(m)).range(from, from + 999);
    if (error) { console.log(`${m.nome}: ERRO ${error.message}`); break; }
    linhas.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  if (!linhas.length) continue;

  const N = linhas.length;
  const socios = (e: any) => (e.socio ?? []) as any[];
  /* A tabela nao tem coluna `tipo`. PF se identifica pela faixa etaria: a Receita so preenche
     faixa para pessoa fisica, PJ vem 0/vazio. Mesmo criterio que o scoring.ts usa pra pontuar
     idade, entao esta contagem responde exatamente "o eixo de idade tem em quem pegar". */
  const nPf = (e: any) => socios(e).filter((s) => { const f = Number(s.faixa_etaria); return f >= 1 && f <= 9; }).length;

  const semSocio = linhas.filter((e) => socios(e).length === 0).length;
  const um = linhas.filter((e) => socios(e).length > 0 && nPf(e) === 1).length;
  const dois = linhas.filter((e) => nPf(e) >= 2).length;

  const porteDe = (p: string | null) => (p ?? "").toUpperCase();
  const demais = linhas.filter((e) => porteDe(e.porte).includes("DEMAIS")).length;
  const epp = linhas.filter((e) => porteDe(e.porte) === "EPP").length;
  const me = linhas.filter((e) => porteDe(e.porte) === "ME").length;

  const scores = linhas.map((e) => calcScore(e as any, socios(e) as any).score);
  const zero = scores.filter((s) => s === 0).length;
  const perfil = linhas.filter((e) => perfilSucessorio(e as any, socios(e) as any)).length;
  const ord = [...scores].sort((a, b) => b - a);
  const p = (q: number) => ord[Math.min(ord.length - 1, Math.floor(ord.length * q))];

  // O que o Henrique ve na primeira tela: as 20 primeiras. Quantas tem quadro pontuavel?
  const top20 = linhas
    .map((e) => ({ e, s: calcScore(e as any, socios(e) as any).score }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 20);
  const top20ComSocio = top20.filter((x) => socios(x.e).length > 0).length;
  const top20Relevante = top20.filter((x) => !porteDe(x.e.porte).includes("ME")).length;

  const pct = (n: number) => `${((n / N) * 100).toFixed(1)}%`;
  console.log(`\n${"=".repeat(78)}\n${m.nome}  ·  ${N.toLocaleString("pt-BR")} empresas\n${"=".repeat(78)}`);
  console.log(`  quadro societario   sem socio ${semSocio.toLocaleString("pt-BR")} (${pct(semSocio)}) · 1 socio PF ${um.toLocaleString("pt-BR")} (${pct(um)}) · 2+ PF ${dois.toLocaleString("pt-BR")} (${pct(dois)})`);
  console.log(`  porte               ME ${me.toLocaleString("pt-BR")} (${pct(me)}) · EPP ${epp.toLocaleString("pt-BR")} (${pct(epp)}) · DEMAIS ${demais.toLocaleString("pt-BR")} (${pct(demais)})`);
  console.log(`  score               zero ${zero.toLocaleString("pt-BR")} (${pct(zero)}) · p90 ${p(0.1)} · p50 ${p(0.5)} · max ${ord[0]}`);
  console.log(`  perfil sucessorio   ${perfil.toLocaleString("pt-BR")} (${pct(perfil)})`);
  console.log(`  TOP 20 da tela      ${top20ComSocio}/20 tem socio cadastrado · ${top20Relevante}/20 nao sao ME · score do 20o = ${top20[19]?.s ?? "-"}`);
}
