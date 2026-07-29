import { NextResponse } from "next/server";
import { createUserClient } from "@/lib/supabase-server";
import { nomeDivisao } from "@/lib/cnae";

/* Cobertura real da base indexada: quais UFs e quais divisões CNAE existem.

   Serve ao estado vazio da busca. Sem isto a tela dizia "a tese pode estar
   restrita demais, tente ampliar a faixa etária" para QUALQUER zero resultado,
   inclusive quando a causa é não termos o setor ou a praça ingeridos. Culpar a
   pergunta do usuário por um limite nosso é desonesto — e na frente de cliente
   pagante, custa credibilidade. */

export const runtime = "nodejs";

type Cobertura = {
  total: number;
  ufs: { uf: string; n: number }[];
  divisoes: { div: string; nome: string; n: number }[];
};

// A base só muda quando roda ingestão (manual, raro), então cache em processo
// resolve. A alternativa seria um GROUP BY no Postgres via RPC, mas isso exigiria
// mais uma migration pra ganhar segundos numa rota que quase não é chamada.
const TTL_MS = 60 * 60 * 1000;
let cache: { em: number; dados: Cobertura } | null = null;

const PAGINA = 1000; // teto de linhas por request do PostgREST

export async function GET() {
  if (cache && Date.now() - cache.em < TTL_MS) {
    return NextResponse.json({ ...cache.dados, cached: true });
  }
  try {
    const supabase = await createUserClient();
    const { count, error: erroCount } = await supabase
      .from("empresa")
      .select("*", { count: "exact", head: true });
    if (erroCount) throw new Error(erroCount.message);
    const total = count ?? 0;

    // Em paralelo: sequencial custava ~34s (uma ida ao banco por página).
    const paginas = Math.ceil(total / PAGINA);
    const respostas = await Promise.all(
      Array.from({ length: paginas }, (_, i) =>
        supabase
          .from("empresa")
          .select("uf, cnae_principal")
          .range(i * PAGINA, i * PAGINA + PAGINA - 1)
      )
    );

    const porUf = new Map<string, number>();
    const porDivisao = new Map<string, number>();
    for (const r of respostas) {
      if (r.error) throw new Error(r.error.message);
      for (const l of (r.data ?? []) as { uf: string; cnae_principal: string | null }[]) {
        if (l.uf) porUf.set(l.uf, (porUf.get(l.uf) ?? 0) + 1);
        const div = (l.cnae_principal ?? "").slice(0, 2);
        if (div) porDivisao.set(div, (porDivisao.get(div) ?? 0) + 1);
      }
    }

    const ordenar = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);
    const dados: Cobertura = {
      total,
      ufs: ordenar(porUf).map(([uf, n]) => ({ uf, n })),
      // Divisão com punhado de empresas é resíduo de ingestão, não cobertura real.
      divisoes: ordenar(porDivisao)
        .filter(([, n]) => n >= 50)
        .map(([div, n]) => ({ div, nome: nomeDivisao(div), n })),
    };
    cache = { em: Date.now(), dados };
    return NextResponse.json(dados);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
