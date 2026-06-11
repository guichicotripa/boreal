# Progress — Log de Construção

> Append-only. Uma entrada por sessão de trabalho. Formato: `## [YYYY-MM-DD] quem | título`.
> Este log alimenta o roteiro do Loom no fim — registra a **jornada**, não só o resultado.
> Anota o que foi feito, o que travou, o que aprendeu. Screenshots/links bem-vindos.

---

## [2026-05-27] Guilherme | Setup inicial — scaffold + brain

Primeira sessão pós-reunião 1 do Clube. Montado o esqueleto do repo:

- `create-next-app` → Next.js 16.2.6 + React 19 + TypeScript + Tailwind v4 + App Router + `src/`
- `shadcn/ui` inicializado (preset base-nova) — `button.tsx` + `lib/utils.ts` criados
- Brain do projeto criado: `CLAUDE.md` + `brain/{progress,decisions,pending}.md`
- Nome do projeto fechado: **Boreal**

**Aprendizado:** create-next-app instalou Next **16**, não 15. Next 16 tem breaking changes —
gerou um `AGENTS.md` avisando pra consultar `node_modules/next/dist/docs/` antes de codar
framework. Mantido esse aviso.

Também nesta sessão:
- Supabase client (`src/lib/supabase.ts`, browser + admin) + `.env.example` + `.env.local`
  (gitignored). `build` e `tsc --noEmit` passam limpos.
- Repo GitHub privado criado e no ar: https://github.com/guichicotripa/boreal (branch `main`).

**Ainda pendente (ações fora do código):**
- Guilherme: colar chaves reais no `.env.local` (Supabase + Anthropic).
- Adicionar Maguto como collaborator (falta o GitHub username dele).
- Primeira pull de CNPJs via BrasilAPI (Semana 1).

---

## [2026-05-27] Guilherme | BigQuery + Base dos Dados conectado

Segunda sessão. Foco: conectar a fonte de dados principal (Base dos Dados via BigQuery).

- Service account `boreal-bq` criada no GCP (projeto `boreal-497620`). Chave salva em
  `.gcp/` (gitignored).
- `GCP_PROJECT_ID` e `GCP_KEY_PATH` adicionados ao `.env.local` e `.env.example`.
- Client BigQuery criado: `src/lib/bigquery.ts` (singleton, server-only, usa key file).
- Schema do dataset `basedosdados.br_me_cnpj` mapeado — tabelas: `empresas`,
  `estabelecimentos`, `socios`. (Nome correto é `br_me_cnpj`, não `br_rf_cnpj`.)

**Dados confirmados:**
- 79.396 estabelecimentos ativos, CNAE 24/25/28, UF SP, snapshot 2025-11-09.
- Campos chave: `cnpj`, `cnae_fiscal_principal` (7 dígitos, ex: "2840200"), `sigla_uf`,
  `id_municipio` (código IBGE), `data_inicio_atividade`, `situacao_cadastral` ('2' = ativa).
- Sócios: `nome`, `qualificacao`, `data_entrada_sociedade`, `faixa_etaria`
  ('5' = 41–50 anos, '8' = 71–80 anos — o sinal de risco sucessório).

**Aprendizado:** `situacao_cadastral` usa '2' (não 'ATIVA' nem '02'). UF é `sigla_uf`,
não `uf`. `id_municipio` é código IBGE — para nome da cidade vai precisar join
com `br_bd_diretorios_brasil` ou tabela própria.

## [2026-05-27] Guilherme | Ingest pipeline BQ → Supabase

Terceira sessão. Ingest completo do dataset metalmecânica SP.

Script: `scripts/ingest-empresas.mjs`

- Query BQ: `estabelecimentos JOIN empresas LEFT JOIN socios`, filtro CNAE 24/25/28 + SP
  + ATIVA (`situacao_cadastral='2'`) + sede (`identificador_matriz_filial='1'`)
  + excluindo São Paulo capital (`id_municipio != '3550308'`)
- Ordenado por `max_faixa_etaria DESC` — empresas com sócios mais velhos primeiro (risco)
- Sócios buscados numa segunda query com `IN` (2 chamadas BQ, não 2000)
- Upsert em lote de 100 no Supabase (service role, RLS bypass)

**Resultado:**
- ✅ 2.000 empresas inseridas na tabela `empresa`
- ✅ 4.929 sócios inseridos na tabela `socio`

**Aprendizado:**
- `identificador_matriz_filial = '1'` garante uma linha por empresa (sem filiais duplicando)
- `faixa_etaria` máxima dos sócios foi usada como critério de prioridade de ordenação
- `municipio` armazenado como código IBGE por enquanto — nome da cidade fica pra Semana 2

## [2026-05-27] Guilherme | Pipeline v0 — input NL → filtro → lista (primeira UI)

Quarta sessão. A primeira coisa demoável: digita em linguagem natural, recebe empresas reais.

- `@anthropic-ai/claude-agent-sdk` instalado. Smoke test (`scripts/check-agent-sdk.mjs`)
  confirmou: o SDK chama o Claude pela **assinatura** do Claude Code, sem API key.
- `src/lib/llm.ts` — `parseQueryLLM(texto)`: Claude lê a frase → JSON de filtros
  (cnaePrefixes, minFaixaEtaria, maxAnoFundacao, limit).
- `src/lib/query-parser.ts` — fallback heurístico (mesma interface), demo nunca quebra.
- `src/app/api/search/route.ts` — POST: parse → query Supabase (CNAE OR, idade sócio via
  inner join, ano de fundação) → lista.
- `src/app/page.tsx` — UI: input + chips de exemplo + cards de empresa com sócios e faixa etária.

**Resultado (validado rodando):**
- "metalmecânica no interior de SP com sócios acima de 60 anos" → filtros
  `{cnae:[24,25,28], minFaixaEtaria:7}`, 50 empresas, todos sócios 71–80/80+. ✓
- "máquinas e equipamentos fundados antes de 1985" → o LLM **estreitou** pra `cnae:[28]`,
  `maxAnoFundacao:1985`, 50 empresas todas 28xx fundadas pré-85. ✓
- Type-check limpo, página renderiza.

**Aprendizado:**
- Agent SDK = assinatura sem custo de token, MAS só local (não no Vercel). Caveat no deploy
  registrado em `decisions.md`.
- Latência ~8s por chamada (overhead de subir o engine do Claude Code). Tolerável com loading
  state; otimizar (ou trocar pra API direta) quando precisar de velocidade.
- No `.or()` do Supabase o wildcard do LIKE é `*`, não `%`.

*(append novas entradas abaixo desta linha)*

## [2026-05-30] Maguto | Restyle brandkit — Etapas 7–10 + polimento navbar

Sessão longa (continuação de contexto compactado). Branch: `maguto/restyle-brandkit`.

**Construído:**
- **Etapa 7** — neutralizou o último azul restante: `--sidebar-primary` do shadcn dark mode tinha hue 264 (azul). Trocado para `oklch(0.488 0 0)` (neutro). Boreal agora é 100% sem azul/navy.
- **Etapa 8** — dossiê + timeline:
  - `MemoDisplay`: overview, análise sucessória, perguntas de abordagem, tese com borda risk-mid.
  - `Timeline` horizontal CSS puro: fundação → entrada de sócios, dot centrado na linha, labels acima/abaixo, "Hoje" com dot vazio. Fixes: margin collapse (`h-8 mb-4`), linha insetada (`inset-x-[18px]`), containers de 28px fixos nas bordas.
- **Etapa 9** — três estados revisados: loading copy final ("Comentando as primeiras empresas com IA…"), erro com label `font-data` + mensagem risk-high + sugestão bone, vazio com headline Newsreader + parágrafo de sugestão.
- **Etapa 10** — polimento: hover nos cards (`hover:bg-surface-hover transition-colors`), responsivo mobile (headline `text-3xl md:text-[44px]`, padding `py-10 md:py-20`), sandbox deletado, `.obsidian/` no gitignore.
- **Navbar sticky** — `sticky top-0 z-50` no `layout.tsx`.
- **NavLogo route-aware** — novo `src/components/brand/NavLogo.tsx` (client component): scroll suave no `/`, `router.push("/")` nas demais rotas.

**Tentado e revertido:**
- `router.back()` no "← Voltar à busca" da pipeline — não funcionou como esperado. Revertido para `href="/"`. Ficou como pendência para resolver depois.

**Alinhamento UI/UX (doc ChatGPT `boreal_ajustes_finais_ui_ux_3105.md`):**
- 8 de 11 pontos aprovados para implementar amanhã.
- 2 com ressalva: coluna direita (manter cobertura vs placeholder de metodologia) e contador no header (arquitetura a definir).
- 1 trivial (barra do notebook — ignorar).

**Resultado:** branch `maguto/restyle-brandkit` com 6 commits de restyle + 1 feat (navbar). Produto visualmente alinhado à direção Boreal — dark, editorial, quente, sem azul.

**Aprendizado:**
- `@theme inline` do shadcn auto-gera `--font-sans: var(--font-sans)` → circular reference. Fix: declarar explicitamente `--font-sans: var(--font-plex-sans)` no bloco `@theme inline`.
- Timeline CSS com conteúdo absoluto dentro de container: o container precisa de altura explícita (`h-8`) senão o margin-bottom colapsa através dele.
- `layout.tsx` é Server Component — qualquer `onClick` na navbar precisa de um client component wrapper separado (`NavLogo.tsx`).

## [2026-05-28] Guilherme | Semana 2 — Score + Reasoner LLM batched

Quinta sessão (continuação pós-compactação do contexto). Foco da noite: tirar o produto de
"lista filtrada" e levar pra "research agent" — número + raciocínio por empresa.

**Construído:**
- `src/lib/scoring.ts` — função pura, score 0–100 em 4 dimensões:
  - Idade dos sócios (max 40): faixa 9→40, 8→35, 7→25, 6→12, ≤5→0
  - Antiguidade da empresa (max 30): ≥40 anos→30, 25–39→22, 15–24→12, <15→0
  - Estabilidade societária (max 20): última entrada de sócio há >10a→20, 5–10a→12, neutro 10
  - Porte / relevância (max 10): DEMAIS→10, EPP→6, ME→2
  Retorna `{score, breakdown, sinais}` — sinais human-readable, ordenados por força.
- `src/lib/reasoner.ts` — chamada Claude **batched** (Agent SDK, single call) pro top 15:
  retorna `{empresa_id, one_liner, flags}`. Compacta dados antes de mandar (só o que importa
  pro raciocínio) pra economizar tokens. Parsing robusto: extrai array JSON, descarta entradas
  malformadas em vez de quebrar.
- `src/app/api/search/route.ts` — score local após query DB + reasoner com `try/catch`
  (se LLM falhar, devolve sem insights, busca continua viva).
- `src/app/page.tsx` — badge grande à esquerda do card (cor por tier: vermelho ≥70, laranja
  50–70, cinza <50), one-liner em itálico, flags como chips uppercase, sinais do score abaixo.
  Indicador `top X analisadas por IA` no header.

**Qualidade dos one-liners (amostra real):**
- *"Ubirajara Rodrigues (80+) comanda desde 1973 empresa com R$52,5M de capital; único co-sócio entrou apenas em 2015."*
- *"Joint venture germano-brasileira de 1975 com Hugo Klaus Grieser (80+) no quadro desde 1984 e composição inalterada há 42 anos."*
- *"Quatro Flecks no quadro desde 2000, com matriarca Mariana (80+) e três filhos entre 51 e 70 anos."*

Específicos. Citam nome, ano, capital. Zero genérico. Era exatamente o objetivo.

**Problema crítico — latência:** Agent SDK gasta ~5–8s só pra spawnar Claude Code a cada call.
Resultado:
- parseQueryLLM: ~8s
- reasonAboutEmpresas (top 15): ~80–100s
- **Total ~90–110s por busca**

Inaceitável pro demo de 60s. Decisão (`decisions.md`): trocar Agent SDK por Anthropic API direta
(`@anthropic-ai/sdk`) assim que a key chegar. Latência projetada ~15–20s, já fica pronto pro Vercel.

**Strategic frame confirmado nesta sessão:** Boreal **é o motor do Relay**. Arquitetura
BQ → Supabase → score → reasoner é exatamente o que o Relay precisa. Tratar Semana 2+ como
"prototipando o produto real, não só demo de competição".

**Aprendizado:**
- Score 100 nos top 8 não é bug — a query "fabricantes de máquinas no interior de SP" puxou
  empresas já pré-ordenadas por idade dos sócios no ingest. O discriminador aparece quando
  você scrolla pra baixo.
- Batched LLM é a forma certa: 1 chamada com N empresas > N chamadas. Mas Agent SDK paga
  startup overhead a cada call, anulando boa parte do ganho. API direta resolve.
- "Top 15 analisadas por IA" no header é importante UX — usuário sabe que o resto é só
  score determinístico.

## [2026-05-29] Guilherme | Research-agent (score v1) via assinatura + estratégia Relay

Continuação (mesma data). Foco: alinhar a expansão do escopo com o Relay e construir o
research-agent. Sessão muito estratégica (leitura do raw) + a Etapa 1 do plano.

