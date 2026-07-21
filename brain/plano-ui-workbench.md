# Plano UI/UX — de site-de-pitch a ferramenta de ponta ("workbench")

> Criado: 2026-07-20. Status: AGUARDANDO APROVAÇÃO do Guilherme antes de executar.
> Diagnóstico que originou (mesma data): o produto foi construído pra ganhar o Clube —
> centro de gravidade na vitrine (6 páginas de pitch) e não no instrumento (3 telas de
> trabalho). Craft de CSS é bom; o que falta é arquitetura de produto + afordância + acabamento.
> Referências de padrão: Attio (tabela densa + peek panel + views), Linear (velocidade,
> teclado, dark contido), Affinity/4Degrees (pipeline de deal), Harmonic/Grata (sourcing).
> Mobbin indisponível na conta atual (exige plano pago) — validar visualmente se destravar.

---

## Princípios (o contrato do redesign)

1. **A ferramenta é a casa; o pitch é uma ala.** Usuário logado cai na bancada de trabalho,
   nunca numa landing.
2. **Manter a identidade, consertar a afordância.** Paleta Smoky/Olive/Bone/Floral e as 3
   fontes FICAM (são um ativo). O que muda: cada tela ganha UMA ação primária SÓLIDA
   (fundo floral, texto smoky) — hoje tudo é ghost text de 11px; ferramenta precisa de
   botão que parece botão.
3. **Duas escalas de densidade.** Editorial (atual, 15px, respirada) só nas páginas de
   prova/certificado. Ferramenta usa escala compacta: tabelas com linha de 36-40px, corpo
   13px, labels 11px. Densidade de informação é respeito pelo analista, não poluição.
4. **Todo estado existe.** Cada superfície assíncrona tem: skeleton, empty state com CTA e
   explicação de 1 linha, erro com retry. Sem exceção.
5. **Teclado como cidadão de primeira classe.** Cmd+K desde a fundação; atalhos de tabela
   depois (não-bloqueante).
6. **Desktop-first declarado.** Analista de M&A trabalha em desktop. Mobile = não quebrar
   (nav hambúrguer, tabelas com scroll horizontal contido), não paridade.

## Arquitetura de informação (a mudança estrutural)

**Hoje:** top nav de site (Início | Pipeline | Metodologia▾) → home é landing de pitch.

**Novo: app shell com sidebar esquerda** (o padrão Attio/Linear que sinaliza "ferramenta"):

```
┌─ sidebar (220px, colapsável p/ ícones) ─┬─ superfície de trabalho ─────────┐
│ ● Boreal (logo compacto)                │ topbar: breadcrumb · ⌘K · status │
│                                         │                                  │
│ TRABALHO                                │                                  │
│   Radar (busca)          ← nova home    │   [conteúdo da rota]             │
│   Pipeline                              │                                  │
│   Agenda                 ← promovida    │                                  │
│                                         │                                  │
│ INTELIGÊNCIA                            │                                  │
│   Heat-map                              │                                  │
│   Setores                               │                                  │
│                                         │                                  │
│ PROVA (colapsada por default)           │                                  │
│   Validação · Mercado · Consolidadores  │                                  │
└─────────────────────────────────────────┴──────────────────────────────────┘
```

- **Radar** (ex-home): busca + resultados. O hero editorial ("O modelo que prevê…") sai
  daqui e vira o topo da seção Prova/Validação — o pitch não morre, muda de endereço.
- **Agenda promovida a rota própria** (hoje é aba do pipeline): é a fila "o que fazer hoje",
  a tela de abertura do dia do analista.
- **Proveniência** fica fora do shell (certificado é artefato client-facing; o look
  editorial ali é CORRETO e não muda).

## Padrões novos (as 3 peças de maior alavancagem)

**A. Tabela densa como superfície padrão de listas** (Radar e Pipeline):
sticky header, colunas ordenáveis, linha 38px, hover com quick actions (salvar/selar/abrir),
score como barra+número compactos, chips mínimos. Substitui cards empilhados nos resultados
(cards altos leem "demo"; tabela lê "instrumento").

**B. Peek panel (gaveta à direita)** — clicar numa linha abre preview da empresa (score
breakdown, sócios, contato, ações) SEM navegar; Enter/2º clique abre a página cheia.
É o padrão Attio que corta 80% das navegações de ida-e-volta. Reusa o que a página
/empresa já tem, em formato resumido.

