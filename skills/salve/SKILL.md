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

## Passo 4 — Commit (na branch pessoal, nunca na main)

Confirmar `git branch --show-current`. Se estiver na `main`, criar branch pessoal antes
(`git config user.name` → `gui`/`maguto` → `git checkout -b <prefixo>/<slug>`).

```
git add <arquivos> brain/
git commit -m "<tipo>: <resumo específico em inglês>"
```

Tipos: `feat:` `fix:` `chore:` `docs:` `data:`. Um commit por mudança lógica.

## Passo 5 — Integrar e publicar (automático, avisando)

1. `git fetch origin` + `git pull --rebase origin main` → avisa "rebase ok" ou para se conflitar.
2. Perguntar: "Push da branch `<nome>` + abrir PR pra main?"
3. Se sim: `git push origin <branch>` → `gh pr create --fill --base main --head <branch>`
   (sem `gh`: mostrar link `compare/main...<branch>`).
4. **Nunca** `push origin main` direto, **nunca** `--force`. Main só via PR.

(Detalhe completo em `.claude/commands/salve.md`.)

## Passo 6 — Confirmar

Resumo do que foi atualizado + branch + hash do commit + status do PR + próximo passo.

## Regras

- `progress.md` append-only · nunca commitar secret · **nunca commitar/pushar na main** ·
  push só com confirmação · conflito → resolver (nunca `--force`) · commits em inglês · tom direto.
