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

**Status:** ✅ Implementada (29/05). Latência real ~31–38s (não 15–20 — o reasoner do top 15 é o
gargalo, não o overhead de subida). Custo real ~$0.04/busca. Parser foi pra Haiku (trivial),
reasoner ficou em Sonnet (qualidade). Gotcha: `ANTHROPIC_API_KEY` vazia como var de sistema
mascarava o `.env.local` — resolvido com dotenv `override:true` no `next.config.ts`.

---

## [2026-05-28] Boreal = motor do Relay (não só competição)

**Contexto:** Após o reasoner funcionar, ficou claro que a arquitetura BQ → Supabase → score
→ reasoner não é específica da competição — é o que o Relay precisa pra deal sourcing em escala.

**Decisão:** Tratar Semana 2+ do Boreal já com o Relay em mente:
- Heurística de score = v0 do `score_run` do Relay (mesma tabela, mesma lógica)
- Reasoner = pattern "agent lê cada item e decide" — base do enrichment do Relay
- Polish puramente cosmético pra demo vai pra Semana 3, mas só se não comprometer reuso.

**Status:** ✅ Decisão estratégica registrada.

---

## [2026-05-29] Fluxo de colaboração automático nos skills — "automático mas avisa"

**Contexto:** Gui e Maguto trabalham em paralelo; já houve um conflito de rebase. Precisava de um
fluxo de git à prova de erro pra dupla iniciante, sem virar overhead manual.

**Decisão:** Embutir o git colaborativo nos skills `/boreal` (boot) e `/salve` (flush): detecção de
identidade via `git config`, branch pessoal automática, rebase no boot, push + PR via `gh` no fim.
Main só recebe via PR. Modo escolhido: **"automático mas avisa"** (executa sozinho, mostra cada
passo em 1 linha) — entre "totalmente automático" e "guiado com confirmação". Push sempre pede OK.

**Por quê:** remove a chance de erro (commit direto na main) sem esconder o que acontece — o Maguto
aprende o fluxo profissional vendo. Divisão de domínio (Gui motor / Maguto interface, `types.ts`
como contrato) minimiza conflito de merge.

