# Pitch Mestre — Domínio completo: destravar o middle/lower market de M&A no Brasil

> Criado: 2026-07-20. Objetivo: Guilherme dominar mercado, método, modelo e defesa a ponto de
> fazer qualquer pitch (investidor, boutique, dono de empresa, imprensa) sem improvisar.
> Convenções de honestidade: **[medido]** = dado nosso, reproduzível por script · **[fonte]** =
> dado externo com link · **[estimativa]** = conta nossa com premissas à mostra. Nunca citar
> número sem saber em qual das três categorias ele está — é exatamente assim que se derruba
> um pitch alheio, e o nosso não pode cair assim.

---

## 1. A narrativa (memorizar, não ler)

**30 segundos:** "O Brasil tem milhões de empresas familiares chegando na hora de trocar de
comando. Quase nenhuma é atendida por M&A: banco grande não desce, boutique não acha, e o
dono não se anuncia. Eu minerei o registro público de empresas do país inteiro e construí um
motor que identifica quem vai vender ANTES de estar à venda, validado contra aquisições reais
mineradas do próprio CNPJ: 4,1x melhor que sorteio num teste de holdout. Vendo essa originação
para boutiques de M&A: a primeira já assinou."

**Os 3 fatos que sustentam tudo (decorar):**
1. O estoque existe e está parado: ~80% das empresas com perfil sucessório seguem com o mesmo
   dono velho anos depois, não fecham, não passam pra herdeiro, não vendem **[medido:
   coorte-destino.mjs]**. É por isso que o jogo não é achar quem tem o perfil, e sim achar a
   minoria que está de fato se mexendo.
2. O sinal existe e é público: o quadro societário do CNPJ (idade do controle, entradas e saídas
   de sócio, escala) prevê as vendas de sucessão com 63% a 95% de recall por setor **[medido:
   N=317 Brasil-inteiro]**, e fica 4,1x acima do acaso no teste de holdout **[n=978, z=2,59]**.
3. Ninguém está nessa camada: quem cobre o Brasil (Inven, Neoway) lê site ou vende cadastro;
   nenhum tem o sinal sucessório em profundidade **[fonte: verificado 06/07]**.

---

## 2. O mercado — macro global (a analogia que investidor reconhece)

**EUA (o mercado que valida a tese):**
- Baby boomers são donos de ~12 milhões de negócios (41% das empresas privadas), empregando
  25M+ pessoas **[fonte: becomebusinessbroker/ClearlyAcquired]**.
- ~US$ 10 tri em valor de negócios de boomers; ~4,5M devem trocar de mãos na década
  **[fonte: Headway/ButcherJoseph]**.
- McKinsey (abr/2026): ~6M transições de PMEs até 2035; 1M+ firmas viáveis pra venda =
  até US$ 5 tri em enterprise value **[fonte: via Grow America]**.
- Menos de 1/3 dos donos tem plano de sucessão formal; só 15-20% já fez valuation
  **[fonte: surveys citados acima]**.
- **O capital já respondeu lá:** OffDeal (YC) levantou Series A de US$ 12M com a Radical
  Ventures (~US$ 100M de valuation, total US$ 17M), como "primeiro banco de investimento
  AI-native para small business", alvo empresas de US$ 10-100M de receita — 30+ mandatos
  sell-side lançados **[fonte: offdeal.io/Radical]**. Search funds, ETA e SBA lending vivem
  do mesmo fenômeno.

**Uso no pitch:** o Silver Tsunami americano tem infraestrutura inteira nascendo em cima
(OffDeal, marketplaces, brokers, SBA). O Brasil tem a MESMA demografia e ZERO infraestrutura
equivalente. Nós somos a camada de infraestrutura chegando primeiro.

## 3. O mercado — Brasil (os números de bolso)

**Tecido empresarial:**
- Pequenos negócios = 97% das empresas, ~26,5-30% do PIB **[fonte: Sebrae/ASN]**.
- Empresas familiares = ~90% dos negócios e 60%+ do PIB **[fonte: Sebrae via Jornal E&N]**.
- Sucessão: só ~30% chega à 2ª geração, ~2% à 3ª; 54% sem plano estruturado de sucessão
  **[fonte: idem]**. (Versão que usávamos: 72% sem plano/7% à 3ª geração — usar a faixa
  "50-70% sem plano" e citar Sebrae, não cravar decimal.)
- Universo total: 26,1M matrizes ativas no CNPJ **[medido: build-heatmap]**.

