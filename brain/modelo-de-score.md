# O score do Boreal: como é construído, medido e revisado

> Criado: 2026-07-29. Autor: Guilherme + Claude (sessão de recalibração v0 → v1).
> Escopo: a metodologia completa do score de sucessão. O que ele mede, com que estatística,
> contra que verdade, e o protocolo de como mexer nele sem quebrar a honestidade do número.
>
> **Este documento não é fixo.** O score é a peça central do produto e vai ser refinado toda vez
> que entrar dado novo, setor novo ou desfecho real da Setter. A seção 10 é o protocolo dessa
> revisão. Se você mexer no score e não mexer aqui, este arquivo vira ficção.

---

## 0. Por que este documento existe

O score é o IP do Boreal. Grata e Inven ganham em amplitude com dezenas de milhões de funding;
o que nós temos e eles não têm é uma tese específica (sucessão em empresa familiar brasileira)
medida contra o que realmente aconteceu no registro da Receita.

Isso só é defensável se você conseguir sustentar três frases numa call:

1. "Os pesos não são chutados, cada eixo foi medido contra aquisições reais."
2. "O número que eu te dou é de holdout, metade da base que o modelo nunca viu."
3. "Aqui está o que o dado contrariou na nossa própria intuição."

A terceira é a mais poderosa e a mais difícil de fingir. Este documento existe para você ter
fluência nas três.

---

## 1. O problema, em uma frase

Dado o universo de empresas ativas no CNPJ, ordenar as que têm maior probabilidade de mudar de
dono nos próximos dois anos, usando **só o que o registro público diz hoje**.

Duas palavras carregam peso:

- **Ordenar**, não classificar. O originador não quer saber "esta vende, sim ou não". Ele quer
  uma lista onde as primeiras cinquenta valem mais o telefonema que as cinquenta seguintes.
- **Hoje**, não depois. Todo sinal usado precisa existir antes do deal. Isso é a diferença entre
  um modelo e uma tautologia, e a seção 3.5 trata disso.

---

## 2. O ground truth: como sabemos quem vendeu

Esta é a peça mais importante de todo o sistema. Um modelo é tão bom quanto a verdade contra a
qual ele é medido, e a maioria das tentativas nessa área morre aqui, porque usa notícia de
imprensa como verdade. Imprensa cobre deal grande, em São Paulo, com assessor contratado. Treinar
contra isso ensina o modelo a encontrar empresa que sai no jornal, não empresa que vende.

**A nossa verdade é minerada do próprio CNPJ.** A Receita publica snapshots do quadro societário
de toda empresa do país. Comparando dois snapshots, uma aquisição deixa uma assinatura:

```
sócio pessoa jurídica ENTRA   (a compradora aparece no quadro)
    E
sócio pessoa física SAI       (a família vende e deixa a sociedade)
```

Em SQL, entre o snapshot de corte e o atual:

```sql
adq AS (
  SELECT a.cnpj_basico FROM a JOIN b USING(cnpj_basico)
  WHERE b.pj > a.pj   -- ganhou sócio PJ
    AND b.pf < a.pf   -- perdeu sócio PF
)
```

Janela em uso: corte **2023-06-10**, atual **2025-11-09**. Cerca de 2,4 anos.

### Por que isso é bom

- Cobre o país inteiro, não só o que a imprensa cobriu.
- Cobre deal pequeno, que é justamente o mid-market familiar que a gente persegue.
- É reproduzível: qualquer pessoa com acesso ao BigQuery público refaz o número.
- Não tem viés de seleção do nosso lado. Não escolhemos quais deals entram.

### Por que isso é imperfeito, e você precisa saber dizer isso

É um **proxy**, não um registro de transações. Especificamente:

- **Captura demais.** Criar uma holding familiar produz exatamente a mesma assinatura (uma PJ
  entra, PFs saem) sem que nada tenha sido vendido. Reorganização societária interna vira falso
  positivo. Foi por isso que descartamos o eixo "tem sócio PJ no quadro" mesmo com lift 3,15x:
  empresa que já tem estrutura societária faz mais reorganização visível, então parte daquele
  lift pode ser o proxy se medindo a si mesmo.
- **Captura de menos.** Venda de PF para PF (o concorrente da cidade compra) não aparece. Venda
  de ativos sem mudar o CNPJ não aparece.
- **Janela curta.** 2,4 anos. Um ciclo de sucessão é mais longo que isso.

Quando a Setter começar a registrar desfechos reais no pipeline, teremos um **segundo ground
truth, independente e sem esses defeitos**. Ele vai ser pequeno (dezenas, não milhares) mas vai
servir para checar se o proxy está enviesado. Isso está na fila da seção 11 e é a coisa de maior
valor que o piloto produz além da receita.

---

## 3. Os cinco conceitos estatísticos que sustentam tudo

Se você dominar esta seção, você domina o modelo.

### 3.1 Lift

**Definição:** quanto uma característica é mais frequente entre as empresas que venderam do que
entre as empresas em geral.

```
lift = (% das vendidas que têm a característica) / (% do universo que tem a característica)
```

Exemplo real: capital social acima da mediana aparece em **65,3%** das vendidas e em **17,2%** da
coorte. Lift = 65,3 / 17,2 = **3,80**.

**A leitura que importa** (e é a que você usa numa call): por Bayes, esse mesmo número é quanto a
característica multiplica a probabilidade de a empresa vender. Ter capital acima da mediana faz
uma empresa ser 3,8 vezes mais provável de vender do que uma empresa qualquer da mesma coorte.

Lift 1,0 significa nenhuma informação. Lift abaixo de 1,0 é sinal negativo: a característica torna
a venda **menos** provável, e isso é tão útil quanto sinal positivo.

### 3.2 Lift marginal versus lift condicional

Este é o conceito que mais rende, e foi ele que produziu o achado desta rodada.

- **Lift marginal:** medido no universo inteiro. Responde "esta característica aparece mais nas
  vendidas?". Foi o que escolheu os eixos do v0.
- **Lift condicional:** medido **dentro da coorte que o score já elegeu** (aqui, score v0 >= 80).
  Responde a pergunta diferente e mais útil: "entre empresas que já passam no perfil, o que ainda
  separa quem vende de quem fica?".

Por que os dois divergem: uma característica pode ter lift marginal alto só por ser **proxy** de
algo que o score já usa. Empresa antiga também é empresa grande. No universo inteiro, "40+ anos"
tem lift marginal 4,39x, o maior de todos. Dentro da coorte, onde todo mundo já é grande, ela para
de informar.

**Consequência prática, e é contraintuitiva:** a feature com o maior lift marginal de todas
(antiguidade) foi a que teve de sair do score. Ver seção 5.

Regra mental: **lift marginal escolhe o filtro, lift condicional escolhe o ranking.**

### 3.3 Significância: o z

Lift é uma razão entre duas proporções estimadas em amostras. Com amostra pequena, uma razão
grande pode ser puro acaso. Se você adiciona um eixo por causa de ruído, o ranking piora.

O guarda-corpo é o **z da diferença de proporções**, que é a diferença dividida pela incerteza
dela:

```
erro padrão = raiz( p_universo(1-p_universo)/n_universo  +  p_vendidas(1-p_vendidas)/n_vendidas )
z = |p_vendidas - p_universo| / erro padrão
```

Leitura: **|z| >= 2** significa que há menos de 5% de chance de a diferença ser só sorte de
amostragem. Abaixo disso, o número não vira peso, por mais convincente que a história pareça.

O código está em `scripts/validacao-lift-coorte.mjs`, função `significante()`. Uma feature só é
marcada `"forte"` se passar **nos dois critérios ao mesmo tempo**: lift >= 1,3 **e** z >= 2. Efeito
grande sem amostra é anedota; amostra grande com efeito minúsculo não muda ranking nenhum.

Exemplo do próprio artefato: "Quadro parado 20+ anos" tem lift 1,22 com z = 1,32. Parece sinal,
não é. Ficou de fora.

### 3.4 Holdout: por que metade da base fica escondida

Se você testa dez variações de score no mesmo dado e escolhe a melhor, a melhor vai parecer boa
mesmo que a diferença seja acaso. Você não mediu qualidade, mediu quão bem você ajustou o ruído
daquele dado específico. Isso se chama sobreajuste (overfitting).

