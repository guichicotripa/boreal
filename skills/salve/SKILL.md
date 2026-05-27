---
name: salve
description: >
  Flush de fim de sessão do projeto Boreal — captura o que foi feito e atualiza
  brain/progress.md + pending.md + decisions.md, commita e (com confirmação) faz push.
  Sempre rodar antes de fechar a sessão.
  Triggers: "salve", "salva", "salva a sessão", "fecha a sessão", "flush".
---

# /salve — flush de fim de sessão

> Espelho documentado do comando `.claude/commands/salve.md`.
> Dentro do repo, `/salve` já funciona automaticamente.

Persiste tudo que aconteceu pra que a próxima pessoa abra o repo e saiba onde parou.

## Passo 1 — Revisar a sessão (sem output)

Código alterado · dados ingeridos · decisões · aprendizados (pro Loom) · pendências.

## Passo 2 — Atualizar o brain

- **`brain/progress.md`** — append nova entrada (NUNCA sobrescrever), formato:
  `## [YYYY-MM-DD] <quem> | <título>` + bullets + **Resultado:** + **Aprendizado:**
- **`brain/pending.md`** — marcar `[x]` concluídos, adicionar novos
- **`brain/decisions.md`** — só se houve decisão de escopo/stack/nome/lógica
- **`CLAUDE.md` seção 7** — se o estado macro mudou

## Passo 3 — Verificação

```
git status --short
```

Se `.env.local` ou `.gcp/*.json` aparecerem no staging → **parar e remover**.

## Passo 4 — Commit

```
git add <arquivos> brain/
git commit -m "<tipo>: <resumo específico em inglês>"
```

Tipos: `feat:` `fix:` `chore:` `docs:` `data:`. Um commit por mudança lógica.

## Passo 5 — Push (com confirmação)

Perguntar "Push pra origin/main agora?". Se sim, `git push origin main`.
Conflito → `git pull --rebase origin main` → push. Nunca `--force`.

## Passo 6 — Confirmar

Resumo do que foi atualizado + hash do commit + status do push + próximo passo.

## Regras

- `progress.md` append-only · nunca commitar secret · push só com confirmação ·
  conflito → rebase · commits específicos em inglês · tom direto.
