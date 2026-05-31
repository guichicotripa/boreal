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

## 🟡 Agora

- [ ] **Juiz de M&A (eval sintético)** — rodar `build-juiz-rubric.mjs` (via assinatura agora, custo
      zero) → construir rubric → `juiz-avaliar.mjs` num dossiê real e ver se a crítica tem sinal.

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
- [ ] **Polish da hierarquia visual do card** — acumulou muito (score, one-liner, flags, sinais v0,
      setor, metadados, contato, sócios, research, dossiê). Precisa hierarquia pro vídeo.
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