**Status:** ✅ Implementada e validada (PRs #1–4 passaram pelo fluxo).

---

## [2026-05-29] Enrichment em regimes + moat do banco = loop de outcomes

**Contexto:** Ao planejar o enrichment, surgiu a pergunta (do Gui) de como isso escala pro Relay e
como o banco vira diferencial competitivo.

**Decisão:**
- **Enrichment tem 3 regimes:** N0 (resolver códigos) é determinístico/barato → no **ingest** (JOIN),
  automático. N1 (site/web) é falível/lento → **job assíncrono** idempotente futuro, não bloqueia
  (ausência de site é, ela mesma, sinal). N2 (estimar EBITDA por proxy) **não fazer** — dado
  inventado num pitch pra quem entende de PE.
- **Moat ≠ dados públicos.** Receita é commodity (qualquer um puxa do BigQuery). O defensável é o
  **loop de outcomes**: registro acumulado de quem foi contatado, respondeu, vendeu, a que múltiplo
  — training data que um entrante não compra. Implica tabela de interações/outcomes no futuro (Relay),
  além do `score_run` já versionado.
- **Dossiê híbrido:** dados determinísticos em código + análise narrativa no LLM. Mais barato,
  rápido e os dados não alucinam.

**Status:** ✅ Registrada. Aplicação no Relay documentada em `segundo-cerebro/memory/projects/relay.md`.

---

## [2026-05-29] Linha de expansão Boreal: research-agent → validação → polish (fiel ao Relay)

**Contexto:** Guilherme quis aumentar o escopo "convergindo com o Relay" e ganhar a competição.
Lido o Playbook (§14 funil) e o Excelia workflow (boutique real). Eu derivei pro "memo+CRM estilo
boutique" e Guilherme corrigiu: isso é ferramenta da boutique, fora do escopo do Relay (originador).

**Decisão:** linha linear que casa brilho de demo + fidelidade ao Relay:
1. **Research-agent (score v1)** — o brilho + o coração do Relay (§11). Sem dependência de dados
   externos. **Feito.**
2. **Validação retroativa (hit rate)** — north-star do Relay (§12). Mas frágil em metalmecânica
   (deals opacos, abaixo do threshold CADE). Vira **credencial dita no pitch**, não build agora;
   vertical pra validar de verdade é saúde regional (Relay real).
3. **Polish + Loom.**

**Anti-escopo (explícito):** sem memo com script de reunião, sem CRM de execução de deal, sem
proposta/contrato (isso é da boutique); sem EBITDA proxy (dado inventado); sem outreach automatizado
(Playbook §15 exige contato humano).

**Status:** ✅ Linha acordada. Etapa 1 concluída.

---

## [2026-05-29] Research-agent roda na ASSINATURA (Agent SDK), não na API

**Contexto:** Research-agent precisa de web search. Guilherme não quer gastar créditos da API
testando. A API tem web search (~$0.22/empresa por causa dos ~62k tokens de input).

**Decisão:** rodar via **Agent SDK + WebSearch nativo do Claude Code, autenticado pela assinatura**.
Truque técnico: `options.env` do `query()` substitui o ambiente do subprocesso — passando sem
`ANTHROPIC_API_KEY`, o Claude Code cai no login (assinatura). Custo zero.

**Trade-off:** mais lento (~68s vs ~48s da API) e **só funciona local** (não no Vercel, que não tem
Claude Code logado). Mitigado por: cache do top dos demos (clique instantâneo) + sob demanda.
No deploy, se precisar de research ao vivo, trocar por Anthropic API (web search tool).

**Status:** ✅ Implementada. Parser e reasoner seguem na API (rápidos); só o research usa assinatura.

---

## [2026-05-30] Score v0.1 — recalibrado por validação retroativa (data-driven)

**Contexto:** o score v0 era heurística pura (pesos chutados). A mineração de transições do CNPJ
gerou ground truth (340 aquisições reais) → deu pra medir o que cada feature realmente prediz.

**Decisão:** recalibrar os pesos do `scoring.ts` pelo lift observado nas aquisições:
- idade 0–40 → 0–30; antiguidade mantém 0–30 (lift 2,56x, o mais forte);
- **porte 0–10 → 0–30** (lift 2,38x — estava subaproveitado);
- **"estabilidade/estagnação" REMOVIDA** (lift 0,81x — era NEGATIVO, o v0 premiava o errado);
- **quadro plural +10** (sócio único tem lift ~0 — quase nunca é adquirido).

**Evidência:** top decil de aquisições reais subiu de 17% (v0) → 28% (v0.1) contra o benchmark.
Validado com pesos normalizados (0-100) em `scripts/validacao-v01-norm.mjs`. Portado pro produto.

**Status:** ✅ No produto (PR #13). Ground truth e benchmark em `scripts/{detectar-transicoes,
validacao-escala,validacao-lift,validacao-v01-norm}.mjs`. Síntese: segundo-cerebro `wiki/synthesis/relay-data-moat.md`.

---

## [2026-05-30] Score sempre usa o quadro societário COMPLETO

**Contexto:** ao portar o v0.1, o `quadro_plural` revelou um bug: a busca filtrada por idade usava
`socio!inner` + `.gte(faixa)`, que projetava SÓ os sócios que batiam o filtro. O `calcScore` via
um subconjunto → score errado (PRENSA dava 90 na busca, 100 no research).

**Decisão:** o filtro de idade serve só pra SELECIONAR empresas; o score usa TODOS os sócios.
Implementado com 2ª query (`/api/search`) que traz o quadro completo das empresas selecionadas
antes de pontuar. Separar seleção de projeção.

**Status:** ✅ Corrigido (PR #13). Demo e research consistentes.

---

## [2026-05-30] Juiz de M&A — eval sintético (validar qualidade sem depender de calls)

**Contexto:** calls de validação demoram a responder. Guilherme propôs um "ICP artificial" pra
acelerar o feedback sem esperar humanos.

**Decisão:** construir um JUIZ (eval), não um cliente. A distinção é crítica:
- **Qualidade do output** (dossiê, perguntas de abordagem, score) → o juiz sintético faz bem,
  porque é dedutível do conhecimento de M&A.
- **Desejabilidade** ("alguém quer isso?") → SÓ calls reais. O juiz NÃO substitui (seria espelho
  do próprio modelo). Risco de auto-engano se confundir os papéis.
Juiz fundamentado em PESQUISA WEB (não só Excelia/Playbook) + EVOLUTIVO: refinado com transcrições
das calls reais (juiz v1 → call → destila → juiz v2). Múltiplas personas adversariais; ground truth
manda quando existe. Scripts: `build-juiz-rubric.mjs` (pesquisa → rubric), `juiz-avaliar.mjs` (avalia dossiê).

**Status:** 🟡 scripts prontos; rubric pendente de rodar (assinatura bloqueada — ver abaixo; rodar via API ~$0,30).

---

## [2026-05-30] Assinatura Agent SDK bloqueada → research migra pra Anthropic API

**Contexto:** o truque de custo-zero (Agent SDK autenticado pela assinatura) parou de funcionar:
erro consistente "Your organization has disabled Claude subscription access for Claude Code".

**Causa provável** (issue anthropics/claude-code#8327): a `ANTHROPIC_API_KEY` no ambiente
**sobrescreve** a assinatura; a key (de conta/org sem subscription access habilitado) "ganha".
Antes funcionava porque a key de sistema era vazia; depois que a key real foi colada, ela passou a
vencer. Tentar remover a key do env pra forçar assinatura foi bloqueado (pode ser contornar política
de org — ambíguo: depende se a conta é individual ou sob organização).

**Decisão:** migrar `research.ts` (e os scripts de pesquisa: rubric, ground-truth, transições) pra
**Anthropic API** (web search tool). Era o caminho de produção de qualquer forma — no Vercel a
assinatura nunca rodaria (precisa do Claude Code logado local). Custo: ~$0,20/empresa (research, sob
demanda + cache), $0,30 (rubric único). Demos cacheados seguem funcionando (já gravados).

**Status:** 🟡 pendente migração. Opcional: investigar reabilitar assinatura no terminal local
(`unset ANTHROPIC_API_KEY` + `claude`) — só se conta individual.
