---
description: Liga o contexto do projeto Boreal — lê CLAUDE.md + brain/ + estado do git e do banco, e faz um briefing compacto de onde o projeto está. Rodar no início de cada sessão.
---

# /boreal

Boot do projeto Boreal. Carrega todo o contexto pra você (ou o Maguto) começar a sessão sabendo exatamente o que já foi feito e o que vem agora. Você está rodando dentro da pasta do repo (working directory atual) — leia tudo por path relativo.

---

## Fase 1 — Carregar contexto (paralelo, sem exibir conteúdo bruto)

Leia em paralelo:

**Schema / regras:**
1. `CLAUDE.md` — o que é o projeto, quem, stack, convenções, regras pro agente
2. `AGENTS.md` — regras do Next.js 16 (breaking changes vs. conhecimento de treino)

**Brain do projeto:**
3. `brain/progress.md` — o que foi feito, sessão por sessão (lê as últimas 2-3 entradas)
4. `brain/decisions.md` — decisões tomadas + porquê
5. `brain/pending.md` — próximos passos / o que está em aberto

Arquivos ausentes: pular silenciosamente.

## Fase 1.5 — Estado do código e dados

Rode (sem expor segredos):

```
git log --oneline -8
git status --short
git branch --show-current
```

Se quiser confirmar o estado do banco e for rápido, cheque quantas linhas existem
(`scripts/check-supabase.mjs` confirma conexão; uma contagem em `empresa`/`socio` confirma dados).
**Nunca imprima valores de `.env.local`** — só diga quais variáveis estão setadas, se relevante.

## Fase 2 — Briefing compacto

Output exato neste formato (preencha com o que carregou):

```
=== BOREAL — DD/MM/YYYY ===

PROJETO: AI research agent · deal sourcing PE/M&A · metalmecânica interior SP (CNAE 24/25/28)

ESTADO ATUAL:
  ✅ [o que já está pronto — 2-4 linhas]
  🔜 [próximo passo imediato]

DADOS:
  [empresas / sócios no Supabase, fonte BigQuery — se aplicável]

DEADLINES:
  🔥 [próximo marco do Clube] em X dias

ÚLTIMOS COMMITS:
  [3-5 commits recentes, um por linha]

EM ABERTO (pending.md):
  → [item 1]
  → [item 2]
  → [item 3]

Pronto. O que vamos trabalhar?
```

## Pull on demand

Após o briefing, aceite:
- `mostra progresso` → `brain/progress.md` completo
- `mostra decisões` → `brain/decisions.md`
- `mostra pending` → `brain/pending.md`
- `mostra schema` → `supabase/migrations/`
- `mostra commits` → `git log` mais longo

Os dados já foram carregados — não re-fetch o que já leu.

## Fallback

- Arquivo ausente → omitir, continuar
- Conflito de merge no git → mencionar ANTES do briefing
- Não está num repo git → avisar e seguir só com o brain/

## Comportamento

- Tom direto, sem preâmbulo, sem bajulação
- Português default (código/commits em inglês)
- Aguardar instrução após o briefing
- Lembrar: o Maguto está aprendendo — se explicar algo técnico, definir em uma frase
