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
