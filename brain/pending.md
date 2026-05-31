# Pending — Próximos Passos / Em Aberto

> O que falta fazer agora. Marcar `[x]` ao concluir. Mover concluídos pro `progress.md` no fim da sessão.

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

## ⚪ Semana 3 — Polish + Loom (até 14/06) ← FOCO ATUAL

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
- [ ] **"Voltar à busca" com router.back()** — tentado, não funcionou, revertido. Investigar causa.
- [ ] **Narrativa da home** — header amarrando a tese Silver Tsunami / sucessão.
- [ ] ~~Deploy no Vercel~~ — **decisão (30/05): não fazer agora.** Pitch/Demo Day via tela
      compartilhada (localhost). Research já está na API se um dia o deploy fizer sentido.
- [ ] Roteiro do Loom escrito, gravado, editado (sem pressa — 15 dias até o submit)
- [ ] **Submeter até sábado 14/06**

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
