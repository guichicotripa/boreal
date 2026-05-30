"use client";

// Sandbox — Etapa 5/6: botões de ação com estados interativos
// Remover antes do PR final.

import { useState } from "react";

const EMPRESA_1 = {
  rank: 1,
  score: 87,
  tier: "alto" as const,
  razao_social: "PRENSA JUNDIAÍ INDÚSTRIA E COMÉRCIO S/A",
  municipio: "Campo Limpo Paulista",
  uf: "SP",
  cnpj: "50925890000110",
  one_liner: "Ubirajara Rodrigues, 80+, controla sozinho esta indústria fundada em 1973 — 53 anos sem renovação societária.",
  flags: ["FUNDADOR 80+", "53 ANOS", "QUADRO TRAVADO", "PORTE RELEVANTE"],
  fundada: "1973",
  capital: "R$ 52.500.000",
  natureza: "Sociedade Anônima Fechada",
  cnae_desc: "Fabricação de máquinas-ferramenta",
  socios: [
    { nome: "UBIRAJARA RODRIGUES DA SILVA", faixa: "80+" },
  ],
  telefone: "(11) 4039-8240",
  email: "contato@prensajundiai.com.br",
};

const EMPRESA_2 = {
  rank: 2,
  score: 74,
  tier: "alto" as const,
  razao_social: "METALÚRGICA IRMÃOS COSTA LTDA",
  municipio: "Sorocaba",
  uf: "SP",
  cnpj: "12345678000195",
  one_liner: "Três irmãos fundadores — todos na faixa 70-80 anos — sem herdeiros identificados no quadro desde 1981.",
  flags: ["SÓCIOS 70-80", "44 ANOS", "QUADRO TRAVADO"],
  fundada: "1981",
  capital: "R$ 8.200.000",
  natureza: "Ltda",
  cnae_desc: "Produtos de metal",
  socios: [
    { nome: "ANTÔNIO CARLOS COSTA", faixa: "71-80" },
    { nome: "JOSÉ ROBERTO COSTA", faixa: "71-80" },
    { nome: "LUIZ HENRIQUE COSTA", faixa: "61-70" },
  ],
  telefone: "(15) 3232-4400",
  email: null as string | null,
};

const TIER_STYLES = {
  alto:  { borderL: "border-l-risk-high", badge: "border-risk-high/40 bg-risk-high/5", text: "text-risk-high" },
  medio: { borderL: "border-l-risk-mid",  badge: "border-risk-mid/40 bg-risk-mid/5",   text: "text-risk-mid"  },
  baixo: { borderL: "border-l-hairline",  badge: "border-hairline bg-surface",         text: "text-bone"      },
} as const;

const FAIXA_COLOR: Record<string, string> = {
  "80+":   "bg-risk-high/15 text-risk-high",
  "71-80": "bg-risk-high/15 text-risk-high",
  "61-70": "bg-risk-mid/15 text-risk-mid",
  "51-60": "bg-surface text-bone",
};

function formatCnpj(cnpj: string) {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

type Empresa = typeof EMPRESA_1;

function CardShell({ e, children }: { e: Empresa; children: React.ReactNode }) {
  const t = TIER_STYLES[e.tier];
  return (
    <li className={`rounded-lg border border-hairline border-l-2 ${t.borderL} bg-surface overflow-hidden p-4`}>
      <div className="flex items-start gap-3">
        <div className={`shrink-0 rounded border ${t.badge} px-2 py-1 text-center`}>
          <div className={`font-data text-lg tabular-nums leading-none ${t.text}`}>{e.score}</div>
          <div className="font-data text-[9px] uppercase tracking-wide text-olive">{String(e.rank).padStart(2, "0")}</div>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg leading-tight text-floral">{e.razao_social}</h3>
          <p className="font-data text-[11px] text-olive">
            {e.municipio}/{e.uf} · {formatCnpj(e.cnpj)}
          </p>
        </div>
        <button className="shrink-0 rounded border border-hairline px-2 py-1 font-data text-[10px] uppercase tracking-wide text-bone hover:border-hairline-hover hover:text-floral">
          + salvar
        </button>
      </div>
      <p className="mt-3 font-display text-sm leading-relaxed text-floral">{e.one_liner}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {e.flags.map((f) => (
          <span key={f} className="rounded border border-hairline px-2 py-0.5 font-data text-[10px] uppercase tracking-wide text-bone">
            {f}
          </span>
        ))}
      </div>
      <p className="mt-2 font-data text-[11px] uppercase tracking-wide text-olive">
        {e.fundada} · {e.capital} · {e.natureza} · {e.cnae_desc}
      </p>
      {children}
    </li>
  );
}

function PainelSocios({ e }: { e: Empresa }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <div className="mt-3 flex items-center gap-4 border-t border-hairline pt-2">
        <button className="font-data text-xs text-bone transition-colors hover:text-floral">
          Investigar com IA
        </button>
        <span className="text-olive">·</span>
        <button className="font-data text-xs text-bone transition-colors hover:text-floral hover:underline">
          Gerar memo de investimento
        </button>
        <span className="text-olive">·</span>
        <button
          onClick={() => setAberto((v) => !v)}
          className="font-data text-xs text-bone transition-colors hover:text-floral hover:underline"
        >
          {aberto ? "Ocultar sócios" : "Ver sócios"}
        </button>
      </div>

      {aberto && (
        <div className="mt-3 rounded-lg border border-hairline bg-surface p-3 space-y-3">
          <div>
            <p className="mb-1.5 font-data text-[10px] uppercase tracking-wider text-olive">Sócios</p>
            <ul className="flex flex-col gap-1.5">
              {e.socios.map((s) => (
                <li key={s.nome} className="flex items-center gap-2">
                  <span className="text-sm text-floral">{s.nome}</span>
                  <span className={`rounded px-1.5 py-0.5 font-data text-xs ${FAIXA_COLOR[s.faixa] ?? "bg-surface text-bone"}`}>
                    {s.faixa} anos
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {(e.telefone || e.email) && (
            <div>
              <p className="mb-1 font-data text-[10px] uppercase tracking-wider text-olive">Contato</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-bone">
                {e.telefone && <span>{e.telefone}</span>}
                {e.email && <span>{e.email}</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default function Sandbox() {
  return (
    <div className="min-h-screen bg-smoky text-floral">
      <main className="mx-auto max-w-3xl px-6 py-16 space-y-16">

        <header>
          <p className="font-data text-[11px] uppercase tracking-widest text-olive">Sandbox — Etapa 5/6</p>
          <h1 className="mt-1 font-display text-2xl text-floral">Ver sócios — 1 sócio vs. múltiplos</h1>
          <p className="mt-2 text-sm text-bone">Clique em "Ver sócios" nos dois cards para comparar.</p>
        </header>

        <section className="space-y-3">
          <p className="font-data text-[11px] uppercase tracking-widest text-olive">1 sócio</p>
          <ul>
            <CardShell e={EMPRESA_1}>
              <PainelSocios e={EMPRESA_1} />
            </CardShell>
          </ul>
        </section>

        <section className="space-y-3">
          <p className="font-data text-[11px] uppercase tracking-widest text-olive">3 sócios</p>
          <ul>
            <CardShell e={EMPRESA_2}>
              <PainelSocios e={EMPRESA_2} />
            </CardShell>
          </ul>
        </section>

      </main>
    </div>
  );
}
