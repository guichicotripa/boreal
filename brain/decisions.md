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
**Atualização (30/05, continuação):** ✅ migração feita E assinatura destravada — ver entrada abaixo.
A causa registrada acima (#8327, API key sobrescreve) estava **errada**.

---

## [2026-05-30] Resolução: a assinatura era conta errada + arquitetura API-no-produto / cache-na-assinatura

**Contexto:** continuação. O "org disabled" NÃO era a API key — confirmado: sem `ANTHROPIC_API_KEY`
em nenhum escopo de ambiente (User/Machine/Process) e o erro persistia. O Claude Code estava logado
numa **conta errada** (vinculada a uma org que desabilitou Claude Code). Re-login com a conta pessoal
Pro (guichicotrip4@gmail.com) destravou; `check-agent-sdk.mjs` voltou a responder.

**Decisões:**
1. **Migração `research.ts` → Anthropic API + web search tool concluída** (interface intacta,
   validada — PRENSA 24s). Mantida mesmo com a assinatura de volta: é o caminho deploy-ready.
2. **Arquitetura: produto na API, cache gerado via assinatura.** `research.ts`/`dossier.ts` usam a API
   (rodam em qualquer lugar); os caches (research + dossiê) são pré-computados via Agent SDK na
   assinatura (custo zero). O pitch serve 100% do cache → ~$0 de API ao vivo.
3. **Não fazer deploy agora.** Pitch/Demo Day via tela compartilhada (localhost). Deploy fica
   disponível (research já na API) se um dia fizer sentido.

**Status:** ✅ Tomada e implementada. Fábricas de cache via assinatura: `cache-research-sub.mjs`,
`cache-dossier-sub.mjs`. Custo da sessão ≈ $0,21 (1 teste na migração); resto via assinatura.

---

## [2026-06-02/03] RACIONAL DAS MELHORIAS — o "porquê" pra usar no pitch

> Cada item: **o que** construímos, **por quê**, e **o que rejeitamos** (a parte que mais convence um
> juiz de PE/VC). Use isto pra responder "por que vocês fizeram X?" sem improvisar.

### 1. Reframe: tornar o deep-tech VISÍVEL, não ADICIONAR deep-tech
**Por quê:** "adicionar" um modelo difícil (GNN, fine-tune) não demoa em 60s e viola o anti-drift.
O que impressiona um juiz afiado não é tecnologia, é **insight não-óbvio que muda o processo**.
**Rejeitamos:** gold-plating técnico. O Boreal já era deep-tech; faltava mostrar.

### 2. Hindcast nominal como herói da prova (não "antes/depois de 2 semanas")
**Por quê:** "2 semanas → 30s" parece wrapper de GPT. Mostrar **empresas reais com nome** (Fischer,
Polimold) que venderam e o rank que demos ANTES do deal responde "como você sabe que funciona?" —
visceral pra VC (defensibilidade) e founder técnico (rigor). 76 deals, 50 no top decil.
**Rejeitamos:** narrativa de produtividade genérica.

### 3. Validação leakage-free (retroactive hit rate)
**Por quê:** ausência de lookahead bias é conceito que VC e founder de IA reconhecem na hora. É o
que separa "lista bonita" de "modelo que comprovadamente acerta". Ground truth minerado do CNPJ (de graça).

### 4. /consolidadores reenquadrado de PREDITIVO → DESCRITIVO
**Por quê:** rodamos backtest out-of-sample da previsão de próximo alvo → **lift 1,4× (≈ aleatório)**.
Vender como preditivo seria auto-gol se um juiz perguntasse "validou?". Mostrar o backtest honesto
VIRA força: "validamos, não se sustenta, por isso não vendemos como previsão". A força preditiva
mora na sucessão (66%).
**Rejeitamos:** overclaim. Honestidade como arma.

### 5. Tese das duas lentes (metalmec=sucessão, saúde=consolidação)
**Por quê:** revelada PELO DADO (densidade de roll-up é toda em saúde, zero em metalmec). Transforma
a fraqueza aparente (score fraco em saúde, 18%) em sofisticação: são dois jogos, temos o modelo dos dois.

### 6. /mercado: TAM honesto, SEM inventar R$ por empresa
**Por quê:** estimar EBITDA por proxy do CNPJ cheira a dado fabricado pra quem entende de PE. Levamos
o universo quente real (30.732) + giro real (0,46%); monetização só como **sensibilidade ilustrativa**
com premissas à mostra.
**Rejeitamos:** valuation fabricado.

### 7. Refino da tese: "congelado por falta de originação" overclaimava
**Por quê:** testamos com a coorte do CNPJ — **80% das quentes seguem paradas-viáveis** (não morrendo,
7% fecham, 0,5% vendem) → mata o "estão morrendo". MAS **Selic 13–15% (máx 20 anos)** confunde: venda
baixa é em parte cíclica. Tese refinada: **estoque viável sub-coberto + represamento cíclico + virada
de ciclo = originação contracíclica.** Pendência: discovery (ligar pra 10 donos) separa "não abordado"
de "não quer vender".

### 8. Memo: blocos quantitativos honestos, NÃO um DCF
**Por quê:** DCF com EBITDA fabricado de empresa que não se falou = auto-gol com juiz de PE; o Boreal
só tem CNPJ. Em vez disso: **precedentes** (M&A real do setor, da nossa mina) + **cenário de referência**
(faixas de mercado, não valuation) + **"pedir ao dono"** (o que falta pra ir de sourcing a IC).
**Rejeitamos:** projeção financeira fabricada. O princípio que blinda: *saber o que um memo de sourcing
deve e NÃO deve afirmar.*

### 9. Pipeline v2: o loop de outcome (o moat §17 do Playbook saiu do papel)
**Por quê:** o pipeline é onde o "retroactive hit rate" vira **hit rate realizado** — registra o desfecho
(contatado/respondeu/vendeu) e compara com o score previsto. É training data que um concorrente não compra
(defensibilidade) e o sistema que se auto-aprimora (rigor). Lente AI-native: sensor→outcome→aprende (face a)
+ company brain com DRI que coordena pessoas (face b). Prática de mercado: Affinity/DealCloud/4Degrees.
**Rejeitamos (YAGNI):** retreino ao vivo do score, captura automática de email, deal-execution/VDR/compliance.

### 10. Recalibração pros jurados reais
**Por quê:** painel = **Monica Saggioro (Maya, VC)** + **Henrique Vaz (Enter/IA jurídica, Sequoia)** +
Laura. Henrique Dubugras NÃO confirmado → Sharpe vira fio opcional. Demo serve os dois: prova/rigor pro
Vaz, moat/TAM pra Monica. Demo Day = soft pitch do Relay (seed VC + founder Sequoia na sala), não só os $10k.

**Status:** ✅ Tudo implementado e testado (PRs #23–#26). Racional consolidado aqui pra pitch.

---

## [2026-06-03] Pipeline UX: card colapsável + sort + filtro (escala com volume)

**Contexto:** com várias empresas salvas, o kanban floodou — tudo cai em "Identificado", cards altos
(todos os campos sempre visíveis), sem ordem nem prioridade. Não dá pra saber quem trabalhar primeiro.

**Decisão (prática de mercado Affinity/DealCloud — kanban é fluxo, densidade resolve volume):**
1. **Card colapsável** — colapsado mostra só nome · score · dono · próxima ação (vermelho + borda
   lateral se atrasada); expande no clique. Mata a poluição vertical.
2. **Ordenação na coluna:** atrasadas → próxima ação mais cedo → maior score. Resolve "quem primeiro".
3. **Filtro/busca:** texto (empresa/cidade/setor) + dono (DRI) + toggle "só atrasadas".

**Rejeitado por ora (YAGNI):** view de tabela densa pro backlog em massa — fica pro passo seguinte se
o volume pedir. Tudo client-side (sem schema/API novo).

**Status:** ✅ Implementado e testado no browser (compacto + sort + "só atrasadas" filtrando). PR #27.

---

## [2026-06-03] Look-alike (achar similares) — inspirado no Grata, com nosso dado

**Contexto:** o Guilherme mandou 3 vídeos do Grata (concorrente US de deal sourcing). Scrapeados via
Jina Reader (transcrição), não Chrome. A feature-bandeira deles é busca semântica + **similarity
matching** ("acha 1 boa → me dá mais como esta"). Achado estratégico: o sinal central do Grata é
**"ownership transitions → purchase-ready"** = literalmente a nossa tese. Validação externa do wedge.

**Decisão:** construir **look-alike** — dada uma empresa, achar as mais parecidas no universo. Similaridade
determinística e EXPLICÁVEL (CNAE + praça + porte + época), desempate pelo score de sucessão. `similar.ts`
(puro) + `/api/similar` + botão "achar similares" no card.

**Rejeitado (reforça diferenciação):** copiar o **EBITDA estimado "99% accuracy"** do Grata — nossa
credibilidade é justamente NÃO fabricar financeiro. "O Grata chuta EBITDA, nós não fingimos." Também
fora: marketplace de deals, contatos US, integrações CRM.

**Próximo (não agora):** **monitor de transições** — virar a mineração (hoje histórica, p/ ground truth)
em alerta forward ("empresa do pipeline teve mudança societária"). É o sensor do loop, e unicamente nosso
(snapshot-diff do CNPJ). Precisa de infra de snapshot periódico — fica pro Relay-produção.

**Status:** ✅ Look-alike implementado e testado via API (PRENSA → 12 similares, 75% NARDINI/SANCHES).
Grata salvo como entidade na wiki do segundo cérebro. PR #28.

---

## [2026-06-03] Monitor de transições — o sensor forward (o que mais diferencia do Grata)

**Contexto:** o Grata MONITORA transições societárias pra flag "purchase-ready". Nós minerávamos isso
só historicamente (ground truth). Virar forward = a peça que nos diferencia (nosso snapshot-diff do CNPJ
é único) e fecha o sensor do loop de outcome do pipeline.

**Decisão:** monitor que, pros CNPJs do pipeline, diffa o quadro societário entre dois snapshots do CNPJ
e detecta MUDANÇA (PJ entrou=aquisição; PF saiu=saída/falecimento→janela de sucessão; PF entrou=sucessão).
Arquitetura = demo-cache: `scripts/monitor-transicoes.mjs` (pesado, BigQuery) → `src/lib/monitor.json` →
UI lê instantâneo e mostra alerta no card. "Em produção é worker periódico; aqui é script."

**Validação:** rodado no pipeline real — **detectou mudança real na PRENSA** (sócio PF saiu 2023→2025,
janela de sucessão). Alerta renderiza no card (borda + banner vermelho).

**Próximo (produção, não agora):** worker periódico que re-roda e alerta; baseline = snapshot no save
(em vez de janela fixa); estender pro universo, não só pipeline.

**Status:** ✅ Implementado e testado via script (sem Chrome, a pedido). PR #29.

---

## [2026-06-04] Setor como 1ª classe — cobertura sector-by-sector (venture-scale)

**Contexto:** ideia do Guilherme — trabalhar setor por setor, cada um com sua peculiaridade/score.
Já provado pela tese das duas lentes. Refinamento na decisão: não é só "pesos diferentes" — às vezes é
uma LENTE diferente (sucessão × consolidação). E a calibração vem do loop de validação, NUNCA de knob manual.

**Decisão:** setor vira config de 1ª classe. `build-setores.mjs` valida os 3 (SP, leakage-free) →
`setores.json` → `setores.ts` (registry: CNAEs + lente + status do gate) → página `/setores` (cobertura,
recall validado, lente por setor). Aumentar cobertura = adicionar setor + rodar validação.

**Números validados (04/06):** metalmec recall 70% (✅ sucessão), saúde 17% (🔴 → lente consolidação),
educação 26% (🟡 itera, sucessão, N=27 pequeno; foco Relay é NE, aqui medido SP).

**Próximo (Step 4–5):** busca sector-aware (?setor escopa CNAEs) + **ingest saúde/educação no Supabase**
(hoje só metalmec ~2k indexado — é o gargalo real de cobertura).

**Pro clube:** metalmec segue herói; setores é a história venture-scale (infra sector-agnostic) p/ Monica.

**Status:** 🟡 Framework (config + página) feito e testado (PR #30). Ingest pendente.
