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