**Mercado de M&A formal:**
- 2025 fechou com **1.581 transações** (2024: 1.582) — estável apesar de Selic a 15%
  **[fonte: KPMG 4T25]**.
- PE/VC subiu de 43% pra **50% das transações** — o capital institucional está comprando
  mais, não menos **[fonte: KPMG]**.
- Tech concentra ~40% das operações **[fonte: KPMG]** — ou seja, o M&A registrado é urbano,
  tech e large/mid cap. **O middle/lower market familiar do interior quase não aparece na
  estatística — esse é o mercado destravável.**

**O gap quantificado (nosso dado):**
- Das empresas quentes (perfil sucessório), só 0,3-0,7% vendem por ano; ~80% seguem paradas
  com dono envelhecendo **[medido: coorte]**. Giro de troca de controle observado no universo
  limpo: ~0,46%/ano **[medido]**.
- Exemplo de funil (educação NE): 13.669 escolas privadas → 8.953 familiares → 3.933 perfil
  sucessório → 1.518 sucessão clássica; contra ~26 aquisições/ano de educação básica no BR
  INTEIRO **[medido: universo-educacao-ne.mjs]**. Milhares de alvos viáveis, dezenas de
  transações: **mercado grande e ilíquido por falta de originação, não por falta de ativo.**
- Confundidor honesto (falar ANTES que perguntem): Selic 13-15% em 2023-25 (máxima de ~20
  anos) reprimiu conversão — parte da iliquidez é cíclica. A Selic começou a cair (14,5%
  abr/26): a aposta é **contracíclica** — montar o pipeline enquanto capital é o gargalo,
  colher na virada do ciclo.

**O wedge de dado (validação externa, Illa Elias, Manager M&A PwC Belgium):** "no Brasil a
originação proativa é difícil porque você não tem dado; não quer gastar recurso sem saber o
EBITDA". Na Europa o financeiro é público; no BR não → quem transforma o dado público que
EXISTE (CNPJ) em sinal acionável destrava o funil que trava todo mundo.

**TAM honesto (como falar):** NÃO citar "US$ 400-600 bi" sem qualificar (é valor de ativos,
não fee pool). Formato blindado: universo quente medido (dezenas de milhares de empresas em
perfil sucessório) × ticket médio do segmento (R$10-50M) × fee de advisory (3-5%) ou nossa
captura (0,5% + retainer) = sensibilidade com premissas à mostra, apresentada como cenário
**[estimativa]**. Quem crava TAM redondo pra juiz de PE perde credibilidade — nossa marca é
o contrário.

---

## 4. Por que agora (timing em 4 vetores)

1. **Demografia:** a geração fundadora de 70-90 está cruzando os 60-75 anos agora; o CNPJ
   mostra os sócios mudando de faixa etária em tempo real **[medido: trajetória]**.
2. **Ciclo de capital:** Selic saindo da máxima → M&A represado destrava; quem tiver o
   pipeline pronto captura a virada.
3. **Custo de originação desabou:** IA derrubou o custo de pesquisa/qualificação (~R$1,08
   por empresa enriquecida **[medido]**). O que tornava o middle market "uneconomical" pras
   boutiques (tese OffDeal) deixou de ser.
4. **A janela competitiva está aberta mas encolhendo:** SoM&A (marketplace, MVP, captando),
   Inven (cobertura BR rasa), Neoway (dado sem produto de M&A). Ninguém na nossa camada — por
   enquanto **[fonte: varreduras 06-20/07]**.

---

## 5. Como fazemos (o método, com a prova em cada passo)

**O motor em uma frase:** mineramos o registro público (CNPJ via basedosdados/BigQuery),
detectamos trocas de controle entre snapshots (PJ entra + PF sai), usamos isso como ground
truth pra treinar/validar um score de propensão à venda por sucessão, e entregamos leads
qualificados com dossiê e prova de origem.

**Passo a passo (cada um com número):**
1. **Ground truth de graça:** 14.486 candidatas a aquisição mineradas → 7.877 limpas após
   remover SPE/newco/holding (universo só ativo, idade ≥5, filtro cirúrgico em setores
   SPE-heavy) **[medido: build-heatmap + diag-spe]**. Nenhum concorrente BR tem M&A rotulado
   nessa escala — a imprensa dá dezenas; nós temos milhares.
2. **Score validado leakage-free:** recall nas vendas de sucessão, Brasil inteiro, N=317:
   metalmec 90%, agro 95%, saúde 77%, educação 63% **[medido: validacao-nacional.mjs]**. No corte
   mais duro, rankeando só quem já passa no perfil sucessório, 41,5% com metade da base em holdout
   **[medido: validacao-score-v1.mjs --amplo, n=978, z=2,59]**.
