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

*(append novas entradas abaixo desta linha)*
