# Decisions — Decisões + Porquê

> Uma entrada por decisão que muda escopo, stack, nome ou lógica.
> Formato: data, contexto, decisão, status.

---

## [2026-05-26] Direção do produto: AI research agent pra deal sourcing PE/M&A

**Contexto:** competição do Clube da Programação. Avaliados 2 caminhos — (A) research agent
de deal sourcing, (B) ferramenta de LBO modeling.

**Decisão:** Plan A. Plan B descartado — gerar modelo financeiro funcional e correto em 30
dias, com parceiro aprendendo, é risco técnico alto demais. Output qualitativo do A tolera
mais erro e demoa melhor em 60s.

**Status:** ✅ Tomada.

---

## [2026-05-26] Nicho: metalmecânica interior SP + Sul (CNAEs 24/25/28)

**Contexto:** precisava de um vertical com succession risk dramático e dados públicos bons.

**Decisão:** metalmecânica / indústria média. Idade média de donos é a mais alta do BR,
Receita Federal cobre bem, narrativa Silver Tsunami pronta.

**Status:** ✅ Tomada.

---

## [2026-05-27] Nome do projeto: Boreal

**Contexto:** opções na mesa eram Boreal, Herdeiro, Sucessio, Tropos.

**Decisão:** **Boreal**. Soa limpo, não explica demais o que o produto faz.

**Status:** ✅ Tomada.

---

## [2026-05-27] Stack confirmada com Next.js 16 (não 15)

**Contexto:** o plano original dizia Next 15; create-next-app instalou a 16 (atual estável).

**Decisão:** seguir com Next 16. Consultar `node_modules/next/dist/docs/` antes de escrever
código de framework, porque a 16 tem breaking changes vs. conhecimento de treino do agente.

**Status:** ✅ Tomada.

---

## [2026-05-27] Interpretação NL via Claude Agent SDK (assinatura), não API key

**Contexto:** o Pipeline v0 precisa interpretar a query em linguagem natural. Duas opções —
(A) Anthropic API com `ANTHROPIC_API_KEY` (cobrada por token), (B) Claude Agent SDK usando o
login do Claude Code (assinatura do Guilherme, sem custo por token).

**Decisão:** **Plan B (Agent SDK)** por enquanto. Roda local na máquina do Guilherme, onde o
Claude Code está logado. Custo zero de API durante o desenvolvimento.

**Trade-off / caveat crítico:** o Agent SDK só autentica por assinatura **onde o Claude Code
está logado** — ou seja, **não funciona no Vercel**. Quando for fazer deploy pra submissão,
trocar `parseQueryLLM` por uma chamada direta à Anthropic API (mesma interface, basta a key).
Latência ~8s por chamada (overhead de subida do engine) — aceitável com loading state pro v0.

**Mitigação:** `src/lib/llm.ts` (Agent SDK) e `src/lib/query-parser.ts` (heurístico) têm a
mesma assinatura. A rota tenta o LLM e cai no heurístico se falhar — a demo nunca quebra.

**Status:** ✅ Tomada (revisar no deploy).

---

*(append novas decisões abaixo)*

---

## [2026-05-28] Score determinístico + Reasoner LLM batched

**Contexto:** Semana 2. O v0 filtrava empresas mas não diferenciava qualidade. Pro Loom de 60s
mostrar "research agent" em vez de "search box", precisava de número + raciocínio por empresa.

**Decisão:** Score determinístico (4 dimensões somáveis, max 100) na lista inteira + reasoner
LLM **batched** (1 chamada Claude pro top 15) com one-liner narrativo + flags. Dossier vira
camada 3 (clique → expande), não centerpiece.

**Por quê:**
- Score local resolve "rank visual" sem custo de LLM
- Batched: 1 call → N análises >> N calls (latência e custo)
- One-liner cita nome, ano, capital → prova que a IA leu AQUELA empresa específica
- Mantém compatibilidade com Relay (mesma arquitetura: score local + LLM enrichment)

**Status:** ✅ Implementada. Qualidade dos outputs validada com dados reais.

---

## [2026-05-28] Trocar Agent SDK → Anthropic API direta (quando a key chegar)

**Contexto:** Reasoner funciona, mas latência ficou em 90–110s por busca. Causa: Agent SDK
spawna subprocesso Claude Code a cada call (~5–8s overhead/call).

**Decisão:** Manter Agent SDK até a `ANTHROPIC_API_KEY` chegar; depois refatorar `llm.ts` e
`reasoner.ts` pra `@anthropic-ai/sdk` direto (Sonnet 4.6). Interface pública das funções
fica idêntica — só troca a implementação interna.

**Trade-off:**
- Ganho: latência projetada ~15–20s total (5x mais rápido). Demo viável.
- Custo: ~$0.02 por busca em vez de zero. Não material no escopo da competição.
- Bônus: já fica pronto pro deploy Vercel (Agent SDK não funciona lá).

**Status:** 🟡 Pendente da key.

---

## [2026-05-28] Boreal = motor do Relay (não só competição)

**Contexto:** Após o reasoner funcionar, ficou claro que a arquitetura BQ → Supabase → score
→ reasoner não é específica da competição — é o que o Relay precisa pra deal sourcing em escala.

**Decisão:** Tratar Semana 2+ do Boreal já com o Relay em mente:
- Heurística de score = v0 do `score_run` do Relay (mesma tabela, mesma lógica)
- Reasoner = pattern "agent lê cada item e decide" — base do enrichment do Relay
- Polish puramente cosmético pra demo vai pra Semana 3, mas só se não comprometer reuso.

**Status:** ✅ Decisão estratégica registrada.
