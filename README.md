# Boreal

Deal sourcing de M&A por **risco sucessório**. Boreal encontra empresas familiares no middle market
brasileiro cujo controle tende a mudar de mãos (dono envelhecendo, sem sucessor no quadro) e prioriza
quem abordar, a partir de uma tese em linguagem natural. É o motor de originação do Relay.

## Por que é diferente

O moat não é a interface, é o **ativo de dado que compõe**:

- **Ground truth de M&A minerado de graça** — transições do quadro societário no CNPJ (PJ entra + PF sai
  entre dois snapshots) dão milhares de aquisições reais rotuladas, sem comprar base. Ver `scripts/`.
- **Score de sucessão validado por vertical, sem leakage** — heurística determinística (idade do sócio,
  antiguidade, porte, quadro plural) calibrada contra as aquisições reais. Em metalmecânica, 67% das
  aquisições caíram no top 10% do score. Ver `src/lib/scoring.ts`.
- **Sensor forward** — a mudança societária é minerada continuamente, então dá pra ver o controle mudar,
  não só a foto estática que os concorrentes vendem.
- **Research + dossiê AI-native** — o agente lê a web e o site oficial da empresa e devolve perfil,
  gatilho de timing, red flags e um rascunho de abordagem. Score qualitativo v0 → v1.

## Stack

- **Next.js 16** (App Router, Turbopack) + React 19 + TypeScript + Tailwind v4.
- **Supabase** (Postgres) — empresas, sócios e o pipeline de originação (`oportunidade`, `interacao`).
- **BigQuery / Base dos Dados** (`br_me_cnpj`) — mineração de ground truth, universo e enriquecimento.
- **Anthropic API** — parser de query, reasoner, research agent e dossiê. Cache gerado via assinatura
  (custo zero) pros demos.

## Rodando local

1. `npm install`
2. Copie `.env.example` para `.env.local` e preencha (Supabase, Anthropic, GCP/BigQuery).
3. Aplique as migrations em `supabase/migrations/` no seu projeto Supabase.
4. `npm run dev` → http://localhost:3000
5. `npm test` roda os testes do score (runner nativo do Node).

### Gate de acesso (piloto)

Setando `BOREAL_GATE_PASSWORD` (+ `BOREAL_GATE_SECRET`) o app fica privado: pede a senha em `/acesso` e
libera por 30 dias. Sem a env, fica aberto (dev/local). Ver `src/middleware.ts`.

## Mapa do código

| Caminho | O quê |
|---|---|
| `src/app/` | páginas (home, pipeline, empresa, heat-map, validação, mercado…) + rotas de API |
| `src/lib/scoring.ts` | score de sucessão (IP determinístico) + testes em `scoring.test.ts` |
| `src/lib/research.ts` · `dossier.ts` | research agent e memo (LLM) |
| `src/lib/heatmap.ts` · `treemap.ts` | heat-map de atividade de M&A por setor/região |
| `src/lib/proveniencia.ts` | selo de proveniência do lead (prova de origem pro success fee) |
| `scripts/` | mineração, validação e build de caches (BigQuery). `sonda-*` e `valida-*` são análises pontuais |
| `supabase/migrations/` | schema do Postgres |

> Domínio em português (dados brasileiros: `empresa`, `socio`, `oportunidade`). Código e commits em inglês.
