# Decisions — Decisões + Porquê

> Uma entrada por decisão que muda escopo, stack, nome ou lógica.
> Formato: data, contexto, decisão, status.

---

## [2026-07-02] Revisão end-to-end + execução (Tier 1 do piloto + polish)

**Contexto:** revisão completa do projeto amarrada ao objetivo (rodar o piloto Setter, provar conversão
e atribuição). Achado central: como demo está forte; o gap é a passagem pra "parceiro roda deal flow e a
gente prova que o lead foi nosso".

**Executado nesta sessão:**
- **Gate de acesso** (`src/middleware.ts` + `/acesso`): app fica privado quando `BOREAL_GATE_PASSWORD`
  está setada (cookie HMAC, sem Supabase Auth). Fecha o buraco de "pipeline público". Ativar na Vercel.
- **Selo de proveniência** (`migration 0005` + `lib/proveniencia` + `/api/proveniencia` + `/proveniencia/[id]`):
  prova assinada de origem/data/score/"novo pro CRM deles". Destrava o success fee. **Falta aplicar a
  0005 no banco + plugar o botão "selar" na entrega.**
- **Teste do score** (`scoring.test.ts`, runner nativo do Node): trava o IP antes de evoluir.
- **Feature saída-do-Simples: VALIDADA como preditiva, mas PARQUEADA (revisão 03/07).** O
  `valida-simples-porte.mjs` mostrou lift 1,8-4,6x dentro de cada banda de porte. MAS "prevê aquisição"
  ≠ "mede risco sucessório": sair do Simples = a empresa CRESCEU (estourou o teto de R$4,8M), sinal de
  crescimento, quase o oposto do perfil sucessório (dono desengajado/sem herdeiro). Enfiar no score de
  sucessão borra o que diferencia o Boreal da Grata. Cobertura ainda é baixa no alvo (só ~12% das
  adquiridas DEMAIS saíram do Simples; mid-market costuma ser Lucro Real). **Decisão: NÃO entra no score
  de sucessão.** Se um dia servir, é na lente de consolidação ou como qualificador de porte ao lado do
  score, nunca misturado. (Correção da 1ª leitura, que dizia "entra após recalibrar".)
- **Polish:** README real, comentário defasado da ponte de empresa, "1 Issue" do dev = não reproduz.

**Não feito (precisa de decisão/infra):** fechar o loop de outcome (2a, precisa de dado do piloto),
sensor forward vivo (2c, feature maior), integração da feature Simples (ingest + recalibração),
estimativa de tamanho no memo (decisão de produto), créditos da API (billing), aplicar migrations.

**Status:** ✅ Tier 1 entregue em código; ativação depende de aplicar migrations + envs na Vercel.

---

## [2026-07-02] Data lake / RAG de enriquecimento: NÃO construir agora (sonda matou a premissa)

**Contexto:** Taylor lembrou o Guilherme da possibilidade de um "data lake" com várias bases (crédito,
financeiro) + RAG pra melhorar scraping e análise de empresas. Ideia atraente, mas avaliada com a lente
crítica antes de aceitar.

**Crítica (3 reframes):** (1) O data lake já existe — a basedosdados É o maior data lake público do BR e o
Boreal já roda em cima dela por CNPJ; falta ENRIQUECER a espinha, não construir infra (YAGNI). (2) RAG é
ferramenta errada pra dado estruturado (crédito/dívida/financeiro): quer SQL/tool-use preciso por CNPJ, não
busca vetorial por similaridade; RAG só serve pra texto (site raspado, notícia). (3) Crédito/financeiro é
paywalled pro segmento (PME familiar de capital fechado): score é proprietário (Serasa/LGPD), financeiro
real só de S.A. aberta (CVM). Mira certa = fontes públicas de porte/distress.

**Sonda barata (uma tarde, `scripts/sonda-distress.mjs`) pra decidir antes de construir:**
- **Feasibility:** RAIS/CAGED na basedosdados NÃO têm CNPJ (anonimizados por município+CNAE) → sinal de
  tamanho não linka. PGFN dívida ativa existe (aberta, por CNPJ) mas fora do acesso BigQuery atual e sem
  histórico pra testar "antecede". Os dois melhores sinais públicos estão fora de alcance barato.
- **Teste de sinal (dado CNPJ-linkável em mãos, `br_me_cnpj`):** distress ANTECEDE o deal? Tratamento =
  7.877 aquisições limpas vs controle = 9,2M matriz ativa idade>=5. Resultado CONTRARIA a hipótese:
  saída do Simples pré-2023 = 22,0% vs 7,2% (**3,06x**), mas isso é TAMANHO (empresa estourou o teto de
  R$4,8M), não distress; ex-MEI 0,16x e não-ativa@2023 0,27x (adquiridas eram MAIS saudáveis). Alvo é
  empresa média sólida com dono envelhecendo, não empresa em aperto financeiro. Pressão é geracional, não
  de balanço.

**Decisão:** **não construir o enriquecimento/lake/RAG agora.** A premissa (cruzar crédito/financeiro pra
achar pressão) não se sustenta nos dados; produto ainda sem modelo validado; gargalo real é relacional
(confiança) e prazos duros são outros (piloto Setter, SAT). A sonda custou uma tarde e evitou construir uma
camada inteira sobre premissa falsa.

**Backlog (o único nugget acionável):** saída do Simples/MEI como **proxy de PORTE** está de graça na
`br_me_cnpj.simples` (sem fonte nova). Vale testar como feature do score com lift/hold-out decente antes de
confiar (o 3,06x é confundido com tamanho e cross-seccional, não é lift validado). É o "qualificar por
tamanho" que parecia perdido quando a RAIS não linkou.

**Status:** ✅ Decidida. Sonda em `scripts/sonda-distress.mjs` (reproduzível).

---

## [2026-07-01] Heat-map: limpeza do sinal de M&A (SPE/holding + universo ativo + escala log)

**Contexto:** o sinal cru "PJ entra + PF sai entre 2 snapshots do CNPJ" (14.486 candidatas) NÃO é M&A;
mistura três coisas. Crítica dos dados a pedido do Guilherme, confirmada por diagnóstico de idade
(`diag-spe.mjs`): os setores que apareciam mais "quentes" (Finanças, Imobiliária, Construção, Energia)
tinham 40-48% das "aquisições" em empresas com <5 anos = **SPE/newco e reorganização de holding
familiar**, não venda de empresa estabelecida. Um sócio da Setter derrubaria em 10s.

**Três correções (build-heatmap-setores.mjs):**
1. **Universo só ativo** — `situacao_cadastral='2'`. Antes contava as 30,2M matriz **baixadas** ('8')
   contra 26,1M ativas ('2'); o denominador estava inflado >2x, afundando a densidade de todo mundo.
2. **Idade ≥ 5 anos** na adquirida (no corte) — remove SPE/newco. Efeito **diferencial**: corta ~50% de
   Energia/Finanças/Aux.fin (jovens) e só ~15% de metalmec (velhos). É o de-viés que importa.
