# Pending — Próximos Passos / Em Aberto

> O que falta fazer agora. Marcar `[x]` ao concluir. Mover concluídos pro `progress.md` no fim da sessão.

---

## 🟢 Handoff Maguto → Guilherme (09/06) — RESOLVIDO (11/06)

Pipeline remodel (PR #39) mergeado na main (`41c62ee`). Itens abaixo implementados pelo Maguto em sessões posteriores; info dos setores descartada por decisão.

### INÍCIO (`/`)
- [x] ~~**Info dos setores à direita**~~ — **decidido NÃO colocar** (optamos por não ter a coluna de setores na home).

### PIPELINE (`/pipeline`)
- [x] **Col Dono/Estágio — texto muito à esquerda** — o container `min-w-0 space-y-0.5` da coluna 3 não tem padding horizontal; o texto "Guilherme" e o select "IDENTIFICADO" começam rente à borda da célula, visualmente feio. Fix: adicionar `px-2` (ou similar) ao wrapper da col 3.
- [x] **DateInput — remover ícone nativo** — `<input type="date">` renderiza ícone de agenda do browser + o SVG bone customizado; ficam dois ícones. Manter só o SVG bone (já tem hover ajustado). Fix: adicionar `[&::-webkit-calendar-picker-indicator]:hidden` ao className do input nativo em `DateInput`.
- [x] **Atividade: botão "+" mais próximo do título, com box própria** — o `+` de adicionar toque/log fica longe do label "Atividade" e não tem delimitação visual. Jogar adjacente ao título e dar uma caixa delimitada para o bloco de log.
- [x] **View geral (cross-stage)** — aba ou toggle que mostra _todas_ as oportunidades numa tabela única, sem filtrar por estágio. Candidatos: aba "Todos" antes das abas de estágio, ou um toggle "Estágios | Todos" no header do pipeline.
- [x] **Aba Agenda — underline amarelo → floral** — active state usa `border-risk-mid` (ocre) em vez de `border-floral`. Fix: trocar `accentAgenda ? "border-risk-mid text-floral" : "border-floral text-floral"` por `"border-floral text-floral"` (Agenda recebe o mesmo tratamento dos demais estágios).
- [x] **Separar Agenda dos estágios visualmente** — Agenda é uma dimensão operacional (fila de ações), não um estágio do funil. Hoje aparece na mesma barra de tabs que Identificado/Abordado/etc, o que confunde a narrativa. Solução: separador visual ou agrupamento distinto, mantendo navegabilidade por teclado (← →) entre todas as abas. Em aberto qual forma — discutir e decidir antes de implementar.
- [x] **Review com impeccable no final** — após as features acima prontas, rodar `/impeccable polish pipeline/page.tsx` para quality pass de design antes de qualquer demo/Loom.

---

## 🟡 Pipeline remodel (planejado 08/06 · Maguto)

Problema: kanban de 6 colunas espreme os cards (nome ilegível) e com volume vira scroll
infinito + expandir card a card. O board paga o custo das colunas sem usar o benefício (não
tem drag — troca de estágio já é via `<Select>`).

**Direção fechada:**
- **Layout = tabs de estágio + linhas largas** (uma view de estágio por vez, em largura cheia,
  legível sem expandir). Caminho natural pro híbrido Funil/Lista (opção C) depois, se der tempo.
- **Worklist fria (`/worklist`) morre** — sua função de descoberta já é melhor servida pela busca
  (ranqueia por score + mostra contato + deixa salvar). Aposentar a rota; opcional: preset
  "perfil sucessório · com contato" na home pra preservar o atalho de prospecção.
- **Agenda entra no pipeline** — fila quente sobre os salvos (com ação devida, ordenada por
  prioridade: atrasadas → data → score). É a visão de ação do pipeline, não é "worklist". Nome: **Agenda**.

**Em aberto:**
- [ ] **Aba inicial: Agenda vs Identificado** — standby, Maguto vai alinhar com Guilherme
  (operacional pede Agenda; narrativa do Loom pode pedir o funil/overview).
- [ ] **Notas na linha: opção A/B/C** — em discussão (A: só indicador→página; B: expand só de
  notas, log na página; C: notas+log inline). Tendência B.
- [ ] **Alerta de mudança societária (monitor) — repensar a forma na linha.** O ponto terracota
  testado no sandbox destoa do guideline (linguagem de notificação, atropela a semântica
  reservada de ocre/terracota). Manter o sinal (é o sensor forward, diferencial vs. Grata) mas
  na linguagem do brand: micro-rótulo tipográfico mono uppercase risk-high (ex: `⚠ TRANSIÇÃO`),
  como o banner já faz hoje em `pipeline/page.tsx`. **Não é prioridade — fazer depois do remodel.**

## 🟢 Home restyle Fase 1 (07/06 · Maguto) — pré-reunião 3

Lote de baixo risco antes da reunião de terça (09/06). Tudo em `src/app/page.tsx` + `src/components/brand/Nav.tsx`.

- [x] Copy da home enxuta (subhead sem moldura de venda; "ver metodologia →")
- [x] Navbar: Início · Pipeline · Worklist + dropdown **Metodologia** (Validação/Mercado/Consolidadores/Setores)
- [x] Card: stats strip (Porte · Capital · Fundada · Sócio+), capital compacto, badges + linha olive removidos, ações curtas
- [x] Switcher de setor na home (segmented control) — troca o universo sem ir a /setores; cobertura segue o setor (2.000 empresas · SP por setor)
- [x] Fix de toggle "não fecha" em investigar/memo/similares; labels olive→bone/70 na investigação
- [x] Lint limpo (`set-state-in-effect` + prop `rank` órfã)

## 🔴 Trajetória societária — handoff p/ Guilherme (removida da home 07/06)

Removida do card da home (pesada inline: query BigQuery ao vivo, lenta/instável p/ empresas sem snapshot).
**Rota `/api/trajetoria` + libs preservadas** — nada deletado do backend; só saíram botão/painel/handler do `page.tsx`
(recuperáveis do git p/ a página da empresa).

- [x] **Cachear trajetória das empresas-top dos demos** → `trajetoria-cache.json` + rota lê cache-first.
  _(`build-trajetoria-cache.mjs` em lote via BigQuery, 110 empresas / 87 com eventos; `/api/trajetoria`
  cache-first com `?fresh=1` pra forçar. Branch `gui/contexto-illa`.)_
- [x] ~~Reviver o painel de trajetória na **página da empresa**~~ → **consolidado no dossiê** (decisão
  09/06 com Guilherme): a seção standalone duplicava a linha do tempo do dossiê. O sinal que a Timeline
  não tem (saídas + envelhecimento de faixa) virou o bloco "Movimentação societária" dentro do dossiê.

## 🟡 Fase 2 — página da empresa + interatividade (versão final, esta semana)

Decidido com o Maguto (07/06): busca e pipeline precisam ser navegáveis — clicar numa empresa abre a **página própria**
dela (card + infos completas). Racional: o analista de M&A revisa muitas empresas e não lembra delas só pelo nome.

- [x] Rota `/empresa/[id]` — recebe as ações pesadas (investigar, memo, similares, trajetória) + sócios + contato +
  **score explainer** (o `breakdown` já vem no payload do `calcScore`). _(PR #38, `a60b01c`)_
- [x] Card da busca vira link → página da empresa (card magro de verdade; lista longa fica varrível). _(PR #38)_
- [x] **Pipeline:** cards clicáveis → página da empresa (mesma lógica). _(`138249b`)_
- [x] **Similares funcional:** botão "Salvar no pipeline" por linha + legenda do critério (CNAE+praça+porte+época).
  Hoje é lista morta; vira "ache parecidas → salve as boas" (wedge do Grata). _(resolvido)_
- [x] Dependência opcional (Guilherme): `GET /api/empresa/[id]` (empresa + score) p/ a página sobreviver a
  refresh/deploy. Sem isso, dá pra navegar via estado no clique (suficiente p/ o Loom). _(`138249b`, feito pelo Maguto)_

## 🎨 Restyle sistema v1 (em curso — 03/06 · branch `maguto/restyle-sistema-v1`)

Sistema de tipografia/cor documentado em `brand/uso-tipografia-cor.md`. Feito: base (strong 600, pesos
sans 400/500/600), hero, card/memo. Faltam as páginas.

- [x] **Ajeitar erro de borda na box** — resolvido.
- [x] Etapa 3 — pipeline (`fb62e46`)
- [x] Etapa 4 — validação (`4e769af` + `57b838f` + `5659693`)
- [x] Etapa 5 — consolidadores (`fe59f28`) — aguarda revisão do Maguto no browser
- [x] Etapa 6 — mercado ("0,46%" ocre → floral + strong sem cor) _(PR #35, `3bfe6a0`)_
- [x] Etapa 7 — /setores (nova página do Guilherme, sem restyle) _(PR #35)_
- [x] Etapa 8 — /worklist (nova página do Guilherme, sem restyle) _(PR #35; /worklist depois aposentada no PR #39)_
- [x] Decidir peso do negrito — **decidido manter 600** (atual).
- [x] SINAL_COR em validacao/page.tsx — **decidido manter como está; não usaremos SINAL_COR.**
- [x] Abrir PR: `maguto/restyle-sistema-v1` → main _(PR #35 mergeado em main, `3bfe6a0`)_

## 🔵 Fix de dados — /validacao · hindcast.json (Guilherme)

- [x] **`hindcast.json`: campo `municipio` tem código IBGE em vez de nome da cidade** (ex: `3549102`
  em vez de `"Sorocaba, SP"`). _(PR #36, `083b440` — lookup via API IBGE, 76 deals corrigidos)_
  _Causa raiz também corrigida (`gui/contexto-illa`, `b67084b`): o `build-hindcast-cache.mjs` gerava
  o código cru e reverteria o fix do JSON na próxima regeneração — agora faz JOIN com a tabela
  `municipio` no BigQuery e formata "Cidade, SP". Sem isso, qualquer rebuild voltaria a quebrar._

## 🔵 Dívida técnica — navegação `<a>` → `<Link>` (Guilherme, repo-wide)

- [x] **Migrar back links de `<a href="/">` para `<Link>` do `next/link`** em todas as páginas.
  _(Feito repo-wide em home, validação, pipeline, mercado, consolidadores e setores; `/worklist`
  não existe mais. Zerou as 8+ violações de `@next/next/no-html-link-for-pages`. Links externos
  (http, `target=_blank`) seguem como `<a>`. Branch `gui/contexto-illa`.)_

---

## 🟢 Data moat + validação (30/05) ✅ MARCO

- [x] **Mineração de transições do CNPJ** — ground truth de M&A de graça (340 deals saúde+metalmec SP).
      `scripts/detectar-transicoes.mjs`. Ver `segundo-cerebro/wiki/synthesis/relay-data-moat.md`.
- [x] **Validação retroativa em escala** + reconstrução temporal — `validacao-escala.mjs` (N=340).
- [x] **Score v0.1 recalibrado por lift** e **portado pro produto** — top decil 17%→28%. PR #13.
- [x] **Fix**: busca filtrada usa quadro societário completo (não subconjunto).

## 🟢 Research na API + assinatura destravada (30/05) ✅

- [x] **Research-agent migrado pra Anthropic API** + web search tool server-side (`web_search_20250305`).
      `lib/research.ts` + `route.ts` + `check-research.mjs`. Interface intacta; validado (PRENSA 24s).
- [x] **Assinatura destravada** — era conta errada logada no Claude Code (não bug da key). Re-login
      com a conta pessoal Pro resolveu. Agent SDK voltou a custo zero (`check-agent-sdk.mjs` confirma).
- [x] **Arquitetura:** produto na API (deploy-ready) · cache gerado via assinatura (custo zero).
- [x] **Cache via assinatura:** `cache-research-sub.mjs` + `cache-dossier-sub.mjs` (fábricas custo-zero).

## 🟢 Juiz de M&A validado (30/05) ✅

- [x] **Rubric construído via assinatura** (`build-juiz-rubric.mjs`, 284s, custo zero): 8 dimensões
      (pesos 3-5), 13 red flags, 24 fontes reais. Salvo em `scripts/juiz-rubric.json`.
- [x] **Juiz rodado em 2 dossiês reais** (`juiz-avaliar.mjs`, migrado pra assinatura): PRENSA **4/10**
      e MECANOTECNICA **4/10**, notas quase idênticas por dimensão. **O eval generaliza** — detecta
      fraquezas sistemáticas do `dossier.ts`, não ruído. Tem sinal real (pegou o capital-social-como-porte).

## 🟢 Correções do dossiê aplicadas + ganho medido pelo juiz (30/05) ✅

- [x] **Red flags** (era 1/10 → **7-8/10**): seção classificada por severidade + como verificar
      (PGFN/CARF/TJSP, NR-12, ambiental, dependência de owner, concentração). *Maior salto.*
- [x] **Capital social**: prompt instrui explicitamente a NÃO usar como porte/receita.
- [x] **Tese com "por que nós"**: ângulo do adquirente/originador (MECANOTECNICA tese 5→7).
- [x] **Canal + próximo passo**: usa telefone/email do banco (ex: PRENSA "ligar (11) 4039-8240, falar
      com Lucas; email é de terceiro → secundário"). Campo `proximo_passo` no dossiê.
- [x] **Loop fechado e medido**: PRENSA **4→5**, MECANOTECNICA **4→6**. Ganho localizado nas dimensões
      corrigidas (juiz mede de forma confiável). Cache de memos regenerado via assinatura (9 memos).
- [x] **Bug do avaliador corrigido**: `juiz-avaliar.mjs` não passava os campos novos → juiz avaliava cego.

## 🟡 Gargalo restante (decisão de produto pendente)

- [ ] **Estimativa financeira** (juiz: 0-1/10, trava a nota geral) — ⚠️ TENSÃO com a decisão de não fazer
      proxy de EBITDA. **Argumento novo do juiz**: a estimativa é o **primeiro corte de qualificação por
      tamanho** (MECANOTECNICA: EPP → EBITDA ~R$580-860K, provável < ticket mínimo institucional → corta
      o target *antes* de gastar tempo). Não é "número bonito", é filtro. Meio-termo: CAGED/PIA-IBGE +
      flag "não auditado, pré-DD". **Decisão do Guilherme: incorporar com metodologia ou manter abstenção?**
- [ ] Perfil competitivo do negócio (juiz: 3/10) + metodologia do score no memo (2/10) — não estavam nas 4 baratas.

## ⚪ Semana 3 — deploy + Loom

- [x] API direta (~31–38s, ~$0.04/busca)
- [ ] **Deploy no Vercel** — env vars (Supabase + Anthropic + GCP). Com research na API, destrava.
- [ ] **Calls de validação** — DMs enviadas (Daniella/Volaris, Nathália, Brenda, Illa). Na call: pedir
      deal list (ground truth premium) + transcrição alimenta o juiz. Roteiro em `brain/roteiro-validacao.md`.

## 🟡 Semana 1 — Foundation (até reunião 2, 02/06)

- [x] BigQuery conectado — `br_me_cnpj` confirmado, 79k empresas SP ativas CNAE 24/25/28
- [x] Ingerir dataset: 2.000 empresas + 4.929 sócios via `scripts/ingest-empresas.mjs`
- [x] Schema Postgres: `empresa`, `socio`, `score_run` (migration 0001 aplicada)
- [x] Pipeline v0: input NL → filtro → lista bruta — `/api/search` + UI (`page.tsx`)
      LLM via Agent SDK (assinatura, local). ⚠️ no deploy trocar por Anthropic API direta.

## 🟢 Semana 2 — Inteligência ✅ CONCLUÍDA

- [x] **Heurística de succession risk** — `src/lib/scoring.ts`, 4 dimensões somáveis
      (idade 40 + antiguidade 30 + estabilidade 20 + porte 10), ordenação desc na search
- [x] **Reasoner LLM batched** — `src/lib/reasoner.ts`, 1 chamada Claude pro top 15,
      retorna one_liner + flags por empresa. Qualidade excelente, cita dados específicos.
- [x] **API direta** — `llm.ts` (Haiku no parser) + `reasoner.ts` (Sonnet). ~31–38s, ~$0.04/busca.
- [x] **Enrichment Nível 0** — `enrich-empresas.mjs` resolveu município/CNAE/natureza (código→nome)
      nas 2.000 empresas; telefone/email exibidos; ingest atualizado com JOINs (dados novos já nascem
      resolvidos). `cnaes_secundarios` com descrição.
- [x] **Dossiê estruturado** — `lib/dossier.ts` + `/api/dossier` + painel expansível na UI.
      Memo: overview, análise sucessória, perguntas de abordagem, tese + timeline societária (CSS).
- [x] **Fluxo de colaboração automático** nos skills `/boreal` e `/salve` (branch por pessoa,
      rebase, PR via `gh`, "automático mas avisa").

## 🟢 Semana 2.5 — Research-agent (score v1) ✅ CONCLUÍDA

- [x] **Research-agent** — `src/lib/research.ts` + `/api/research`. Eleva score v0→v1 com sinais
      qualitativos da web (Playbook §11). Via **Agent SDK + WebSearch nativo na ASSINATURA**
      (truque: `env` do query() sem ANTHROPIC_API_KEY → Claude Code cai no login). **Custo zero.**
      Híbrido: LLM identifica sinais da lista fechada + cita fonte; código aplica pesos. Bidirecional.
- [x] **UI**: botão "🔍 Investigar com IA", badge muda v0→v1 ao vivo com delta (↑/↓), sinais com
      peso colorido + link de fonte, resumo. Validado por Guilherme.
- [x] **Cache de research** — `research-cache.json` + `build-research-cache.mjs`. Top 3 dos demos
      pré-investigado → clique instantâneo (0.5s vs ~68s ao vivo). PR #6 mergeado.

## ⚪ Semana 3 — Polish + Loom (SUBMIT até 10/06 23h59) ← FOCO ATUAL

- [x] **Cache de demos** — `demo-cache.json` + `build-demo-cache.mjs`. Queries instantâneas.
- [x] **Demo dos dois lados** — **MECANOTECNICA 85→96** ↑ (IA achou herdeiro na pecuária → sem
      sucessor no negócio → eleva, com fonte real). Complementa o rebaixamento PRENSA 100→75 ↓.
      Cacheado via assinatura. (Subida forte é rara no dataset — leads frios não têm M&A público.)
- [x] **Cache de memos (dossiês)** — `/api/dossier` lê de `dossier-cache.json`; 9 memos pré-gerados
      via assinatura (top-5 dos demos + research-cache). Expandir memo no pitch = instantâneo, custo 0.
- [x] **Polish da hierarquia visual do card** — restyle completo na branch `maguto/restyle-brandkit`.
      Card D.2 com two-column badge+content, border-left por tier, ações funcionais, dossiê + timeline.
- [ ] **Ajustes UI/UX pós-restyle** (doc `boreal_ajustes_finais_ui_ux_3105.md`) — implementar amanhã:
      - **Etapa A (Home):** label "DESCREVA UMA TESE EM LINGUAGEM LIVRE" + "Score de risco sucessório"
      - **Etapa B (Cards):** "top 15 analisadas por IA" · badge RISCO SUCESSÓRIO ALTO/MÉDIO/BAIXO ·
        limitar badges a 3 · reordenar ações (Ver detalhes → Investigar → Memo) · "Salvar no pipeline"
      - **Etapa C (Pipeline):** lanes visuais sutis · empty states nas colunas
      - **Decidir antes:** coluna direita (cobertura vs placeholder metodologia) · contador "PIPELINE · N"
      - **Etapa D (memo — blocos `red_flags` + `proximo_passo` do #17, integrados no merge 31/05):**
        Integrei o conteúdo do Guilherme reestilizado no brandkit (build/typecheck limpos), mas
        a estilização foi 1ª tentativa "no automático" — revisar junto:
        - **D.1 — cor por severidade dos red flags:** usei borda+texto `risk-high` (terracota/alta),
          `risk-mid` (ocre/média), `hairline`+`bone` (baixa). Conferir leitura e se não compete com
          o badge de score do card.
        - **D.2 — densidade da lista de red flags:** o rubric tem até 13 flags possíveis; a lista pode
          ficar longa. Avaliar limitar a N, ordenar por severidade (alta primeiro), ou agrupar.
        - **D.3 — `como_verificar`:** hoje vem após " — " em `text-bone` na mesma linha. Em lista longa
          fica pesado. Avaliar quebra de linha, tamanho menor, ou esconder atrás de hover/expandir.
        - **D.4 — destaque do `proximo_passo`:** hoje é só "→ texto" em `text-floral`. É um call-to-action;
          talvez mereça mais peso (bloco com borda/fundo sutil, como a tese).
        - **D.5 — poluição de badges:** card já tem badge de score + chips de flags; red flags adiciona
          badges de severidade. Cruzar com o ponto B ("limitar badges a 3") pra não virar ruído visual.
        - **D.6 — ordem dos blocos no memo:** red flags entre análise sucessória e perguntas; próximo
          passo no fim (após a tese). Confirmar se é a melhor hierarquia de leitura.
- [ ] **Deploy no Vercel — decisão REVERTIDA (10/06): deployamos pros jurados.** O link está no ar,
      mas **rodando versão antiga: o PR #40 (alinhamento de colunas + polish de empresa/home) ainda NÃO
      está no Vercel.** Guilherme tem que re-deployar / sincronizar o Vercel com a main. Infra pendente:
      env vars, `/api/trajetoria` quebra em serverless (BigQuery `keyFilename` → JSON inline), teto de
      custo do link aberto. (decisão registrada em `decisions.md`, entrada retroativa 11/06)
- [x] Roteiro do Loom escrito (v11 em `brain/submissao-clube.md`), gravar + editar.
- [x] **⏰ SUBMETER o Loom até 10/06 23h59** — **submetido a tempo (10/06).**

## 🔵 Semana 4 — Demo Day (15–16/06)

- [ ] Se shortlist: ensaiar pitch ao vivo (~3–5min) + backup pré-gravado

---

## Decisões em aberto

- Enrichment Nível 1 (site/web da empresa): job assíncrono futuro, não bloqueante. Metade das
  empresas-alvo não tem presença digital (ausência é, ela mesma, sinal). Não é prioridade pro Loom.
- Como estimar EBITDA sem demonstrativo (proxy por porte / capital social)? Decisão: **não fazer**
  — proxy financeiro cheira a dado inventado num pitch pra quem entende de PE. Melhor ser honesto
  com o que temos (capital social, porte) do que fabricar número.
- Qualificação do sócio (código "49" → "Sócio-Administrador", "Inventariante" = sinal sucessório
  direto): resolver via dicionário do BigQuery. Barato e alto valor pro dossiê. Próximo enrichment.
