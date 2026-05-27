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
