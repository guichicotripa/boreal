# Pending — Próximos Passos / Em Aberto

> O que falta fazer agora. Marcar `[x]` ao concluir. Mover concluídos pro `progress.md` no fim da sessão.

---

## 🔴 Agora (Semana 3 — deploy + Loom)

- [x] Client helper Supabase + envs + smoke test (`scripts/check-supabase.mjs`) — **conexão confirmada**
- [x] Repo GitHub privado `boreal` criado + push (branch `main`)
- [x] Maguto (`magutolou`) — collaborator ativo, já fez commits no repo
- [x] `ANTHROPIC_API_KEY` no `.env.local` + créditos — **feito**
- [x] Refatorado `llm.ts` + `reasoner.ts` pra Anthropic API direta — latência ~31–38s, ~$0.04/busca
- [ ] **Deploy no Vercel** — configurar env vars lá (Supabase + Anthropic + GCP). Agent SDK não
      era usável no Vercel; com a API direta agora dá.

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

## ⚪ Semana 3 — Polish + Loom (até 14/06)

- [x] **Cache de demos** — `demo-cache.json` + `build-demo-cache.mjs`. 3 queries canônicas
      instantâneas (0.04s) vs busca ao vivo (38s). Loading com steps progressivos. Funciona no Vercel.
- [ ] Deploy no Vercel (ver bloco 🔴)
- [ ] UI lapidada + micro-animations no fluxo input → loading → output
- [ ] 1 demo ao vivo na home além dos 3 canned
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
