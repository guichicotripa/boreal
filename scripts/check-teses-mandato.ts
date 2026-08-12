/**
 * Que tese de exemplo faz sentido em cada mandato? Mede antes de escrever.
 *
 *   node --experimental-strip-types --env-file=.env.local scripts/check-teses-mandato.ts
 *
 * POR QUE MEDIR. `parseQueryHeuristic` entende exatamente quatro dimensoes: CNAE (setor/mandato),
 * faixa etaria minima do socio, ano maximo de fundacao e UF. Qualquer outra palavra na frase e
 * ignorada em silencio. Ja aconteceu de um atalho prometer filtro inexistente e voltar o oposto do
 * pedido (ver o comentario de "consultorios com socio unico idoso" em src/lib/teses.ts).
 *
 * O segundo modo de falhar e o atalho valido que volta vazio ou quase: numa vertical jovem como
 * diagnostico veterinario, "socios acima de 70 anos" pode render 12 empresas e a tela parece
 * quebrada no primeiro clique do piloto. Entao este script devolve, por mandato, quantas empresas
 * cada corte possivel retornaria.
 */
import { createClient } from "@supabase/supabase-js";
import { MANDATOS, filtroOr } from "../src/lib/mandatos.ts";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const SEL = "id,uf,data_inicio_atividade,socio(faixa_etaria)";

for (const m of MANDATOS) {
  const linhas: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("empresa").select(SEL).or(filtroOr(m)).range(from, from + 999);
    if (error) { console.log(`${m.nome}: ERRO ${error.message}`); break; }
    linhas.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  if (!linhas.length) continue;

  const maxFaixa = (e: any) => {
    const f = (e.socio ?? []).map((s: any) => Number(s.faixa_etaria)).filter((n: number) => n >= 1 && n <= 9);
    return f.length ? Math.max(...f) : 0;
  };
  const ano = (e: any) => (e.data_inicio_atividade ? Number(String(e.data_inicio_atividade).slice(0, 4)) : 0);

  const N = linhas.length;
  const conta = (p: (e: any) => boolean) => linhas.filter(p).length;
  const pct = (n: number) => `${n} (${((n / N) * 100).toFixed(1)}%)`;

  const ufs = Object.entries(
    linhas.reduce((a: any, e: any) => ((a[e.uf] = (a[e.uf] ?? 0) + 1), a), {})
  ).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5);

  console.log(`\n${"=".repeat(74)}\n${m.nome}  ·  ${N.toLocaleString("pt-BR")} empresas\n${"=".repeat(74)}`);
  console.log(`  socio 50+ (faixa>=6) ....... ${pct(conta((e) => maxFaixa(e) >= 6))}`);
  console.log(`  socio 60+ (faixa>=7) ....... ${pct(conta((e) => maxFaixa(e) >= 7))}`);
  console.log(`  socio 70+ (faixa>=8) ....... ${pct(conta((e) => maxFaixa(e) >= 8))}`);
  for (const corte of [1990, 2000, 2010, 2015]) {
    console.log(`  fundada antes de ${corte} ...... ${pct(conta((e) => ano(e) > 0 && ano(e) < corte))}`);
  }
  console.log(`  UFs .......... ${ufs.map(([u, n]) => `${u} ${n}`).join(" · ")}`);
  // O cruzamento que os atalhos de fato usam: praca + idade.
  const [ufTop] = ufs[0] as [string, number];
  console.log(`  ${ufTop} + socio 60+ ............ ${conta((e) => e.uf === ufTop && maxFaixa(e) >= 7)}`);
  console.log(`  ${ufTop} + socio 70+ ............ ${conta((e) => e.uf === ufTop && maxFaixa(e) >= 8)}`);
}
