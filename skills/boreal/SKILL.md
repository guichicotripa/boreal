---
name: boreal
description: >
  Liga o contexto do projeto Boreal — carrega CLAUDE.md, brain/ (progress, decisions,
  pending) e o estado do git/banco, e faz um briefing compacto de onde o projeto está.
  Rodar no início de cada sessão.
  Triggers: "boreal", "/boreal", "liga o projeto", "onde paramos", "contexto do projeto".
---

# /boreal — boot do projeto

> Esta skill é o espelho documentado do comando `.claude/commands/boreal.md`.
> Dentro do repo, o comando `/boreal` já funciona automaticamente (vem com o `git clone`).
> Esta versão existe pra consistência com o padrão do segundo cérebro do Guilherme.

Carrega todo o contexto pra começar a sessão sabendo o que já foi feito e o que vem agora.

## Fase 1 — Carregar (paralelo, sem output bruto)

1. `CLAUDE.md` — o que é, quem, stack, convenções, regras
2. `AGENTS.md` — regras do Next.js 16
3. `brain/progress.md` — últimas 2-3 entradas
4. `brain/decisions.md` — decisões + porquê
5. `brain/pending.md` — o que está em aberto

## Fase 1.5 — Estado do código

```
git log --oneline -8
git status --short
git branch --show-current
```

Nunca imprimir valores de `.env.local`.

## Fase 2 — Briefing compacto

```
=== BOREAL — DD/MM/YYYY ===

PROJETO: AI research agent · deal sourcing PE/M&A · metalmecânica interior SP

ESTADO ATUAL:
  ✅ [o que está pronto]
  🔜 [próximo passo]

DADOS:
  [empresas / sócios no Supabase]

DEADLINES:
  🔥 [próximo marco] em X dias

ÚLTIMOS COMMITS:
  [3-5 commits]

EM ABERTO:
  → [itens do pending.md]

Pronto. O que vamos trabalhar?
```

## Pull on demand

`mostra progresso` · `mostra decisões` · `mostra pending` · `mostra schema` · `mostra commits`

## Comportamento

Tom direto, português default, código/commits em inglês. O Maguto está aprendendo — definir
conceito técnico em uma frase antes de usar. Aguardar instrução após o briefing.