3. **Duas lentes (a sofisticação que desarma):** sucessão (previsível — nosso jogo) vs
   consolidação (roll-up; testamos prever: lift 1,4x ≈ aleatório → NÃO vendemos como
   predição) **[medido: backtest]**. Saber onde o modelo NÃO funciona é o que convence quem
   entende.
4. **Os pesos são medidos, e o dado já nos contrariou:** a tese ingênua é "dono velho, sem
   herdeiro, quadro congelado". O lift condicional contra aquisições reais diz o oposto: sucessor
   aparente no quadro tem **2,14x**, quadro parado há dez anos tem **0,60x** (anti-sinal), e mais
   octogenários no quadro tem **0,50x**. Quem vende é quem já está conduzindo uma transição. Dois
   pesos do research estavam invertidos por causa disso e foram corrigidos **[medido:
   validacao-lift-coorte.mjs, z >= 9]**. Saber que o próprio modelo estava errado, e ter o número
   que provou, é o que separa isto de opinião.
5. **Sensor forward:** monitor de transições societárias detecta mudança de quadro em
   empresas do pipeline (janela de sucessão abrindo) — o gatilho de abordagem que ninguém
   mais tem **[medido: caso PRENSA detectado]**.
6. **Selo de proveniência:** hash HMAC sobre origem+data+score — prova inforjável de que o
   lead foi nosso, resolve a disputa de atribuição que trava success fee **[construído,
   testado em produção 03/07]**.
7. **Loop de outcomes:** pipeline registra contatado→respondeu→reunião→desfecho e compara
   com o score previsto — o sistema aprende com a operação real **[construído; alimentação
   começa com o piloto]**.

**O que NOS RECUSAMOS a fazer (honestidade como arma — usar no pitch):** não fabricamos
EBITDA (validado por banker de Big Four: "mesmo tendo, eu não colocaria"); não vendemos
predição de consolidação (backtest reprovou); não automatizamos outreach (o contato é
humano). Cada "não" tem um porquê testado — isso É o pitch pra quem é sofisticado.

---

## 6. Modelo de negócio

**Hoje (assinado):** Setter Investimentos — R$2.000 + 0,5% de success fee, operação a partir
de ago/2026. Sêniores deles fecham; nós originamos e provamos atribuição via selo.

**Ano 1 — camada de inteligência de originação:** retainer R$5-15k/mês por boutique/fundo
(dimensionado por vertical + exclusividade regional) + success fee override 0,3-0,5%
garantido pelo selo. Meta: 3-5 parceiros que não se canibalizam. Relatórios setoriais
(R$20-40k) como caixa-ponte. Unit economics: custo de servir ~R$280-560/mês por parceiro
**[medido]** contra retainer de R$5-15k → margem de software.

**Ano 2 — decisão por dado:** se o custo por conversa qualificada provar queda vs processo
manual, opções: NewCo whitelabel com boutique estabelecida (marca/licença/sêniores deles +
nosso motor) ou escala horizontal da camada. Advisory próprio só com sênior contratado
(exige capital).

**LatAm:** só depois do BR provado. Arquitetura registry-agnostic desde já (México/Colômbia
têm registros análogos; RUES colombiano é até melhor que o CNPJ).

---

## 7. Competitivo (e a resposta-marketplace)

| Player | O que é | Por que não nos mata |
|---|---|---|
| **SoM&A** (BR, MVP) | Marketplace matching comprador×vendedor, <R$50M, começou por franquias; assinatura ~1 salário mínimo/ano + success fee **[fonte: Exame]** | Agrega intenção DECLARADA (quem se lista); sofre seleção adversa (empresa boa é comprada, não listada); começou por franquia porque é o único nicho sem barreira de confiança. Meta declarada de R$2,1bi/6 mil deals até 2027 = 3-4x o mercado BR registrado inteiro (1.581/ano) — pitch de captação, não projeção |
| **Inven** (global) | 28M perfis, lê sites em 160+ países | Perfil vem do SITE — metade do nosso alvo não tem site **[medido]**; zero quadro societário/faixa/transições |
| **Neoway** (BR) | Maior data/analytics BR por CNPJ | Inteligência B2B genérica (vendas/crédito/jurídico), não produto de originação M&A. Incumbente de DADO, não de produto |
| **Grata/Sourcescrub/Gain.pro** | Deal sourcing EUA/Europa | Sem cobertura BR declarada |
| **OffDeal** (EUA) | Advisory AI-native, $17M levantados | Não concorre (geografia); é a VALIDAÇÃO do modelo e o comp de valuation |

