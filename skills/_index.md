# skills/

Skills do **Claude Code** que automatizam o fluxo de trabalho colaborativo no Boreal.

> O objetivo: qualquer um (Guilherme ou Maguto) abre o repo no Claude Code, roda `/boreal`
> e já sabe tudo que foi feito e o que vem agora. No fim, roda `/salve` e o progresso fica
> registrado pro outro continuar de onde parou.

## Skills disponíveis

| Skill | Quando usar | O que faz |
|-------|-------------|-----------|
| [`boreal/`](./boreal/SKILL.md) | Início de sessão | Carrega CLAUDE.md + brain/ + estado do git e faz briefing compacto |
| [`salve/`](./salve/SKILL.md) | Fim de sessão | Atualiza progress/pending/decisions, commita, push (com confirmação) |

## Loop de trabalho ideal

```
Início:   /boreal    → carrega contexto, vê onde parou, começa
(durante) trabalha normalmente — código, ingest, queries
Fim:      /salve      → persiste no brain, commita, push pro outro ver
```

## Como funciona — dois caminhos

O Boreal tem as skills em **dois lugares**, e os dois funcionam:

### 1. `.claude/commands/` — funciona automático (recomendado)

Os arquivos em `.claude/commands/boreal.md` e `.claude/commands/salve.md` vêm junto com o
`git clone`. **Não precisa instalar nada** — basta abrir o Claude Code dentro da pasta `boreal/`
e digitar `/boreal` ou `/salve`. Esse é o caminho pro Maguto: clonar e usar.

### 2. `skills/` — instalação global (opcional)

Os `SKILL.md` aqui são a versão documentada. Se quiser que as skills fiquem disponíveis em
qualquer projeto (não só dentro do `boreal/`), copie pra pasta global do Claude Code:

**Windows (PowerShell):**
```powershell
New-Item -ItemType Directory -Force "$HOME\.claude\skills"
Copy-Item -Recurse "$PWD\skills\*" "$HOME\.claude\skills\"
```

**Mac/Linux:**
```bash
mkdir -p ~/.claude/skills
cp -r ./skills/* ~/.claude/skills/
```

Pro fluxo do Boreal, o caminho 1 basta — clonou, funciona.

## Onboarding do Maguto (resumo)

1. `git clone https://github.com/<owner>/boreal`
2. `cd boreal && npm install`
3. Copiar `.env.example` → `.env.local` e preencher as chaves (pedir ao Guilherme)
4. Abrir Claude Code na pasta → digitar `/boreal`
5. Trabalhar → `/salve` no fim

## Anatomia de uma skill

Cada skill tem um `SKILL.md` com frontmatter YAML (`name`, `description` com triggers) +
instruções em markdown. O comando equivalente em `.claude/commands/{nome}.md` tem o mesmo
conteúdo, auto-suficiente, e é o que de fato dispara dentro do repo.

## Ideias futuras

- `/pipeline` — roda o ingest + valida contagens no Supabase num passo só
- `/demo` — checa se os 3 demos canned estão funcionando antes da reunião
- `/loom` — monta o roteiro do vídeo a partir do `progress.md`
