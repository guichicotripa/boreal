# Pending — Próximos Passos / Em Aberto

> O que falta fazer agora. Marcar `[x]` ao concluir. Mover concluídos pro `progress.md` no fim da sessão.

---

## 🔴 Agora (fechar o setup)

- [x] Client helper Supabase + envs + smoke test (`scripts/check-supabase.mjs`) — **conexão confirmada**
- [x] Repo GitHub privado `boreal` criado + push (branch `main`)
- [x] Maguto (`magutolou`) convidado como collaborator — aguardando ele aceitar o convite
- [ ] Colar `ANTHROPIC_API_KEY` no `.env.local` (Supabase já ok) — necessária na Semana 2 (LLM)

## 🟡 Semana 1 — Foundation (até reunião 2, 02/06)

- [x] BigQuery conectado — `br_me_cnpj` confirmado, 79k empresas SP ativas CNAE 24/25/28
- [x] Ingerir dataset: 2.000 empresas + 4.929 sócios via `scripts/ingest-empresas.mjs`
- [x] Schema Postgres: `empresa`, `socio`, `score_run` (migration 0001 aplicada)
- [x] Pipeline v0: input NL → filtro → lista bruta — `/api/search` + UI (`page.tsx`)
      LLM via Agent SDK (assinatura, local). ⚠️ no deploy trocar por Anthropic API direta.

## 🟢 Semana 2 — Inteligência (até reunião 3, 09/06)

- [ ] Heurística de succession risk: idade média sócios + tempo de empresa + ausência de
      mudança societária recente + tamanho relativo
- [ ] Enrichment via LLM: site da empresa → história / perfil / sinais
- [ ] Geração de dossier (Claude API monta 1-pager)
- [ ] Primeira UI funcional (Tailwind + shadcn)

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