**Estratégia (a partir do `raw/` do segundo-cérebro):**
- Lido o **Playbook Relay** (§14 = funil de origination em 10 estágios) e o **Excelia workflow**
  (processo real de uma boutique de M&A — o cliente do Relay). Insight: o Boreal cobre os estágios
  1–6 do funil; o Excelia mostra que o Relay pluga substituindo a "montagem de target list" manual.
- Guilherme corrigiu um desvio meu: eu comecei a desenhar o "memo + CRM estilo Excelia", que é
  **ferramenta da boutique** (fora do escopo — Playbook §1: Relay não é boutique/SaaS/consultoria).
  Reancorado: Relay = originador (acha → score → valida sinal → entrega oportunidade).
- **A linha definida** (brilho de demo + fidelidade Relay): (1) research-agent [feito], (2) validação
  retroativa [roadmap], (3) polish + Loom. Validação retroativa é frágil em metalmecânica (deals
  opacos, não passam no CADE) — vertical pra isso é saúde, no Relay real. Vira credencial dita no pitch.
- **Anti-escopo:** sem memo com script de reunião, sem CRM de execução, sem EBITDA proxy, sem
  outreach automatizado (Playbook §15 proíbe contato não-humano).

**Construído — Research-agent (Etapa 1, score v0→v1):**
- `src/lib/research.ts` — investiga a empresa na web e acha sinais qualitativos (Playbook §11:
  herdeiro fora, C-suite externo, menção a venda, banco contratado, Big4, sucessor ativo, sem pegada).
- **Roda via ASSINATURA, custo zero** — Agent SDK + WebSearch nativo. Truque: `options.env` do
  `query()` substitui o ambiente do subprocesso; passando sem `ANTHROPIC_API_KEY`, o Claude Code
  cai no login (assinatura). `maxTurns:18` + limite de 4 buscas pra não estourar turns.
- Híbrido honesto: LLM identifica os sinais (lista fechada) + cita FONTE; o código aplica os pesos
  (LLM não inventa score). Ajuste **bidirecional**: achou sucessor → rebaixa; achou venda → sobe.
- `/api/research` + `research-cache.json` (top 3 dos demos pré-investigado → clique instantâneo 0.5s).
- `page.tsx`: botão "🔍 Investigar com IA", badge muda v0→v1 ao vivo com delta, sinais com peso
  colorido + link de fonte, resumo. Validado visualmente por Guilherme.
- **PR #6 mergeado.**

**Resultado validado (dado real):**
- PRENSA JUNDIAI: v0 **100 → v1 75**. A IA descobriu que Lucas Cremonese Rodrigues (mesma família)
  já é Presidente ativo → sucessor encaminhado, risco menor. Com fonte. A IA *corrigiu* a heurística.
- ISSHIKI: achou "Andre Makoto Isshiki" com CNPJ próprio independente → herdeiro fora do negócio.

**Decisões:**
- Research = score v1 do Playbook. Roda no **topo** (não em todas as 2k — §10 "enrichment é caro").
  Clique manual = simplificação do protótipo; produção = worker assíncrono no top N (roadmap).
- Usar assinatura (não API) pro research a pedido do Guilherme (economizar créditos). Trade-off:
  ~68s/empresa (vs 48s API), só local (não Vercel). Mitigado por cache + sob demanda.

**Evidência que corrigiu uma suposição:** rodei `check-score-dist.mjs` — o score v0 **não satura**
(só 5.6% em 100; 50% em 70-89; boa resolução). O "tudo 100" que eu via era viés de amostra (topo da
busca ordenada). Modelo está bem calibrado, não precisa recalibrar.

**Aprendizado:**
- Agent SDK `options.env` REPLACES o ambiente do subprocesso → caminho limpo pra forçar assinatura
  mesmo com a API key no `process.env` do app (que o reasoner/parser usam).
- Web search consome ~1 turn por busca; sem folga de maxTurns, estoura antes de sintetizar o JSON.
- O caso de demo mais forte é o **rebaixamento** (IA evita falso positivo), não a subida.

---

## [2026-05-29] Guilherme | Colab automático + API direta + enrichment + dossiê + cache

Sessão longa (28→29 madrugada). Fechou a Semana 2 inteira e começou a Semana 3.

**1. Fluxo de colaboração automático (skills `/boreal` e `/salve`):**
- `/boreal` detecta identidade via `git config user.name`, cria branch pessoal (`gui/...` ou
  `maguto/...`) automaticamente se estiver na main, rebase com origin/main no boot.
- `/salve` faz rebase antes de publicar, push da branch + abre PR via `gh`. Nunca toca a main.
- Modo "automático mas avisa": executa o git sozinho mas mostra cada passo (Maguto aprende vendo).
- Onboarding do Maguto documentado em `skills/_index.md` (git config + divisão de domínio:
  Gui no motor, Maguto na interface, `types.ts` como contrato).

**2. Migração Agent SDK → Anthropic API direta:**
- `llm.ts` usa `@anthropic-ai/sdk` (Haiku no parser — tarefa trivial), `reasoner.ts` (Sonnet).
- Cliente lazy (singleton na 1ª call) + `next.config.ts` com dotenv `override:true` — necessário
  porque `ANTHROPIC_API_KEY` existia vazia como var de sistema e o Next não sobrescrevia.
- **Latência 90–110s → ~31–38s.** Custo real medido: ~$0.04/busca. Funciona no Vercel agora.

**3. Enrichment Nível 0** (`scripts/enrich-empresas.mjs` + `check-lookups.mjs`):
- Resolveu via JOIN nos diretórios do BigQuery: `id_municipio`→nome (3504107→Atibaia),
  `cnae`→descrição, `natureza_juridica`→descrição. 100% das 2.000 empresas.
- Lê do payload `raw` (idempotente) e sobrescreve os campos visíveis — código preservado em `raw`,
  sem migration. Paginação no read do Supabase (limite de 1000/página — peguei só metade no 1º run).
- **Telefone/email já estavam no banco e eram ignorados** — agora exibidos (output mais valioso
  pra deal sourcing). `cnaes_secundarios` com descrição.
- Ingest atualizado com os mesmos JOINs → dados novos nascem enriquecidos (pensando no Relay).

**4. Dossiê estruturado** (`lib/dossier.ts` + `/api/dossier` + UI):
- Híbrido: dados estruturais montados em código (precisos), análise narrativa via LLM (1 call ~20s).
- Memo: overview, análise de risco sucessório, perguntas de abordagem ao fundador, tese.
- Timeline societária visual (CSS puro): fundação → entrada de cada sócio. Agrupa eventos do mesmo
  ano e alinha labels conforme posição (fix de sobreposição/corte nas bordas).
- Fix: `FAIXA_LABEL` cobre 1–9 (antes só 5–9; sócios jovens chegavam como código cru, LLM adivinhava).

**5. Cache de demos** (`demo-cache.json` + `build-demo-cache.mjs`):
- 3 queries canônicas pré-computadas → servidas instantâneas (0.04s) vs busca ao vivo (38s).
- Rota normaliza a query (lowercase/sem acento) e serve do cache; `?fresh=1` pula. Busca ao vivo
  segue real. Cache commitado → funciona no Vercel. Loading com steps progressivos pras buscas novas.

**PRs:** #1 (colab) · #2 (enrichment) · #3 (dossiê) · #4 (demo-cache) — todos mergeados na main.

**Decisões estratégicas (registradas em `decisions.md`):**
- Enrichment em 2 regimes: N0 determinístico no ingest, N1 (web) job assíncrono futuro, N2 (EBITDA
  proxy) não fazer.
- **Moat do banco = loop de outcomes, não dados públicos.** Receita é commodity; o defensável é o
  histórico de quem foi contatado/respondeu/vendeu. Implica tabela de interações no futuro (Relay).
- LLM híbrido (dados em código + análise no LLM) como padrão do research-agent.

**Aprendizado:**
- `next.config.ts` com dotenv override resolve var de sistema vazia mascarando o `.env.local`.
- Supabase SELECT tem teto de 1000 linhas — paginar com `.range()`.
- Cache pré-computado é o jeito certo de ter demo instantâneo + busca real ao vivo coexistindo.

---

## [2026-05-30] Guilherme | Research → API + assinatura destravada + demo-dois-lados + cache de memos

Continuação (após score v0.1 e juiz). Foco: tirar o research-agent da assinatura bloqueada e
preparar o pitch pra rodar com custo de API ~zero.

- **Migração `research.ts`:** Agent SDK (assinatura) → Anthropic API + **web search tool**
  server-side (`web_search_20250305`). Interface `investigarEmpresa()→ResearchResult` intacta —
  rota e UI não mudaram. Validado (PRENSA 24s, 3 buscas, comportamento bidirecional preservado).
- **Assinatura destravada:** o "org disabled subscription access" era **conta errada logada** no
  Claude Code (não bug da API key — confirmado: sem key no ambiente). Re-login com a conta pessoal
  Pro resolveu → Agent SDK voltou a custo zero. `check-agent-sdk.mjs` confirma.
- **Arquitetura definida:** produto (`research.ts`/`dossier.ts`) na **API** (deploy-ready); **cache
  gerado via assinatura** (custo zero). Pitch serve do cache → ~$0 de API ao vivo.
- **Demo-dois-lados resolvido:** investigou candidatas "do meio" via assinatura
  (`cache-research-sub.mjs`). **MECANOTECNICA 85→96** ↑ — IA achou herdeiro na pecuária (sem
  sucessor no negócio → eleva), com fonte real. Complementa o rebaixamento **PRENSA 100→75** ↓.
- **Research-cache curado:** removidas 4 subidas triviais (+3 só `sem_presenca_digital`); ficaram 6.
- **Cache de memos:** rota `/api/dossier` agora lê de `dossier-cache.json` (cache hit instantâneo);
  **9 memos** gerados via assinatura (`cache-dossier-sub.mjs`, top-5 dos demos + research-cache).

**Resultado:** typecheck + `next build` de produção limpos. Custo de API da sessão ≈ $0,21 (1 teste
na migração); todo o resto (16 researches + 9 dossiês) via assinatura = custo zero.
**Aprendizado:**
- "org disabled" pode ser só conta errada logada no Claude Code — re-login resolve, não é bug.
- PowerShell `Set-Content -Encoding UTF8` grava **BOM** → quebra `JSON.parse` do Node. Usar
  `[IO.File]::WriteAllText` (UTF-8 sem BOM).
- Subida de score é **estruturalmente rara** no dataset: leads frios não têm M&A público. O research
  corrige sobretudo **pra baixo** (depura falsos positivos) — narrativa honesta e forte pro Loom.

---

## [2026-05-30] Guilherme | Juiz de M&A validado (eval sintético com sinal real)

