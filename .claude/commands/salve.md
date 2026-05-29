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

## Passo 4 — Commit (sempre na branch pessoal, nunca na main)

Antes de commitar, confirme a branch:
```
git branch --show-current
```

- Se está numa branch pessoal (`gui/...` ou `maguto/...`) → segue normal.
- **Se está na `main`** (alguém pulou o `/boreal`): crie a branch agora antes de commitar.
  Descubra a identidade (`git config user.name`) → prefixo `gui` ou `maguto` →
  `git checkout -b <prefixo>/<slug>` e avise: `🌿 Você estava na main; movi pra <branch>.`

Stage os arquivos relevantes (preferir nomear, evitar `git add .` cego) e commite.
Mensagem em inglês, dizendo **o quê + porquê** (vira o changelog da jornada pro Loom):

```
git add <arquivos> brain/
git commit -m "<tipo>: <resumo específico>"
```

Convenções de tipo: `feat:`, `fix:`, `chore:`, `docs:`, `data:` (ingest/pipeline).

Um commit por mudança lógica quando fizer sentido — não um megacommit.

## Passo 5 — Integrar com a main e publicar (automático mas avisando)

Modo: **executa os passos de git sozinho, avisando cada um em 1 linha**. A única confirmação
pedida é antes de publicar pro remoto (push). O Maguto aprende vendo o que acontece.

1. **Rebase com a main remota** (traz o que o outro pushou, evita o conflito clássico):
   ```
   git fetch origin
   git pull --rebase origin main
   ```
   Avise: `🔄 Rebase com a main: sem conflitos.` ou, se houver conflito:
   `⚠️ Conflito em <arquivos> — pare e resolva. Nunca use --force.`
   Se conflitar, **não prossiga** pro push até estar resolvido.

2. **Pergunte antes de publicar:** **"Push da branch `<nome>` + abrir PR pra main?"**

3. Se sim:
   ```
   git push origin <branch>
   ```
   Avise: `⬆️ Branch publicada.`
   Então ofereça abrir o PR (precisa do `gh` CLI):
   ```
   gh pr create --fill --base main --head <branch>
   ```
   - Se `gh` existe e autenticado → cria e mostra a URL do PR.
   - Se `gh` não existe → mostre o link manual:
     `https://github.com/guichicotripa/boreal/compare/main...<branch>?expand=1`

4. **Nunca** `git push origin main` direto, **nunca** `--force`. A main só recebe via PR mergeado.

> Por que PR e não push direto na main? Assim o outro vê o que mudou antes de entrar, a main
> nunca quebra, e fica um histórico do que cada um fez (útil pro Loom). Merge do PR pode ser
> feito pelo GitHub (botão) ou no fim, quando os dois revisarem juntos.

## Passo 6 — Confirmar

Output exato:

```
✓ Sessão salva — DD/MM/YYYY

Atualizado:
  brain/progress.md  (nova entrada)
  brain/pending.md   (N concluídos, M novos)
  [brain/decisions.md  (se houve)]
  [CLAUDE.md          (se mudou estado)]

Branch: <branch> (você = gui|maguto)
Commit: <hash> <mensagem>
[PR aberto: <url> | Branch publicada, PR pendente | Não publiquei — commit local só.]

Próximo passo: <o foco da próxima sessão, do pending.md>
```

---

## Regras

- **`progress.md` é append-only** — nunca sobrescrever entrada anterior
- **Nunca commitar secret** — checar staging no Passo 3
- **Nunca commitar/pushar na `main`** — sempre branch pessoal + PR
- **Push só com confirmação** — respeita a regra de não publicar sem autorização
- **Conflito de rebase** → parar e resolver, nunca `--force`
- **Commits específicos em inglês** — "feat: ingest 2000 empresas via BigQuery" > "update"
- Tom direto, sem explicação desnecessária no output