3. **Filtro de holding cirúrgico** — só em construção/imobiliária/energia (41/42/43/68/35), onde a SPE é a
   forma legal dominante (patrimônio de afetação, SPE-por-usina). Exclui a candidata em que **só entraram
   PJ de holding/participações/incorporadora** (reorganização, não venda). Imobiliária 0,317→0,093;
   Energia 0,415→0,196; metalmec intacto.
   - **Testado e REJEITADO como filtro global:** cortava 60-73% de TODOS os setores igualmente, inclusive
     os validados (Máquinas 81→29), porque nome "Participações" não separa holding-da-família de
     holding-do-adquirente (PE/estratégico entra via SPV). Efeito não-diferencial = não é filtro de
     artefato. Só vale nos setores SPE-heavy. As flags `novos_op/novos_hold` ficam gravadas no ground
     truth pra refino de precisão futuro.

**Resultado:** 14.486 brutas → **7.877 limpas (54%)**. Ranking nacional de densidade agora honesto:
topo = indústria/consolidação de empresa madura (Bebidas, Química, Equip.elétricos, **Máquinas 0,359**);
Finanças caiu pro meio (0,220); Imobiliária/Construção foram pro fundo.

**Escala de cor (heatmap.ts):** a densidade é fortemente assimétrica (mediana 0,04% vs cauda >0,5%).
Linear jogava 90% no escuro e dava branco só pra cauda → **log min-max**. E **PISO_N 10→15** pra suprimir
densidade de n pequeno (Farmacêutica n=11 tinha 1,43% e sequestrava a escala). **Cor:** monocromático
quente (cinza→branco), mas a escala linear deixava o meio claro demais (parecia tudo branco). Corrigido
com **gamma 1,6** (mantém o grosso escuro, só o topo acende) + faixa alargada (L 12%→94%). Luminância
final 31→100(mediana)→240: o quente vira branco e salta. Testei uma rampa âmbar pra dar mais contraste,
Guilherme vetou (feio) — fica monocromático. Sem verde/vermelho/ocre (semântica de risco é do score).

**Timespace e cadência (respondido, não vira código agora):** janela = 2 snapshots (10/06/2023 →
09/11/2025, ~2,42 anos), é foto, não fluxo (não vê timing, conta transição dupla como uma, `deals/ano`
assume taxa constante). basedosdados atualiza ~mensal; M&A é lento → re-minerar **trimestral/semestral**,
janela **deslizante** de ~2 anos (fixar o corte incha e envelhece).

**Ground truth (`scripts/data/aquisicoes-br.json`):** agora guarda TODOS os campos crus por aquisição
(idade, situação, natureza das PJ entrantes) → dá pra re-filtrar qualquer política **sem re-consultar o
BigQuery** (`reaggregate-local.mjs` faz isso). Pra validar recall fora dos 3 setores, usar o subconjunto
`limpa`, não as 14.486 brutas.

**Resíduo assumido (honesto):** (a) Finanças 0,220 pode ter holding financeira legítima (CNAE 64/66 É
holding) — não filtrei porque seria circular; (b) idade≥5 é piso, sobra SPE de 5-8 anos em energia/imob;
(c) morte de sócio sem venda dispara o mesmo sinal. Rótulo do mapa diz "troca de controle observada",
não "deal previsto"; o dot marca onde há recall validado.

**Status:** ✅ Tomada e implementada. Verificado no browser (BR + regiões renderizam, gradiente legível).

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