**Por que não viramos marketplace (resposta pronta, foi testada em 20/07):** marketplace
funciona onde o ativo é padronizado e o vendedor não teme exposição (main street, franquia).
No mid-market familiar: (1) seleção adversa não se subsidia — listar enche a prateleira de
empresa invendável; (2) vendedor transaciona 1x na vida — não há recorrência do lado difícil;
(3) confidencialidade é cultura — o dono não se expõe; (4) ticket de R$10-50M convida fechar
por fora. Evidência: Axial (EUA, 15+ anos) virou rede de intermediários; BizBuySell só
funciona em main street; SoM&A começou por franquia. **Marketplace é o prêmio de quem já tem
liquidez, não o caminho até ela** — e o nosso caminho (originação proprietária + mandatos de
compradores + selo como rails) é o que um dia PODE virar um, com as duas pontas já na mão.

---

## 8. Moat (o que acumula e não se compra)

1. **Loop de outcomes:** quem foi contatado, respondeu, vendeu, a que múltiplo — training
   data de originação real; cada mês de operação aumenta a distância.
2. **Arquivo temporal proprietário:** snapshots mensais + diffs do universo. Quem começar em
   2028 nunca terá 2026.
3. **Índice CNPJ→domínio→contato confirmado:** cada confirmação humana vira registro
   verificado que nenhuma base pública tem.
4. **Grafo relacional (caminho de indicação):** sócios em comum + rede das boutiques
   parceiras → "quem te leva até o dono". Ataca o gargalo REAL (relacional) e compõe a cada
   parceiro.
5. **Selo como padrão de atribuição:** se 5+ boutiques adotarem, viramos a infraestrutura de
   confiança da originação terceirizada — efeito de rede.
6. **A operação AI-native em si:** margem escala com o sistema, não com sênior; concorrente
   copia feature, não copia a firma.

O que NÃO é moat (nunca alegar): dado público, score determinístico, features de LLM.

---

## 9. Plano futuro (fases com gatilhos)

- **Ago-set/26 — piloto Setter:** provar custo por conversa qualificada < processo manual.
  Entregáveis: CRM importado, selo ativo, monitor forward produtizado, outcomes reais no loop.
- **Set/26-mid/27 — Ano 1:** 3-5 parceiros pagantes (retainer+selo), cobertura BR nos setores
  dos parceiros, grafo societário + caminho de indicação, snapshots mensais acumulando.
- **Mid/27 — decision point (honesto: coincide com faculdade):** com dado do Ano 1, decidir:
  escalar camada / NewCo whitelabel / operação automatizada em modo manutenção. O produto
  precisa rodar com pouca operação humana ATÉ lá — restrição de design, não desejo.
- **2028+ — LatAm e/ou fee cheio**, só sobre base provada.

## 10. Riscos (falar antes que perguntem — tabela de respostas na §11)

1. Solo founder indo pra faculdade em ago/2027 (o maior).
2. Concentração na Setter (único cliente e único canal de fechamento hoje).
3. Ciclo longo do success fee (deal leva 9-15 meses; caixa vem de retainer/relatórios).
4. Concorrência capitalizada entrando (SoM&A captando; Inven aprofundando).
5. LGPD no enriquecimento (mitigado: dado societário é público; pessoal só com desenho jurídico).

---

## 11. Q&A de pitch (as duras, com resposta pronta)

**"Por que a Neoway não faz isso amanhã?"** Porque o produto deles é inteligência B2B
horizontal (vendas/crédito) e o valor aqui está na VERTICAL: ground truth de M&A minerado,
score validado contra deal real, selo, loop de outcomes com boutiques. Dado eles têm; o
sistema de originação e a distância acumulada de validação, não. E o segmento (boutique de
M&A mid-market) é pequeno demais pra prioridade de uma empresa deles — e grande o
suficiente pra mim.

**"E quando a SoM&A tiver R$50M de funding?"** Ela resolve outro problema (matching de quem
JÁ quer vender). Se crescer, vira minha cliente ou minha compradora: os compradores dela vão
sofrer com estoque adversamente selecionado, e supply proprietário é exatamente o que eu
produzo. Capital não compra a saída da seleção adversa.

