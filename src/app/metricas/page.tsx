import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createUserClient } from "@/lib/supabase-server";
import { permissoesAtuais } from "@/lib/permissoes";

export const metadata: Metadata = { title: "Métricas do piloto" };
export const dynamic = "force-dynamic"; // número velho aqui é pior que página lenta

/* Painel de acompanhamento do piloto. Só staff, e o gate é duplo: este notFound e
   as policies da 0013, que só deixam staff ler `evento` e cruzar orgs.
 *
 * REGRA DESTA PÁGINA: nunca inventar número. Métrica sem dado aparece como
 * PENDENTE, com o motivo e o que destrava. Painel que preenche buraco com zero
 * mente duas vezes: esconde que falta dado e sugere que o valor é baixo. */

type Contagem = Record<string, number>;

function agrupar<T extends Record<string, unknown>>(linhas: T[], campo: keyof T): Contagem {
  const out: Contagem = {};
  for (const l of linhas) {
    const k = String(l[campo] ?? "—");
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function Cartao({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <div className="rounded-lg border border-hairline px-4 py-3">
      <p className="font-data text-[10px] uppercase tracking-wider text-ink-muted">{rotulo}</p>
      <p className="mt-1 font-display text-2xl text-ink">{valor}</p>
      {nota && <p className="mt-0.5 text-[11px] text-ink-muted">{nota}</p>}
    </div>
  );
}

function Pendente({ rotulo, porque }: { rotulo: string; porque: string }) {
  return (
    <div className="rounded-lg border border-dashed border-hairline px-4 py-3">
      <p className="font-data text-[10px] uppercase tracking-wider text-ink-muted">{rotulo}</p>
      <p className="mt-1 font-display text-2xl text-ink-muted">pendente</p>
      <p className="mt-0.5 text-[11px] text-ink-muted">{porque}</p>
    </div>
  );
}

function Barras({ dados }: { dados: Contagem }) {
  const entradas = Object.entries(dados).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entradas.map(([, n]) => n));
  if (entradas.length === 0) return <p className="text-sm text-ink-muted">Sem registro ainda.</p>;
  return (
    <div className="space-y-1.5">
      {entradas.map(([k, n]) => (
        <div key={k} className="flex items-center gap-3">
          <span className="w-36 shrink-0 truncate font-data text-[11px] text-ink-soft">{k}</span>
          <div className="h-4 flex-1 rounded-sm bg-fill">
            <div className="h-full rounded-sm bg-ink/60" style={{ width: `${(n / max) * 100}%` }} />
          </div>
          <span className="w-10 shrink-0 text-right font-data text-[11px] text-ink">{n}</span>
        </div>
      ))}
    </div>
  );
}

export default async function Metricas() {
  if (!(await permissoesAtuais()).staff) notFound();
  const supabase = await createUserClient();

  const [ops, descartes, interacoes, eventos, memos, v1s, crm] = await Promise.all([
    supabase.from("oportunidade").select("estagio, resultado, dono, novo_para_setter, score_no_save, created_at"),
    supabase.from("empresa_descartada").select("empresa_id, motivo, created_at"),
    supabase.from("interacao").select("tipo, criado_em"),
    supabase.from("evento").select("tipo, user_id, empresa_id, criado_em, payload").order("criado_em", { ascending: false }).limit(2000),
    supabase.from("empresa_memo").select("empresa_id", { count: "exact", head: true }),
    supabase.from("score_run").select("empresa_id").not("research", "is", null),
    supabase.from("crm_incumbente").select("cnpj", { count: "exact", head: true }),
  ]);

  const oportunidades = ops.data ?? [];
  const evs = eventos.data ?? [];
  const buscas = evs.filter((e) => e.tipo === "busca");
  const salvou = evs.filter((e) => e.tipo === "salvou");
  const totalDescartes = (descartes.data ?? []).length;
  const comV1 = new Set((v1s.data ?? []).map((r) => r.empresa_id as string)).size;

  /* O sinal do loop: em que POSIÇÃO da lista o analista escolheu. Mediana alta
     significa que o topo do ranking não é o que ele quer, e é o eixo mais direto
     pra recalibrar o score. Sai da interseção entre `busca` (a lista exibida) e
     `salvou` (a escolha) — por isso o evento de busca guarda o top ranqueado. */
  const escolhidos = new Set(salvou.map((e) => String(e.empresa_id ?? "")).filter(Boolean));

  /* UMA observação por empresa escolhida, não uma por busca em que ela apareceu.
     Sem isto, um analista que refaz a mesma busca oito vezes antes de decidir
     conta como oito escolhas, e a mediana passa a refletir quem busca muito em
     vez de quem escolhe o quê. Vale a busca MAIS RECENTE que continha a empresa:
     é a lista que ele tinha na frente quando decidiu (`buscas` já vem ordenada
     por criado_em desc). */
  const posicaoPorEmpresa = new Map<string, number>();
  for (const b of buscas) {
    const top = (b.payload as { top?: { id: string; posicao: number }[] })?.top ?? [];
    for (const item of top) {
      if (escolhidos.has(item.id) && !posicaoPorEmpresa.has(item.id)) {
        posicaoPorEmpresa.set(item.id, item.posicao);
      }
    }
  }
  const posicoes = [...posicaoPorEmpresa.values()];
  const medianaPos = posicoes.length
    ? [...posicoes].sort((a, b) => a - b)[Math.floor(posicoes.length / 2)]
    : null;

  const seteDias = Date.now() - 7 * 864e5;
  const buscasSemana = buscas.filter((e) => new Date(e.criado_em as string).getTime() > seteDias).length;
  const taxaDescarte = totalDescartes + oportunidades.length > 0
    ? Math.round((totalDescartes / (totalDescartes + oportunidades.length)) * 100)
    : null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="font-display text-2xl text-ink">Métricas do piloto</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Visão de staff, cruzando todas as firmas. Métrica sem dado aparece como pendente,
        nunca como zero.
      </p>

      <section className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Cartao rotulo="Oportunidades" valor={String(oportunidades.length)} nota="no funil, todas as firmas" />
        <Cartao rotulo="Buscas (7 dias)" valor={String(buscasSemana)} nota={`${buscas.length} no total registrado`} />
        <Cartao rotulo="Toques" valor={String((interacoes.data ?? []).length)} nota="ligações, emails, reuniões" />
        {taxaDescarte === null ? (
          <Pendente rotulo="Taxa de descarte" porque="sem triagem registrada ainda" />
        ) : (
          <Cartao rotulo="Taxa de descarte" valor={`${taxaDescarte}%`} nota="descartadas ÷ (descartadas + salvas)" />
        )}
      </section>

      <section className="mt-8 grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-3 font-display text-lg text-ink">Funil por estágio</h2>
          <Barras dados={agrupar(oportunidades, "estagio")} />
        </div>
        <div>
          <h2 className="mb-3 font-display text-lg text-ink">Por dono</h2>
          <Barras dados={agrupar(oportunidades, "dono")} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-lg text-ink">Sinal de aprendizado</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          O que o originador escolhe contra o que a gente ranqueou. É o insumo para recalibrar
          o score sem precisar esperar deal fechado, que leva quase um ano.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
          {medianaPos === null ? (
            <Pendente rotulo="Posição escolhida (mediana)" porque="precisa de busca + save registrados" />
          ) : (
            <Cartao
              rotulo="Posição escolhida (mediana)"
              valor={`#${medianaPos}`}
              nota={`${posicoes.length} ${posicoes.length === 1 ? "empresa escolhida" : "empresas escolhidas"} casadas com a lista exibida`}
            />
          )}
          <Cartao rotulo="Empresas com v1" valor={String(comV1)} nota="investigação na web feita" />
          <Cartao rotulo="Empresas com memo" valor={String(memos.count ?? 0)} nota="dossiê pré-computado" />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-lg text-ink">Critério de sucesso do piloto</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {(crm.count ?? 0) === 0 ? (
            <Pendente
              rotulo="Novos para a Setter"
              porque="crm_incumbente vazio: depende do export do CRM do parceiro"
            />
          ) : (
            <Cartao
              rotulo="Novos para a Setter"
              valor={String(oportunidades.filter((o) => o.novo_para_setter === true).length)}
              nota={`contra ${crm.count} CNPJs do CRM deles`}
            />
          )}
          <Cartao
            rotulo="Viraram abordagem"
            valor={String(oportunidades.filter((o) => o.estagio !== "identificado" && o.estagio !== "arquivado").length)}
            nota="saíram de 'identificado'"
          />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 font-display text-lg text-ink">Motivos de descarte</h2>
        <p className="mb-3 max-w-2xl text-sm text-ink-soft">
          Motivo que se repete é eixo faltando no score, não ruído.
        </p>
        <Barras dados={agrupar(descartes.data ?? [], "motivo")} />
      </section>
    </main>
  );
}
