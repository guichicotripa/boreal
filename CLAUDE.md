@AGENTS.md

# Boreal — Brain do Projeto

> Entry point. Todo agente (Claude Code) e todo humano novo no repo lê **isto primeiro**.
> Modelo enxuto inspirado no "segundo cérebro" do Guilherme, focado num produto de 4 semanas.

---

## 1. O que é

**Boreal** é um *AI-native research agent para deal sourcing em PE/M&A no middle market
brasileiro*. Foco: empresas familiares com **succession risk** — sócios envelhecendo, sem
plano sucessório evidente, sem mudança societária recente.

**Nicho inicial:** metalmecânica / indústria média no interior de SP + Sul.
CNAEs **24** (metalurgia básica), **25** (produtos de metal), **28** (máquinas e equipamentos).

**Por que existe:** competição **Clube da Programação** (organizada por Laura Dubugras).
4 semanas, prêmio **US$ 10.000** (patrocínio Cognition). Submissão = Loom de 1 minuto.

| Data | Marco |
|------|-------|
| 2026-06-02 20h | Reunião 2 — mostrar progresso Semana 1 |
| 2026-06-09 20h | Reunião 3 — produto demoável |
| **2026-06-14** | **Deadline submissão (Loom 1min)** |
| 2026-06-16 20h | Reunião 4 — Demo Day ao vivo |

**Critério de julgamento:** mais subjetivo do que objetivo — pesa **progresso pessoal** e o que
cada um conseguiu realizar/aprender. Implicação: o Loom precisa contar a jornada (o que
aprendemos a construir em 4 semanas), não só exibir um produto pronto. Por isso `progress.md`
importa tanto quanto o código.

---

## 2. Quem

| Pessoa | Frente | Nunca delega / sempre puxa |
|--------|--------|-----------------------------|
| **Guilherme Augusto** | arquitetura, prompts, lógica de scoring/ranking, integração LLM | prompts, scoring, arquitetura |
| **Maguto** | UI, copy da landing, busca/limpeza de dados, gravação/edição do vídeo | autonomia crescente da semana 3 em diante |

Ambos usam **Claude Code**. Dividem o prêmio se ganhar.

---

## 3. O produto — demo de 60 segundos

**Input** em linguagem natural:
> *"empresas de metalmecânica no interior de SP, EBITDA estimado 10–50M, sócios acima de 60
> anos, sem sucessão evidente."*

**Output** em ~30s: lista priorizada de empresas reais (CNPJ, site, sócios) com **score de
succession risk** + **dossier curto** por empresa (overview, sinais, perguntas pra abordagem).

Tagline: *"o gargalo do deal sourcing colapsado de 2 semanas pra 30 segundos."*

---

## 4. Stack

> ⚠️ **Next.js 16** (não 15) — tem breaking changes em relação ao conhecimento de treino do
> agente. Antes de escrever código de framework, consultar `node_modules/next/dist/docs/`.

| Camada | Ferramenta | Versão |
|--------|-----------|--------|
| Frontend | Next.js (App Router) + TypeScript | 16.x |
| UI | Tailwind + shadcn/ui | Tailwind v4 |
| Backend / DB | Supabase (Postgres + Auth) | — |
| LLM | Claude API (Sonnet 4.6 default; Opus 4.7 pontual) | — |
| Dados CNPJ | BrasilAPI + Receita Federal aberta + scraping curado | — |
| Deploy | Vercel | — |
| Vídeo | Loom | — |

---

## 5. Convenções

- **Idioma:** código, commits e comentários em **inglês**. Nomes de domínio em **português**
  (`empresa`, `socio`, `cnae`, `score_run`) — os dados são em português, não traduzir.
- **Commits:** pequenos e frequentes direto na `main`. Mensagem diz **o quê + porquê** —
  isso vira o changelog natural da jornada pro Loom.
- **Fim de cada sessão de trabalho** → atualizar `brain/progress.md` (append, nunca sobrescrever).
- **Decisão relevante** (escopo, stack, nome, scoring) → `brain/decisions.md`.
- **Próximos passos / o que está em aberto** → `brain/pending.md`.

---

## 6. Regras pro agente

1. **Planejar antes de codar** em tarefa que toca >1 arquivo ou >~30 linhas: ler → propor
   plano → executar → validar.
2. **Evidência > confiança.** Não dizer "deve funcionar". Rodar e verificar, ou dizer que não testou.
3. **YAGNI.** São 4 semanas. Construir só o que a demo de 60s precisa. Sem abstração prematura.
4. **Explicar decisões técnicas em linguagem natural** — o Maguto está aprendendo o ciclo
   AI-native end-to-end. Definir conceito avançado em uma frase antes de usar.
5. **Tom direto.** Sem preâmbulo, sem bajulação.

---

## 7. Estado atual

**2026-05-27** — Scaffold inicial. Next.js 16 + Tailwind v4 + shadcn/ui prontos. Supabase e
primeira pull de CNPJs a seguir. Ainda sem pipeline. Ver `brain/progress.md` pro detalhe e
`brain/pending.md` pro que vem agora.

---

## 8. Mapa do brain

| Arquivo | O que tem |
|---------|-----------|
| `CLAUDE.md` (este) | schema/contexto — lê primeiro |
| `AGENTS.md` | regras do Next.js 16 (gerado pelo create-next-app) |
| `brain/progress.md` | o que foi feito, sessão por sessão (append-only) |
| `brain/decisions.md` | decisões + porquê |
| `brain/pending.md` | próximos passos / em aberto |
| `skills/_index.md` | catálogo das skills + onboarding do Maguto |

> Contexto operacional completo (deadlines, equipe, relação com Relay/BRHSIC) vive no segundo
> cérebro do Guilherme em `memory/projects/clube-programacao.md` — fora deste repo.

---

## 9. Fluxo de sessão (Claude Code)

Dois comandos automatizam o trabalho colaborativo — funcionam direto no repo (vêm com o clone):

| Comando | Quando | O que faz |
|---------|--------|-----------|
| `/boreal` | início da sessão | carrega CLAUDE.md + brain/ + estado do git, faz briefing de onde paramos |
| `/salve` | fim da sessão | atualiza progress/pending/decisions, commita, push (com confirmação) |

Loop: `/boreal` → trabalha → `/salve`. Quem clonar o repo já tem os dois (`.claude/commands/`).
Detalhe e onboarding em `skills/_index.md`.