Branch `gui/juiz-mea` (após mergear #16 na main). Foco: provar se o juiz tem sinal.

- **Rubric via assinatura** (`build-juiz-rubric.mjs`, custo zero, 284s de pesquisa web): 8 dimensões
  (pesos 3-5), 13 red flags, 24 fontes reais. Salvo em `scripts/juiz-rubric.json`.
- **`juiz-avaliar.mjs` migrado pra assinatura** + lê dados da empresa do demo-cache (o cache hit do
  dossiê só devolve `analise`) + URL configurável (`BOREAL_URL`).
- **Rodado em 2 dossiês reais:** PRENSA **4/10** e MECANOTECNICA **4/10** — notas quase idênticas por
  dimensão. O eval **generaliza**: detecta fraquezas sistemáticas do `dossier.ts`, não ruído.

**Resultado:** juiz tem **sinal real** — pegou um erro técnico nosso (capital social usado como proxy de
porte) e mapeou 5 gaps sistemáticos (red flags, "por que nós", canal/próximo passo, estimativa financeira,
perfil do negócio raso). Tudo via assinatura = custo zero. Backlog de correções no `pending.md`.
**Aprendizado:** o teto do memo é ~4-5/10 sem dados financeiros + red flags, por melhor que seja a
análise sucessória — reflete a realidade de M&A (ler quadro societário é necessário, não suficiente).
A tensão estimativa-financeira (juiz quer × decisão de não inventar proxy) é decisão de produto em aberto.

---

## [2026-05-30] Guilherme | Loop de qualidade fechado: corrigir dossiê → juiz mede o ganho

Continuação na `gui/juiz-mea`. Apliquei as 4 correções baratas que o juiz apontou e re-rodei pra medir.

- **`dossier.ts` + `types.ts` + UI**: campo `red_flags` (severidade + como verificar), `proximo_passo`
  (canal usando telefone/email do banco), prompt instrui capital-social-não-é-porte, "por que nós" na tese.
- **Cache de memos regenerado** via assinatura (9 memos, custo zero) com os campos novos.
- **Bug pego pelo próprio juiz**: 1ª re-rodada não melhorou (PRENSA até caiu 4→3) porque o `juiz-avaliar.mjs`
  montava o memo SEM os campos novos → juiz avaliava cego. Corrigido o template; aí mediu de verdade.

**Resultado:** PRENSA **4→5**, MECANOTECNICA **4→6**. Red flags **1→7/8** (maior salto). Ganho **localizado**
nas dimensões corrigidas (perfil/priorização, que não toquei, ficaram iguais) → o juiz é instrumento de
medição confiável. Loop sensor→correção→medição fechado, custo zero (assinatura).
**Aprendizado:** (1) um eval só mede o que recebe — o template do avaliador tem que espelhar TODOS os campos
do output, senão penaliza melhorias invisíveis. (2) A estimativa financeira (deixada de fora) trava a nota
em 5-6 e é o gargalo: o juiz argumenta que é o **primeiro corte de qualificação por tamanho**, não enfeite —
o que reabre a decisão de produto sobre proxy de EBITDA com metodologia.

---

## [2026-05-30] Guilherme | Convergência Relay: recall por vertical + data moat consolidado

Sessão de análise (motor do Boreal aplicado à pergunta do Relay: decision gate Phase 0).

- **Recall@top10% por vertical** (`validacao-vertical.mjs`, decil dentro do vertical): metalmec **66%**
  (passa o gate ≥40%), saúde **17%**. O agregado ~28% escondia a diferença.
- **Decomposição de saúde** (`validacao-saude-decomp.mjs`): 62% do M&A de saúde é consolidação
  (recall 1%), só 8% sucessão clássica (recall 100%) → o label estava sujo, não o score.
- **Filtrar universo não resolve** (`validacao-saude-filtrado.mjs`): decil médio piora pra 4,95.
  Achado de arquitetura: **o score v0 é bom de elegibilidade (corte), fraco de ranking fino** (idade
  satura entre velhos). O v0 elege, o v1 (research-agent) ordena.
- **Data moat consolidado**: trazidos os 5 scripts de mineração (`detectar-transicoes`, `validacao-escala`,
  `validacao-lift`, `validacao-refino`, `check-socios-schema`) da branch órfã `gui/transicoes-cnpj` pra cá.
  Não dava pra mergear a branch inteira (atrasada — reverteria research→API e deletaria o juiz).

**Resultado:** validação retroativa pura no platô; insights estratégicos do Relay documentados no segundo
cérebro (`wiki/synthesis/relay-data-moat`). Saúde descartada como vertical (sem acordo com a Setter).
**Aprendizado:** validação retroativa mede elegibilidade, não ranking fino — pra ordenar a fila de
abordagem precisa do v1 (sinais que variam entre empresas igualmente velhas), que não é testável retroativo.

---

## [2026-05-27] Maguto | Onboarding no repo + validação do pipeline v0

Entradas retroativas: o lado do Maguto não tinha sido logado aqui (só nas sessões do segundo cérebro). Consolidado pra fechar a jornada antes do Loom.

Setup local pra entrar no projeto e validar end-to-end o que o Guilherme tinha empurrado de manhã.

**Construído:**
- Collaborator do `guichicotripa/boreal` aceito — `gh api` confirma permissão `write` (push, triage, pull).
- `.env.local` do Guilherme renomeado/movido pra `D:\documents\boreal\.env.local` (gitignored ok). Chaves Supabase + GCP + Anthropic em ambiente.
- GitHub CLI instalado + auth como `magutolou` (token com gist, read:org, repo, workflow).
- Aspa órfã no SYSTEM PATH do Windows removida — npm/node herdavam PATH corrompido (causa de `npm run dev` falhar silencioso antes).
- `npm install --ignore-scripts` → 678 pacotes; postinstall do msw pulado por causa do sandbox, sem efeito em dev/prod.
- `npm run dev` em `localhost:3000` → pipeline v0 validado end-to-end via API e browser. Screenshot confirmando 50 cards renderizados + badges de filtro + tag "interpretado por IA".

**Resultado:** ambiente do Maguto operacional. Pipeline v0 reproduzido fora da máquina do Guilherme — primeira evidência de que o setup é portável.

**Aprendizado:**
- Caso de teste útil pro scoring v1: **EXTRUSORAS OLGA** (2 sócios 80+, fundada 1975) vs **PRENSA JUNDIAI** (um sócio 80+ + um 31–40, fundada 1973). Filtro burro por idade do mais velho dá "alto risco" pras duas, mas a presença do sócio mais novo na Prensa muda o sinal sucessório. Discriminação que o scoring determinístico da Semana 2 precisaria capturar (e capturou).
- Aspa órfã em SYSTEM PATH do Windows não dá erro óbvio — só faz npm/node herdarem PATH parcial. Vale checar PATH no shell antes de debugar instalação.

---

## [2026-05-28] Maguto | Preparação do brand sprint — workflow de identidade visual com IA

Dia de research, sem código no repo do produto. Objetivo: chegar no dia 29 com plano antes de abrir o Claude Code pra identidade visual.

**Construído (no segundo cérebro, fora deste repo):**
- Ingest de vídeos sobre criação de identidade visual com IA → `wiki/sources/identidade-visual-ai-brandbook.md` no segundo cérebro.
- Workflow de 8 passos consolidado em `wiki/concepts/identidade-visual-ia.md`: território da marca → conceito de ícone (Claude) → referências Pinterest → tipografia no Canva → ícone no Recraft → paleta/fontes → estilo de ilustração → brandbook → CSS theme.
- Narrativa do Loom persistida em `memory/projects/boreal.md` (segundo cérebro).
- Conceito de deal sourcing PE estruturado em `wiki/concepts/deal-sourcing-pe.md` — Silver Tsunami, processo manual, vocabulário técnico.

**Resultado:** plano de execução pra Semana 1.5 (identidade visual) pronto antes de abrir o editor. Estimativa: ~2h30 de prep — caro em horário mas pagou no dia 29 (zero retrabalho).

**Aprendizado:**
- Naming "Boreal" (norte, bússola) carrega coerência semântica explorável no ícone — base do conceito de onda dupla referenciando aurora boreal que apareceu no dia 29.
- Separar "preparação de research" de "execução de design" é não-óbvio até falhar. O instinto inicial era abrir o Claude Design e iterar; research antes elimina rodadas perdidas.

---

## [2026-05-29] Maguto | Identidade visual Boreal — paleta + logo + brandkit v1

Sessão longa de identidade visual com o plano do dia 28 em mãos. Brandkit v1 fechado e commitado no repo (assets em `brand/`).

**Construído:**
- **Pesquisa de referências PE/M&A** — Grata, Harmonic, Cyndx, SourceScrub, DealCloud. Conclusão: praticamente todos em azul/navy corporativo. Diferenciação real = ir pro lado oposto (warm minimalism).
- **Paleta fechada** com Guilherme:
  - Smoky Black `#11120D` — fundo
  - Olive Drab `#565449` — decoração
  - Bone `#D8CFBC` — info legível
  - Floral White `#FFFBF4` — no lugar de branco puro (mantém coesão quente)
- **Cores de risco:** terracota `#C8623E` (alto) / ocre `#C99B3D` (médio) / Bone (baixo).
- **Tipografia:** Newsreader (display editorial) + Space Grotesk (interface, depois trocada por IBM Plex Sans no restyle) + IBM Plex Mono (dados).
- **Logo:** múltiplas rodadas no Claude Design até a **onda dupla 3a**, Archivo Medium tracking 0.10em. Referência dupla — ondas da aurora boreal + tese do Silver Tsunami.
- **Assets organizados e commitados:** `brand/logo/` (SVGs + docs), `brand/guidelines/` (PDF + HTML). Pushed → Guilherme tem acesso.

**Tentado e adiado:**
- Refinamentos pontuais na `page.tsx` em 3 blocos. Revertido — implementar pedaços antes das fontes e tokens estarem no código gera inconsistência. Restyle completo virou tarefa do dia 30.

**Resultado:** brandkit v1 íntegro no repo. Direção visual cravada (warm minimalism, sem azul) — diferencia do nicho em 2 segundos.

**Aprendizado:**
- Num nicho saturado de azul corporativo (PE/M&A), paleta quente é diferenciação que se lê antes de qualquer copy.
- Claude Design itera logo bem em rodadas curtas (variação → escolher direção → refinar tracking → atualizar brandkit), mas geração de imagem consome muito token. Iterar com prompt enxuto.

---

## [2026-05-30] Maguto | Restyle brandkit — Shell + Etapas 1–6

Sessão de tarde/início da noite (12:26 → 18:43). Branch: `maguto/restyle-brandkit`. Primeira metade do restyle: do shell do brandkit até o card D.2 fechado. Etapas 7–10 + navbar entraram em sessão separada depois (ver entrada de 30/05 mais abaixo).

**Construído:**

- **Shell do brandkit** (`4f3d1ad`): tokens de cor no `globals.css` (Smoky Black, Olive Drab, Bone, Floral White + cores de risco), fontes carregadas via `layout.tsx`, componentes `Logo.tsx` / `Mark.tsx` em `src/components/brand/`.
- **Etapa 1** (`af651a6`): aplica tokens Boreal em `page.tsx` + `pipeline/page.tsx` — substitui shadcn defaults por `bg-smoky-black`, `text-bone`, `border-floral-white/10`.
- **Etapa 2** (`b179cb8`): hero terminal two-column (eyebrow `font-data` mono + headline Newsreader à esquerda, input + chips de exemplo à direita). IBM Plex Sans entra como `font-sans`.
- **Divergência tipográfica** (`1fa5309`): Space Grotesk (planejado no brandkit V1) trocada por IBM Plex Sans. Registrada em `brand/BRAND.md` pra futura referência (Space Grotesk não casou bem com a Newsreader; Plex Sans deu hierarquia mais limpa).
- **Fix circular reference** (`e2d4cac`): `@theme inline` do shadcn auto-gera `--font-sans: var(--font-sans)`, criando referência circular que quebra o build. Resolvido declarando explicitamente `--font-sans: var(--font-plex-sans)` no bloco `@theme inline`.
- **Etapa 3 — navbar** (`f6d57d9` + `dc1c6b8`): navbar com `max-w-5xl`, logo à esquerda, link "Pipeline" discreto à direita. Primeira tentativa com link em Olive Drab não lia como clicável → trocado pra `text-bone`.
- **Etapa 4 — results header** (`3cdc697` + `4844f43`): tipografia mono consistente no header de resultados, fix de wrap quando a query era longa, reposicionamento da metadata "top X analisadas por IA" + honestização da copy (não prometer mais do que entrega).
- **Etapas 5+6 — card D.2** (`7e4dd1f`): estrutura two-column badge à esquerda + conteúdo à direita, border-left por tier (vermelho ≥70, laranja 50–70, neutro <50), ações funcionais (Ver detalhes, Investigar com IA, Memo) com hover states.

**Resultado:** 9 commits empurrados pra `maguto/restyle-brandkit`. `npm run dev` valida visualmente cada etapa em localhost:3000. Build limpo após o fix do `@theme inline`. Card D.2 com hierarquia visual clara (score → empresa → sócios → ações).

**Aprendizado:**
- `@theme inline` do shadcn cria circular reference quando você redeclara `--font-sans` sem apontar pra uma fonte concreta. Resolver com `--font-sans: var(--font-plex-sans)` explícito.
- Espacar UI por etapa (não num megacommit) ajuda a reverter sem perder o resto se uma etapa der ruim. Inversão: força a commitar mesmo estados intermediários "feios", mas vale o trade-off.
- Cor de link discreto em paleta dark precisa ser testada no contexto, não no isolated. Olive Drab `#565449` parece tom acentuado fora da tela mas some quando colado em `bg-smoky-black` — Bone foi a leitura certa de "clicável mas não chamativo".

---

## [2026-05-31] Maguto | PR #18 do restyle — rebase + resolução de conflito + abertura

Sessão curta e operacional pra fechar o trabalho do dia 30 num PR limpo antes dos ajustes UI/UX.

**Construído:**
- `/boreal` rodado pra ver o estado. `origin/main` andou 4 commits do Guilherme durante o dia: research na API, score v0.1, juiz de M&A, demo-dois-lados.
- Rebase de `maguto/restyle-brandkit` (16 commits) em cima de `origin/main`.
- **Conflito em `brain/pending.md`** — ambos editaram a seção da Semana 3. Resolução manual preservando os dois lados: demo-dois-lados + cache de memos (Guilherme) marcados [x], restyle marcado [x] (Maguto), ajustes UI/UX e `router.back()` em aberto.
- Force-push com `--force-with-lease` (seguro em branch pessoal).
- PR aberto via `gh`: https://github.com/guichicotripa/boreal/pull/18 — descrição cobre as 10 etapas + fixes técnicos + test plan + anti-escopo (ajustes A/B/C ficam pra PR separado).

**Resultado:** PR #18 aberto sem merge conflicts no GitHub. Restyle pronto pra review do Guilherme.

**Aprendizado:**
- Fluxo do `/salve` validado em conflito real: rebase + resolução manual + `--force-with-lease` + `gh pr create` em sequência roda limpo.
- `--force-with-lease` em vez de `--force` puro evita sobrescrever commit que outra pessoa tenha empurrado na mesma branch — padrão certo pra force-push em branch pessoal.
- Ajustes UI/UX (Etapas A/B/C do doc `boreal_ajustes_finais_ui_ux_3105.md`) em PR separado em cima do #18 mergeado: mantém restyle puro, review do Guilherme fica mais focado.

---

## [2026-05-31] Maguto | Merge da main no restyle + integração dos blocos red_flags/proximo_passo

Guilherme sinalizou (comentário no PR #18) que a branch precisava integrar a main atualizada: #17 (juiz + dossiê com `red_flags`/`proximo_passo`), #19 (histórico retroativo, já mergeado) e #20 (regra de domínio: motor define contrato em `types.ts`, interface renderiza). No #17 ele adicionou o render desses 2 campos no `page.tsx` (domínio meu) em classes shadcn cruas — pediu que eu integrasse no brandkit.

**Construído:**
- **Merge `origin/main` → `maguto/restyle-brandkit`** (escolhi merge, não rebase). Motivo: o restyle refatorou `DossierPanel` (estado+render juntos, da main) em `MemoDisplay` (render puro) + componente pai. Rebase commit-a-commit colidiria várias vezes na mesma região (a etapa 8 toca o mesmo bloco); merge gera 1 conflito único representando o estado final dos dois lados, mais seguro de resolver certo.
- **Conflito único em `src/app/page.tsx`** (função `MemoDisplay`). Resolvido mantendo a estrutura restyle + integrando os 2 blocos do Guilherme reestilizados:
  - `red_flags`: badge de severidade com cores de risco do brandkit (`risk-high` terracota / `risk-mid` ocre / `hairline`+`bone` baixa), header `font-data text-olive`. Descartado o `text-zinc-*`/`text-red-400`/`text-amber-400` cru.
  - `proximo_passo`: bloco com header `font-data text-olive` + `→ texto` em `text-floral`.
  - Posições preservadas do #17: red flags entre análise sucessória e perguntas; próximo passo após a tese.
- Resto do motor do #17 (`dossier.ts`, `types.ts`, `dossier-cache.json`, scripts de validação/juiz) veio limpo pelo merge, sem conflito.

**Resultado:** `tsc --noEmit` limpo, `npm run build` limpo (9 páginas geradas). Branch atualizada com a main, PR #18 deixa de ficar atrás. Estilização dos blocos foi 1ª tentativa "no automático" — pontos de revisão registrados como **Etapa D** no `pending.md` pra ver com o Matheus na próxima sessão.

**Aprendizado:**
- Quando o outro lado refatora a estrutura de um componente que você também mexeu, **merge > rebase**: o rebase reaplica cada commit e força resolver o mesmo conflito N vezes; o merge consolida num ponto só. History fica menos linear, mas o Guilherme pode squash no merge do PR.
- Regra de domínio (#20) na prática: o conteúdo (campos `red_flags`/`proximo_passo` vindos de `types.ts`) é do motor; a renderização é da interface. A integração respeitou isso — peguei os campos do contrato e dei o estilo do brandkit.

---

## [2026-06-02/03] Guilherme | Push deep-tech pros jurados + refino da tese + memo quant + pipeline v2

Sprint grande de 2 dias. Foco: tornar **visível e provável** o deep-tech que o Boreal já tinha, e
recalibrar pro painel real (Monica/Maya VC + Henrique Vaz/Enter técnico). Racional completo de cada
peça em `brain/decisions.md` → "[2026-06-02/03] RACIONAL DAS MELHORIAS" (pra usar no pitch).

**O que foi construído (PRs #23–#26):**
- **`/validacao`** — prova do score: recall@top10% **67%** metalmec, leakage-free, + **hindcast nominal**
  (empresas reais com nome que venderam + rank pré-deal) + **calibração por lift** (pesos medidos; o dado
  corrigiu a intuição: quadro estagnado 0,81×, sócio único 0× saíram).
- **`/consolidadores`** — lente do comprador; reenquadrado pra descritivo após backtest dar 1,4×.
- **`/mercado`** — TAM honesto (30.732 quentes × 0,46% giro) + **coorte de destino** (80% paradas-viáveis,
  7% fecham) + **macro Selic** → refino da tese (estoque viável sub-coberto + represamento cíclico).
- **Gatilho "por que agora" + rascunho de abordagem** no research; estado "não é o momento" quando há sucessor.
- **Memo quant** — precedentes (da mina) + cenário de referência + "pedir ao dono". Sem DCF fabricado.
- **Pipeline v2** — funil de 6 estágios + DRI + próxima ação + log de atividade + **loop de outcome**
  (score previsto × desfecho real). Migration 0004.

**Validação:** tudo testado — backtests ao vivo (BigQuery), API E2E contra DB real, render no browser
(screenshots). Dois bugs pegos pelo rigor: "17%→28%" no scoring (não reproduz) e "58% baixada" na coorte
(faltava filtro ativa-em-2023; real 7%). Sem checar, teríamos contado história errada num pitch.

**Aprendizado:** o "porquê" estava só em commits/PRs — fácil de perder no pitch. Consolidado em
`decisions.md`. Daqui pra frente: registrar racional (incl. o que rejeitamos) junto com o código.

---

## [2026-06-04] Guilherme | Cobertura multi-setor + score por lentes + robustez nacional

Dia longo (PRs #28–#32). Detalhe do racional em `brain/decisions.md`.

- **Look-alike (#28)** — achar similares (CNAE+praça+porte+época), inspirado no Grata.
- **Monitor de transições (#29)** — sensor forward: alerta de mudança societária no pipeline. Pegou
  mudança real na PRENSA. O que mais diferencia do Grata.
- **Setores 1ª classe (#30)** — registry + página `/setores` + ingest saúde/educação no Supabase
  (cobertura 1→3 setores).
- **Score por lentes (#31)** — o achado do dia: o score de sucessão acerta **88–100% nas vendas de
  sucessão em TODO setor**. Recall baixo de saúde/educação = consolidação (o score não deve prever),
  não falha. Flag `perfil_sucessorio`. Decomp: educação 26% geral → 88% no perfil de sucessão.
- **Validação Brasil-inteiro (#32)** — robustez: recall se sustenta com N 2–6× maior (educação N=8→24,
  88%→83%). Distinção: ingest=cobertura, não aumenta N da validação; lever é geografia.

**Aprendizado:** "aumentar a amostra" tinha uma armadilha — ingerir mais no banco não muda o N da
validação. O N é a realidade (quantas aquisições aconteceram), e o lever é geografia/tempo.

---

## [2026-06-04] Maguto | Restyle sistema de tipografia/cor — etapas 3–5 + nav ativo

Sessão de design/UI aplicando o sistema de tipografia/cor v1 (doc: `brand/uso-tipografia-cor.md`)
nas páginas principais. 6 commits na branch `maguto/restyle-sistema-v1` (rebased em cima do
`origin/main` com 7 commits novos do Guilherme — zero conflito).

**Construído:**

- **Etapa 3 — /pipeline** (`fb62e46`): labels de coluna Bone uniforme (arquivado Olive); ocre
  removido das fases do funil; loop de outcome → label Bone semibold + número Floral regular
  (sem `strong` em `font-data`); "Não receptivo"/"Perdido" de terracota → Olive; back link
  padronizado em todas as páginas (Floral, uppercase 11px, seta animada, `items-start`).
- **Etapa 4 — /validacao** (`4e769af` + `57b838f` + `5659693`): todos os `strong text-floral`
  convertidos para `strong` (Bone 600); números de passo 1/2/3 → Floral; "X× melhor" e "top X%"
  → Floral; tabela lift + resultado por setor → Floral; títulos dos passos ("Ground truth de
  graça." etc.) → `strong text-floral` (funcionam como sub-títulos); "antes"/"depois" no
  hindcast → `strong` Bone 600 (palavra curta, bold não imperceptível no contexto).
- **Etapa 5 — /consolidadores** (`fe59f28`): mesma limpeza de `strong text-floral`; links
  → Floral; "X já adquiridas" → Floral.
- **Nav ativo** (`57b838f`): extraído nav em `src/components/brand/Nav.tsx` (client component,
  `usePathname()`); ativo = `text-floral`; inativos = `text-bone/70 hover:text-bone`;
  `aria-current="page"` no ativo.
- **Rebase sobre origin/main** limpo — monitor (#29), look-alike (#28), setores (#30–32),
  afiar (#33) integrados sem conflito. Pipeline.tsx: alerta de mudança societária (terracota
  como alerta funcional) coexiste com restyle.

**Resultado:** branch `maguto/restyle-sistema-v1` em cima da main. Pendente: PR + Etapa 6
(mercado) + /setores e /worklist (novas, sem restyle) + erro de borda na box + decisão de
peso do negrito.

**Aprendizado:**
- Workflow combinado: sandbox HTML antes de tocar o código, aguardar aprovação antes de commitar.
  Dois erros de processo nesta sessão (etapa 5 sem sandbox; commit sem confirmação) — reforçar.
- `strong { font-weight: 600 }` em `font-data` (mono) fica visivelmente pesado — não usar
  `strong` em números monoespaçados, só cor.
- "Ativo" no nav precisa de um segundo sinal além da cor se o hover dos inativos também usa
  Floral. Solução: reservar Floral só ao ativo, inativos vivem em Bone/70.
- Rebase > merge quando o histórico precisa ser linear pra PR limpo. Git resolveu automaticamente
  porque as edições eram em regiões não sobrepostas do mesmo arquivo.

---

> ⚠️ **Entrada retroativa (registrada em 11/06).** A sessão de 01/06 abaixo não foi salva
> no brain do Boreal na época — só o segundo cérebro foi atualizado. Logada aqui depois para
> fechar a jornada. O trabalho descrito (PRs #21 e #22) precede tudo que veio depois neste log.

## [2026-06-01] Maguto | Bugs de encoding/select + ajustes UI/UX (etapas A–D)

Sessão pós-merge do restyle (PR #18). Duas frentes: corrigir dois bugs visuais reportados pelo
Guilherme e implementar os ajustes UI/UX pós-restyle (doc `boreal_ajustes_finais_ui_ux_3105.md`).

**Bugs corrigidos (PR #21):**
- **Encoding corrompido no "Investigar com IA":** `research-cache.json` e `dossier-cache.json`
  tinham double-encoding UTF-8→Latin-1 (subprocess do Claude Code no Windows gravando stdout em
  CP-1252). `ç`/`ã`/`é` apareciam como `Ã§`/`Ã£`/`Ã©`, em-dashes fragmentavam em GS/replacement
  char. Criado `scripts/fix-mojibake.mjs` (idempotente: buffer latin1→utf8 + limpa residuais).
  149 → 0 ocorrências no research-cache, 12 → 0 no dossier-cache.
- **Select do pipeline com fundo branco:** o `<select>` nativo ignorava `bg-surface` (o popup das
  `<option>` é pintado pelo OS). Substituído pelo componente shadcn `Select` (base-ui). Popup com
  fundo sólido `#1c1d17` (par visual com o trigger fechado, `sideOffset={0}`), label exibido via
  children do `SelectValue` (evita fallback pro id cru). `color-scheme: dark` no `globals.css`.

**Ajustes UI/UX (PR #22) — etapas A/B/C/D:**
- **A (Home):** label "Descreva uma tese em linguagem livre" acima do input; "comentadas por IA"
  → "top N analisadas por IA"; botão "Buscar tese" com a seta `→` separada e animação
  `translate-x-1` no hover.
- **B (Cards):** badge passa a mostrar tier `ALTO/MÉD/BAIXO` no lugar do rank (rank ficava
  desatualizado quando a investigação alterava o score — tier é derivado do score atual, sempre
  fiel, zero re-ranking); badges de evidência limitados a 3; ações reordenadas (Ver detalhes →
  Investigar → Memo) com os painéis expandidos na mesma ordem; título "Memo de investimento" no
  `MemoDisplay`; `SalvarButton` "Salvar no pipeline"; `hover:underline` removido (padronizado).
- **C (Pipeline):** lanes com `border-t-2 border-floral/15` uniforme (sem distinção por cor —
  hierarquia vem do volume de cards); empty states contextuais por coluna.
- **D (Memo):** red flags ordenados por severidade (alta→media→baixa), máx 5; `como_verificar`
  em linha própria (bone, 11px) em vez de inline com travessão; tese com `border-bone/30` neutro
  (era `border-risk-mid`); próximo passo com `bg-surface-hover` (CTA destacado, sem cor de risco);
  títulos de seção do memo em `text-bone/55` (era `text-olive`, baixo contraste no fundo escuro).

**Processo:** sandboxes HTML (`sandbox-badge.html`, `sandbox-memo-d.html`) usados pra decidir
badge e estilo do memo antes de tocar o código; deletados antes do PR. Cada etapa validada no
`localhost:3000` + `tsc --noEmit` limpo antes de commitar.

**Resultado:** PR #21 (2 commits, mergeado) e PR #22 (6 commits, branch `maguto/etapa-a-copy`).

**Aprendizado:**
- `<select>` nativo no Windows/Chrome não respeita `bg`/`color-scheme` no popup das `<option>` —
  pra dark-mode confiável tem que trocar pelo componente custom (base-ui/shadcn).
- Mojibake em cache vem do encoding do **stdout do subprocess**, não do código que grava o JSON —
  `[IO.File]::WriteAllText` UTF-8 sem BOM no lado que gera, e fix idempotente no que já corrompeu.
- Rank fixo no card briga com score que muda pós-investigação: derivar o rótulo do score atual
  (tier) elimina a inconsistência sem precisar de re-ranking dinâmico.
- Cor de risco (terracota/ocre) deve ser exclusiva de sinalização de score/severidade; usar nos
  destaques editoriais (tese, CTA) cria ambiguidade semântica — destaques usam paleta neutra.

---

## [2026-06-03] Maguto | Restyle sistema tipografia/cor — criação do doc + etapas 0–2

> ⚠️ Entrada retroativa registrada em 2026-06-11. A sessão de 03/06 não foi salva no brain do Boreal
> na época (só o segundo cérebro pessoal foi atualizado). Este registro fecha o gap. É a sessão que
> **antecede** o "etapas 3–5 + nav" de 04/06 — cria o doc do sistema e aplica as etapas 0–2 (base,
> hero, card). O código entrou na main via PR #35 junto com as etapas 3–5.

Sessão de sync + início do restyle. Branch `maguto/restyle-sistema-v1` criada a partir da main.

**Sync com o trabalho do Guilherme:**
- PR #22 (etapas A–D + polish do Maguto) mergeado (`e4004cf`). Pipeline v2 (#26/#27 — funil de 6
  estágios + DRI + log de atividade), deep-tech (#23 — `/validacao`, `/consolidadores`), `/mercado`
  (#24) e memo com blocos quantitativos (#25) integrados na main pelo Guilherme.

**Bug do pipeline — diagnóstico corrigido:**
- 3 oportunidades apareciam fora das lanes do board. Diagnóstico inicial errado ("dados de teste com
  vocabulário inventado", `identificado`/`em_conversa`); cheguei a tentar migrar/limpar o Supabase
  (bloqueado pelo sandbox classifier, acertadamente). Causa real: a `main` local estava 5 commits atrás —
  o board renderizava o vocabulário do **pipeline v0** enquanto os dados já eram do **pipeline v2**.
  Resolvido com `git pull` (`828ce46`). **Aprendizado:** `git fetch` antes de concluir que dado está
  sujo — divergência dado×código costuma ser branch desatualizada.

**Construído — `brand/uso-tipografia-cor.md`:** doc do sistema de tipografia/cor v1 (receitas por papel:
fonte + peso + cor + opacidade + tamanho). Fonte de verdade de aplicação, complementa o `BRAND.md`.

**Etapa 0 — base:**
- `globals.css`: `strong { font-weight: 600 }` global — mata o faux-700 sintetizado (borrado), ênfase
  passa a ser peso real.
- `layout.tsx`: Plex Sans `400/500/600` (remove o 300 não usado, carrega o 600).

**Etapa 1 — hero (`page.tsx`):**
- Copy enxuta no subheadline ("estavam no top 10% do modelo, 12 meses antes" — menos tom "marketing proof").
- Subheadline → Bone `text-[15px]` (corpo de leitura).
- "ver a prova": ocre (`risk-mid`) → Floral + seta `→` que anda no hover.

**Etapa 2 — card/memo (`page.tsx`):**
- Labels de seção uniformizados em Bone/70 (antes: mistura de `text-bone` cheio e `text-bone/55`).
- Espaçamento entre tópicos do memo `space-y-4` → `space-y-5` (20px).
- Dot pulsante de loading: ocre → Bone (ocre é cor de score, não de UI).
- **Toggle Ver/Ocultar investigação** — bug: depois de investigar não havia como fechar o painel.
  Replicado o padrão do memo (estado `researchAberto`, resultado fica em memória, sem re-fetch).
- Boxes da investigação ("sem gatilho de timing" e "rascunho de abordagem"): `bg-smoky` (afundava,
  destoava) → `bg-surface-hover` sem borda, igual à box "Próximo passo" do memo.
- Decisão de hierarquia: corpo do memo permanece **Floral** (revertido após teste — bone "apaga" o
  painel compacto; a regra híbrida de bone-pra-leitura vale só pras páginas de prosa).

**Resultado:** doc do sistema + etapas 0–2 na branch `maguto/restyle-sistema-v1` (commit local da época,
depois rebased). Continuação (etapas 3–5 + nav) na sessão de 04/06.

**Aprendizado:**
- Faux-bold 700 (Plex Sans não carrega 700 → o browser sintetiza) fica borrado; 600 real é mais limpo.
- O cansaço de ler em Bone era **tamanho** (14px), não a cor — Bone 15px é confortável e mais sóbrio que
  Floral em volume (que "vibra"/hala). Daí a regra de corpo de leitura = Bone 15px.
- Contexto manda na regra: a hierarquia "bone-pra-leitura" funciona em página de prosa, mas no painel
  compacto (card/memo) o corpo precisa ser Floral pra não apagar.
- Validar decisões de design em sandbox HTML standalone (antes/depois) antes de tocar o código acelera
  a convergência e evita retrabalho no app.

---

> ⚠️ **Entrada retroativa (registrada em 11/06).** A sessão de 05/06 não foi salva no brain do Boreal
> na época — só o segundo cérebro pessoal foi atualizado. Logada aqui depois para fechar o gap. É o
> passe **profundo** de /validacao, que vem **depois** do passe leve "etapas 3–5 + nav" de 04/06
> (aquele só limpou `strong text-floral`; este reformula card, contraste, a11y e ritmo). Commits
> `a451a8b`→`a81cdc4` na branch `maguto/restyle-sistema-v1` (à frente da main, sem PR mergeado ainda).

## [2026-06-05] Maguto | /validacao restyle profundo — impeccable + card hero (craft) + merge #34

Sessão de design/UI focada inteira na página `/validacao`. Filtrado o feedback do ChatGPT (descartado o
que conflitava com nossas decisões; aprovado o que agregava), rodada a crítica completa do `$impeccable`
e reformulado o card hero com o `$impeccable craft`.

**Crítica + correções (`$impeccable critique`, score 25 → 29/40):**
- **a11y:** focus rings (`focus-visible:ring-1 ring-floral/50`) em todos os links interativos;
  `scope="col"` em todos os `<th>`; `key` estável (`key={d.nome}`) no lugar de `key={i}` nas listas.
- **Contraste:** labels de seção (h2) Olive → Bone/70 (Olive em Smoky reprova WCAG ~2,7:1; Bone/70 ≈6,4:1);
  caption split em dois tiers — informativa (dado que o leitor precisa) → Bone/60, assinatura/rodapé → Olive.
- **Ritmo tipográfico:** statement "O score não é chutado…" promovido a título serif Floral 22px com
  eyebrow Bone/70 (statement de seção); body de prosa 14px → 15px (Bone).

**Estrutura da página:**
- Lead-in antes da tabela de setor; tabela de lift separada em grupos (ativos / descartados).
- Sinais descartados na tabela: Olive → Floral/70 + Bone/70 (mesma linguagem de cor da tabela, só
  rebaixada em /70 — Olive seria cor diferente, não versão atenuada).

**Card hero reformulado (`$impeccable craft`):**
- Padrão **figura editorial**: o número (97%) flutua à esquerda (`float-left` + `display:flow-root` no
  pai, nunca `overflow:hidden`) e lidera a frase ("97% das vendas… estavam no top 10%"); o texto flui ao
  redor. Stats block separado por `border-t` (lift, confirmação nacional). Nuance honesta do 67% (recall
  geral contando todas as aquisições) ao lado, de-emphasizada mas não escondida.
- Motivo: o template "hero-metric" (número grande + label + stats) é banido pelo `layout.md` do impeccable;
  a figura editorial é idiomática à voz editorial da marca.

**Merge do PR #34 do Guilherme (auditoria de tese) na branch:**
- `#34` trouxe **97% sucessão como headline** (era "67% geral") e `setores.json` como fonte única de dados
  de setor. Merge (não rebase — Guilherme refatorou componentes que também editamos pesado) com 4 conflitos
  resolvidos (`page.tsx` home, `consolidadores`, `decisions.md`, `pending.md`): conteúdo dele preservado,
  nosso sistema de cor/tipo aplicado por cima. O 67% migrou para bloco de nuance no pé do card hero.

**Copy:** auditoria de travessões em /validacao (3 trocados por vírgula, 5 mantidos como aposto/realce);
"a gente" informal → registro formal; "telling not showing" removido.

**Doc:** `brand/uso-tipografia-cor.md` atualizado de v1 → **v3** (8 novas decisões — ver `decisions.md`).

**Resultado:** /validacao fechada na branch `maguto/restyle-sistema-v1`; commits `6ab90b9`, `a451a8b`,
`c7e6f86`, `708d085`, `e1b913e`, `8be1e55` (merge #34), `4510413` (card craft), `1c3e218`, `a81cdc4` (brand v3).

**Aprendizado:**
- **Figura editorial usa `display:flow-root`, não `overflow:hidden`** — com `overflow:hidden` o topo do
  glifo Newsreader do número flutuado era cortado; `flow-root` contém o float sem clipar.
- **De-ênfase em tabela = /70 na mesma cor, não troca pra Olive** — manter a linguagem de cor (Floral/Bone)
  rebaixada em opacidade lê como "mesmo tipo de dado, descartado"; trocar a cor lê como "outro tipo de dado".
- **Merge > rebase quando o outro lado refatorou o mesmo componente** — 1 conflito unificado por arquivo
  em vez de replay commit-a-commit.
- Chrome MCP (`tabs_context_mcp`) falhou de forma consistente em screenshots do dev server ("No group with
  id"); validação visual feita pelo usuário no browser + sandboxes HTML standalone.

---

> ⚠️ **Entrada retroativa (registrada em 11/06).** A sessão de 06/06 (madrugada, commit 01:00) não foi
> salva no brain do Boreal na época — só o segundo cérebro pessoal. Logada aqui depois. É o passe
> **profundo** de /consolidadores (Etapa 5), que vem depois do passe leve `fe59f28` de 04/06. Commit
> `04130b1` na branch `maguto/restyle-sistema-v1`.

## [2026-06-06] Maguto | /consolidadores restyle profundo (Etapa 5)

Sessão de restyle + reescrita de copy da `/consolidadores`. Workflow `/review` (wrapper do impeccable)
rodado na página — score 23/40, primeira run do alvo.

**Sistema de cor/tipo alinhado ao brand guide:**
- 4 eyebrows internos Olive → Bone/70 (mini-cards de tese, eyebrow do backtest, label "Candidatos");
  caption de metodologia (buy-box) Olive → Bone/60; body do backtest `text-sm` → `text-[15px]`;
  metadata sócio/desde → Bone/70.
- Focus rings nos 3 links; `key={a.nome}` (era `key={i}`); H1 com `text-balance`.
- **Buy-box CNAE labels removidos** de cada card de consolidador — código CNAE é opaco pro leitor
  não-técnico e o setor já é evidente pelos nomes das candidatas.
- "Não é uma previsão validada" no rodapé: `<strong text-bone>` removido (saltava demais), virou Olive simples.

**Copy do backtest reescrita (clareza técnico + leigo):**
- "1,4× vs. acaso" → **"40% a mais de acerto"** (em negrito), matematicamente idêntico mas lê como ganho,
  não como fração; calculado dinâmico do JSON (`Math.round((lift - 1) * 100)`).
- "detecção descritiva" mantida mas explicada inline; "97% de acerto nas vendas de sucessão" (negrito) no fim.
- Mini-cards reescritos em paralelo: "O modelo identifica quem tem **maior propensão a vender**, com
  antecedência." / "O modelo detecta **quem está comprando e com que padrão**, em tempo real." (reforça
  que é o mesmo sistema em dois contextos).

**Resultado:** /consolidadores fechada na branch `maguto/restyle-sistema-v1`; commit `04130b1`.

**Aprendizado:**
- O mesmo dado lido como "40% a mais de acerto" comunica melhor que "1,4×" sem mentir — escolher a
  forma que não diminui o produto.
- CNAE cru no card é ruído pro não-técnico; quando o setor já está implícito nos nomes, o código não agrega.

---

> ⚠️ **Entrada retroativa (registrada em 11/06).** A sessão de 06-07/06 não foi salva no brain do Boreal
> na época — só o segundo cérebro pessoal foi atualizado. Logada aqui depois para fechar o gap. É a
> **continuação** do restyle profundo: vem depois de /consolidadores (06/06, acima) e fecha as últimas
> 4 páginas (etapas 6-9), abrindo o PR #35 que mergeou o sistema v1 inteiro na main. Inclui também o
> fix do hindcast (PR #36). Todo o código descrito já está na main; este registro só fecha a jornada.

## [2026-06-06/07] Maguto | Restyle etapas 6-9 (/mercado, /setores, /worklist, home) + PR #35 + fix hindcast município (#36)

Sessão longa de fechamento do restyle sistema v1. Aplica o brand guide v3 nas 4 páginas que faltavam,
roda o `/review` (wrapper do impeccable) em cada uma, e abre o PR que leva tudo pra main. Workflow
combinado: sandbox HTML antes de tocar o código, aprovação antes de commitar. Branch
`maguto/restyle-sistema-v1`.

**Etapa 6 — /mercado** (`aff5d17` parcial + `ae5f334`):
- Hierarquia das boxes refeita (TAM, coorte de destino, macro Selic) — peso visual por importância,
  não uniforme. Revisão de copy.
- Sistema de cor/tipo do brand guide aplicado: labels Bone/70, números Floral, `strong` 600 sem cor
  em prosa.

**Etapa 7 — /setores** (`bbad3a1`):
- Copy review: metadescription, eyebrow, lead sem parênteses, labels LENTE, footer sem referência
  ao script de build. Formalização do registro (sem informalidade).
- Brand guide aplicado (cor/tipo).

**Etapa 8 — /worklist** (`3525437`):
- **Crítico:** `try/catch` em `carregar()` + estado de erro **variante C** (Bone monocromático, botão
  `border-hairline`, sem cor de alarme) — antes mostrava empty state genérico mesmo em erro de rede.
- **a11y:** `aria-live`/`aria-busy` no loading, `aria-pressed` nos toggles, chip de score com `title`
  + `border-hairline`, back link com animação padronizada.
- **Polish:** "pra" → "para", ordinal posicional removido (Bone/45 reprovava WCAG + redundante com o
  chip de score), `SalvarButton` idêntico à home (3 estados + rollback otimista).

**Etapa 9 — home + pipeline** (`3adec20`):
- **Error states:** erro principal da busca vira **variante B** (label Olive mono + mensagem Bone 15px
  + `py-10` de respiro + botão retry `border-hairline`) — prominência por label e respiro, não por cor;
  erros inline (investigação/memo/similares/trajetória) `text-risk-high` → `text-bone/70` com copy
  impessoal ("Não foi possível carregar…").
- **Absolute ban (impeccable):** `border-l-2` removido de EmpresaCard e da tese hairline (side-stripe
  border > 1px é proibido) — ver decisão em `decisions.md`.
- **Hover/focus padronizados:** `transition-opacity hover:opacity-70` em "ver a prova" e "Buscar tese"
  (mesmo padrão dos "Voltar à busca"); focus rings em todos os interativos (chips, links, botões,
  SalvarButton); `aria-live` no LoadingSteps; `role="status"` no `animate-pulse` da investigação.
- **Separador overline** "BOREAL · Modelo preditivo de M&A": `{" "}` explícito em ambos os lados do `·`
  (com `tracking-[0.2em]`, espaço de text-node renderiza assimétrico; espaço JSX explícito corrige).
- Labels de sidebar e search: `text-olive` → `text-bone/70` (hierarquia tier 3).
- `/pipeline`: focus ring adicionado ao back link (era o único das 9 páginas que faltava).

**PR #35 — sistema v1 completo:** branch `maguto/restyle-sistema-v1` mergeada na main. Antes do merge,
verificado que a branch estava em cima do HEAD da main (PR #34 do Guilherme, 04/06) — sem conflito,
merge direto. Cobertura final: as 9 páginas (`/` home, `/pipeline`, `/worklist`, `/setores`,
`/mercado`, `/consolidadores`, `/validacao`, `/analise`, `/comparar`) no brand guide v3.

**Fix hindcast município (PR #36, `083b440`):**
- Bug: a tabela de aquisições reais em `/validacao` exibia o **código IBGE bruto** (ex: `3550308`) na
  coluna "Praça" em vez do nome da cidade. O campo `municipio` de `src/lib/hindcast.json` foi gerado
  sem passar pela camada de resolução (o `demo-cache` já vem resolvido; o hindcast escapou).
- Fix: lookup dos 43 códigos IBGE únicos via API do IBGE (`/api/v1/localidades/estados/35/municipios`),
  76 deals corrigidos (ex: `3550308` → São Paulo, `3538709` → Piracicaba). Só dado, sem mudança de
  lógica; typecheck limpo.
- PR isolado a pedido do Matheus (diff de 1 arquivo, fácil de reverter) numa branch nova a partir da
  main, em vez de empilhar no PR já mergeado. Mergeado.

**Resultado:** restyle sistema v1 100% na main (PR #35); bug de exibição do hindcast corrigido (PR #36).
typecheck limpo em todas as etapas; sandboxes de iteração deletados antes de cada commit.

**Aprendizado:**
- Prominência de error state pode vir de **label + respiro vertical**, não de cor — variante B (Olive
  label + Bone + `py-10`) chama atenção sem o ruído da terracota, que destoava do resto do sistema.
- Espaço de separador com `letter-spacing` alto: text-node space e `{" "}` JSX renderizam diferente;
  usar `{" "}` explícito dos dois lados garante simetria.
- Diff de dado isolado (hindcast) merece PR próprio em branch nova a partir da main, não empilhar num
  PR de feature já mergeado — diff limpo, reversão trivial.
- `municipio` resolvido no `demo-cache` mas cru no `hindcast.json`: caches gerados por scripts diferentes
  podem divergir na resolução; vale um check de consistência quando o mesmo campo aparece em mais de uma fonte.

---

> ⚠️ **Entrada retroativa (registrada em 11/06).** A sessão abaixo é de **07/06** (à noite, distinta do
> restyle etapas 6-9 acima). O código foi mergeado na main na época (PR #37), mas a jornada só ficou no
> segundo cérebro pessoal — não foi logada no brain do repo. Registrada agora para fechar o gap.

## [2026-06-07] Maguto | Restyle home Fase 1 — card stats + mega-menu Metodologia + switcher de setor (PR #37)

Sessão de planejamento + execução do restyle da home, dividida em **duas fases**: Fase 1 (baixo risco,
antes da reunião 3 de 09/06) e Fase 2 (estrutural, até o Loom). Esta entrada cobre a **Fase 1**, mergeada.
Branch `maguto/home-restyle-fase1` a partir de `origin/main` limpa (separada do fix do município, que virou
o #36). Workflow: sandbox HTML por decisão visual + aprovação antes do código.

**Verificação de dependência (antes de codar):** a página da empresa da Fase 2 precisaria de empresa-por-id.
Lido o código: `/api/dossier` já carrega empresa por id, e o card já tem o objeto `empresa` completo (com
`score.breakdown`) em memória ao clicar. Conclusão: dá pra navegar via estado no clique — **não bloqueia**
no Guilherme; `GET /api/empresa/[id]` fica como polish opcional (refresh/deploy).

**Navbar (`Nav.tsx`):**
- Top-level reduzido ao fluxo real do usuário: **Início · Pipeline · Worklist**.
- Validação/Mercado/Consolidadores/Setores agrupados num **mega-menu "Metodologia"** — grid 2×2 (400px),
  abre no **hover** + `group-focus-within` (acessível por teclado e toque), título Floral 500 + descrição
  por item, fundo opaco (`bg-smoky`), **rabinho** (tail rotacionado) ancorando no gatilho.
- **Chevron SVG** centrado no viewBox (substituiu o glyph `▾`, cuja tinta não é centrada na caixa e
  "pulava" verticalmente ao girar 180°).
- Ponte de hover via `pt-3` transparente no container do menu (sem dead-zone entre gatilho e box).

**Card de empresa (`page.tsx`):**
- **Stats strip** novo: Porte · Capital · Fundada (+anos) · Sócio+ (+nº de sócios), com **porte e capital
  em primeira classe** (mono, tabular) — antes ficavam enterrados na linha olive junto de natureza/CNAE.
- Capital compacto (`R$ 52,5 mi` em vez de `R$ 52.500.000`).
- Removidos: bloco de badges de evidência (redundante com a stats strip) e a linha de metadata olive
  (natureza jurídica + CNAE completo migram pro "Ver detalhes"/página da empresa).
- Rótulos de ação encurtados (Memo, Similares).
- Porte mantém os termos da Receita (DEMAIS = médio/grande; a Receita não separa médio de grande, e
  separar exigiria faturamento que não temos).

**Switcher de setor (`page.tsx`):**
- Segmented control (Metalmecânica/Saúde/Educação) na home reusa o estado `setorAtivo` que já existia (só
  era setável vindo de `/setores?setor=`). Clicar troca o universo e dispara a busca do setor.
- Sidebar de cobertura passa a seguir o setor ativo: nome + CNAEs (com descrição) + lente + contagem.
  Confirmado por query no Supabase: **2.000 empresas indexadas por setor, todas em SP** — daí a linha
  "2.000 empresas · São Paulo".

**Copy:** subhead da home enxuto — removida a moldura de venda ("Não é um buscador. É um modelo validado…"),
mantido o `97% das vendas por sucessão` como linha factual; link "ver a prova" → "ver metodologia".

**Fixes pontuais:**
- Labels olive→`bone/70` em `ResearchDisplay` ("Sem gatilho de timing", "Rascunho de abordagem") — estavam
  ilegíveis em olive.
- Bug de toggle: investigar/memo/similares só alternavam o painel quando havia dado; em erro ou retorno
  vazio o painel travava aberto. Corrigido com `if (x || xAberto)` — fecham em qualquer estado.
- Opacidade do mega-menu: `bg-surface` (3%) deixava o conteúdo vazar; trocado por `bg-smoky` opaco.

**Trajetória societária — REMOVIDA da home:** botão, painel, handler, estados e types tirados do
`page.tsx`. Era uma query **BigQuery ao vivo** (pesada/instável inline, e dead-end sem a página da empresa).
**Rota `/api/trajetoria` + libs preservadas** (nada deletado do backend). Handoff registrado no `pending.md`:
cachear a trajetória do top dos demos (`trajetoria-cache.json` + rota cache-first) e reviver na página da
empresa (Fase 2).

**Lint:** corrigido `react-hooks/set-state-in-effect` no efeito que lê `?setor=` (disable pontual no
`setSetorAtivo`, não no efeito todo) e removida a prop `rank` órfã do `EmpresaCard` (não usada desde a
decisão "tier label substitui rank").

**PR #37 (squash `4d63e0d`):** 3 commits (`feat(nav)`, `feat(home)`, `docs(brain)`). typecheck + eslint +
`next build` (17 páginas) verdes. Mergeado junto com o #36 (fix município).

**Aprendizado:**
- Glyph de fonte (`▾`) não é centrado na sua caixa → rotação 180° desloca a tinta verticalmente; **SVG
  simétrico** no viewBox resolve (mesmo centro geométrico nos dois estados).
- O card pesado (6 `useState` + 4 fetch + 4 painéis inline) é o que torna a lista de 50 inviável de varrer;
  mover as ações pesadas pra uma página da empresa deixa o card um componente de apresentação leve → lista
  escala sem paginação. (Base da Fase 2.)
- Hover-menu acessível sem JS de estado: CSS `group-hover` + `group-focus-within` cobre mouse, teclado e
  toque (foco abre); `pt` transparente faz a ponte de hover.

---

> ⚠️ **Entrada retroativa (registrada em 11/06).** A sessão de **08/06** não foi salva no brain do Boreal
> na época — só o segundo cérebro pessoal foi atualizado. Logada aqui depois para fechar o gap. É a
> **Fase 2** do plano de 07/06 (a "página própria da empresa" decidida na entrada anterior): o scaffold
> de `/empresa/[id]` + o wiring da navegação. Todo o código já está na main (PR #38, merge `a60b01c`).

## [2026-06-08] Maguto | Fase 2: página /empresa/[id] scaffoldada + wiring (PR #38)

Sessão que materializa a Fase 2 decidida em 07/06. O scaffold da página tinha sido construído numa sessão
anterior (contexto compactado) mas **não commitado**; esta sessão fechou o commit, o wiring da navegação e
o merge. Branch `maguto/empresa-page` a partir da main. Commit `7e9f0ec`, merge `a60b01c` (PR #38).

**Página `/empresa/[id]` (`src/app/empresa/[id]/page.tsx`):**
- **Hero que rola embora:** back link com a origem (← Busca / ← Pipeline), razão social, CNPJ/município/
  fundação+idade/porte, e um bloco-resumo do score (número grande tier-colored + leitura `perfil_sucessorio`
  + `one_liner`).
- **Nav scroll-spy sticky** abaixo da Nav global (`top-[60px]`, empilhada com `z-30`), com chip de score
  persistente + ação primária "Salvar no pipeline". Destaque da seção ativa via `IntersectionObserver`
  (`rootMargin "-30% 0px -65% 0px"`), `scroll-mt-28` nas seções.
- **6 seções:** Sobre (campos da Receita instantâneos + camada enriquecida da IA com skeleton), Sócios
  (faixa etária, driver do score), Score (breakdown das 4 dimensões + cross-link "ver sócios →"),
  Investigar (auto-disparada ao abrir), Dossiê (sob demanda, abre com "Síntese a partir dos sinais
  investigados acima"), Similares (auto, critério explícito por CNAE/praça/porte).
- Estado "empresa não carregada" (link direto / refresh sem passar pela busca): fallback monocromático
  com link para a busca. Estados de erro na variante monocromática (sem cor de alarme), coerentes com o
  brand v3.

**Componentes extraídos para `src/components/empresa/` (agora a versão canônica):** `ResearchDisplay`,
`MemoDisplay` e `Timeline` saíram de inline na home para módulos compartilhados — a página da empresa passa
a ser a versão expandida e a home reusa os mesmos componentes (fonte única do vocabulário visual). Helpers
e constantes de apresentação (`FAIXA_LABEL`, `FAIXA_COLOR`, `TIER_STYLES`, `formatCnpj`, `formatTelefone`,
`formatCapitalCompact`, `anosOperacao`) centralizados em `src/lib/format.ts`.

**Ponte de navegação (`src/lib/empresa-store.ts`):** a home/pipeline já têm o objeto `Empresa` completo em
memória ao clicar; em vez de re-buscar no servidor (`GET /api/empresa/[id]` ainda não existia — domínio do
Guilherme), o objeto é guardado em `sessionStorage` e a página lê de lá. Única camada que conhece o
mecanismo → trivial de trocar por um fetch quando o endpoint existir. Racional em `decisions.md`.

**Wiring da navegação:**
- **Home (`page.tsx`):** o nome da empresa no card vira `Link` para `/empresa/${id}` com `storeEmpresa(e)` +
  `storeOrigin("busca")`; affordance "ver perfil →" aparece no hover. Os botões de ação do card
  (Investigar/Memo/Similares/Ver detalhes) seguem independentes — clicar no nome navega, as ações não.
- **Pipeline (`pipeline/page.tsx`):** link "Ver perfil completo →" dentro do card expandido, com
  `storeOrigin("pipeline")` — fica no detalhe aberto pra não conflitar com o accordion (header expande/
  recolhe). `Oportunidade.empresa` é `Pick<Empresa,…>` (não a `Empresa` cheia): resolvido com cast
  `as unknown as Empresa` — a página já lida com campos parciais nulos.

**Tratamento das barras do Score:** breakdown desenhado com barras **neutras (bone)**, seguindo a regra
brand v3 "cor de risco só comunica o total, nunca a sub-dimensão". *(Estado do momento; o tratamento das
barras voltou a ser discutido depois.)*

**Decisão deferida:** auto-trigger do Research ao abrir a página (custo ~$0.04/pageview na 1ª visita, zero
com cache) ficou como **decisão-com-Guilherme**, registrada no `pending.md` — não bloqueia o scaffold.

**Diagnóstico de ambiente:** durante a sessão, `npx tsc --noEmit` acusava dezenas de erros de sintaxe em
`.next/dev/types/routes.d.ts` (arquivo gerado pelo Next, com JSDoc truncado vazando do template). Causa: o
dev server ficou em estado inconsistente ao adicionar a rota nova com o server rodando. Não é erro de
código — reiniciar o dev (`npm run dev`) regenera o `.next` limpo e registra a rota.

**Resultado:** typecheck + eslint + `next build` verdes; `/empresa/[id]` aparece como `ƒ (Dynamic)` na
tabela de rotas; home e demais páginas intactas. PR #38 mergeado na main (`a60b01c`), branch deletada.

**Aprendizado:**
- Isolar o mecanismo de transporte de estado num único módulo (`empresa-store.ts`) deixa a página agnóstica
  de *como* a empresa chega — trocar `sessionStorage` por `GET /api/empresa/[id]` depois é mexer em 1 arquivo.
- Erro de sintaxe em massa vindo de `.next/dev/types/` é quase sempre dev server stale, não bug no fonte —
  reiniciar antes de caçar erro inexistente.
- Quando o tipo da fonte é um `Pick<>` parcial (`Oportunidade.empresa`) e o destino lida com campos nulos,
  o cast pontual é mais honesto que alargar o tipo do payload do pipeline só pra navegação.

---

> ⚠️ **Entrada retroativa (registrada em 11/06).** A sessão abaixo é de **08/06 (à noite)** — distinta e
> **posterior** ao scaffold da Fase 2 / PR #38 logado acima (aquele é a sessão da manhã). Não foi salva no
> brain do Boreal na época (só o segundo cérebro pessoal). Logada agora para fechar o gap. Todo o código já
> está na main: commits `120f015` → `138249b` → `a639e25` (push direto). É o passe de polish + correção de
> bugs da página da empresa, a criação do `GET /api/empresa/[id]` e a aplicação do `/review`.

## [2026-06-08] Maguto | Polish /empresa/[id] + GET /api/empresa/[id] + /review (sessão da noite)

Continuação do mesmo dia, depois do PR #38. Sessão de iteração guiada por sandbox (decisão visual no
sandbox HTML → aprovação → código) fechando os bugs da página da empresa, a navegação do pipeline e um
passe de `/review`. Branch de trabalho na main local; 3 commits pushados direto (mesmo fluxo combinado).

**De-dup concluído + card da home enxuto (`120f015`):**
- O PR #38 criou os componentes canônicos em `src/components/empresa/`, mas a home (`page.tsx`) ainda tinha
  cópias **inline** de `ResearchDisplay`/`MemoDisplay`/`Timeline` + helpers. Removidas as duplicatas (-355
  linhas) → a home importa do canônico e do `src/lib/format`.
- **4 botões de ação removidos do card da home** (Investigar/Memo/Similares/Ver detalhes): a página
  `/empresa/[id]` virou a versão expandida, então o card volta a ser só superfície de triagem. Removido
  também o "ver perfil →" do hover (causava layout shift jogando a linha olive pra baixo).

**Bugs da página da empresa corrigidos:**
- **Score reativo:** o número-herói usava `e.score?.score` estático (v0 do sessionStorage); passou a
  `research?.score_v1 ?? e.score?.score ?? 0` → número, tier, cor e chip da nav atualizam quando a
  investigação carrega. Badge de **delta** (`↑N`/`↓N`) no hero.
- **Bloco "Sinais — investigação com IA"** na seção Score: cada sinal qualitativo com seu peso em badge
  (`+12` terracota / `−25` neutro), espelhando o vocabulário do `ResearchDisplay`.
- **CNAEs secundários** viraram lista de tópicos (`·` olive centrado) em vez de boxes (box criava
  hierarquia indevida — atividade secundária é secundária).
- **Similares clicáveis:** cada similar vira `Link` pra `/empresa/[id]` (com `storeEmpresa`), badge de score
  por tier (antes todos floral), `% match` rotulado.
- Label "Memo de investimento" → "Dossiê" (alinha o nome interno ao externo).

**Barras do breakdown na cor do tier (`TIER_STYLES.bar`):** as 4 barras deixaram de ser neutras (bone) e
passaram a seguir a cor de risco da empresa (risk-high/70, risk-mid/70, bone/60). Iterado em sandbox (bone →
floral → terracota → cor do tier da empresa). Adotado o padrão do `/mercado` (track `bg-surface`, `h-2`).
Decisão registrada no brand guide (#16) — ver `decisions.md`.

**`GET /api/empresa/[id]` CRIADO (`138249b`) — ⚠️ cruzou pro domínio `api/` do Guilherme (avisar):**
- Raiz dos bugs de abrir empresa pela pipeline: `Oportunidade.empresa` é um `Pick<>` parcial (sem `socio`,
  `score`, `data_inicio_atividade`, `cnaes_secundarios`) → quadro societário vazio, sem barras de breakdown,
  score 0. O Maguto cravou a pergunta certa: "não é a mesma página da home? por que não funciona igual?" —
  é a mesma página; o que difere é o **dado que a alimenta**.
- Fix de raiz: a página deve **buscar os próprios dados pelo `id`**, não depender da bagagem do
  sessionStorage. Novo arquivo `src/app/api/empresa/[id]/route.ts` — GET que retorna a `Empresa` completa
  (sócios + `score` via `calcScore` + breakdown), espelhando a query da rota de research (incluindo
  `telefone`/`email`/`cnaes_secundarios`, que o select da research omite).
- A página agora **hidrata pelo id**: paint instantâneo do sessionStorage + `fetch(/api/empresa/${id})`
  quando o objeto vem parcial (pipeline) ou nulo (link direto). **Link direto e refresh passaram a
  funcionar**; o estado "não encontrada" só dispara em 404 real. A ponte sessionStorage vira só otimização
  de primeiro paint + overlay do score_v1.

**Overlay de score pós-investigação (`empresa-store.ts`):** `storeScoreConhecido`/`readScoresConhecidos`
guardam `{score, delta}` por empresa em sessionStorage. A página da empresa grava o `score_v1` ao investigar;
home e pipeline lêem o overlay ao montar **e ao voltar** (`pageshow` cobre o bfcache do botão voltar,
`focus` cobre re-foco da aba) → o card reflete o score atualizado. **Indicador de delta no card da home**
(`↑N`/`↓N`/`✓ IA`) sinaliza que a empresa já foi investigada.

**Pipeline card clicável como na home (`138249b`):**
- Nome da empresa virou `Link` pra `/empresa/[id]` (sintetiza `score` a partir do `score_no_save` pra não
  exibir 0 antes da hidratação). Botão "Ver perfil completo →" removido.
- Critério de clique: **mouse no nome abre a empresa; clicar no espaço em volta (header inteiro) expande/
  recolhe** o detalhe editável (hit area grande; o `+`/`−` minúsculo era difícil de acertar). `role="button"`
  + `tabIndex` + `onKeyDown` (Enter/Espaço) + `aria-expanded`; o `Link` do nome usa `stopPropagation`.
- Símbolo do expand: o **triângulo SVG da Metodologia** (`M1.5 2.5 L8.5 2.5 L5 7.5 Z`, rotaciona 180° ao
  abrir) no lugar do `+`/`−`. Badge do pipeline reflete o `score_v1` pós-investigação (o `score_no_save`
  original fica intacto no Dashboard do loop de outcome).

**`/review` da página da empresa (`a639e25`):** rodado o wrapper do impeccable (detector clean, ~33/40).
Aplicado:
- **Crítico — contraste:** Olive em captions informativas (nota das seções, "sócio desde", meta dos
  similares) reprova WCAG ~2,5:1 e a decisão #9 do brand guide → trocado por Bone/60 (caption) e Bone/70
  (metadata). Olive mantido só na assinatura "Dados públicos da Receita" e nos divisores `·`.
- **Rótulos distintos para os 2 grupos de sinais** da seção Score: "Sinais — investigação com IA" (web) ×
  "Sinais estruturais — da Receita" (determinísticos do `calcScore`) — antes o segundo grupo aparecia sem
  rótulo logo abaixo do primeiro, dava pra confundir.
- **Polish:** negativo com sinal de menos tipográfico (`−25`, não hífen ASCII), opacidades na escala
  (label `bone/70`, `% match` `bone/60`), `aria-live="polite"` no badge de score (anuncia v0→v1),
  redundância `${e.cnae_principal}` removida. Brand guide ganhou decisões #16 e #17.

**Caminho B (delta nas barras) — implementado e REVERTIDO:** chegou a existir um helper `breakdownAjustado`
(em `format.ts`) que redistribuía o ajuste da investigação sobre as 4 barras, com soma fechando exatamente em
`score_v1` (mapeamento sinal→dimensão + cascata por teto/piso, 100% no domínio do frontend, sem tocar
`research.ts`). Revertido a pedido do Maguto antes de commitar — segue como **pendência aberta** (o gráfico
ainda mostra o breakdown v0 enquanto o número mostra o v1).

**Resultado:** typecheck + `next build` (com a rota nova `ƒ /api/empresa/[id]`) verdes. Bugs de abrir
empresa pela pipeline resolvidos na raiz; navegação consistente por todos os caminhos (busca, pipeline, link
direto, refresh). Commits `120f015`/`138249b`/`a639e25` na main.

**Aprendizado:**
- A pergunta "não é a mesma página?" expôs o erro de arquitetura: a página dependia da bagagem do caller em
  vez de buscar o próprio estado. **A página deve ser dona do seu fetch por id** — o sessionStorage é
  otimização, não fonte de verdade. Um `Pick<>` parcial no caller (pipeline) é sintoma desse acoplamento.
- Os 3 sintomas (sócios vazio, barras ausentes, score 0) eram **um só** root cause. Vale rastrear o dado até
  a origem antes de remendar sintoma por sintoma (o synth do `score_no_save` foi paliativo até o endpoint).
- Overlay cross-página com `sessionStorage` precisa de `pageshow`/`focus` pra cobrir bfcache e re-foco —
  ler no mount só não basta quando o usuário volta pelo botão do navegador.
- Cruzar pro domínio do parceiro (criar rota em `api/`) é aceitável quando desbloqueia e é ~20 linhas
  espelhando código existente — mas **registrar e avisar** é parte do trabalho, não opcional.

---

> ⚠️ **Entrada retroativa (registrada em 11/06).** A sessão abaixo é de **08–09/06** e cobre o PR #39
> (pipeline remodel completo). Não foi salva no brain do Boreal na época — só o segundo cérebro pessoal
> foi atualizado. Commits `5b740f0` (remodel) + `2b24f8` (underline fix) → merge `41c62ee` na main.

## [2026-06-08/09] Maguto | Pipeline remodel — kanban → tabs por estágio + drag-to-reorder + undo (PR #39)

Sessão longa de reescrita do `src/app/pipeline/page.tsx` (~950 linhas, single-file). Motivação: o kanban
de 6 colunas espremía os nomes de empresa (ilegível em volume), gerava scroll infinito e não justificava
o custo — a mudança de estágio já era via `<Select>`, então não havia ganho real de drag. Decisão tomada
antes de codar: **layout = tabs por estágio + linhas de largura cheia, uma view por vez**.

**Arquitetura geral:**
- Tipo `ActiveTab = "agenda" | EstagioOportunidade` — 7 abas no total (Agenda + 6 estágios).
- Grid fixo por coluna: `COL = "14px 48px 1fr 155px 128px 175px auto 28px"` (grip · score · empresa ·
  dono+estágio · próxima ação · contato · notas · remove). Todas as linhas e o header compartilham o mesmo
  `grid-template-columns` — nenhum header desalinhado.
- Aba **Agenda**: fila operacional cross-stage (oportunidades com `proxima_acao_em` definida, de qualquer
  estágio, ordenadas por data/score). Não é um estágio do funil — é uma dimensão de trabalho. Detalhe:
  incluída na barra de tabs para navegabilidade, mas o conceito é distinto (pendência de separação visual).

**Drag-to-reorder (`@dnd-kit/sortable`):**
- Dependências: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.
- `SortableContext` + `useSortable` por row; `DndContext` wrapping a lista de cada aba.
- Ordem persistida em `localStorage["pipeline-order"]` como `Record<string, string[]>` (tab id →
  array de IDs de oportunidade ordenados). Lido no `useState` initializer (SSR-safe com `typeof window`).
- **Animação — translate-only:** `CSS.Transform.toString()` inclui `scaleX`/`scaleY`, o que achatava o
  card ao arrastar. Corrigido com string manual: `translate3d(0px, ${Math.round(transform.y)}px, 0)`.
- **Drag handle invisível:** `text-bone/0` + `group-hover:text-bone/25` não funciona em Tailwind v4 com
  CSS custom properties (a opacidade não cascateia corretamente). Solução: `opacity-25` no container div,
  `group-hover:opacity-50`, com o SVG sempre renderizado em `text-bone fill="currentColor"` (sem condicional
  no render). O `pointer-events-none opacity-0` cobre o caso "drag não disponível".
- `isDraggable = !scoreSort && !donoSort && !acaoSort` — drag desabilitado automaticamente quando qualquer
  sort está ativo (ordens conflitam).

**Sort toggles (3 estados: `asc | desc | null`):**
- Colunas: Score (`ScoreSort`), Dono (`boolean` para simples toggle), Próxima Ação (`ScoreSort`).
- Clicar cicla `null → "asc" → "desc" → null`. Indicador visual (chevron rotaciona, cor muda).
- Quando sort ativo: `isDraggable` desliga, custom order do localStorage é ignorado.

**DateInput — input nativo intacto + botão `showPicker()`:**
- Problema: tentativas de esconder o indicador nativo do `<input type="date">` (via
  `[&::-webkit-calendar-picker-indicator]:hidden` ou `opacity-0 [width:0px]`) quebravam a edição em texto.
- Solução: **não tocar no input**. Renderizar o `<input>` completamente limpo (sem classes que afetem o
  pseudo-elemento) + botão customizado ao lado que chama `ref.current?.showPicker()` num `try/catch`
  (browser support não universal). O usuário edita em texto clicando no input, abre o calendário pelo ícone.

**Dashboard expand/collapse:**
- Antes: só o triângulo do canto direito expandia. Depois: clicar em qualquer parte do header expande/
  recolhe (hit area maior, mais natural). `role="button"` + `tabIndex` + `onKeyDown` Enter/Espaço.

**Dono filter — migração Radix → Base UI Select:**
- O `<select>` nativo/Radix não respeitava o dark theme. Migrado para Base UI `Select` (já usado no
  estágio inline da row).
- Armadilha de tipo: a assinatura do `onValueChange` em Base UI é
  `(value: string | null, eventDetails: SelectValueChangeDetails) => void`, não `(value: string) => void`.
  Fix: `onValueChange={(v) => setFiltroDono(v ?? "todos")}`.

**Undo Ctrl+Z — `useRef` em vez de `useState`:**
- `lastActionRef = useRef<UndoAction | null>(null)` — **não** `useState`. Razão: o handler de `keydown`
  é registrado no `useEffect` com `[activeTab]` na dep array; se `lastActionRef` fosse estado, o closure
  do handler capturaria o valor no momento do registro (stale closure clássico). Com `useRef`, o handler
  sempre lê `.current` que reflete o valor atual.
- Tipo `UndoAction = { type: "patch"; id: string; previousCampos: Partial<Oportunidade> } | { type: "remove";
  oportunidade: Oportunidade }`.
- Undo de remoção: POST para recriar + PATCH para restaurar campos → estado local restaurado otimisticamente,
  ID atualizado após confirmação do servidor.

**Toast de remoção:**
- `useState<string | null>(null)` com `toastTimerRef` (ref do timeout para cancelar/resetar).
- Ao remover: mensagem `"${nome} removida do pipeline"` + botão "Desfazer" que chama `performUndo()`.
- Posicionado `fixed bottom-6 left-1/2 -translate-x-1/2 z-50`.

**Keyboard nav ← → entre tabs:**
- `useEffect` com listener `window.addEventListener("keydown", onKey)`.
- `ALL_TABS: ActiveTab[] = ["agenda", ...ESTAGIOS.map(s => s.id)]` — lista ordenada de todas as abas.
- Guarda: `!!target.closest("input, textarea, select")` — não captura quando foco está num campo de texto.
- Ctrl+Z no mesmo handler (não conflita com a guarda de input).

**Worklist deletada:**
- `src/app/worklist/page.tsx` removido integralmente.
- `Nav.tsx`: entrada `{ href: "/worklist", label: "Worklist" }` removida do array `FLUXO`.
- Erro de TS pós-deleção (`validator.ts` em `.next/types/` com referência cacheada): resolvido deletando
  a pasta `.next` e re-rodando `tsc`.

**Tab underline fix (`2b24f8`):**
- O indicador da aba ativa estava deslocado à direita do texto. Causa: `mr-0.5 pr-3` no `TabButton`
  criava espaço extra que o underline cobria. Fix: `mr-4` (só margem entre botões, sem padding extra).

**Resultado:** typecheck + `next build` verdes. PR #39 aberto e mergeado na main (`41c62ee`). Itens
não implementados registrados em `brain/pending.md` para handoff ao Guilherme: botão "+" da atividade
com box própria, view geral cross-stage, separação visual Agenda/estágios, info de setores na home,
review com impeccable no final.

**Aprendizado:**
- `CSS.Transform.toString()` sempre inclui `scaleX`/`scaleY = 1` no output, o que causa reflow visual
  ao arrastar mesmo quando os valores são neutros. Para drag vertical puro, montar a string manualmente
  (`translate3d(0, Ypx, 0)`) é mais seguro e predizível.
- Tailwind v4 com CSS custom properties e modificadores de opacidade (`text-bone/25`) é não-confiável
  para valores que precisam transicionar (group-hover). A abordagem `opacity-X` no container é mais
  robusta e agnóstica da engine de CSS.
- `useRef` para estado de undo evita toda a classe de bugs de stale closure sem precisar de dep array
  pesada. Regra prática: se o estado só é lido dentro de handlers de evento (não renderizado), `useRef`
  é mais correto que `useState`.

---

> ⚠️ **Entrada retroativa** — registrada em 2026-06-11. A sessão de 2026-06-10 (alinhamento das
> colunas do pipeline) não foi salva no brain do Boreal na época; este registro fecha o gap. O código
> já estava na main desde o merge do PR #40 (`eb569e3`).

## [2026-06-10] Maguto | Alinhamento das colunas do pipeline + polish (PR #40)

Sessão de polish de UI. PR #40 mergeado na main (squash `eb569e3`); commit de trabalho `3d1463e`
(5 arquivos, +257/-138). Foco: o desalinhamento sistemático entre os títulos do header e os dados das
linhas no pipeline.

**Causa raiz do desalinhamento (a parte que importa):**
- O grid `COL` tinha **duas** colunas flexíveis: `1fr` (Empresa) e `auto` (Notas). A coluna `auto`
  dimensiona pelo conteúdo — no header é o texto curto `Notas` (~38px), nas linhas é o botão
  `+ NOTA`/`notas` com borda+padding (~72px). Como `auto` ficava mais larga nas linhas, ela roubava
  largura da única outra coluna flexível (`1fr` Empresa), deslocando **todas** as colunas após Empresa
  (Dono, Próxima ação, Contato) ~34px para a esquerda nas linhas em relação ao header.
- **Fix:** `COL` Notas `auto → 92px` (fixa), deixando `1fr` como a única coluna flexível e, portanto,
  idêntica em header e linhas. `COL` final:
  `"14px 48px 1fr 144px 128px 175px 92px 28px"`.
- **Drift residual de 1px:** o `<li>` das linhas tem `border` e o header não. Header ganhou
  `border-x border-x-transparent` para igualar o box model e zerar o drift.

**Coluna Dono/Estágio:**
- Largura `155px → 144px`.
- Nome do dono e chip (Estágio/Resultado) alinhados à esquerda (antes centralizados): input com
  `text-left pl-2.5`, chips sem `mx-auto`. O `pl-2.5` alinha o início do nome com o texto do chip.
- Título do header alinhado sobre o dado: `pl-[18px]` = `px-2` (8px) do container + `pl-2.5` (10px) do
  input/chip. (Tentativa anterior com `pl-2` só compensava o `px-2` e deixava ~10px de defasagem.)

**Chips Estágio/Resultado (`EstagioChip`/`ResultadoChip`):**
- Construídos sobre `@base-ui/react/select` (não Radix). `SelectValue` traz `flex-1 text-left` embutido
  e `SelectTrigger` traz `justify-between` — ambos atrapalhavam o alinhamento.
- Solução: chevron posicionado em absoluto (`[&>svg]:absolute right-1 …`), `SelectValue` com
  `flex-none text-left`, trigger `justify-start w-fit` com padding assimétrico `pl-2.5 pr-5` (respiro à
  esquerda, folga para o chevron à direita).

**Demais polish no mesmo commit (vinham acumulados, não commitados):**
- Drag-to-reorder passou a coexistir com ordenação (remove o gate `isDraggable`; ao arrastar, a lista
  visível ordenada é commitada como `customOrder` e os sorts são limpos).
- Score sort passou a usar `scoreOverrides` (`score_v1` da investigação) em vez de só `score_no_save` —
  alinha o sort ao valor exibido.
- `PipelineSkeleton` (loading skeleton substituindo render vazio); `Chevron`/`Stat` içados para escopo
  de módulo; `carregar()` inlinado no `useEffect` com guard `ativo`; import `CSS` não usado removido
  (resolve erros de lint `static-components` e `set-state-in-effect` em `pipeline/page.tsx`).
- Tokens de opacidade normalizados para a escala `/100 · /70 · /60 · /45`; `focus-visible:ring` nos
  interativos que faltavam; `aria-pressed` no toggle "Só atrasadas".
- `globals.css`: token `--color-overlay` (#1c1d17, substitui `bg-[#1c1d17]` hard-coded em dropdowns/toast)
  + bloco global `@media (prefers-reduced-motion: reduce)`.
- `/empresa/[id]`: fix do warning de React key na lista de sócios — `key={s.id ?? \`${s.nome}-${i}\`}`
  (a ponte de sessionStorage entrega sócios sem `id`).
- Home (`page.tsx`): cards clicáveis (abrem a empresa) com guardas para **não** capturar clique sobre
  texto/boxes de dados (preserva seleção/cópia); sem `cursor-pointer` para o cursor I-beam aparecer
  naturalmente sobre o texto.
- `MemoDisplay.tsx`: movimentação societária — helper `partesEvento()` separa nome (sempre `floral`) do
  status (colorido por tipo: saiu→risk-high, envelheceu→risk-mid, entrou→floral/60); legenda reescrita
  explicando a detecção por snapshot.

**Nota factual sobre o PR #40 mergeado:** o squash `eb569e3` inclui 3 arquivos a mais que o commit
desta sessão (`src/app/icon.svg`, `src/app/layout.tsx`, `src/app/opengraph-image.tsx` — favicon +
OpenGraph). Esses **não** são desta sessão; foram adicionados à branch por outro contribuidor antes do
merge.

**Estado:** validado manualmente no browser (Dono, Próxima ação, Contato e Notas alinhados com seus
dados). PR #40 mergeado na main.

**Aprendizado:**
- Grid com **duas** colunas flexíveis (`1fr` + `auto`) usado em header e linhas separados quebra o
  alinhamento sempre que o conteúdo da `auto` difere entre os dois — a `auto` "rouba" largura da `1fr`
  de forma diferente em cada um. Regra: deixar **uma só** coluna flexível; fixar todas as outras.
- Box model precisa bater entre header e linhas: se a linha tem `border` e o header não, há drift de
  1px. Igualar com `border-transparent`.
