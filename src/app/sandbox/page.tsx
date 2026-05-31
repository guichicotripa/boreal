"use client";

// Sandbox — Etapa 8: MemoDisplay + Timeline com dados mockados
// Remover antes do PR final.

// Mock espelhando o shape real de DossierAnalise + Empresa com sócios
const ANALISE = {
  overview:
    "Prensa Jundiaí S/A é uma indústria metalúrgica fundada em 1973 em Campo Limpo Paulista/SP, com capital social de R$ 52,5M e foco em fabricação de máquinas-ferramenta. Opera como Sociedade Anônima Fechada há 53 anos sob controle familiar.",
  analise_sucessoria:
    "O risco sucessório é alto. Ubirajara Rodrigues da Silva, 80+, é o único controlador desde a fundação em 1973 — 53 anos sem qualquer alteração no quadro societário. Não há herdeiros identificados no registro ou na imprensa. A ausência de diversificação societária e a idade avançada do fundador configuram o perfil clássico de empresa familiar sem plano de saída.",
  perguntas_abordagem: [
    "O Sr. Ubirajara tem filhos ou familiares envolvidos na gestão operacional da Prensa Jundiaí?",
    "Existe algum processo formal de planejamento sucessório em andamento?",
    "A empresa já recebeu abordagens de fundos ou compradores estratégicos anteriormente?",
    "Como o senhor enxerga o futuro da empresa nos próximos 5 a 10 anos?",
    "Haveria interesse em discutir uma estrutura de parceria que preserve o legado da empresa?",
  ],
  tese_aproximacao:
    "A Prensa Jundiaí representa uma oportunidade rara de aquisição de ativo industrial consolidado com forte geração de caixa e marca regional estabelecida. O ângulo de abordagem ideal é a preservação do legado — posicionar o fundo como parceiro de longo prazo, não como comprador oportunista.",
};

const EMPRESA = {
  razao_social: "PRENSA JUNDIAÍ INDÚSTRIA E COMÉRCIO S/A",
  data_inicio_atividade: "1973-03-15",
  socio: [
    { id: "1", nome: "UBIRAJARA RODRIGUES DA SILVA", faixa_etaria: "9", data_entrada_sociedade: "1973-03-15" },
  ],
};

const EMPRESA_MULTI = {
  razao_social: "METALÚRGICA IRMÃOS COSTA LTDA",
  data_inicio_atividade: "1981-07-01",
  socio: [
    { id: "1", nome: "ANTÔNIO CARLOS COSTA",  faixa_etaria: "8", data_entrada_sociedade: "1981-07-01" },
    { id: "2", nome: "JOSÉ ROBERTO COSTA",    faixa_etaria: "8", data_entrada_sociedade: "1981-07-01" },
    { id: "3", nome: "LUIZ HENRIQUE COSTA",   faixa_etaria: "7", data_entrada_sociedade: "1995-02-10" },
  ],
};

// ── Componentes copiados do page.tsx para isolamento no sandbox ──────────────