**C. Cmd+K (paleta de comandos):** navegar rotas, buscar empresa por nome/CNPJ, ações
rápidas ("ir pro pipeline", "emitir selo em..."). ~150 linhas hand-rolled, sem dependência
nova (avaliar `cmdk` só se o hand-rolled emperrar — decisão na execução).

## Plano tela a tela

| Tela | O que muda | O que preserva |
|---|---|---|
| **Shell/Nav** | Sidebar + topbar + ⌘K + hambúrguer mobile (dropdown 400px hoje estoura os 375px) | Logo, tipografia de label mono |
| **Radar (ex-home)** | Busca no topo da bancada; resultados em tabela densa + peek panel; painel de cobertura vira strip compacta acima da tabela | Busca em linguagem natural, exemplos por setor, switcher de setor |
| **Pipeline** | Linhas em densidade compacta; coluna de selo (status: sem selo/selado/novo pro CRM); empty state com CTA "ir pro Radar"; Agenda extraída | Tabs por estágio, sort atrasadas→data→score, filtros, log de atividade |
| **Agenda (nova rota)** | Fila do dia standalone: atrasadas primeiro, ação devida, 1 clique pra ligar/abrir | Lógica que já existe na aba |
| **Empresa** | Layout de registro: rail esquerda (atributos fixos: CNPJ, porte, contato, score breakdown) + tabs à direita (Visão geral / Investigação / Memo / Trajetória / Similares) em vez de toggles empilhados | Todo o conteúdo; research/memo/similares intactos |
| **Prova (validação/mercado/consolidadores)** | Só re-endereçamento no shell + herda o hero editorial da antiga home | Conteúdo e estética editorial INTACTOS (é a parte forte) |
| **Acesso (gate)** | Alinhamento visual mínimo | Fluxo |

## Sistema visual — deltas pontuais (não é rebrand)

1. Botão primário sólido: `bg-floral text-smoky` (+hover 90%), UM por tela. Secundário =
   outline atual. Terciário = ghost text atual.
2. Escala compacta: `text-[13px]` corpo de tabela, linha 38px, célula px-3.
3. Toasts/feedback usam `--color-overlay` (já existe e é subutilizada).
4. Focus rings e reduced-motion: manter o padrão atual (já está certo).
5. NADA de tema claro, NADA de azul, NADA de shadcn-default look.

## Fases de execução (commits pequenos, verificação a cada fase)

- **F1 — Fundação (shell):** sidebar + topbar + rotas reorganizadas + hambúrguer + ⌘K.
  *Risco: mexe em todas as páginas (wrapper). Mitigação: shell envolve sem alterar conteúdo.*
- **F2 — Radar:** tabela densa + peek panel + strip de cobertura + realocação do hero pra Prova.
- **F3 — Pipeline + Agenda:** densidade, coluna selo, empty states, rota /agenda.
- **F4 — Empresa:** layout de registro com rail + tabs.
- **F5 — Acabamento:** varredura de estados (skeleton/empty/erro em TODAS as superfícies),
  contraste AA nas superfícies de ferramenta, teclado na tabela (j/k/Enter — se der tempo).

Verificação por fase: `npm run build` + `tsc` limpos, DOM via browser (read_page/JS), e
**review visual do Guilherme** (único revisor de UI — screenshots do headless estão
quebrados nesta máquina). Nenhuma fase seguinte começa sem o OK visual da anterior.

## Fora de escopo (explícito)

Multi-tenant/auth por firma (gatilho: 2º parceiro), mandatos de compradores (roadmap F1-2
do piloto, não é UI agora), tema claro, mobile paridade, redesign do certificado, mexer no
conteúdo das páginas de prova.

## Riscos honestos

1. Screenshot headless quebrado → review visual depende do Guilherme a cada fase.
2. `pipeline/page.tsx` tem ~1.400 linhas → F3 inclui quebrar em componentes (refactor
   contido à tela, não repo-wide).
3. Peek panel reusa dados da /empresa → checar que o payload da busca tem o necessário
   (senão, fetch-on-open, que o `GET /api/empresa/[id]` já cobre).
