# Pending — Próximos Passos / Em Aberto

> O que falta fazer agora. Marcar `[x]` ao concluir. Mover concluídos pro `progress.md` no fim da sessão.

---

## 🔴 Agora (fechar o setup)

- [ ] Configurar Supabase: criar projeto no painel → `.env.local` com `NEXT_PUBLIC_SUPABASE_URL`
      + `NEXT_PUBLIC_SUPABASE_ANON_KEY` + service role → client helper em `src/lib/supabase.ts`
- [ ] Criar repo GitHub privado `boreal` → primeiro commit → push → adicionar Maguto como collaborator

## 🟡 Semana 1 — Foundation (até reunião 2, 02/06)

- [ ] Coletar dataset: ~2.000 CNPJs de CNAEs 24/25/28 no interior de SP via BrasilAPI
- [ ] Schema Postgres: `empresa`, `socio`, `score_run`
- [ ] Pipeline v0: input texto → filtro CNAE → lista bruta (ainda sem scoring)

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
