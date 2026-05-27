---
description: Flush de fim de sessão do projeto Boreal — captura o que foi feito, atualiza brain/progress.md + pending.md + decisions.md, commita e (com confirmação) faz push. Rodar antes de fechar a sessão.
---

# /salve

Flush completo de fim de sessão. Persiste tudo que aconteceu no brain do projeto pra que a próxima pessoa (você ou o Maguto) abra o repo e saiba exatamente onde parou. Você está rodando dentro da pasta do repo (working directory atual).

---

## Passo 1 — Revisar a sessão (sem output)

Revise mentalmente TUDO que aconteceu nesta sessão:

- **Código:** arquivos criados/alterados, scripts que rodaram, o que passou/falhou
- **Dados:** ingest rodado, tabelas populadas, queries validadas
- **Decisões:** escopo, stack, nome, lógica de scoring, escolha de abordagem
- **Aprendizados:** o que travou, o que surpreendeu, gotcha que vale registrar (alimenta o Loom)
- **Pendências:** o que ficou resolvido, o que abriu, o que vem agora

## Passo 2 — Atualizar o brain

**`brain/progress.md`** (append-only — NUNCA sobrescrever):

Adicione uma entrada acima da linha `*(append novas entradas abaixo desta linha)*`:

```markdown
## [YYYY-MM-DD] <quem> | <título da sessão>

<2-5 linhas do que foi feito>

- <bullet de mudança concreta>
- <bullet de mudança concreta>

**Resultado:** <evidência — números, "passou", "X linhas inseridas">
**Aprendizado:** <se houver algo que vale pro Loom ou pra próxima sessão>
```

**`brain/pending.md`:**
- Marcar `[x]` no que foi concluído
- Adicionar novos itens que surgiram
- Mover o foco pro próximo passo real

**`brain/decisions.md`** (só se houve decisão que muda escopo/stack/nome/lógica):

```markdown
## [YYYY-MM-DD] <título da decisão>

**Contexto:** <por que precisou decidir>
**Decisão:** <o que foi decidido + alternativa descartada>
**Status:** ✅ Tomada.
```

**`CLAUDE.md` seção 7 (Estado atual):** se o estado macro do projeto mudou, atualize o parágrafo.

## Passo 3 — Verificação rápida

- `brain/progress.md` teve append (não substituição)?
- `pending.md` reflete a realidade pós-sessão?
- Algum arquivo de secret prestes a ser commitado por engano? (`.env.local`, `.gcp/*.json` — devem estar gitignored)

```
git status --short
```

Se um secret aparecer no staging, **pare e remova** antes de commitar.

## Passo 4 — Commit

Stage os arquivos relevantes (preferir nomear, evitar `git add .` cego) e commite.
Mensagem em inglês, dizendo **o quê + porquê** (vira o changelog da jornada pro Loom):

```
git add <arquivos> brain/
git commit -m "<tipo>: <resumo específico>"
```

Convenções de tipo: `feat:`, `fix:`, `chore:`, `docs:`, `data:` (ingest/pipeline).

Um commit por mudança lógica quando fizer sentido — não um megacommit.

## Passo 5 — Push (com confirmação)

Pergunte antes de pushar: **"Push pra origin/main agora?"**

Se sim:
```
git push origin main
```

Se falhar com "rejected" (Maguto pushou algo):
```
git pull --rebase origin main
git push origin main
```

Nunca `--force`.

## Passo 6 — Confirmar

Output exato:

```
✓ Sessão salva — DD/MM/YYYY

Atualizado:
  brain/progress.md  (nova entrada)
  brain/pending.md   (N concluídos, M novos)
  [brain/decisions.md  (se houve)]
  [CLAUDE.md          (se mudou estado)]

Commit: <hash> <mensagem>
[Pushed para origin/main. | Não pushei — commit local só.]

Próximo passo: <o foco da próxima sessão, do pending.md>
```

---

## Regras

- **`progress.md` é append-only** — nunca sobrescrever entrada anterior
- **Nunca commitar secret** — checar staging no Passo 3
- **Push só com confirmação** — respeita a regra de não publicar sem autorização
- **Conflito de push** → `pull --rebase`, nunca `--force`
- **Commits específicos em inglês** — "feat: ingest 2000 empresas via BigQuery" > "update"
- Tom direto, sem explicação desnecessária no output
