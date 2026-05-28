# Pending — Próximos Passos / Em Aberto

> O que falta fazer agora. Marcar `[x]` ao concluir. Mover concluídos pro `progress.md` no fim da sessão.

---

## 🔴 Agora (destravar latência do reasoner)

- [x] Client helper Supabase + envs + smoke test (`scripts/check-supabase.mjs`) — **conexão confirmada**
- [x] Repo GitHub privado `boreal` criado + push (branch `main`)
- [x] Maguto (`magutolou`) convidado como collaborator — aguardando ele aceitar o convite
- [ ] **Colar `ANTHROPIC_API_KEY` no `.env.local`** — Reasoner via Agent SDK demora 90–110s/busca,
      inaceitável pro demo. Trocar pra `@anthropic-ai/sdk` direto baixa pra ~15–20s e já deixa
      pronto pro deploy Vercel.
- [ ] Refatorar `llm.ts` + `reasoner.ts` pra Anthropic API direta após a key chegar.

## 🟡 Semana 1 — Foundation (até reunião 2, 02/06)

- [x] BigQuery conectado — `br_me_cnpj` confirmado, 79k empresas SP ativas CNAE 24/25/28
- [x] Ingerir dataset: 2.000 empresas + 4.929 sócios via `scripts/ingest-empresas.mjs`
- [x] Schema Postgres: `empresa`, `socio`, `score_run` (migration 0001 aplicada)
- [x] Pipeline v0: input NL → filtro → lista bruta — `/api/search` + UI (`page.tsx`)
      LLM via Agent SDK (assinatura, local). ⚠️ no deploy trocar por Anthropic API direta.

## 🟢 Semana 2 — Inteligência (até reunião 3, 09/06)

- [x] **Heurística de succession risk** — `src/lib/scoring.ts`, 4 dimensões somáveis
      (idade 40 + antiguidade 30 + estabilidade 20 + porte 10), ordenação desc na search
- [x] **Reasoner LLM batched** — `src/lib/reasoner.ts`, 1 chamada Claude pro top 15,
      retorna one_liner + flags por empresa. Qualidade dos outputs excelente, cita dados específicos.
- [x] **UI v1** — badge de score colorido (vermelho/laranja/cinza), one-liner em itálico,
      flags como chips, sinais do score como bullets
- [ ] **Latência** — bloqueada até API key chegar (ver bloco 🔴)
- [ ] **Dossier estruturado** — 1-pager por empresa (overview, sinais, perguntas, tese).
      Faz mais sentido depois da troca pra API direta — senão cada clique espera +60s.
- [ ] **Enrichment via site** — pode entrar no dossier (Claude lê o site da empresa).
      Decisão técnica: como descobrir URL? Provisoriamente, deixar manual ou usar BrasilAPI.

## ⚪ Semana 3 — Polish + Loom (até 14/06)

- [ ] UI lapidada + micro-animations no fluxo input → loading → output
- [ ] 3 demos canned + 1 ao vivo na home
- [ ] Roteiro do Loom escrito, gravado, editado
- [ ] **Submeter até sábado 14/06**

## 🔵 Semana 4 — Demo Day (15–16/06)

- [ ] Se shortlist: ensaiar pitch ao vivo (~3–5min) + backup pré-gravado

---

## Decisões em aberto

- Provedor de dados CNPJ definitivo: BrasilAPI cobre o básico, mas pode faltar idade de sócio /
  quadro societário completo. Avaliar CASA dos Dados ou scraping curado na Semana 1.
- Como estimar EBITDA sem demonstrativo (proxy por porte / capital social / nº funcionários?).
