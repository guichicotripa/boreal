@AGENTS.md

# Boreal — Brain do Projeto

> Entry point. Todo agente (Claude Code) e todo humano novo no repo lê **isto primeiro**.
> Modelo enxuto inspirado no "segundo cérebro" do Guilherme.

---

## 1. O que é

**Boreal** é um *AI-native research agent para deal sourcing em PE/M&A no middle market
brasileiro*. Foco: empresas familiares em **transição societária** — controle em idade de
transferir, geração seguinte presente, quadro se movimentando, e escala que justifique o deal.

> A tese mudou em 29/07/2026 e vale saber por quê antes de escrever qualquer coisa: a formulação
> antiga era "sócio envelhecendo, sem sucessão evidente, sem mudança societária recente". O lift
> condicional contra aquisições reais derrubou as três pontas. Quadro parado tem lift **0,60x** e
> sucessor aparente tem **2,14x**. Quem vende é quem está administrando uma transição, não quem
> foi abandonado. Metodologia inteira em `brain/modelo-de-score.md`.

**Setores cobertos:** metalmecânica (CNAE 24/25/28), saúde (86), educação (851/852) e agro
(01/02/03). Base indexada: **51.033 empresas**.

**Estágio:** produto em produção, com **piloto pago da boutique Setter** iniciando em agosto/2026
(R$ 2.000 + 0,5% de success fee). Não é mais protótipo e não é mais projeto de prazo curto.

---

## 2. Quem

**Guilherme Augusto**, solo. Arquitetura, prompts, lógica de scoring e ranking, integração LLM,
produto e comercial.

> Histórico, porque o repo inteiro carrega marcas disso: o Boreal nasceu como entrada na competição
> Clube da Programação (Laura Dubugras, prêmio US$ 10.000, submissão em 10/06/2026) e era tocado a
> dois, com o **Maguto** cuidando de UI, copy e dados. O Clube acabou em junho e o Maguto parou de
> trabalhar no projeto depois disso. A antiga "regra de domínio" que separava motor e interface não
> vale mais: **hoje um agente edita o repo inteiro.** Maguto segue com acesso de tester.

---

## 3. O produto

**Input** em linguagem natural:
> *"metalmecânica no interior de SP com sócios acima de 60 anos"*

**Output:** lista priorizada de empresas reais (CNPJ, contato, sócios) com **score determinístico**
e composição por eixo, mais **investigação sob demanda** que busca na web o gatilho de timing ("por
que agora") e um rascunho de abordagem. Do resultado nasce um **pipeline de originação** com selo
de proveniência, que é o que destrava o success fee.

Duas perguntas diferentes, e é importante não confundi-las:

| camada | responde | custo |
|---|---|---|
| score determinístico (`scoring.ts`) | "esta empresa tem o perfil?" | microssegundos, roda no universo inteiro |
| investigação / research (`research.ts`) | "vale ligar hoje?" | ~100s de LLM por empresa, sob demanda |

---

## 4. Stack

> ⚠️ **Next.js 16** (não 15) — tem breaking changes em relação ao conhecimento de treino do
> agente. Antes de escrever código de framework, consultar `node_modules/next/dist/docs/`.

| Camada | Ferramenta | Versão |
|--------|-----------|--------|
| Frontend | Next.js (App Router) + TypeScript | 16.x |
| UI | Tailwind + shadcn/ui | Tailwind v4 |
| Backend / DB | Supabase (Postgres + Auth) | — |
| LLM | Claude API + Agent SDK. Modelos fixados em `src/lib/modelos.ts` (Sonnet 5 default, Opus 5 pontual, Haiku 4.5 extração) | — |
| Dados CNPJ | BrasilAPI + Receita Federal aberta + scraping curado | — |
| Deploy | Vercel | — |


---

## 5. Convenções

- **Idioma:** código, commits e comentários em **inglês**. Nomes de domínio em **português**
  (`empresa`, `socio`, `cnae`, `score_run`) — os dados são em português, não traduzir.
- **Commits:** pequenos e frequentes direto na `main`. Mensagem diz **o quê + porquê**.
- **Fim de cada sessão de trabalho** → atualizar `brain/progress.md` (append, nunca sobrescrever).
- **Decisão relevante** (escopo, stack, nome, scoring) → `brain/decisions.md`.
- **Próximos passos / o que está em aberto** → `brain/pending.md`.

---

## 6. Regras pro agente

1. **Planejar antes de codar** em tarefa que toca >1 arquivo ou >~30 linhas: ler → propor
   plano → executar → validar.
2. **Evidência > confiança.** Não dizer "deve funcionar". Rodar e verificar, ou dizer que não testou.
3. **YAGNI.** Construir o que o originador usa hoje. Sem abstração prematura.
4. **Explicar decisões técnicas em linguagem natural.** Definir conceito avançado em uma frase
   antes de usar.
5. **Nenhum peso de score por intuição.** O protocolo de mudança está em `brain/modelo-de-score.md`
   §10: lift condicional com z >= 2, depois ablação em holdout, depois os dois arquivos de fórmula
   (`src/lib/scoring.ts` e `scripts/lib/score-sql.mjs`) mudam juntos.
5. **Tom direto.** Sem preâmbulo, sem bajulação.

---

## 7. Estado atual

**2026-07-30.** Em produção em `boreal-teste.vercel.app`, multi-tenant real (org, membro, RLS),
contratos por setor/praça/módulo, log de eventos como sinal de treino e página de métricas para
staff.

- **Score v1** (29/07) substituiu o v0. Pesos medidos por lift condicional contra aquisições reais
  mineradas do CNPJ; recall no perfil sucessório de **41,5%** em holdout (n=978, z=2,59), 4,1x
  melhor que sorteio. **Ler `brain/modelo-de-score.md` antes de tocar em `scoring.ts`.**
- Piloto da Setter começando; faltam do lado deles os 2 setores, a praça e a lista de CRM
  incumbente.

Detalhe sessão a sessão em `brain/progress.md`, o que está aberto em `brain/pending.md`.

---

## 8. Mapa do brain

| Arquivo | O que tem |
|---------|-----------|
| `CLAUDE.md` (este) | schema/contexto — lê primeiro |
| `AGENTS.md` | regras do Next.js 16 (gerado pelo create-next-app) |
| `brain/progress.md` | o que foi feito, sessão por sessão (append-only) |
| `brain/decisions.md` | decisões + porquê |
| `brain/pending.md` | próximos passos / em aberto |
| `brain/modelo-de-score.md` | **como o score é construído, medido e revisado** — metodologia completa, protocolo de mudança e limitações. Ler antes de tocar em `scoring.ts`. |
| `brain/referencia-site-fairplay.md` | referência visual e de copy para o site institucional |
| `skills/_index.md` | catálogo das skills |

> Contexto operacional completo (deadlines, equipe, relação com Relay/BRHSIC) vive no segundo
> cérebro do Guilherme em `memory/projects/boreal.md` — fora deste repo.

---

## 9. Fluxo de sessão (Claude Code)

Dois comandos automatizam o trabalho colaborativo — funcionam direto no repo (vêm com o clone):

| Comando | Quando | O que faz |
|---------|--------|-----------|
| `/boreal` | início da sessão | carrega CLAUDE.md + brain/ + estado do git, faz briefing de onde paramos |
| `/salve` | fim da sessão | atualiza progress/pending/decisions, commita, push (com confirmação) |

Loop: `/boreal` → trabalha → `/salve`. Quem clonar o repo já tem os dois (`.claude/commands/`).
Detalhe e onboarding em `skills/_index.md`.