A defesa: dividir a base em duas metades. Escolher na primeira, **reportar na segunda**.

```sql
MOD(ABS(FARM_FINGERPRINT(cnpj_basico)), 2) AS metade
```

Hash do CNPJ, não sorteio aleatório, para que a divisão seja **sempre a mesma** entre execuções.
Um número de validação que muda de rodada para rodada não serve para saber se o modelo melhorou.

**Honestidade sobre o que o holdout não cobre:** as features candidatas foram escolhidas olhando o
lift da amostra inteira. Então a *seleção* tem vazamento. O que o holdout garante é que a
comparação entre variantes e o ganho sobre o v0 não vêm de sobreajuste dos cortes. É uma garantia
parcial e você deve descrevê-la assim se alguém tecnicamente sofisticado perguntar.

### 3.5 Sem lookahead: a regra que separa modelo de tautologia

Toda feature é lida no snapshot de **2023-06**. Toda aquisição é detectada **depois disso**. O
modelo nunca vê nada posterior ao momento em que teria feito a previsão.

Parece óbvio e é o erro mais comum da área. Se você calculasse "quadro societário mudou" com o
snapshot de hoje, o modelo aprenderia que empresa adquirida tem sócio PJ novo, o que é a definição
de ter sido adquirida. Recall de 99% e valor zero.

### 3.6 A métrica final: recall@top10%

Lift e z avaliam **uma feature de cada vez**. Para avaliar a **fórmula inteira** é preciso outra
métrica, e a escolha dela é uma decisão de produto.

**Não usamos acurácia.** Só 0,1% do universo vende em dois anos; um modelo que diz "ninguém vende"
acerta 99,9% e não serve para nada.

**Usamos recall@top10%:** de todas as empresas que de fato foram adquiridas, que fração o score
colocou no decil de topo do próprio setor, antes do deal?

- Aleatório = 10%.
- v1 no perfil sucessório = 38,3%, ou seja, **3,8 vezes melhor que sorteio**.

Por que essa métrica e não outra: ela responde exatamente a pergunta do originador, que é "se eu
trabalhar só o topo da lista, quanto do que presta eu pego?". Ele nunca vai ler 51 mil linhas.

Decil calculado **dentro do vertical**, nunca no geral. Uma clínica não compete com uma metalúrgica
pela atenção do originador; ele trabalha um setor por vez.

---

## 4. A fórmula atual (v1), eixo por eixo

Código: `src/lib/scoring.ts`. Espelho em SQL para validação: `scripts/lib/score-sql.mjs`.
Máximo exatamente 100, sem clamp, porque os tetos somam 100.

| eixo | teto | lift condicional | o que captura |
|---|---|---|---|
| Escala (capital em percentil do setor) | 34 | 3,80x | a empresa tem tamanho que justifica a transação |
| Idade do controle | 28 | (marginal 2,83x) | o controle está em idade de transferir |
| Sucessor aparente | 14 | 2,14x | existe geração seguinte para conduzir a venda |
| Quadro plural | 13 | 2,45x | há mais de um decisor, sociedade é transacionável |
| Movimento societário | 11 | 2,22x | o quadro está vivo, não congelado |

### 4.1 Escala: capital social em percentil do setor (0 a 34)

O eixo mais forte de todos. Faixas: acima do p95 vale 34, acima do p85 vale 27, acima do p70 vale
19, acima do p50 vale 11, abaixo disso vale 0.

**Percentil do setor, nunca valor absoluto.** Os cortes reais da nossa base:

| setor | p50 | p70 | p85 | p95 |
|---|---|---|---|---|
| agro | R$ 84 mil | R$ 710 mil | R$ 4,45 mi | R$ 26,0 mi |
| metalmec | R$ 48 mil | R$ 100 mil | R$ 360 mil | R$ 3,00 mi |
| educação | R$ 5,5 mil | R$ 20 mil | R$ 70 mil | R$ 150 mil |
| saúde | R$ 5 mil | R$ 10 mil | R$ 50 mil | R$ 108 mil |

R$ 200 mil é topo de mercado em saúde e medianía em metalmecânica. Usar valor bruto transformaria
o score num ranking de setor rico contra setor pobre, e o originador de saúde nunca veria nada.

Artefato: `src/lib/capital-percentis.json`, gerado por `scripts/build-capital-percentis.mjs` a
partir da **própria base indexada**, não do BigQuery. O percentil tem que ser o da população que
está sendo rankeada. Consequência aceita e importante: **crescer o ingest desloca os cortes e
reordena a lista.** Por isso é artefato versionado, regerado de propósito, e não cálculo em runtime.

**A fraqueza conhecida deste eixo:** capital social é capital declarado, nominal, e muita empresa
brasileira nunca atualiza desde a constituição. É um proxy sujo de tamanho. Ele mede 3,80x
*apesar* disso, o que sugere fortemente que um proxy limpo (faturamento estimado, número de
empregados via RAIS/CAGED) seria ainda mais forte. Está na fila da seção 11.

### 4.2 Idade do controle (0 a 28)

Faixa etária do sócio mais velho: 80+ vale 28, 71 a 80 vale 25, 61 a 70 vale 19, 51 a 60 vale 10.

**Só a faixa mais velha conta, e acumular octogenário não acumula ponto.** Ter 2 ou mais sócios na
faixa 80+ tem lift **0,50x**, ou seja, é sinal negativo. O eixo mede "o controle está em idade de
transferir", não "quantos velhos tem no quadro". Empresa com cinco octogenários e ninguém novo é
uma empresa que vai fechar, não vender.

### 4.3 Sucessor aparente (0 a 14)

Existe algum sócio na faixa de até 50 anos? Se sim, 14 pontos. Se não, zero **e um sinal explícito
na tela**, porque a ausência é informação e não pode virar silêncio.

**Este é o eixo contraintuitivo e o mais importante de você saber defender.** A tese ingênua de
mercado diz o contrário: sem herdeiro, a empresa é obrigada a vender. O dado diz que herdeiro no
quadro tem lift **2,14x positivo** e ausência de gente nova tem **0,58x**.

A explicação, depois de vista, é evidente: herdeiro no quadro não trava a venda, ele é quem a
**conduz**. Negocia, organiza a casa, contrata assessor, e com frequência é quem decide sair. O
octogenário sozinho num quadro parado há vinte anos não vende, ele fica, e a empresa encolhe até
fechar.

### 4.4 Quadro plural (0 a 13)

5 ou mais sócios PF vale 13, 2 a 4 vale 7, sócio único vale 0. Sociedade com um dono só é menos
transacionável, e 5+ sócios tem lift 2,45x.

### 4.5 Movimento societário (0 a 11)

Anos desde a entrada de sócio mais recente. Menos de 5 anos vale 11, menos de 10 vale 6, acima
disso vale 0.

Quadro que mexeu recentemente tem lift 2,22x. Quadro parado 10+ anos tem **0,60x**, sinal negativo.
Empresa que não mudou nada em uma década também não vai mudar de dono.

### 4.6 Ressalva de distress (não pontua)

`alertaDeRegistro()` casa o estado processual que a junta anexa à razão social: recuperação
judicial, recuperação extrajudicial, liquidação, intervenção, massa falida. São 133 empresas na
base e **32 com score >= 70**, ou seja, dentro do pedaço da lista que o originador trabalha.

**Não vale ponto e não penaliza.** Distress nunca foi medido contra o ground truth, e o protocolo
da seção 10 proíbe peso por intuição. Sai como sinal de peso zero no **topo** da lista de sinais,
porque ressalva vem antes de elogio. Empresa em recuperação judicial pode até ser bom deal, mas é
uma conversa completamente diferente de sucessão familiar, e isso precisa ser sabido antes da
ligação, não no meio dela.

### 4.7 O que o score não faz: o gate

`perfilSucessorio()` é separado do score e não soma ponto: exige **sócio 61+ e empresa com 25+
anos**. Fora dele a lente de sucessão não é confiável e o deal provável é consolidação, que é outro
jogo (ver `scripts/proximo-alvo.mjs`).

É aqui que mora a antiguidade desde o v1, e a seção seguinte explica por quê.

---

## 4.8 O teto de 100 e o desempate por evidência