**"Como você sabe que o score funciona?"** Validação retroativa leakage-free contra aquisições
reais mineradas do CNPJ: 63% a 95% de recall nas vendas de sucessão por setor, Brasil inteiro,
N=317, e 4,1x acima do acaso no holdout (n=978), reproduzível por script. E digo também onde NÃO funciona: consolidação deu 1,4x ≈
aleatório, por isso não vendo predição de roll-up. [Se a pessoa é técnica, explicar a
mineração de transições; se é de mercado, mostrar o hindcast nominal: Fischer, Polimold —
empresas com nome que venderam e estavam no nosso top decil ANTES do deal.]

**"Qual o EBITDA das empresas da sua lista?"** Não sei, e não finjo saber — capital fechado
no Brasil não publica financeiro, e estimativa fabricada destrói credibilidade com quem
entende (uma Manager de M&A da PwC me disse: "mesmo tendo, eu não colocaria"). O que entrego:
qualificação de porte honesta por sinais públicos (porte RF, regime tributário, filiais,
capital social) com faixa e confiança declaradas. O EBITDA real sai na primeira conversa —
que é onde o meu lead te coloca.

**"O que acontece quando você for pra faculdade?"** Restrição de design desde já: o produto
roda como máquina (ingest, score, monitor, selo são automáticos; o humano curou e entregou).
Até mid-2027 o dado do Ano 1 decide: escalar com gente, NewCo com parceiro, ou modo
manutenção rentável. E fundador de 18 anos que construiu isso sozinho é o argumento, não a
fraqueza. [Não fingir que o risco não existe — nomeá-lo primeiro.]

**"Por que boutique pagaria se nunca pagou por ferramenta?"** Verdade — o Henrique me disse
isso na cara: outbound frio nunca funcionou e boutique não paga tool. Por isso não vendo
tool: vendo lead qualificado com prova de origem e cobro parte no sucesso. O retainer é
pequeno (R$2-15k) e o alinhamento está no 0,5% — a boutique só paga de verdade quando ganha.
Contrato assinado prova que pelo menos uma topou.

**"Isso não é só um wrapper de LLM?"** O LLM é 10% do sistema (research/narrativa). O core é
engenharia de dados: mineração de transições em 26M de empresas, validação retroativa,
grafo societário, hash de proveniência. Roda em BigQuery+Postgres; o modelo de linguagem é
trocável, o dataset acumulado não.

**"LGPD?"** Quadro societário do CNPJ é dado público por lei. Dado pessoal (LinkedIn de
herdeiro) só entra com desenho jurídico específico — hoje NÃO está no produto, por decisão.

---

## 12. Cartão de bolso (números pra ter na ponta da língua)

| # | Número | Categoria |
|---|---|---|
| M&A BR 2025 | 1.581 transações (PE/VC = 50%) | [fonte: KPMG] |
| Universo CNPJ | 26,1M matrizes ativas | [medido] |
| Ground truth | 7.877 aquisições limpas / 2,4 anos | [medido] |
| Recall sucessão | 90% metalmec · 95% agro · 77% saúde · 63% educação, N=317 BR | [medido] |
| Recall no perfil sucessório (holdout) | 41,5%, 4,1x vs sorteio, n=978, z=2,59 | [medido] |
| Consolidação | lift 1,4x ≈ aleatório → não vendemos | [medido] |
| Coorte parada | ~80% seguem iguais; 0,3-0,7%/ano vendem | [medido] |
| Custo de servir | ~R$1,08/empresa; R$280-560/mês por parceiro | [medido] |
| Contrato | Setter: R$2.000 + 0,5% success fee (ago/26) | fato |
| Familiares BR | ~90% dos negócios, 60%+ do PIB; ~30% chega à 2ª geração | [fonte: Sebrae] |
| EUA comp | OffDeal: US$17M levantados, ~US$100M valuation | [fonte] |
| EUA macro | ~12M negócios boomer, ~US$10T, 6M transições até 2035 (McKinsey) | [fonte] |
| Selic | 15% no pico 23-25; caindo (14,5% abr/26) | [fonte] |
| SoM&A | meta 6 mil deals/ano até 2027 = ~4x o mercado registrado | [fonte: Exame + conta] |

---

*Fontes externas: KPMG Pesquisa F&A 4T25 · Exame (SoM&A) · offdeal.io + Radical Ventures ·
Sebrae/ASN · Headway/ButcherJoseph/GrowAmerica (silver tsunami). Dados internos: scripts em
`boreal/scripts/` (build-heatmap, validacao-nacional, coorte-destino, universo-educacao-ne).*