**Status:** ✅ Framework + ingest (saúde/educação) feitos (PR #30, mergeado).

---

## [2026-06-04] Score por lentes + recall de educação — o label estava sujo, não o score

**Pergunta do Guilherme:** dá pra aumentar o recall de educação (26%)? + fazer score por lentes.

**Achado (decomp de educação, validacao-decomp.mjs):** o 26% geral mistura jogos. Decompondo o M&A
de educação por perfil do alvo: sucessão clássica (sócio 61+ E 25+) = **88% de recall**; o resto
(67%, consolidação por grupos tipo SEB/Inspira) = 0%, e o score CORRETAMENTE não pega. Medindo o
recall só nas vendas de sucessão (onde a lente vale), os 3 setores: **metalmec 97%, saúde 100%,
educação 88%.** O score de sucessão não é setor-específico-quebrado — ele acerta ~90–100% nas vendas
de sucessão em todo lugar. O "baixo" geral é cobertura do jogo, não falha do score.

**Decisão (score por lentes):**
1. `build-setores` mede **recall nas vendas de sucessão** (o número honesto) + **% do M&A que é
   sucessão** (o jogo do setor). Status pelo jogo: ≥40% sucessão · 20–40 misto · <20 consolidação.
2. `/setores`: headline vira "acerto nas vendas de sucessão" (88–100%), com o % do jogo ao lado.
3. `scoring.ts`: flag **`perfil_sucessorio`** (sócio 61+ E empresa 25+) = onde a lente vale. Chip
   "perfil sucessório" no card = alta confiança. Fora dele, o deal provável é consolidação.

**Não fiz (honestidade):** chutar pesos pra perseguir o 26% geral — seria perseguir deals de
consolidação que o score de sucessão não deve prever. A lente certa é medir/operar no perfil certo.

**Status:** ✅ Implementado e testado (curl): /setores 97/100/88%, busca educação 38/50 perfil_sucessorio. PR #31.

---

## [2026-06-04] Robustez: validação Brasil-inteiro (a amostra se sustenta)

**Pergunta do Guilherme:** aumentar a amostragem (educação N=8 frágil). **Distinção que registrei:**
ingerir mais no Supabase = cobertura de busca, NÃO aumenta o N da validação (que já roda no universo
cheio do BigQuery). O lever certo é GEOGRAFIA — rodar Brasil-inteiro em vez de só SP.

**Resultado (validacao-nacional.mjs):** o recall nas vendas de sucessão se sustenta com N 2–6× maior.
metalmec 97%→100% (N 37→79), saúde 100%→99% (N 22→137), educação 88%→83% (N 8→24). Total N=240.
Educação saiu de frágil pra robusto. Persistido no bloco `nacional` do setores.json + linha "confirmado
Brasil-inteiro" na página. App segue SP (cobertura); o recall é propriedade do score, vale nacional.

**Status:** ✅ PR #32.

---

## [2026-06-04] Melhorias pós-setores: velocidade + worklist + trajetória (afiar, não dispersar)

**Contexto:** "o que melhorar?". Filtro aplicado (mesmo do anti-drift): o app já tem muita feature; o
ROI pro clube é afiar/provar + utilidade on-thesis, não inflar escopo. Guilherme escolheu 3 dos 4
(deixou "fechar o loop" de fora — é camada humana, não código).

1. **Velocidade (afiar pro demo):** browse de setor ia ao vivo (~30s pelo reasoner). Cache pré-computado
   (`build-setor-cache.mjs` → `setor-cache.json`, padrão demo-cache). Saúde/educação agora instantâneos
   (0,03–0,84s). O demo nunca trava.
2. **Worklist (`/worklist`):** a view "ligar hoje" — junta as peças (score + perfil sucessório + contato +
   one-liner do reasoner) num worklist priorizado e acionável (tel:/mailto:, salvar no pipeline). Responde
   à crítica de utilidade, on-thesis (só perfil sucessório, onde a lente vale).
3. **Trajetória societária (`/api/trajetoria`):** deep-tech on-thesis — reconstrói o quadro em 5 snapshots
   (2022→2025) e detecta a sucessão EM MOVIMENTO: sócio envelhecendo de faixa, herdeiro entrando, sócio
   saindo. Validado na PRENSA: Ubirajara cruzou 71-80→80+ em 2023; Ludovico saiu em 2025. Painel no card.

**Não fiz (disciplina):** retreino do score (já valida 88-100%), score de consolidação (anti-drift),
deploy (decisão do time é localhost no Demo Day).

**Status:** ✅ Os 3 implementados e testados (API/curl, sem Chrome). PR #33.

---

## [2026-06-04] Sistema de tipografia/cor v1 — decisões de aplicação

**Contexto:** aplicação do sistema documentado em `brand/uso-tipografia-cor.md` nas páginas.
Várias micro-decisões de design fechadas durante sandboxes.

**Decisões:**

1. **`strong` sem cor em prosa** — ênfase = Bone 600. Exceção: termos que funcionam como
   sub-títulos (ex: "Ground truth de graça." nos passos da metodologia) → `strong text-floral`.

2. **Números mono (`font-data`) nunca recebem `strong`** — peso 600 em Plex Mono fica
   visivelmente pesado demais. Destaque por cor (Floral) sem mudança de peso.

3. **Loop de outcome (pipeline)** — "Desfecho positivo/negativo": Bone semibold (label);
   número: Floral regular (opção C do sandbox). Justificativa: é leitura de dados, não prosa.

4. **Nav ativo — Opção B** — ativo = `text-floral`; inativos = `text-bone/70 hover:text-bone`.
   Floral reservado ao ativo; hover dos inativos sobe só até Bone 100, nunca alcança Floral.

5. **Back link padronizado** — todas as páginas: `font-data text-[11px] uppercase tracking-wider
   text-floral`, seta `←` com `group-hover:-translate-x-1`, `items-start` no header flex.

6. **"já adquiridas" e links** — contagem e links que estavam em ocre → Floral (ocre só pra
   succession risk score).

**Status:** ✅ Etapas 3–5 aplicadas. Etapa 6 (mercado) + /setores + /worklist pendentes.

---

## [2026-06-04] Varredura de auditoria — alinhar o app com a tese (6 fixes)

**Contexto:** Guilherme pediu varredura completa pra achar o que está errado/inconsistente. Achados e fix:

1. **demo-cache sem `perfil_sucessorio`** (gerado antes do flag) → o chip não aparecia nas buscas
   canônicas da home. Fix: `patch-demo-cache-perfil.mjs` computa o flag deterministicamente (150 empresas).
2. **/mercado só com 2 dos 3 setores** → faltava educação no TAM e na coorte. Fix: build-tam + coorte
   regenerados com educação; cópia da página ("3 setores").
3. **/consolidadores metadata e texto** ainda diziam "prever o próximo alvo"/"66%" → contradiz o reframe
   honesto + anti-drift. Fix: metadata descritiva, "97% nas vendas de sucessão".
4. **Headline FRACO na vitrine (o principal):** home/validacao lideravam com "67%" (overall, dilui com
   consolidação) em vez do número honesto e forte da moldura de sucessão. Fix: home e /validacao agora
   lideram com **97% das vendas de sucessão** (metalmec, confirmado Brasil-inteiro), com o 67% geral como
   contexto. **Fonte única: setores.json** (mata a divergência 66/67 vs 97 — /validacao importa de lá).
5. **66% × 67% solto** (hindcast/consolidadores) → alinhado na moldura de sucessão.

**Confirmado certo:** sem EBITDA fabricado, scoring honesto, nav 6/6, setor-cache com flag.

**Status:** ✅ Todos corrigidos e testados (curl). PR #34.

---

> ⚠️ **Entradas retroativas (registradas em 11/06).** As duas decisões abaixo foram tomadas na
> sessão de 01/06 (PR #22) mas não chegaram a ser logadas no brain na época — só o segundo cérebro
> foi atualizado. Registradas aqui depois. Cronologicamente precedem as decisões de 04/06 acima.

## [2026-06-01] Cores de risco reservadas para score/severidade — destaque editorial é neutro

**Contexto:** ao destacar "Tese de aproximação" e "Próximo passo" no memo, a cor `risk-mid` (ocre)
estava sendo usada tanto pra score médio nos cards quanto pra realçar texto editorial. Mesma
ambiguidade já vista na lane "Qualificada" do pipeline (ocre = "atenção/risco médio"?).

**Decisão:** terracota (`risk-high`) e ocre (`risk-mid`) ficam **exclusivas** de sinalização de
score, badge de tier e severidade de red flags. Destaques editoriais (tese, próximo passo, lanes do
pipeline) usam paleta neutra (hairline, bone, surface-hover). Regra vale pra qualquer elemento
editorial futuro.

**Consequência:** tese `border-risk-mid` → `border-bone/30`; próximo passo → `bg-surface-hover`;
lanes do pipeline → `border-floral/15` uniforme. Validado em sandbox com os 3 tiers lado a lado.

**Status:** ✅ Implementada (PR #22).

---

## [2026-06-01] Badge do card: tier (ALTO/MÉD/BAIXO) no lugar do rank

**Contexto:** o badge mostrava o número de rank (01, 02…) abaixo do score. Mas a investigação com
IA altera o score (sobe/desce), o que mudaria a ordenação — o rank impresso fica infiel sem
re-ranking, e re-rankear a lista a cada investigação é complexidade de estrutura desnecessária.

**Decisão:** trocar o rank por um rótulo de tier derivado do score atual (`scoreTier`: ≥70 alto,
≥50 médio, <50 baixo). Sempre fiel — seja score v0 ou v1 pós-investigação. Atualiza junto com o
delta `↑/↓` sem nenhuma lógica de ordenação extra.

**Status:** ✅ Implementada (PR #22).

---

## [2026-06-03] Sistema de tipografia/cor v1 — decisões fundamentais

> ⚠️ Entrada retroativa registrada em 2026-06-11. A sessão de 03/06 não foi salva no brain do Boreal
> na época (só o segundo cérebro pessoal). Este registro fecha o gap. São as decisões **fundamentais**
> que originaram `brand/uso-tipografia-cor.md`; as decisões de **aplicação** subsequentes (etapas 3–5)
> estão na entrada de [2026-06-04] mais abaixo.

**Contexto:** as páginas novas do Guilherme (validação, mercado, consolidadores, pipeline v2) usavam o
ocre (`risk-mid`) como cor de destaque genérico (links, métricas, passos) — viola "cor de risco só pra
score". Faltava um sistema explícito de quando usar cada fonte/peso/cor/opacidade. Decisões fechadas via
sandbox HTML (antes/depois) nesta sessão e documentadas em `brand/uso-tipografia-cor.md`.

**Decisões:**

1. **Contraste por peso, não por cor** — ênfase no corpo = `strong` peso 600 na mesma cor. Floral e Bone
   não se misturam na mesma frase como ênfase (poluem); convivem entre blocos (síntese Floral + corpo Bone).

2. **Corpo de leitura = Bone em 15px** — Floral (quase-branco) em volume cansa/hala; o desconforto do Bone
   era o tamanho 14px, não a cor. Bone 15px é confortável e mais sóbrio ("Private, not loud").

3. **Regra híbrida** — síntese/impacto curto em Floral; leitura longa em Bone. **Exceção:** painel compacto
   (card/memo) usa corpo Floral — bone "apaga" o painel; a regra de bone-pra-leitura vale só pra páginas de prosa.

4. **`strong` = 600 global** (`globals.css`), sem cor própria — mata o faux-700 sintetizado (borrado).
   Plex Sans `400/500/600` (remove o 300).

5. **Escala de opacidade fixa** — /100 · /70 · /45 (acaba com `/55`, `/30` arbitrários). Labels de seção = Bone/70.

6. **Ocre/terracota só pra score de succession risk.** Link/ação = Floral. Exceção registrada: box
   "Por que agora" (gatilho de timing) usa terracota como alerta de oportunidade.

**Status:** ✅ Documentado em `brand/uso-tipografia-cor.md`. Etapas 0–2 aplicadas nesta sessão; 3–5 em 04/06.

---

> ⚠️ **Entrada retroativa (registrada em 11/06).** A sessão de 05/06 não foi salva no brain do Boreal na
> época — só o segundo cérebro pessoal. Logada aqui depois. Evolui o "Sistema de tipografia/cor v1" de
> 04/06 acima para **v3**, com os padrões fechados durante o restyle profundo de /validacao (card hero,
> contraste, a11y). Documentado em `brand/uso-tipografia-cor.md` v3.

## [2026-06-05] Sistema de tipografia/cor v3 — contraste, statement de seção e figura editorial

**Contexto:** o restyle profundo de /validacao + a crítica do `$impeccable` (25→29/40) expuseram lacunas
do v1: labels em Olive reprovando WCAG, captions misturando dois papéis, e nenhum padrão pro número que
lidera uma frase. Fechado em sandbox e aplicado na página.

**Decisões (incremento v1 → v3):**

7. **Step de opacidade /60** — adicionado entre /70 e /45. Uso: caption informativa (texto secundário ao
   claim principal mas que ainda carrega dado). Passa WCAG AA (~4,7:1). Escala vira /100 · /70 · /60 · /45.

8. **Caption split em dois tiers** — caption informativa (dado que o leitor precisa, ex: "67% contando
   todas") = Bone/60; assinatura/rodapé puro (fonte, data de geração) = Olive. Olive em caption informativa
   reprova contraste (~2,5:1).

9. **Label de seção repetível = Bone/70, não Olive** — o eyebrow Olive é **único por página** (decoração de
   abertura). h2/labels de seção que se repetem usam Bone/70. Confundir os dois gera excesso de Olive e
   reprova WCAG (Olive em Smoky ~2,7:1).

10. **Statement de seção (h2 editorial)** — quando a seção tem argumento central e não é só rótulo
    estrutural: eyebrow Bone/70 + h2 `font-display` Floral 22px. Máximo um por página.

11. **Figura editorial (número que lidera frase)** — número-herói que faz parte da frase usa `float-left`
    com `display:flow-root` no pai (**nunca `overflow:hidden`** — corta o glifo). Tamanho 64–84px; o texto
    flui ao redor.

12. **Stats block pós-figura** — credenciais que saem da prosa (lift, confirmação nacional) ficam num bloco
    separado por `border-t border-hairline`: valor `font-data text-[22px] font-medium text-floral`, caption
    `font-data text-[11px] text-bone/70`.

13. **De-ênfase em tabela = mesmas cores em /70** — linhas descartadas/secundárias mantêm a linguagem de
    cor da tabela (Floral nome, Bone números) rebaixada em /70; não trocam pra Olive (que é cor diferente,
    não versão atenuada).

14. **Focus ring padrão em links** — todo `<a>` interativo:
    `focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 rounded-sm`.

15. **`scope="col"` em `<th>`** — toda célula de cabeçalho de tabela, para leitores de tela.

**Status:** ✅ Documentado em `brand/uso-tipografia-cor.md` v3. Aplicado em /validacao (05/06) e
/consolidadores (06/06).

---

> ⚠️ **Entradas retroativas (registradas em 11/06).** As duas decisões abaixo foram tomadas na sessão
> de 06-07/06 (restyle etapas 8-9 + PR #35) mas não chegaram a ser logadas no brain na época — só o
> segundo cérebro pessoal. Registradas aqui depois. Estendem regras anteriores de cor/brand.

## [2026-06-07] Error state monocromático — sem cor de alarme (variantes C e B)

**Contexto:** /worklist mostrava empty state genérico ("Nenhum alvo…") mesmo em erro de rede, e a home
não tinha tratamento visual de erro de busca distinto. A proposta inicial usava terracota (`risk-high`)
pra sinalizar o erro, mas em volume ficou colorido demais e brigava com a regra de 01/06 ("cor de risco
só pra score/severidade"). Mensagem 100% em Bone, por outro lado, ficou monótona.

**Decisão:** estado de erro usa paleta neutra, sem terracota/vermelho, em duas variantes conforme o
contexto:
- **Variante C (async / worklist):** mensagem `text-bone` + botão retry `border-hairline` (hover →
  `border-floral/40`). Para falhas de carregamento de lista.
- **Variante B (síncrono / home):** label Olive mono uppercase ("Erro na busca") + mensagem Bone 15px +
  `py-10` de respiro vertical + botão retry. A prominência vem do **label + respiro**, não da cor.

Erros inline nos cards (investigação/memo/similares/trajetória): `text-risk-high` → `text-bone/70` com
copy impessoal ("Não foi possível carregar…", não "não consegui").

**Por quê:** estende a regra de 01/06 — cores de risco são exclusivas de score/severidade, nunca de
estado de UI. Testadas 3 variantes em sandbox contextual; a B venceu a A (centralizada com `font-display`,
"gritante demais") por dar destaque sem o peso de uma cor de alarme.

**Status:** ✅ Implementada. Variante C em /worklist (PR #35), variante B na home (PR #35). Padrão para
todos os estados de erro assíncronos do Boreal.

---

## [2026-06-07] Banimento de side-stripe border (`border-left > 1px`) em cards

**Contexto:** EmpresaCard usava `border-l-2` por tier (vermelho/laranja/neutro) e a "tese de aproximação"
tinha uma borda lateral colorida. O `/review` (impeccable) marcou ambos como **absolute ban**: borda
lateral colorida > 1px em cards/list-items/callouts é tido como tell de design genérico, nunca intencional.

**Decisão:** remover toda `border-left`/`border-right` colorida > 1px de cards e blocos editoriais. A
hierarquia passa a vir de borda completa (`border-hairline`), tint de fundo (`hover:bg-surface-hover`),
ou simplesmente da tipografia — não de uma faixa lateral. EmpresaCard ficou com `border border-hairline`
uniforme; a tese hairline manteve só a indentação (`pl-3`), sem a borda.

**Por quê:** alinha o Boreal à regra do impeccable e ao princípio de que a cor de tier já é comunicada
pelo badge de score (ALTO/MÉD/BAIXO) — a faixa lateral era redundante e adicionava ruído visual.

**Status:** ✅ Implementada (PR #35, home/etapa 9).

---

> ⚠️ **Entrada retroativa (registrada em 11/06).** Decisão tomada na sessão de **07/06** (restyle home
> Fase 1 / PR #37), logada só no segundo cérebro pessoal na época. Registrada aqui para fechar o gap.

## [2026-06-07] Home = superfície de triagem; profundidade na página da empresa (arquitetura Fase 1/Fase 2)

**Contexto:** os recursos pesados do card (investigar com IA, memo, similares, trajetória) estavam todos
inline na home, deixando o card alto e a lista de ~50 empresas inviável de varrer (demorava pra chegar na
empresa 50). Discussão sobre como um analista de M&A realmente trabalha no sourcing.

**Decisão:** a home é uma **superfície de triagem** — o analista varre rápido decidindo "vale aprofundar?",
e o card mostra só o essencial de triagem (score + sinal de sucessão + porte/capital + fundação + sócio
mais velho). A **profundidade vai pra uma página própria da empresa** (`/empresa/[id]`, Fase 2), clicável
a partir da **busca E do pipeline** (o analista revisa muitas empresas e não as lembra só pelo nome).
Mapeia o funil de sourcing: universo + triagem (home) → deep dive (página da empresa) → outreach
(pipeline/worklist). Execução em 2 fases: Fase 1 (card stats, navbar/mega-menu, switcher, copy, fixes —
PR #37, feita) e Fase 2 (página da empresa + card magro + pipeline em abas + similares funcional + score
explainer).

**Sub-decisões da mesma sessão:**
- **Porte honesto:** mantém os termos da Receita (ME/EPP/DEMAIS; DEMAIS = médio/grande). Não se separa
  médio de grande nem se estima faturamento/EBITDA — estende a regra de 29/05 ("não fabricar financeiro";
  é o diferencial vs. o Grata, que chuta EBITDA). Porte + capital social são o único sinal de tamanho que
  o dado público dá.
- **Trajetória fora da home:** sai do card (query BigQuery ao vivo, pesada) e vira cache + painel na
  página da empresa. Rota/lib preservadas; handoff no `pending.md`.

**Consequência:** o card vira componente de apresentação leve → a lista escala sem paginação. As ações
pesadas deixam de ser dead-ends inline e ganham contexto na página da empresa.

**Status:** 🟡 Fase 1 implementada (PR #37). Fase 2 especificada no `pending.md`, pendente.

---

> ⚠️ **Entrada retroativa (registrada em 11/06).** Decisão tomada na sessão de **08/06** (Fase 2 /
> PR #38), logada só no segundo cérebro pessoal na época. Registrada aqui para fechar o gap.

## [2026-06-08] Navegação para /empresa/[id] via ponte sessionStorage (temporária)

**Contexto:** a Fase 2 (decisão de 07/06) precisava da página `/empresa/[id]` clicável a partir da busca e
do pipeline. A página precisa do objeto `Empresa` (com `score.breakdown`, sócios, contato). A rota canônica
`GET /api/empresa/[id]` é domínio do motor (Guilherme) e ainda não existia — esperar por ela bloquearia a
interface no handoff.

**Decisão:** a home e o pipeline já têm o objeto `Empresa` completo em memória quando o usuário clica num
card. Em vez de re-buscar no servidor, guardar o objeto em `sessionStorage` no clique (`storeEmpresa` +
`storeOrigin`) e a página lê de lá no mount. Todo o conhecimento do mecanismo fica **isolado num único
módulo** (`src/lib/empresa-store.ts`) — quando o `GET /api/empresa/[id]` existir, troca-se `readEmpresa`
por um fetch sem tocar na página. A ponte vira fallback / otimização de primeiro paint.

**Sub-decisão (UX):** o **nome da empresa** no card vira o `Link` de navegação, não o card inteiro. O card
tem ações próprias (Investigar/Memo/Similares/Ver detalhes) que precisam continuar clicáveis de forma
independente; tornar o card inteiro um link sequestraria esses cliques. Affordance "ver perfil →" no hover
do nome. No pipeline, o link mora dentro do detalhe expandido (o header do card já é o gatilho do accordion).

**Por quê:** desbloqueia a interface sem depender do motor (regra de domínio #20 — `types.ts` é o contrato;
a interface não espera implementação do backend pra navegar). O custo é uma página que não sobrevive a link
direto / refresh (o `sessionStorage` só tem a empresa se você passou pela busca) — aceitável no protótipo, e
explicitamente isolado pra ser substituído pelo endpoint depois.

**Status:** ✅ Implementada (PR #38, `a60b01c`). Dependência `GET /api/empresa/[id]` registrada no
`pending.md` como handoff/polish (refresh + deploy + link direto).
**Atualização (08/06 noite):** a ponte deixou de ser o único caminho — o `GET /api/empresa/[id]` foi criado
na mesma noite (decisão abaixo) e a página passou a hidratar pelo id. O sessionStorage virou só otimização
de primeiro paint + overlay do score_v1, exatamente como previsto.

---

> ⚠️ **Entrada retroativa (registrada em 11/06).** Decisão tomada na sessão de **08/06 (à noite)** — distinta
> e posterior à da ponte sessionStorage acima (manhã / PR #38). Logada só no segundo cérebro pessoal na
> época. Registrada aqui para fechar o gap. Código na main (`138249b`).

## [2026-06-08] `GET /api/empresa/[id]` criado — a página busca os próprios dados pelo id

**Contexto:** abrir empresa pela pipeline mostrava quadro societário vazio, sem barras de breakdown e score 0.
Raiz: a página dependia 100% do objeto guardado no sessionStorage, e pela pipeline só chega o `Pick<Empresa,…>`
parcial de `Oportunidade.empresa` (sem sócios/score/breakdown). O Maguto questionou: "não é a mesma página da
home? por que não funciona igual?" — sim, é a mesma página; o que difere é o **dado que a alimenta**.

**Decisão:** a página `/empresa/[id]` deve **buscar os próprios dados pelo `id`**, não depender da bagagem do
caller. Criado `src/app/api/empresa/[id]/route.ts` — GET que retorna a `Empresa` completa (sócios + `score`
via `calcScore` + breakdown), espelhando a query da rota de research (incluindo `telefone`/`email`/
`cnaes_secundarios`, que o select da research omite). A página hidrata pelo id: paint instantâneo do
sessionStorage + fetch canônico quando o objeto vem parcial (pipeline) ou nulo (link direto). Link direto e
refresh passaram a funcionar; o estado "não encontrada" só dispara em 404 real.

**Cruzamento de domínio:** `api/` é do Guilherme (regra de domínio: motor define `lib/`/`api/`, interface
renderiza). Criei mesmo assim por ser bloqueador da UI e ~20 linhas espelhando código existente. **Registrado
no `pending.md` com ⚠️ avisar Guilherme** para ele não duplicar. Supera o handoff que a decisão da ponte
(manhã) tinha deixado em aberto.

**Por quê (vs. alternativas):** alargar o payload do pipeline pra carregar a `Empresa` cheia duplicaria dado
e incharia a lista; o GET por id é a fonte de verdade única, robusta a qualquer entrada (busca, pipeline, link
direto, refresh, deploy). A ponte sessionStorage continua como otimização de primeiro paint + overlay do
score_v1 pós-investigação (`storeScoreConhecido`/`readScoresConhecidos`).

**Status:** ✅ Implementada (`138249b`, na main). Pendência: avisar Guilherme da rota.

---

> ⚠️ **Entrada retroativa (registrada em 11/06).** Decisão da sessão de **08/06 (à noite)**, logada só no
> segundo cérebro na época. Registrada aqui para fechar o gap. Código na main (`138249b`/`a639e25`); brand
> guide v3 atualizado (decisões #16 e #17).

## [2026-06-08] Barras do breakdown do score na cor do tier (brand guide #16/#17)

**Contexto:** no scaffold (PR #38, manhã) as 4 barras de dimensão do score eram **neutras (bone)**, com a
regra "cor de risco só comunica o total, nunca a sub-dimensão". Ao revisar à noite, o Maguto pediu que as
barras seguissem a cor de risco da empresa (amarelo se médio, terracota se alto). Iterado em sandbox (bone →
floral → terracota → cor do tier da empresa).

**Decisão:** as barras usam `TIER_STYLES.bar` (risk-high/70, risk-mid/70, bone/60). Registrado no brand guide
como **decisão #16** — refina a regra "ocre = só score": o ocre vive no total **e** no breakdown que o compõe
(ambos são score), nunca em link/CTA/decoração. Reverte a sub-decisão "barras neutras" da manhã. **Decisão
#17** (do mesmo `/review`) reforça: caption informativa nunca em Olive na página da empresa (corrige o achado
crítico de contraste — nota das seções/"sócio desde"/meta dos similares → Bone/60–70; Olive só em assinatura
e divisores).

**Não resolvido (pendência aberta):** o **caminho B** — fazer as barras refletirem o *delta da investigação*
(não só a cor). Implementei um helper `breakdownAjustado` (em `format.ts`) que redistribuía o ajuste da IA
sobre as barras com soma fechando em `score_v1` (mapeamento sinal→dimensão + cascata por teto/piso, 100% no
frontend, sem tocar `research.ts`) e **revertido a pedido** antes de commitar. O gráfico ainda mostra o
breakdown v0 enquanto o número mostra o v1. Alternativa descartada na hora: opção A (escala proporcional das
barras por `score_v1/score_v0`).

**Status:** ✅ Barras na cor do tier na main (`138249b`); brand guide #16/#17 (`a639e25`). 🟡 Caminho B aberto.

---

> ⚠️ **Entradas retroativas (registradas em 11/06).** Decisões da sessão de **08–09/06** (PR #39 —
> pipeline remodel). Não foram salvas no brain do Boreal na época. Código na main: commits `5b740f0`
> + `2b24f8` → merge `41c62ee`.

## [2026-06-08/09] Pipeline: kanban descartado — tabs por estágio + linhas de largura cheia

**Contexto:** com o pipeline crescendo, o kanban de 6 colunas gerava 3 problemas simultâneos: (1) nome
da empresa truncado em cards estreitos — ilegível em volume; (2) scroll horizontal + vertical ao mesmo
tempo; (3) nenhum ganho de drag já que a mudança de estágio era via `<Select>`, não via arraste de
coluna. O layout pagava o custo do kanban sem receber o benefício.

**Decisão:** substituir por **uma aba por estágio + linhas de largura cheia** (full-width row list).
Uma view de estágio por vez, em largura total da tela, legível sem expandir. Grid template fixo
compartilhado por header e rows (`COL = "14px 48px 1fr 155px 128px 175px auto 28px"`). Drag-to-reorder
vertical dentro de cada aba (ordem persiste em `localStorage`). Sort toggles de 3 estados (asc/desc/off)
em Score, Dono e Próxima Ação.

**Aba Agenda:** fila operacional cross-stage (oportunidades com `proxima_acao_em` definida, de qualquer
estágio, ordenadas por data depois score). Incluída como primeira aba para acesso rápido. Conceito:
é uma **dimensão de trabalho**, não um estágio do funil — ver decisão abaixo sobre separação visual.

**Worklist (`/worklist`) aposentada:** a Agenda substitui a função de "fila quente de ação". Rota e
entrada no nav removidas.

**Rejeitado:** kanban com colunas menores, tabela flat sem tabs (perde o contexto de estágio), view
"híbrida" simultânea (scope creep para a sessão).

**Status:** ✅ Implementado. PR #39 mergeado na main (`41c62ee`).

---

## [2026-06-08/09] Aba Agenda: dimensão operacional distinta dos estágios de negociação

**Contexto:** ao incluir a Agenda como primeira aba na barra de navegação do pipeline, ela ficou
visualmente no mesmo nível semântico que "Identificado", "Abordado", etc. — como se fosse um estágio
do funil. Não é: a Agenda é uma fila cross-stage (dimensão temporal/operacional), enquanto os estágios
são fases do deal (dimensão de progresso). Um analista pode ter empresas em "Em conversa" E em "Qualificado"
aparecendo juntas na Agenda se ambas têm próxima ação devida.

**Decisão (provisória):** manter a Agenda na mesma barra de tabs por ora (preserva navegabilidade por
teclado ← →), com a separação visual deferred para um próximo passo. Soluções candidatas discutidas mas
não implementadas: separador visual entre "Agenda" e as abas de estágio, label "Funil" sobre o grupo de
estágios, ou agrupamento visual distinto que não quebre a barra de tabs.

**Pendência aberta (handoff Guilherme):** encontrar a solução que diferencia os dois contextos sem
sacrificar a navegabilidade. Registrada em `brain/pending.md`.

**Status:** 🟡 Agenda funcional na main; separação visual pendente.

---

> ⚠️ **Entradas retroativas** — registradas em 2026-06-11. A sessão de 2026-06-10 (alinhamento das
> colunas do pipeline, PR #40) não foi salva no brain do Boreal na época; as duas decisões abaixo
> fecham o gap. O código já estava na main desde o merge do PR #40 (`eb569e3`).

## [2026-06-10] Pipeline: coluna Dono alinhada à esquerda (não centralizada)

**Contexto:** na coluna Dono/Estágio, o nome do dono e o chip de estágio estavam centralizados na
célula. Centralizado deixava o chip "solto" no espaço e destoava das demais colunas de texto do
pipeline (Empresa, Próxima ação, Contato), todas alinhadas à esquerda. Tentativas de centralizar com
respiro deixavam um vazio grande à esquerda do texto (a seta ocupa a direita, a esquerda ficava vazia).

**Decisão:** alinhar nome e chip **à esquerda**, com respiro de `pl-2.5` (10px) para o texto não colar
na borda. Comparação feita em sandbox (`sandbox-dono-align.html`) entre centralizado (A) e esquerda (B);
escolhida a B por coerência com o resto do pipeline.

**Rejeitado:** centralização perfeita (vazio assimétrico por causa do chevron à direita).

**Status:** ✅ Implementado. PR #40 mergeado na main (`eb569e3`).

---

## [2026-06-10] Grid do pipeline: uma única coluna flexível (Notas vira largura fixa)

**Contexto:** o grid `COL`, compartilhado por header e linhas, tinha **duas** colunas flexíveis: `1fr`
(Empresa) e `auto` (Notas). `auto` dimensiona pelo conteúdo, que difere entre header (texto curto
`Notas`) e linhas (botão `+ NOTA`, mais largo). Como a `auto` ficava mais larga nas linhas, roubava
largura da `1fr` de forma diferente em cada contexto, deslocando todas as colunas após Empresa ~34px
entre header e linhas. Foi a causa raiz do desalinhamento que parecia "de padding" mas não era.

**Decisão:** o grid de header+linhas deve ter **uma só** coluna flexível (`1fr`); todas as outras
fixas. Notas passou de `auto → 92px`. Complemento: igualar o box model entre header e linhas — como o
`<li>` tem `border` e o header não, o header recebeu `border-x border-x-transparent` para zerar o drift
de 1px.

**Regra geral derivada:** nunca usar duas colunas flexíveis (`1fr` + `auto`) num grid replicado entre
header e linhas quando o conteúdo da `auto` puder diferir entre eles.

**Status:** ✅ Implementado. PR #40 mergeado na main (`eb569e3`).

---

> ⚠️ **Entrada retroativa** — registrada em 2026-06-11. Decisão tomada na sessão de 2026-06-10 (polish pré-deploy), não salva no brain na época.

## [2026-06-10] Fazer deploy no Vercel para a submissão (reverte "não fazer deploy agora")

**Contexto:** a submissão do Clube exige mandar um link para os jurados avaliarem — não dá pra contar só com tela compartilhada/Loom. Isso reverte a decisão anterior nesta mesma página ("Não fazer deploy agora. Pitch/Demo Day via tela compartilhada (localhost)").

**Decisão:** deployar no Vercel. Consequência imediata no lado interface: passou a valer a pena o polish de primeira impressão do link (favicon, OG/Twitter, `<title>`/description) — feito nesta sessão (ver `progress.md`).

**Por que já estava destravado:** `research.ts`/`dossier.ts` já rodam na Anthropic API (web search tool), sem dependência do Agent SDK local — o motor funciona em serverless. A arquitetura escolhida antes já era "deploy-ready".

**Pendências que o deploy abre (handoff Guilherme, infra):** env vars no Vercel; `/api/trajetoria` com BigQuery `keyFilename` quebra em serverless (precisa JSON inline); teto de custo pra link aberto.

**Status:** 🟡 Interface pronta (metadata/OG/favicon na main via PR #40 / `eb569e3`). Deploy + infra pendentes (Guilherme).

---

## [2026-06-28] Research híbrido — Scrapling lê o site oficial; descoberta por email do CNPJ

**Contexto:** o `perfil_negocio` e os sinais saíam só do `web_search`. Hipótese: ler o SITE OFICIAL a
fundo enriquece o output. Avaliados 2 repos de scraping que o Guilherme trouxe: **agent-reach** (rejeitado
— catálogo social/chinês, eixo errado) e **Scrapling** (adotado, estreito — leitura stealth de página).

**Decisão:** `research.ts` ganha um parâmetro opcional `contextoSite`; quando presente, injeta o texto do
site no prompt (base do perfil + foco das buscas em sucessão). A coleta roda via Scrapling **offline**
(Python + browser **não roda no Vercel**); produto serve do cache, como o resto. `scrape-sites.py` coleta
→ `site-cache.json`; `cache-research-saude-edu.mjs` injeta. Branch `feat/research-scrapling-hibrido`.

**Achado central — descoberta do site (o elo fraco do scraping):**
- **Email do CNPJ resolve ~26% de graça e com precisão ~100%.** A Receita traz email de domínio próprio
  em 116/450 empresas; `email.split('@')[1]` = site. É a 1ª opção do `escolher_site` (filtra genérico e
  domínio de contador). Bate qualquer scraping de SERP. **Dado estruturado > scraping**, de novo.
- **SERP scraping é ruim pra descobrir** (whack-a-mole de agregadores: dnb, eguias, cylex). Só fallback.
- **RDAP do registro.br** confirma titular (.br → CNPJ) mas tem **recall baixo** (domínio sob a holding,
  não a subsidiária). Vale como validação-bônus, não mecanismo. O reverso CNPJ→domínios não é público.

**Honestidade de custo (corrigida em sessão):** o "15x mais barato" vale só pra preencher `perfil_negocio`
isolado em massa (Scrapling + resumo, sem web_search). No **research completo** o híbrido é ~custo-neutro
(o contexto adiciona tokens; buscas caem só 5→4) e o ganho é **qualidade** (A/B: Alpina 3→4 sinais, perfis
e gatilhos ancorados no site real). Duas alavancas distintas, não uma.

**Em aberto (moat que o Guilherme pediu pra desenvolver):** índice próprio CNPJ→site, acumulando o que a
gente confirma. Liga dado estruturado (CNPJ) a conteúdo profundo (site) de forma sistemática no mid-market
BR — ninguém faz, e o acúmulo vira ativo. Resíduo de descoberta (pegada fina) vai por `web_search`, não SERP.

**Status:** ✅ Implementado e validado A/B na branch (3 commits, sem push). Regeneração do cache de produção
e o índice de moat ficam pendentes.

---

## [2026-06-28] Maguto saiu do time (fim do Clube) — interface volta pro escopo do Guilherme

**Contexto:** o Clube da Programação acabou (não fomos ao Demo Day). O Maguto, que era o **domínio
interface** na divisão de trabalho (Gui motor / Maguto interface, `types.ts` como contrato — ver decisão
de 2026-05-29), **parou de trabalhar no Boreal** depois do fim do clube.

**Consequência prática:** não há mais um responsável dedicado de interface nem um revisor de UI/UX no
browser. Guilherme cobre motor **e** interface. Toda feature de UI nova (a começar pelo heat-map de setor)
exige **cuidado redobrado de qualidade visual** — acertar o design seguindo `brand/uso-tipografia-cor.md`
de primeira, porque não há mais o passo "Maguto revisa no browser". O fluxo colaborativo de PR/branch
(decisão 2026-05-29) perde a metade do Maguto; segue valendo a disciplina de branch + commit pequeno.

**Status:** ✅ Registrado. Afeta o modo de trabalho daqui pra frente.

---

## [2026-06-28] Heat-map de setor — temperatura monocromática (estende a regra de cor do brand)

**Contexto:** 1ª das 3 features pós-call Setter. O Henrique pediu um termômetro de setor pra priorizar o
INBOUND ("quando um ativo chega, esse setor está quente?"). Página `/heat-map` que ordena os setores por
ritmo de M&A (deals/ano, mineração do CNPJ) + densidade + consolidadores ativos. Reembala dado existente
(`setores.ts`, `consolidadores.json`, `setor-contexto.json`); não é dado novo, é lente de priorização.

**Decisão de design (a não-óbvia):** um "heat-map" pede cor quente (vermelho/laranja), mas o brand
**reserva ocre/terracota só pra score de risco** (regra de 2026-06-01). Usar vermelho de heat violaria isso
e deixaria a UI "loud", contra o "Private, not loud". **Temperatura comunicada por número real (deals/ano)
+ barra de intensidade monocromática Floral + rótulo textual** (Consolidação ativa / Movimento moderado /
Mercado frio), nunca por cor de alarme. Estende a regra: cor de risco continua exclusiva de score.

**Decisão de UX (corrigida no review):** a 1ª versão embutia o `ContextoSetor` inteiro, que **duplicava**
"quem compra" (players macro tipo Rede D'Or/Hapvida) com o bloco de consolidadores minerados, inchando o
card. Trocado por: bloco "Quem está comprando agora" = só os consolidadores **minerados do CNPJ** (o
diferencial), + "Leitura de mercado" = 1 parágrafo macro + link pro contexto completo em `/setores`.
Heat-map = triagem rápida; /setores = aprofundamento. Sem redundância.

**Cobertura honesta:** 3 setores (saúde quente 110 deals/ano · metalmec morno 32 · educação frio 11).
Consolidadores minerados só existem pra saúde hoje (os outros mostram "—").

**Verificação:** typecheck limpo; renderização conferida via DOM/estilos computados (barra Floral
`rgb(255,251,244)`, ordem por temperatura, 4 consolidadores na saúde). Screenshot travou no renderer
headless do ambiente — verificação foi estrutural, não visual-pixel. **Pedir review visual ao Guilherme**
(sem o Maguto, é o único revisor de UI).

**Status:** ✅ Implementado na branch `feat/research-scrapling-hibrido`. Pendente review visual do Guilherme.

---

## [2026-06-28] Heat-map v2 — treemap tipo TradingView, métrica pra TODOS os setores

**Contexto:** o Guilherme não gostou do visual em cards (v1). Referência: o Stock Heatmap do TradingView
(treemap: tiles dimensionados por market cap, coloridos por performance). Pediu a métrica pra **todos os
setores** (não só os 3) e o visual de treemap monocromático.

**Métrica pra todos os setores (BigQuery):** `build-heatmap-setores.mjs` roda UMA query agregada por divisão
CNAE (2 díg, SP): universo + aquisições detectadas (PJ entra + PF sai, a mesma definição do ground truth).
Resultado em `heatmap-setores.json` (85 divisões, 4.395 aquisições). **Honestidade:** é atividade OBSERVADA
de M&A, consistente pra todos; a VALIDAÇÃO do score (recall) só existe nos 3 cobertos, marcados com dot.

**Decisões de design (as não-óbvias, discutidas):**
1. **Tamanho do tile = nº de aquisições, NÃO universo de empresas.** Universo é dominado por MEI (varejo
   tem 4,16M empresas) e afogaria os setores de M&A real. Dimensionar por volume de deals foca no que
   importa e **mata o ruído de N baixo** automaticamente (CNAE com 1 deal vira tile invisível).
2. **Cor = densidade (aquisições ÷ universo), com piso de N.** Divisões com <10 aquisições ficam
   cinza-neutro (sinal insuficiente), pra não pintar ruído de branco. Resultado correto: varejo é grande
   mas ESCURO (muito volume, baixa densidade); finanças/construção/imobiliária são CLAROS (densos).
3. **Monocromático (escala de cinza levemente quente `hsl(40 6% L%)`), sem verde/vermelho** — cor de risco
   segue reservada a score. Alinha com o brand "Private, not loud" e com a referência do Guilherme.
4. **Agrupado por seção econômica CNAE** (Indústria, Comércio, Finanças, Saúde…), 2 níveis como o TV.

**Implementação:** `treemap.ts` = squarified treemap (Bruls 2000) puro, sem dependência nova. `cnae.ts` =
nomes de divisão + seção por faixa. `heatmap.ts` reescrito (dados + cor). Página server-side (sem JS de
cliente; tooltip nativo via `title`). Tiles em % de um canvas lógico (responsivo via aspect-ratio).

**Verificação:** typecheck limpo; DOM confere 62 tiles, 5 validados com dot, cores corretas (varejo escuro,
finanças claro). Screenshot travou no renderer headless — **review visual pendente com o Guilherme**.

**Disposição full-viewport (v2.1):** o Guilherme gostou dos tiles mas quis o heatmap ocupando a tela
inteira, sem scroll, como o TradingView. Refeito: página vira `flex-col` de `calc(100dvh - 65px)` (nav)
com barra fina no topo (título + legenda + metodologia no tooltip ⓘ) e o treemap preenchendo o resto.
O treemap virou **client component** (`Treemap.tsx`) que se mede (ResizeObserver + medição síncrona no
mount) e faz o layout em px reais — aspect ratio fiel, re-layout no resize, sem distorção. `MIN_TILE=8`
(exceto setores validados) corta os slivers ilegíveis. Verificado: 55 tiles, 0 slivers, sem scroll.
Gotcha de dev: o Fast Refresh acumulado deixava o container vazio até um reload limpo (não ocorre em prod).

**Status:** ✅ Implementado na branch. Substitui os cards (v1). Pendente review visual.

---

## [2026-06-28] Heat-map v3 — Brasil inteiro, filtro por região, ground truth pra validação

**Contexto:** o Guilherme quis o mapa pro Brasil todo, com filtro por região que atualiza o mapa, e pediu
pra **guardar os dados minerados pra validação futura**.

**Dados (BigQuery, `build-heatmap-setores.mjs` reescrito):** query agregada por (UF × divisão CNAE),
Brasil inteiro. Duas saídas:
1. `src/lib/heatmap-setores.json` — agregados por UF (só `div`, `universo`, `n_aquisicoes`; deals/ano e
   densidade são derivados no front). 196KB (era 320KB antes de cortar os campos derivados).
2. `scripts/data/aquisicoes-br.json` — **ground truth**: os 14.486 CNPJs adquiridos (PJ-in/PF-out) com UF
   e divisão. **Fora do bundle do front.** Reservado pra validar o recall do score por setor/região depois.
   Estende o data moat pra todos os setores e o país inteiro.

**Consistência confirmada:** SP no build Brasil deu 4.395 aquisições, idêntico ao build só-SP anterior.

**Decisões:**
- **Guardar por UF, front agrega por região.** Dado granular guardado uma vez; o filtro de região soma as
  UFs, e um filtro por estado no futuro não exige re-minerar.
- **Cor normalizada dentro da seleção.** Cada região usa sua própria escala (a mais quente daquela região
  fica clara) — contraste bom em qualquer vista; perde comparabilidade absoluta entre regiões (aceito).
- **Seletor de região = pills** na barra (Brasil + 5 regiões). A página virou client (`MapaSetores.tsx`):
  estado da região → `gruposPorSecao(regiao)` → `Treemap` recebe os grupos por prop e re-layouta.

**Verificação:** typecheck limpo; DOM confere o filtro (Brasil 14.481 aquisições/69 tiles → Nordeste
1.460/34 tiles, nota e cor recalibradas), sem scroll. Screenshot trava no headless — **review visual pendente**.

**Status:** ✅ Implementado na branch. Pendente review visual do Guilherme.
