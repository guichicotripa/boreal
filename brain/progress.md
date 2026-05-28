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
