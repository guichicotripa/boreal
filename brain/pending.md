# Pending — Próximos Passos / Em Aberto

> O que falta fazer agora. Marcar `[x]` ao concluir. Mover concluídos pro `progress.md` no fim da sessão.

---

## 🟢 Data moat + validação (30/05) ✅ MARCO

- [x] **Mineração de transições do CNPJ** — ground truth de M&A de graça (340 deals saúde+metalmec SP).
      `scripts/detectar-transicoes.mjs`. Ver `segundo-cerebro/wiki/synthesis/relay-data-moat.md`.
- [x] **Validação retroativa em escala** + reconstrução temporal — `validacao-escala.mjs` (N=340).
- [x] **Score v0.1 recalibrado por lift** e **portado pro produto** — top decil 17%→28%. PR #13.
- [x] **Fix**: busca filtrada usa quadro societário completo (não subconjunto).

## 🔴 Agora (destravado pela assinatura bloqueada)

- [ ] **MIGRAR research-agent pra Anthropic API** (web search tool) — a assinatura via Agent SDK foi
      bloqueada ("org disabled subscription access", issue claude-code#8327). Afeta `lib/research.ts`
      + scripts de pesquisa. Demos cacheados seguem ok. Era o caminho de produção de qualquer forma.
- [ ] **Juiz de M&A (eval sintético)** — rodar `build-juiz-rubric.mjs` via API (~$0,30) → construir
      rubric → rodar `juiz-avaliar.mjs` num dossiê real e ver se a crítica tem sinal. Scripts prontos.
- [ ] (opcional) Investigar reabilitar assinatura no terminal local — só se conta individual.

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
- [ ] **Polish da hierarquia visual do card** — acumulou muito (score, one-liner, flags, sinais v0,
      setor, metadados, contato, sócios, research, dossiê). Precisa hierarquia pro vídeo.
- [ ] **Narrativa da home** — header amarrando a tese Silver Tsunami / sucessão.
- [ ] **Demo dos dois lados** — cachear 1 empresa do meio (score 75-89) que o research faça SUBIR
      (achar banco de investimento / menção a venda), pra mostrar IA achando alvo escondido além do
      caso de rebaixamento (PRENSA 100→75).
- [ ] Deploy no Vercel — ⚠️ research-agent usa Agent SDK (assinatura), NÃO funciona no Vercel.
      No deploy: ou research só via cache, ou trocar por Anthropic API (web search tool, ~$0.22/empresa).
- [ ] Roteiro do Loom escrito, gravado, editado
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