function Timeline({ empresa }: { empresa: typeof EMPRESA }) {
  const anoFund = empresa.data_inicio_atividade
    ? Number(empresa.data_inicio_atividade.slice(0, 4))
    : null;
  if (!anoFund) return null;

  const anoAtual = new Date().getFullYear();
  const span = anoAtual - anoFund || 1;

  const porAno = new Map<number, string[]>();
  porAno.set(anoFund, ["Fundação"]);
  for (const s of empresa.socio ?? []) {
    const ano = s.data_entrada_sociedade
      ? Number(s.data_entrada_sociedade.slice(0, 4))
      : null;
    if (ano === null || !Number.isFinite(ano)) continue;
    const nome = s.nome.split(" ")[0];
    const arr = porAno.get(ano);
    if (arr) arr.push(nome);
    else porAno.set(ano, [nome]);
  }

  const eventos = [...porAno.entries()]
    .map(([ano, labels]) => ({ ano, label: labels.join(" · ") }))
    .sort((a, b) => a.ano - b.ano);

  return (
    <div>
      <h4 className="mb-2 font-data text-[10px] uppercase tracking-wider text-olive">
        Linha do tempo societária
      </h4>
      {/* Altura explícita evita margin collapse (conteúdo é absoluto) */}
      <div className="relative mt-10 h-8 mb-4">
        {/* Linha separada, insetada pelo raio do dot (4px) em cada lado */}
        <div className="absolute inset-x-[18px] top-0 border-b border-hairline" />

        {eventos.map((ev, i) => {
          const pct = ((ev.ano - anoFund) / span) * 100;
          const isLeft  = pct === 0;
          const isRight = pct >= 92;

          if (isLeft) {
            // Primeiro evento: container de 28px fixo à esquerda.
            // Label left-aligned (evita overflow), dot e ano centrados.
            return (
              <div key={i} className="absolute left-0 -translate-y-1/2" style={{ width: 28 }}>
                <span className="absolute -top-7 left-0 max-w-[8rem] truncate whitespace-nowrap text-[10px] text-bone">
                  {ev.label}
                </span>
                <span className="mx-auto block h-2 w-2 rounded-full bg-risk-mid" />
                <span className="absolute top-3 w-full text-center font-data text-[10px] tabular-nums text-olive">
                  {ev.ano}
                </span>
              </div>
            );
          }

          if (isRight) {
            return (
              <div
                key={i}
                className="absolute -translate-y-1/2 items-center text-center -translate-x-1/2"
                style={{ left: `${pct}%`, width: 28 }}
              >
                <span className="absolute -top-7 w-full truncate whitespace-nowrap text-center text-[10px] text-bone">
                  {ev.label}
                </span>
                <span className="mx-auto block h-2 w-2 rounded-full bg-risk-mid" />
                <span className="absolute top-3 w-full text-center font-data text-[10px] tabular-nums text-olive">
                  {ev.ano}
                </span>
              </div>
            );
          }

          // Eventos do meio: centrados no ponto exato
          return (
            <div
              key={i}
              className="absolute flex flex-col -translate-y-1/2 -translate-x-1/2 items-center text-center"
              style={{ left: `${pct}%` }}
            >
              <span className="absolute -top-7 max-w-[8rem] truncate whitespace-nowrap text-[10px] text-bone">
                {ev.label}
              </span>
              <span className="h-2 w-2 rounded-full bg-risk-mid" />
              <span className="absolute top-3 font-data text-[10px] tabular-nums text-olive">
                {ev.ano}
              </span>
            </div>
          );
        })}

        {/* Marcador "Hoje" — container 28px fixo à direita, tudo centrado */}
        <div className="absolute right-0 -translate-y-1/2" style={{ width: 28 }}>
          <span className="absolute -top-7 w-full text-center font-data text-[10px] uppercase tracking-wide text-olive">
            Hoje
          </span>
          <span className="mx-auto block h-2 w-2 rounded-full border border-hairline-hover bg-transparent" />
          <span className="absolute top-3 w-full text-center font-data text-[10px] tabular-nums text-olive">
            {anoAtual}
          </span>
        </div>
      </div>
    </div>
  );
}

function MemoDisplay({
  empresa,
  analise,
}: {
  empresa: typeof EMPRESA;
  analise: typeof ANALISE;
}) {
  return (
    <div className="mt-3 space-y-4 rounded-lg border border-hairline bg-surface p-4 text-sm">
      <p className="leading-relaxed text-floral">{analise.overview}</p>
      <Timeline empresa={empresa} />
      <div>
        <h4 className="mb-1 font-data text-[10px] uppercase tracking-wider text-olive">
          Análise de risco sucessório
        </h4>
        <p className="leading-relaxed text-floral">{analise.analise_sucessoria}</p>
      </div>
      {analise.perguntas_abordagem.length > 0 && (
        <div>
          <h4 className="mb-1 font-data text-[10px] uppercase tracking-wider text-olive">
            Perguntas para o primeiro contato
          </h4>
          <ul className="list-decimal space-y-1 pl-5 text-floral">
            {analise.perguntas_abordagem.map((p, i) => (
              <li key={i} className="leading-relaxed">
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="border-l-2 border-risk-mid pl-3">
        <h4 className="mb-1 font-data text-[10px] uppercase tracking-wider text-olive">
          Tese de aproximação
        </h4>
        <p className="leading-relaxed text-floral">{analise.tese_aproximacao}</p>
      </div>
    </div>
  );
}

export default function Sandbox() {
  return (
    <div className="min-h-screen bg-smoky text-floral">
      <main className="mx-auto max-w-3xl px-6 py-16 space-y-16">
        <header>
          <p className="font-data text-[11px] uppercase tracking-widest text-olive">
            Sandbox — Etapa 8
          </p>
          <h1 className="mt-1 font-display text-2xl text-floral">
            Dossiê + Timeline
          </h1>
          <p className="mt-2 text-sm text-bone">
            Dados mockados — API key ausente no ambiente.
          </p>
        </header>

        <section className="space-y-3">
          <p className="font-data text-[11px] uppercase tracking-widest text-olive">
            1 sócio fundador
          </p>
          <MemoDisplay empresa={EMPRESA} analise={ANALISE} />
        </section>

        <section className="space-y-3">
          <p className="font-data text-[11px] uppercase tracking-widest text-olive">
            3 sócios — entrada em anos diferentes
          </p>
          <MemoDisplay empresa={EMPRESA_MULTI} analise={ANALISE} />
        </section>
      </main>
    </div>
  );
}