O v1 é `clamp(v0 + ajuste, 0, 100)`, e no topo da lista o teto apaga a magnitude do research.
Medido em 30/07/2026 num lote de metalmecânica: ajustes brutos de +12, +12, +18, +24, +30 e +30
viraram **todos o mesmo +3**. A CSN tinha quatro menções públicas a venda, mais sucessor familiar,
mais C-suite externo, e ficava indistinguível de quem tinha um sinal só.

Paliativo em produção: `lerScoresV1` recalcula o ajuste bruto a partir da coluna `sinais` (não é
campo novo, e recalcular faz com que mudar um peso reordene a lista sozinho), e `aplicarV1`
desempata por ele quando o score empata. A tela continua mostrando 0 a 100.

**É paliativo, não correção.** A causa é que v0 e v1 respondem perguntas diferentes ("tem o
perfil" e "está acontecendo agora") e não deviam dividir um número só. Separar as duas dimensões
é mudança de produto, com UI e tipos, e está na fila da seção 11.

---

## 5. O que saiu do score, e a lição de cada saída

### Antiguidade (o caso mais instrutivo do projeto inteiro)

Tinha o **maior lift marginal de todos, 4,39x**. Tirá-la do score **melhorou** o recall no holdout
em +1,9pp, de forma consistente nas duas metades.

Por quê: empresa antiga também é empresa grande, e o eixo de capital já captura isso. Antiguidade
não estava trazendo informação nova, estava contando tamanho duas vezes.

Ela não sumiu do produto. **Virou porta de entrada** (`perfilSucessorio`), que é exatamente o papel
que o dado diz que ela tem: define o universo, não ordena dentro dele.

Efeito colateral bom: o problema histórico do agro deixou de existir. A data de abertura do CNPJ
não mede idade de negócio no agro por causa da formalização em massa de produtor rural entre 2006 e
2010, e antiguidade valia 30 dos 100 pontos do v0. O v1 simplesmente não pontua antiguidade.

**Lição: lift marginal alto não é passaporte. O eixo tem que ganhar o lugar dele em ablação.**

### Porte

Três baldes grosseiros (ME, EPP, DEMAIS) medindo a mesma coisa que capital mede com resolução
contínua. Trocar porte por capital em percentil, sozinho, vale **+19,6pp** de recall.

### Tem sócio PJ no quadro

Lift 3,15x, z = 5,35, e mesmo assim **descartado**. Duas razões que se somam:

1. Adicioná-lo à melhor variante ganhou só +0,5pp no holdout, dentro do ruído com n=838.
2. É a feature com maior risco de estar contaminada pela definição do ground truth (seção 2).

Quando o ganho é ruído e o risco metodológico é real, a decisão é fácil.

### Tem filial (2+ estabelecimentos)

Lift 1,97x, e a ablação diz que vale ~1,3pp de recall, ou seja, é sinal de verdade. **Ficou de fora
por limitação de dado:** o ingest não traz contagem de estabelecimentos e a coluna não existe no
Supabase. Entra quando o ingest trouxer. Está na seção 11.

Note a diferença de tratamento: sócio PJ saiu por decisão metodológica, filial saiu por dívida de
engenharia. São coisas distintas e devem ser ditas distintamente.

---

## 6. Os números atuais, com a leitura honesta

### Recall@top10%, holdout

Duas medições, com universos diferentes de propósito.

**Modo estreito** (os 4 verticais cobertos, decil dentro do vertical):

| recorte | v0 | v1 | n |
|---|---|---|---|
| universo | 42,0% | 72,4% | 838 |
| perfil sucessório | 32,9% | 38,3% | 167 |

**Modo amplo** (`--amplo`: CNPJ inteiro, 22,4 milhões de empresas, decil dentro da divisão CNAE,
79 divisões). Existe porque com n=167 um ganho de +5,4pp não era conclusivo:

| recorte | v0 | v1 | delta | n |
|---|---|---|---|---|
| universo | 47,2% | 60,6% | +13,4pp | 7.060 |
| **perfil sucessório** | **35,8%** | **41,5%** | **+5,7pp** | **978** |

**O ganho replicou.** Com o n 6x maior (167 → 978), o delta praticamente não se moveu (+5,4pp →
+5,7pp). Essa é a evidência que importa: um efeito que sobrevive ao aumento da amostra não era
ruído. O z da diferença é **2,59** mesmo no cálculo não-pareado (o pareado seria maior, são as
mesmas 978 empresas rankeadas por dois scores).

**O número para citar é 41,5% no perfil sucessório, 4,1 vezes melhor que sorteio.** O 60,6% do
universo é verdadeiro e enganoso ao mesmo tempo: boa parte do salto vem de setores onde capital
apenas separa empresa real de CNPJ minúsculo, o que é efeito de filtro e não descoberta sobre
sucessão. Se te perguntarem o número do universo, dê os dois e explique a diferença.

### Recall em vendas de sucessão, por setor (`src/lib/setores.json`)

| setor | universo | recall geral | n de vendas de sucessão | recall sucessão |
|---|---|---|---|---|
| metalmec | 67.464 | 79% | 36 | 86% |
| saúde | 157.110 | 59% | 21 | 81% |
| educação | 13.311 | 37% | 8 | 50% |
| agro | 507.499 | 100% | 12 | 100% |

Os 100% do agro têm n=12. Trate como indicativo, nunca como validado, e cite o número nacional que
já está no texto da descrição do setor.

### Taxa base por faixa de score (o diagnóstico que originou tudo)

Medido com o v0, nacional, quatro verticais:

| faixa de score v0 | universo | adquiridas | taxa |
|---|---|---|---|
| 100 | 708 | 28 | 3,95% |
| 80 a 99 | 9.040 | 130 | 1,44% |
| 60 a 79 | 38.643 | 231 | 0,60% |
| até 59 | 733.573 | 716 | 0,10% |

Monotônico e 40x do topo à base. **O v0 nunca esteve quebrado como filtro.** O problema era outro,
e é o da seção seguinte.

### Saturação: o problema que originou a investigação

O v0 tinha 44 valores distintos possíveis e empilhava centenas de empresas no teto. 226
metalmecânicas cravadas em 100 não são um ranking, são uma lista.

| vertical | no teto v0 → v1 | valores distintos v0 → v1 |
|---|---|---|
| metalmec | 336 → **39** | 44 → 84 |
| educação | 121 → **10** | 44 → 83 |
| saúde | 372 → **157** | 44 → 84 |
| agro | 452 → **323** | 44 → 84 |

Na base de produção, metalmecânica saiu de **226 empatadas em 100 para 11**, e os dez maiores
scores viraram 100, 97, 95, 94, 93, 92, 91, 90, 89, 88.

**Ressalva honesta:** o maior empate individual continua grande e em agro até aumentou (367 mil
numa faixa). Esse bloco está no **fundo** da lista, onde ficam empresas sem dado de sócio e sem
capital declarado. Não afeta o topo, que é o que se trabalha, mas não é honesto dizer que "o
empate acabou".

---

## 7. A inversão da tese, que é o achado desta rodada

Vale isolar porque é o que muda a conversa comercial.

| sinal | lift condicional | o que a intuição diz | o que o dado diz |
|---|---|---|---|
| sucessor aparente no quadro | **2,14x** | trava a venda | conduz a venda |
| quadro mexeu em 5 anos | **2,22x** | irrelevante | é dos sinais mais fortes |
| quadro parado 10+ anos | **0,60x** | sinal clássico de sucessão | anti-sinal |
| 2+ sócios na faixa 80+ | **0,50x** | mais urgência | menos deal |

A tese reformulada, e é assim que você deve falar dela:

> Não procuramos a empresa abandonada. Procuramos a empresa **em transição**: controle em idade de
> transferir, geração seguinte presente, quadro se movimentando, e escala que justifique a
> transação. O octogenário sozinho num quadro congelado não vende, ele fecha.

**Corrigido no research em 29/07/2026.** O agente qualitativo tinha DOIS sinais invertidos, e os
dois codificavam a mesma tese ingênua, simetricamente:

| sinal | era | virou |
|---|---|---|
| `sucessor_familiar_ativo` (herdeiro na gestão) | **-25**, o maior castigo do sistema | **+12** |
| `herdeiro_fora_carreira` (herdeiros longe do negócio) | +8 | **-8** |

Junto com a troca de sinal entraram duas regras no prompt: sucessor familiar só conta com **fonte
externa ao registro** (página de agregador de CNPJ apenas repete o quadro societário que já foi
lido e pontuado, e re-reportá-lo faz o mesmo fato valer duas vezes), e "sócio idoso" deixou de ser
gatilho válido, porque é condição de anos e não motivo de agora.

As 43 investigações já persistidas foram **recalculadas, não descartadas**
(`scripts/recalcula-research.ts`): o achado do LLM custa ~100s por empresa e continua válido; só a
aritmética envelheceu. 42 das 43 mudaram de score.

**Ressalva honesta sobre esses pesos:** eles não vieram de lift medido e não têm como vir, porque
medir exigiria rodar o LLM sobre centenas de milhares de empresas. A magnitude é ancorada no eixo
equivalente do score determinístico (sucessor aparente vale 14 de 100), um pouco abaixo porque
evidência qualitativa é menos verificável que registro. O que o dado obriga é a **direção**. Os
outros pesos do research (`banco_investimento` +15, `mencao_sucessao_venda` +12, `csuite_externo`
+6, `big4_auditoria` +5, `sem_presenca_digital` +3) continuam sem validação de espécie alguma.

---

## 8. Como rodar o pipeline inteiro

Todos exigem `.env.local` com `GCP_PROJECT_ID` e `GCP_KEY_PATH` (BigQuery) e as chaves do Supabase.

```bash
node --env-file=.env.local scripts/validacao-lift-coorte.mjs
```
Lift condicional de cada feature candidata dentro da coorte alta. Gera `src/lib/lift-coorte.json`.
**É o primeiro passo de qualquer eixo novo.**

```bash
node --env-file=.env.local scripts/validacao-variantes.mjs
```
Compara variantes de fórmula por recall, com holdout. É onde se resolve colinearidade e se roda
ablação (tirar um eixo e ver se o recall cai).

```bash
node --env-file=.env.local scripts/validacao-score-v1.mjs
node --env-file=.env.local scripts/validacao-score-v1.mjs --amplo
```
Medição definitiva: v0 vs v1, universo e perfil sucessório, mais saturação. **É este script que
autoriza uma troca de score.** Sem flag roda nos 4 verticais e gera `validacao-v1.json`; com
`--amplo` roda o CNPJ inteiro com decil por divisão CNAE e gera `validacao-v1-amplo.json`. Rode
os dois: o estreito é o produto, o amplo é quem dá n suficiente para o resultado ser conclusivo.

```bash
node --experimental-strip-types --env-file=.env.local scripts/recalcula-research.ts --aplicar
```
Refaz a aritmética das investigações persistidas sem reinvestigar. **Rodar depois de toda mudança
em `scoring.ts` ou nos PESOS do research**, senão empresa investigada aparece com a régua antiga
no meio de uma lista com a régua nova.

```bash
node --env-file=.env.local scripts/build-capital-percentis.mjs
```
Recalcula os cortes de capital por setor a partir da base indexada. Rodar **depois de todo ingest
relevante**, senão o eixo mais forte do score fica medindo percentil de uma base que não existe mais.

```bash
node --experimental-strip-types --env-file=.env.local scripts/backfill-score-v0.ts
```
Materializa `empresa.score_v0` para a busca poder ordenar no banco antes do LIMIT. **Rodar depois
de todo ingest e depois de toda mudança em `scoring.ts`.** Sem isso a busca ordena por um número que
a tela não mostra.

```bash
node --env-file=.env.local scripts/validacao-snapshot.mjs
node --env-file=.env.local scripts/build-setores.mjs
```
Regeram os artefatos que o **produto exibe como prova** ao cliente: `validacao.json` (página
/validacao) e `setores.json` (página /setores, descrições e recall por setor).

```bash
npm test
```
59 testes. Os de `scoring.test.ts` travam cada peso medido. O teste "sucessor aparente PREMIA"
existe especificamente para quebrar se alguém "consertar" o sinal de volta para negativo.

### Mapa de arquivos

| arquivo | papel |
|---|---|
| `src/lib/scoring.ts` | a fórmula que roda em produção. Fonte de verdade. |
| `scripts/lib/score-sql.mjs` | o espelho em SQL da mesma fórmula, para validar contra 700 mil empresas |
| `src/lib/capital-percentis.json` | cortes de capital por setor |
| `src/lib/lift-coorte.json` | lift condicional medido de cada feature |
| `src/lib/lift.json` | lift marginal (histórico, escolheu os eixos do v0) |
| `src/lib/validacao-v1.json` | a medição que autorizou a troca |
| `src/lib/validacao.json` | recall por vertical, exibido em /validacao |
| `src/lib/setores.json` | métricas por setor, exibidas em /setores |

**Existir uma cópia da fórmula em SQL é inevitável**, porque validar contra 700 mil empresas não
cabe em TypeScript linha a linha. Existirem várias não é. Antes desta rodada cada script carregava
a sua, e na troca de v0 para v1 todas viraram medição de uma fórmula que não rodava em lugar
nenhum, com a página de validação mostrando ao cliente o recall de um score aposentado. Agora a
cópia é uma, em `scripts/lib/score-sql.mjs`.

---

## 9. Limitações que você deve saber dizer em voz alta

1. **O ground truth é proxy.** Captura reorganização societária como se fosse venda, e não captura
   venda de PF para PF. Seção 2.
2. **O ganho no recorte que importa é modesto, ainda que agora significativo.** +5,7pp com n=978,
   z = 2,59. É real e replicou, mas é +5,7pp, não uma virada de patamar. O salto grande do modo
   amplo (+13,4pp no universo) é majoritariamente efeito de filtro por tamanho.
3. **A seleção de features tem vazamento.** Escolhidas olhando o lift da amostra inteira. O holdout
   protege a comparação de variantes, não a escolha do conjunto.
4. **Capital social é proxy sujo.** Declarado, nominal, frequentemente desatualizado desde a
   constituição da empresa.
5. **Janela de 2,4 anos.** Curta para um fenômeno de sucessão.
6. **Os percentis de capital dependem da base indexada.** Ingerir um setor novo reordena listas
   existentes. É comportamento correto, mas é comportamento que surpreende quem não sabe.
7. **agro com 100% tem n=12.** Não é validado.
8. **O modelo não sabe nada que não esteja no CNPJ.** Quem produz "por que agora" é o research
   qualitativo, não o score. Score responde "esta empresa tem o perfil"; research responde "vale
   ligar hoje". São perguntas diferentes e o produto precisa das duas.

---

## 10. Protocolo de revisão

### Quando revisar

| gatilho | o que rodar |
|---|---|
| ingest de setor novo ou crescimento relevante da base | `build-capital-percentis` + `backfill-score-v0` |
| novo snapshot do CNPJ disponível (a Receita publica periodicamente) | tudo, com janela nova |
| a Setter acumular 20+ desfechos reais no pipeline | validar o proxy contra a verdade real (seção 11) |
| alguém propõe um eixo novo | o rito abaixo, inteiro |
| passaram 6 meses sem revisão | rodar a medição só para ver se o número se sustenta |

### O rito para adicionar ou remover um eixo

Nesta ordem, sem pular etapa:

1. **Lift condicional** em `validacao-lift-coorte.mjs`. Se não tiver lift >= 1,3 **e** z >= 2, para
   aqui. Não negocie com esta etapa.
2. **Ablação** em `validacao-variantes.mjs`. Colocar o eixo, tirar o eixo, comparar recall no
   holdout. Se o recall não se mover, o eixo é decoração e está contando algo que outro eixo já
   conta.
3. **Medição definitiva** em `validacao-score-v1.mjs`, olhando os dois recortes (universo e perfil)
   e a saturação.
4. **Trocar `src/lib/scoring.ts` E `scripts/lib/score-sql.mjs` juntos.** Sempre os dois.
5. **Atualizar `scoring.test.ts`** travando os pesos novos.
6. **Rodar o backfill.**
7. **Regerar `validacao.json` e `setores.json`**, senão o produto exibe prova de um score morto.
8. **Atualizar este documento**, incluindo o número honesto e a limitação nova.

### O que nunca fazer

- **Nunca definir um peso por intuição.** Nem "arredondar para ficar bonito". Se o peso não saiu de
  medição, o discurso inteiro de "não é chutado" cai junto.
- **Nunca reportar o número da metade de desenvolvimento.** Só holdout.
- **Nunca adicionar eixo só por lift marginal.** Seção 3.2.
- **Nunca deixar `scoring.ts` e `score-sql.mjs` divergirem.** No momento em que divergirem, a
  validação passa a medir uma coisa e o produto a entregar outra, e você não vai perceber.
- **Nunca cachear score.** `comOverlays` recalcula e reordena de propósito. O cache guarda o que é
  caro (parse da query, insight do LLM, ida ao banco); score custa microssegundos. Pior que número
  velho seria uma lista ordenada pela fórmula antiga com os números da nova.
- **Nunca "consertar" o sinal do sucessor aparente para negativo** porque parece errado. Ele foi
  medido. Se você discordar, meça de novo e mostre o número.

---

## 11. Fila de hipóteses a testar

Em ordem aproximada de valor esperado sobre esforço.

1. **Validar o proxy contra desfecho real da Setter.** Assim que houver ~20 desfechos no pipeline,
   comparar: as empresas que a Setter conseguiu conversa/mandato estavam no topo do nosso score? É
   o único jeito de saber se o ground truth minerado está enviesado. Maior valor de todos.
2. **Proxy limpo de tamanho.** Capital social é sujo e mesmo assim é o eixo mais forte. Número de
   empregados (RAIS/CAGED) ou faturamento estimado deve ser melhor. Testar como substituto e como
   eixo adicional.
3. **Nº de estabelecimentos.** Já medido, vale ~1,3pp, bloqueado por ingest. É o ganho mais barato
   que existe hoje, e depende só de trazer a contagem de filiais.
4. **Movimento societário graduado por tipo.** Hoje só olhamos "quando foi a última entrada". Uma
   **saída** de sócio idoso é conceitualmente diferente de uma **entrada** de sócio jovem e as duas
   viram o mesmo ponto. `scripts/detectar-transicoes.mjs` já reconstrói trajetória e pode alimentar
   isso.
5. **Reconciliar o research com o score.** Os pesos do v1 qualitativo nunca passaram por lift. O
   `sucessor_familiar_ativo` já está comprovadamente invertido; os outros nunca foram medidos.
6. **Janela mais longa.** Quando houver snapshot mais antigo utilizável, refazer com 4+ anos e ver
   se os pesos se sustentam.
7. **Peso por setor.** Hoje a fórmula é a mesma para os quatro. Saúde é majoritariamente
   consolidação e educação é mista; é plausível que os pesos ótimos difiram. Só testar com n
   suficiente por setor, e hoje educação tem n=8 em vendas de sucessão.

---

## 12. Resumo em cinco frases (para decorar)

1. A verdade vem de minerar transições do CNPJ, não de imprensa, e por isso cobre deal pequeno no
   país inteiro.
2. Cada eixo foi medido por lift dentro da coorte, e nenhum entra sem z >= 2.
3. A fórmula inteira é julgada por recall@top10% em metade da base que ela nunca viu.
4. O dado inverteu a tese: quem vende é quem está em transição, com escala, não quem está
   abandonado.
5. O número honesto para o cliente é 38,3% de recall no perfil sucessório, 3,8 vezes melhor que
   sorteio, e não os 72% do universo completo.

---

## 13. A rodada de 02/08/2026: o label estava contaminado

> Esta seção corrige as seções 3, 4, 6 e 7 acima. Elas continuam no documento porque o
> raciocínio delas foi honesto com o que se sabia na época, e porque saber *como* a medição
> errou vale mais que só ver o número novo. Onde houver conflito, **esta seção vence**.

### 13.1. O que disparou a investigação

O objetivo era ajustar os pesos por fit em vez de ancoragem. O primeiro loop rodou contra o
label de sempre e devolveu isto:

```
quadro_plural:  [0, 41, 58]     ← nº de sócios PF virando 58 dos 100 pontos
idade_controle: [0,  1,  1, 3, 4]  ← idade do dono colapsando pra 4
sucessor_aparente: [0, 0]        ← zerado
```

Resultado bom demais na métrica (recall 71% → 80%) e absurdo no conteúdo. Score de risco
sucessório não deveria descobrir que a idade do dono não importa e que o que importa é contar
sócios. Quando o ajuste acha algo assim, o suspeito não é o mundo, é o label.

### 13.2. O achado: o label não consegue classificar empresa de sócio único

O label é `entra sócio PJ E sai sócio PF` entre os dois snapshots. Medindo a prevalência dele
por número de sócios PF no corte:

| nº de sócios PF no corte | empresas | aquisições detectadas | prevalência |
|---|---:|---:|---:|
| 0 (sem registro de sócio) | 20.966 | 0 | 0,000% |
| 1 | 292.499 | **0** | **0,000%** |
| 2 | 323.211 | 490 | 0,152% |
| 3 | 64.350 | 288 | 0,448% |
| 4 | 28.591 | 271 | 0,948% |
| 5+ | 35.070 | 561 | 1,600% |

**292.499 empresas de sócio único, zero aquisições.** No cruzamento, sair de 1 sócio PF para 0
acontece **1 vez em 292 mil**. O label só enxerga aquisição **parcial**, em que um PJ entra e
ainda sobra sócio PF no quadro.

Não é que empresa de dono único não venda. É que a venda dela não deixa essa assinatura no
registro. Ela é **estruturalmente inclassificável**, e ainda assim estava no denominador de
tudo que a gente reportou.

Duas consequências, e as duas são ruins:

1. **Recall inflado de graça.** Empresa inclassificável nunca conta como acerto perdido, e
   ainda ocupa o fundo do ranking liberando vaga no decil de cima. Medindo só onde o label
   consegue classificar (n_pf ≥ 2), o recall do score de hoje cai de **42,0% para 36,9%** no
   perfil sucessório.
2. **O ajuste aprende a contar sócios.** A probabilidade do label sobe 10x com o número de
   sócios por aritmética pura: cinco sócios dão cinco chances de alguém sair.

### 13.3. Paradoxo de Simpson nos eixos da tese

Estratificando por faixa de nº de sócios, que é o que neutraliza a parte mecânica, os lifts
do universo elegível ficam assim:

| Sinal | Global | 2 sócios | 3-4 | 5+ | Veredito |
|---|---:|---:|---:|---:|---|
| Capital acima da mediana | 2,14x (z56) | 2,18x (z29) | 1,96x (z32) | 1,94x (z31) | sobrevive forte |
| Tem sócio PJ | 5,75x (z12) | 5,07x (z4) | 3,94x (z7) | 2,12x (z6) | sobrevive forte |
| Tem filial | 2,46x (z15) | 2,48x (z8) | 1,96x (z8) | 1,82x (z7) | sobrevive forte |
| Quadro mexeu < 5 anos | 1,62x (z20) | 1,50x (z8) | 1,31x (z7) | 1,29x (z9) | sobrevive |
| Quadro parado 10+ | 0,51x (z19) | 0,64x (z8) | 0,69x (z5) | 0,43x (z11) | sobrevive, anti-sinal |
| Sócio até 50 (sucessor aparente) | 1,15x (z11) | 1,04x (z1) | 1,06x (z3) | 1,10x (z6) | quase morre |
| **Sócio 61+ (idade do controle)** | **1,20x (z7)** | **1,00x (z0)** | **0,99x (z0)** | **0,96x (z1)** | **morre** |

O eixo que vale 28 dos 100 pontos, e que dá nome ao produto, tem lift **1,00x** dentro do
estrato. O global de 1,20x é Simpson: empresa com mais sócios tem mais chance de ter algum
sócio velho **e** mais chance de disparar o label. Os dois sobem juntos sem se causarem.

**A leitura certa NÃO é "idade não prevê nada".** É que **este label não consegue testar
idade**, porque a transação que a idade previria (venda integral de empresa fechada, de dono
único) é exatamente a que o registro não mostra. Ausência de evidência aqui é uma limitação
do instrumento, não evidência de ausência. Tirar o eixo de idade por causa deste número seria
sobreajustar a um label cego justo no caso central do produto.

### 13.4. O que mudou no método, e vale daqui pra frente

1. **Universo elegível.** Toda medição de recall roda só sobre quem o label consegue
   classificar (presente no snapshot de desfecho e n_pf ≥ 2). Fora disso o número é cortesia.
2. **Métrica estratificada.** `recall@top10%` dentro de `(vertical, faixa de nº de sócios)`.
   A pergunta certa é "entre empresas com o mesmo tamanho de quadro, as adquiridas sobem?".
3. **Eixo que a métrica não consegue julgar sai da busca.** `quadro_plural` é quase constante
   dentro do estrato, então o ajuste não o enxerga. Ele foi julgado à parte e o resultado está
   em 13.5.
4. **Extração única, loop local.** `extrai-matriz-score.mjs` puxa a matriz do BigQuery uma vez
   (1.465.665 empresas, 1.610 aquisições); `calibra-score.py` roda milhares de avaliações em
   numpy. Sem isso, uma busca de verdade é cara e lenta demais pra alguém rodar.
5. **Disciplina de amostra.** Ajuste e busca só no desenvolvimento, com 5 folds. O holdout é
   aberto **uma vez**, no fim, e o número dele é o que se reporta.

### 13.5. Resultado da calibração

Ajuste nos quatro eixos que a métrica estratificada consegue julgar, holdout aberto uma vez:

| | estratificado | perfil |
|---|---:|---:|
| Score de hoje | 31,74% | 19,2% |
| Proposto | **35,32%** | **22,8%** |
| Delta | **+3,58** | **+3,6** |

**McNemar pareado no holdout: 81 aquisições só o proposto pegou, 53 só o atual, z = 2,42.**
O ganho é real e não sorteio de empate. No desenvolvimento o ganho era +6,7, ou seja, metade
era sobreajuste da busca; a metade que sobreviveu é a que vale.

Pesos propostos (os quatro eixos, escala preservada em 87 pontos):

| Eixo | Hoje | Proposto |
|---|---|---|
| `escala_capital` | [0, 11, 19, 27, 34] | [0, 5, 17, 27, 51] |
| `idade_controle` | [0, 10, 19, 25, 28] | [0, 17, 17, 30, 30] |
| `sucessor_aparente` | [0, 14] | [0, 1] |
| `movimento_societario` | [0, 6, 11] | [0, 1, 5] |

**`quadro_plural`, julgado à parte:** variar de [0,0,0] a [0,14,26] **não move** a métrica
estratificada (37,44% nos quatro casos) e move só a métrica contaminada. Os 13 pontos de hoje
compram número de validação, não ordenação real.

**Sinais fortes ainda de fora:** `tem sócio PJ` (derivável em runtime) e `tem filial` (exige
mudar o ingest, não está na tabela `empresa`). Somados ao proposto, no desenvolvimento, levam
o perfil de 25,3% para 29,3% mas não movem o estratificado. Não é decisão fechada.

### 13.6. O que isto obriga a corrigir

- Os números do README e do material de cliente foram medidos no universo inflado. O
  41,5% em holdout vira **36,9%** quando medido só onde o label classifica.
- A seção 7 (a inversão da tese) precisa ser reescrita: o lift 2,14x do sucessor aparente é em
  boa parte o artefato de contagem. Dentro do estrato ele é 1,04x a 1,10x.
- O `lift-coorte.json` foi gerado com a fórmula v0 antiga e sem estratificar. Ele não deve ser
  citado sem essa ressalva.

### 13.7. Reproduzir

```bash
node --env-file=.env.local scripts/extrai-matriz-score.mjs   # matriz, uma vez
python scripts/diagnostico-label.py                          # contaminação do label
python scripts/calibra-score.py --iters=500                  # busca, só no dev
python scripts/calibra-score.py --iters=500 --holdout        # abre o holdout, uma vez
```

---

## 14. A rodada de 11/08/2026: o eixo mais forte estava num campo congelado

> Esta seção **soma** à §13, não a substitui. O método da §13 (universo elegível, recall
> estratificado) continua valendo integralmente. O que muda aqui é a lista de eixos, e aparecem
> dois defeitos de instrumento que a §13 não tinha visto: um vazamento novo e um ruído de
> desempate que sempre esteve lá, sem ter sido medido.

### 14.1. O que abriu a investigação

Sondando setores para a Setter, o corte de tamanho usado foi `capital_social >= R$1 mi`. O
Guilherme apontou que capital social é declarado no registro do CNPJ e empresa não atualiza.
Medido em `scripts/check-estagnacao-campos.mjs`:

| campo | idêntico entre 2023-06-10 e 2025-11-09 |
|---|---:|
| `capital_social` | **96,8%** |
| `porte` | **99,0%** |

E `escala_capital` vale **34 dos 100 pontos** do v0, o eixo mais forte do modelo. Pior: o
`src/lib/dossier.ts:94` já instruía o LLM com *"NUNCA use capital_social como proxy de
porte/tamanho/faturamento, é registro contábil histórico"*. O produto proibia numa camada o que
fazia na outra.

### 14.2. Os candidatos, e o que sobrou de cada um

**`porte` da Receita (1=ME, 3=EPP, 5=DEMAIS). ENTROU.** Já está no ingest e na tabela `empresa`
do Supabase (`ingest-empresas.mjs:194`), então é usável em runtime hoje, sem obra. Lift
estratificado no dev: ME **0,72x**, DEMAIS **1,00x**, EPP **2,67x** (z=5,2 no estrato de 2 sócios).

As faixas **não são monotônicas no tamanho**, e isso é o achado: EPP é a faixa de mid-market que a
boutique procura, e DEMAIS mistura empresa grande com empresa inelegível ao regime por natureza
jurídica, inclusive as que **já têm sócio PJ**. Por isso a ordem dos bins na busca é
`ME → DEMAIS → EPP`, e não a ordem natural de tamanho.

**`saiu_simples` (excluída do Simples antes do corte, ou seja, estourou o teto de R$4,8 mi).
MEDIDO E DESCARTADO.** Lift 2,15x isolado, mas com ele o dev CV é **42,32%** contra **42,57%** sem.
Não agrega, porque é redundante com capital e porte. **Resultado negativo útil: economiza a mudança
de ingest** que traria a tabela `simples`.

**A flag `opcao_simples`. BARRADA POR VAZAMENTO.** Dava lift **0,00x com z=11,4** dentro de capital
alto, o que parecia o melhor sinal já medido. A Lei Complementar 123 proíbe sócio PJ no Simples, e
o label de aquisição **é** "entra sócio PJ", então toda adquirida foi obrigada a sair. Como a tabela
`simples` não tem partição por data, a flag é o estado de 2026. Prova em
`scripts/check-vazamento-simples.mjs`:

| flag hoje | janela da exclusão | n | adq | lift |
|---|---|---:|---:|---:|
| no Simples | sem data de exclusão | 137.328 | **28** | **0,06x** |
| fora | sem data de exclusão | 243.842 | 1.187 | 1,36x |
| fora | **antes do corte** | 30.795 | 236 | **2,15x** |
| fora | entre corte e desfecho | 28.155 | 151 | 1,50x |

O campo foi removido da extração e há uma **guarda que aborta** `calibra-score.py` se ele reaparecer
numa matriz antiga. Deixar o campo disponível e confiar em disciplina é como o erro volta.

### 14.3. O defeito de instrumento: o desempate

O baseline no holdout deu **31,86%** nesta rodada e **31,74%** em 02/08, com o mesmo código, os
mesmos pesos e as mesmas 838 aquisições. A causa não é o modelo.

O score é uma soma de poucos inteiros, então tem **cerca de 60 valores distintos para 200 mil
empresas**. A fronteira do top 10% cai dentro de um bloco enorme de empates, e quem entra é
decidido por critério arbitrário. `calibra-score.py` sorteava esse critério **por posição de
linha**, e o BigQuery não garante ordem entre extrações.

Medido com `--ruido=25` (25 sorteios do desempate, mesmos pesos, dev):

| | estratificado | perfil |
|---|---|---|
| baseline | 31,18% **± 0,25** | 24,69% **± 0,91** |
| proposto | 41,60% **± 0,27** | 29,17% **± 0,91** |

**A métrica do perfil, que é a citada publicamente, carrega quase 1 ponto de desvio só de
desempate.** Citar "36,9%" com uma decimal é precisão falsa. O intervalo honesto é de cerca de
±1 ponto.

E isto **não é só do script**: produção usa `NTILE`, que também desempata arbitrariamente. Medido
com `bloco_de_empate`:

| | vagas no top 10% | preenchidas por desempate |
|---|---:|---:|
| baseline | 22.522 | 918 (**4,1%**) |
| proposto | 22.522 | 2.917 (**13,0%**) |

**O proposto ganha recall e piora a granularidade.** Uma em cada oito empresas da lista está lá por
sorteio. É custo real e tem que entrar na decisão.

**Corrigido:** a matriz agora traz uma coluna `desempate` derivada de
`MOD(ABS(FARM_FINGERPRINT(cnpj_basico)), 1000000)`, então o desempate é estável entre extrações e
reproduzível. As duas rodadas anteriores não eram.

### 14.4. Resultado

Busca só no dev, 5 folds, vencedor por CV. Holdout aberto uma vez no fim.

| eixo | hoje | proposto | faixas |
|---|---|---|---|
| `escala_capital` | [0, 11, 19, 27, 34] | **[0, 24, 37, 37, 45]** | <p50 p50 p70 p85 p95 |
| `idade_controle` | [0, 10, 19, 25, 28] | **[0, 2, 2, 6, 11]** | <6 6 7 8 9 |
| `sucessor_aparente` | [0, 14] | **[0, 4]** | sem ≤5 |
| `movimento_societario` | [0, 6, 11] | **[0, 0, 10]** | 10+/sem <10 <5 |
| **`porte_receita`** | [0, 0, 0] | **[0, 17, 17]** | ME/ausente DEMAIS EPP |

| holdout (n=838, perfil 167) | estratificado | simples | perfil |
|---|---:|---:|---:|
| baseline (o `scoring.ts` de hoje) | 31,62% | 46,2% | 19,8% |
| proposto | **38,54%** | 54,4% | **24,0%** |
| delta | **+6,92** | +8,2 | +4,2 |

**McNemar pareado: só o proposto pegou 120, só o atual pegou 62, z = 4,30.**

Para comparar: a proposta de 02/08, sem `porte`, deu **+3,58 com z=2,42**. Adicionar `porte`
praticamente **dobra o ganho** e sobe a significância de 2,4 para 4,3 desvios.

Repare que `escala_capital` **subiu** de 34 para 45 dos 87 pontos. Porte não substituiu capital: os
dois medem coisas diferentes e o modelo quer os dois. Confirma o teste condicional do
`diagnostico-porte.py`, onde capital ≥ p85 dentro de porte DEMAIS dá **9,00x** (z=7,1).

### 14.5. O que continua igual à §13, e não foi resolvido

- `idade_controle` continua colapsando (28 → 11 pontos) e continua sendo mantido por julgamento,
  pelo mesmo motivo: o label não enxerga venda integral de empresa de dono único.
- `sucessor_aparente` continua sendo esvaziado (14 → 4), com o mesmo custo narrativo.
- `quadro_plural` continua sem mover a métrica estratificada em nenhum valor de 0 a 26.
- O holdout **já foi aberto três vezes** (02/08, e duas em 11/08, uma delas antes do desempate
  estável). Isso queima poder estatístico. Se houver uma quarta rodada de calibração, o certo é
  refazer o corte de metades com outra semente.

### 14.6. Reproduzir

```bash
node --env-file=.env.local scripts/extrai-matriz-score.mjs      # matriz, com porte e desempate
node --env-file=.env.local scripts/check-estagnacao-campos.mjs  # capital e porte congelados?
node --env-file=.env.local scripts/check-vazamento-simples.mjs  # prova do vazamento da flag
python scripts/diagnostico-porte.py                             # lift condicional porte x capital
python scripts/calibra-score.py --iters=600 --ruido=25          # busca + ruído de desempate
python scripts/calibra-score.py --iters=600 --com-simples       # quanto valeria o ingest do Simples
python scripts/calibra-score.py --iters=600 --holdout           # abre o holdout
```

---

## 15. A rodada de 12/08/2026: o ponto cego tem instrumento, e o que ele mostra é ruim

> Esta seção **não corrige** as §13 e §14, ela mede o que elas declararam impossível de medir.
> Nenhum peso mudou por causa dela. O que mudou foi o que sabemos não saber.

### 15.1. A ideia

Veio do Guilherme: iterar pesos com base em "últimas movimentações". Dentro disso havia uma ideia
que resolve o ponto cego estrutural da §13. O label de hoje é "entra sócio PJ e sai sócio PF" e
**exige que sobre alguém no quadro**, então empresa de sócio único é inclassificável: sair de 1
sócio PF para 0 acontece 1 vez em 292 mil.

Só que existe uma movimentação que dispara nessa população: **o sócio único trocar de identidade**.
A venda de uma empresa de dono único não aparece como queda na contagem, aparece como troca. A
tabela `socios` tem `documento`, então dá para comparar conjuntos e não só contagens.

### 15.2. O tamanho

| label | eventos |
|---|---:|
| aquisição (o de hoje, base inteira) | 1.610 |
| dono único presente nos dois snapshots | 279.429 |
| trocou de dono | 14.726 (5,27%) |
| **transação** (nenhum sobrenome em comum) | **10.860** (74% das trocas) |
| familiar (sobrenome em comum) | 3.866 (26%) |

**7,7x mais eventos mensuráveis.** E cobre 279 mil empresas que estavam no denominador de todo
número publicado sem nunca poder contar como acerto perdido.

### 15.3. O teste da mortalidade, que o label precisava passar

Na faixa 71+ a taxa de óbito em 2,4 anos é da mesma ordem da taxa de troca. Se o label fosse
dominado por morte, o modelo aprenderia mortalidade e o eixo de idade "funcionaria" trivialmente,
indicando espólio para um comprador que quer negociar com quem decide. Herança mantém sobrenome,
venda não. Separando por tokens de nome (sem partículas e sem sufixo de geração, que são o próprio
marcador de herança e inflariam a semelhança):

| faixa do dono | transação | lift | familiar | lift |
|---|---:|---:|---:|---:|
| até 50 | 3,38% | 0,87x | 1,24% | 0,89x |
| 51-60 | 5,62% | **1,45x** | 1,68% | 1,21x |
| 61-70 | 5,07% | 1,30x | 1,63% | 1,18x |
| 71+ | 5,85% | 1,50x | 3,09% | **2,24x** |

**O label passa.** O degrau de mortalidade aparece isolado no lado familiar (1,18x → 2,24x) e
**não** contamina o lado transação, que é quase plano de 51-60 a 71+. Idade do dono é sinal de
venda, mas modesto: 1,30x a 1,50x, contra 1,94x-2,18x do capital no label antigo.

### 15.4. O resultado que dói

**Recall@top10% do score ATUAL, por label:**

| universo | n | eventos | recall | vs sorteio |
|---|---:|---:|---:|---:|
| 2+ sócios, label de aquisição (o número publicado) | 451.222 | 1.610 | 48,6% | 4,9x |
| **dono único, transação** | **279.429** | **10.860** | **11,3%** | **1,1x** |
| dono único, herança familiar | 279.429 | 3.866 | 14,6% | 1,5x |
| dono único, transação, empresa 25+ anos | 17.678 | 2.595 | 5,5% | **0,6x** |

**Na metade do universo que nunca foi medida, o score é indistinguível de sorteio.** E no recorte
que mais parece a tese (empresa antiga de dono único) ele é *pior* que sorteio.

Por setor, contra transação: saúde 22,7% (2,3x) · metalmec 18,9% (1,9x) · agro 9,2% (0,9x) ·
**educação 3,5% (0,3x)**.

**Por que.** Em dono único, `quadro_plural` e `sucessor_aparente` são constantes por construção
(n_pf=1 sempre, e o menor sócio é o próprio), então 27 dos 100 pontos não discriminam nada. Sobram
capital, idade e movimento. E os eixos **invertem de sinal** entre os dois labels:

| eixo | contra aquisição | contra transação |
|---|---:|---:|
| capital ≥ p85 | 3,75x | **0,80x** |
| porte EPP | 2,67x | **0,68x** |
| porte DEMAIS | ~1,00x | **3,23x** |
| empresa 25+ anos | (não é eixo) | **3,78x** (z=40) |

O sinal mais forte contra o label novo, antiguidade da empresa, **não é eixo do score**.

### 15.5. Mas o label novo está sujo, e isto impede calibrar nele

A taxa de transação por faixa de capital é **em U**: 1,33x abaixo da mediana, 0,48x a 0,68x no
meio, 1,33x acima do p95. Isso é a assinatura de **dois fenômenos misturados**: rotatividade
cadastral de microempresa embaixo e transação de verdade em cima. Por porte a coisa é mais limpa
(ME 0,40x · EPP 0,68x · DEMAIS 3,23x), e no cruzamento `DEMAIS e capital ≥ p85` o score chega a
**25,4% (2,5x)**, com n=532. Estreito demais para concluir.

Outro dado do mesmo corte: **28.530 empresas de 2+ sócios tiveram entrada E saída de sócio PF, e o
label antigo marcou apenas 539 (1,9%) como aquisição.** Os dois labels medem coisas muito
diferentes; nenhum é "o certo".

### 15.6. O que isto obriga

- **Não calibrar contra `transação` ainda.** O label mistura rotatividade com venda, e ajustar peso
  contra ele ensinaria o modelo a achar microempresa que muda de titular.
- **Parar de citar o recall como se valesse para a base toda.** Ele vale para empresa de 2+ sócios,
  que é 31% do universo dos 4 setores. Nos outros 69% o número honesto hoje é "não medido", e a
  única medição existente diz 1,1x.
- **Antiguidade da empresa vira candidata a eixo** (3,78x, z=40 contra transação). Já está na
  tabela `empresa` e é calculável em runtime.
- **`idade_controle` sobrevive, mas menor.** 1,30x a 1,50x contra transação. Não é o 1,00x do label
  cego, e não justifica 28 dos 100 pontos.

### 15.7. A âncora externa que fecha o assunto (Guilherme, 12/08)

O teste de sujeira interno (§15.5) dizia "o label mistura coisas". Existe um argumento mais forte e
mais barato, que é aritmética de ordem de grandeza contra fonte de fora:

**Correção do que foi escrito primeiro.** A versão inicial desta seção comparava as 1.610 aquisições
dos 4 setores contra os 1.581 deals da KKR e concluía "42% do Brasil". Isso confunde escopos: o
nosso é 4 setores em 2,4 anos, o da KKR é o país inteiro em 1 ano. Rodamos o mesmo label sem recorte
de CNAE (`scripts/sonda-aquisicoes-brasil.mjs`) e o número real apareceu.

| | eventos | por ano | leitura |
|---|---:|---:|---|
| KKR, deals anunciados no Brasil, 2025 | 1.581 | 1.581 | âncora externa |
| nosso label, **Brasil inteiro**, 2,42 anos | **14.093** | **5.830** | **3,7x o anunciado** |
| nosso label, os 4 setores validados | 1.610 | 665 | **11,4% do total nacional** |
| label `transação`, só os 4 setores | 10.860 | 4.490 | escala nacional daria ordem de 10⁵ |

Universo nacional: 22.469.122 matrizes ativas, das quais **3.230.115 (14,4%) têm 2+ sócios PF**, que
é a única população onde o label consegue disparar. Taxa nacional de aquisição sobre elegíveis:
**0,44%**.

**A leitura correta.** 3,7x entre "toda troca de controle visível no registro" e "deal anunciado" é
uma razão plausível, provavelmente até conservadora: a Receita enxerga transação pequena sem
assessor e sem imprensa, que é justamente o mid-market que a KKR não conta. O label de aquisição
sobrevive à âncora. O label `transação` não: 10.860 em 4 setores já é 7x o país anunciado, e
extrapolado dá ordem de grandeza incompatível com qualquer definição de M&A.

**Achado de lado, que contraria a escolha de verticais.** Taxa de aquisição sobre elegíveis, por
divisão de CNAE: 64 serviços financeiros 1,31% · 41 construção 1,05% · 68 imobiliário 0,99% · 62
software 0,70% · média nacional 0,44% · **86 saúde 0,38% · 01 agro 0,26%**. Os quatro setores
validados estão **abaixo** da média nacional de intensidade de M&A. Ressalva antes de agir nisso:
64 e 68 são cheios de holding e SPE, onde "entra PJ" é reorganização e não venda, então o topo da
lista está inflado. 41 e 62 parecem transação de verdade.

**Ressalva honesta, que não salva o label novo.** O número da KKR conta deal anunciado, então
subestima a cauda de transferência de pequeno negócio, que de fato existe e é grande. Mas essa
cauda é exatamente o mercado que a Setter **não** atende. O label mede um mercado que não é o
nosso, e isso reforça a decisão em vez de enfraquecê-la.

**O que sobrevive do trabalho de §15:**
1. É o único instrumento que enxerga empresa de dono único. Continua servindo como **diagnóstico**
   de cobertura, e foi ele que provou que o recall publicado só vale para 31% da base.
2. Vira candidato a **anti-sinal**: empresa cujo dono trocou há pouco dificilmente vende de novo já.
3. A técnica de separar herança de venda por token de sobrenome é reaproveitável.

**Como alvo de calibração, está morto.** O alvo continua sendo o label de aquisição, e o próximo
ground truth de verdade não sai do CNPJ: sai das **notas de originador** (§16 quando existir).

### 15.8. Reproduzir

```bash
node --env-file=.env.local scripts/sonda-troca-de-dono.mjs      # o tamanho do ponto cego
node --env-file=.env.local scripts/sonda-troca-sobrenome.mjs    # venda x herança
node --env-file=.env.local scripts/extrai-matriz-score.mjs      # matriz com o label novo
python scripts/diagnostico-troca-dono.py                        # lift, recall e o teste de sujeira
```

---

## 16. O que o piloto da Setter vai de fato mostrar na tela (12/08/2026)

Medido com `scripts/check-mandato-entregavel.ts`, que importa o `scoring.ts` real (não replica) e
roda contra o que está ingerido no Supabase. Números do produto, não do BigQuery.

| | Foco A · diag. vet | Foco B · plano pet | Death care |
|---|---:|---:|---:|
| empresas | 1.671 | 1.119 | 11.712 |
| sem sócio cadastrado | **0 (0,0%)** | 173 (15,5%) | 4.007 (34,2%) |
| 1 sócio PF | 831 (49,7%) | 572 (51,1%) | 3.338 (28,5%) |
| 2+ sócios PF (onde o recall foi medido) | **840 (50,3%)** | 374 (33,4%) | 4.367 (37,3%) |
| não é ME (EPP + DEMAIS) | 377 (22,6%) | 144 (12,9%) | 1.984 (16,9%) |
| **score zero** | **0 (0,0%)** | 79 (7,1%) | **2.391 (20,4%)** |
| **perfil sucessório** | **31 (1,9%)** | **13 (1,2%)** | **1.286 (11,0%)** |
| score do 20º da lista | 76 | 70 | 97 |
| do top 20, quantas não são ME | 13/20 | 8/20 | 18/20 |

**Três leituras que mudam o desenho do piloto:**

1. **O problema visual dos score zero não existe no Foco A.** Zero empresas sem sócio, zero com
   score zero. Laboratório é sociedade constituída, não Empresário Individual. O buraco estrutural
   de §13 é concentrado em death care (20,4%), que é justamente onde a lista é longa.

2. **A tese sucessória quase não se aplica aos mandatos escolhidos.** 1,9% e 1,2% de perfil
   sucessório, contra 11,0% em death care. Foco A e B são verticais jovens em consolidação: o dono
   não está envelhecendo, o comprador é que está montando plataforma. Vender "score de sucessão"
   ali é vender a régua errada. O onepager já diz isso (linha 19) e a linha precisa ser mantida na
   conversa, não só no papel.

3. **Metade do Foco A tem 2+ sócios**, que é a população onde o recall de 4,9x foi medido. Isso é
   melhor do que a base geral (31%). Mas **não há nenhum evento de aquisição medido em laboratório
   veterinário**: o 4,9x é transferência de credibilidade de outros setores, não medição neste. Se
   o Henrique perguntar, é isso que se responde.

**Consequência de produto:** em Foco A e B o entregável defensável é **censo completo e enriquecido**
(cobertura exaustiva, dedupe, sócio, idade, porte, praça, contato), não ranking por sucessão. Em
death care o entregável é **ranking**, que é onde o motor tem o que fazer.
