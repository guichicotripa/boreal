# Referência visual para o site do Boreal: fairplaycapital.com.br

> Criado: 2026-07-30. Capturado do site ao vivo em 30/07/2026 (medido no DOM, não estimado no olho).
> Uso: referência principal de design e de copy para o site institucional do Boreal.
>
> **Não é para copiar.** A Fairplay é boutique de M&A e o Boreal é plataforma; o que se aproveita
> é o SISTEMA (paleta, hierarquia tipográfica, ritmo, estratégia de copy), não o layout. Copiar
> layout de concorrente adjacente é a forma mais rápida de parecer a versão pobre dele.

---

## Por que este site funciona

Ele resolve o problema mais difícil de uma casa de M&A jovem: **parecer sênior sem ter track
record**. Faz isso por três decisões, e todas são replicáveis.

1. **Densidade de dado onde outros põem stock photo.** O hero é um mapa do Brasil interativo com
   drill-down por região e 27 UFs, e um número grande (52%) em serifada de 102px. Antes de ler
   uma palavra você já entendeu que a casa trabalha com dado.
2. **Monoespaçada como material de construção, não como enfeite.** 381 elementos em JetBrains
   Mono. Toda etiqueta, metadado, número e navegação é mono. É o que dá o ar de terminal
   institucional em vez de landing page de agência.
3. **Copy que fala com o dono da empresa, não com o mercado.** Ver a seção de copy abaixo. É a
   parte mais forte do site e a mais barata de imitar bem.

---

## Paleta (valores medidos)

| papel | valor | onde |
|---|---|---|
| fundo | `rgb(245, 242, 237)` | off-white quente, quase papel. NÃO é branco |
| tinta | `rgb(15, 15, 15)` | quase preto, nunca `#000` |
| marca | `rgb(31, 58, 46)` | verde garrafa escuro. É a cor que carrega a identidade |
| apoio | `rgb(143, 179, 160)` | sage, sempre em opacidade baixa (~10%) |
| acento | `rgb(232, 181, 71)` | dourado/mostarda, usado só a ~5% de opacidade |
| preto | `rgb(10, 10, 10)` | blocos invertidos |

O uso de cor é **extremamente contido**: verde e dourado quase nunca aparecem em cheio, só como
véu de 4% a 10% sobre o fundo. O site é essencialmente bicolor (papel + tinta) com dois sotaques.

Contraste com o Boreal hoje: nosso app é dark (`bg-overlay`, `ink-soft`, `hairline`). O site
institucional **não precisa** seguir o app. Site claro e produto escuro é combinação comum e
funciona, desde que a marca (a cor) seja a mesma nos dois.

---

## Tipografia: três famílias com papéis rígidos

| família | uso | elementos |
|---|---|---|
| **Fraunces** (serif variável) | display, headlines, texto editorial | 114 |
| **Inter** (sans) | corpo, UI, texto denso | 582 |
| **JetBrains Mono** | etiquetas, metadados, números, navegação, numeração de seção | 381 |

Fraunces é serifada variável com eixos de *softness* e *wonk*. Eles usam pesos **não inteiros**
(w360, w380), o que só é possível com variable font e é parte do refino.

### Escala medida

| papel | tamanho | peso | tracking | entrelinha |
|---|---|---|---|---|
| número herói | 102,4px | — | — | serif |
| H2 de seção | 61,44px | — | — | serif |
| H3 de caso | 51,2px | — | — | serif |
| display | 33,28px | w360 | **−0,40px** | 40,6px |
| sub | 21,76px | w360 | **−0,22px** | 31,6px |
| corpo | 17px | w400 | **+1,36px** | 28,05px |
| etiqueta | 12px | w400 | **+2,40px** | 19,8px |
| micro | 10px | w400 | +1,40px | 16,5px |
| micro-mini | 9,5px | w400 | +1,33px | 15,7px |

**A regra que faz o estilo:** tracking **negativo** no display grande, tracking **muito positivo**
(+1,3 a +2,4px) nas etiquetas pequenas em mono. É o contraste entre os dois que dá a sensação de
sistema editorial caro. Corpo a 17px com +1,36px de tracking é incomumente arejado e é
deliberado.

Salto de escala agressivo: 61px para 12px sem meio-termo. Nada de tamanhos intermediários
tímidos.

---

## Estrutura: one-page com âncoras

```
#top       hero com mapa do Brasil interativo + praça + ticket
#how       "Três frentes. Uma só lógica: gerar valor."
#fairmind  a camada de inteligência
#team      "Senioridade em todas as transações."
#track     "Transações e trajetória."
#about     "A decisão mais difícil não é começar."
#contact   "Conversas reservadas começam por aqui."
```

Seções numeradas em algarismo romano, em mono, pequeno (`III`). Detalhe barato e muito eficaz.

**O hero declara praça e ticket na primeira dobra**, em mono, como metadado:

```
Sorocaba — SP  ·  Brasil          Middle-market  ·  R$ 20M – R$ 500M
```

Isso é qualificação de lead na primeira linha. Quem tem empresa de R$ 5M sabe na hora que não é
para ele, e quem tem R$ 200M sabe que é. **Copiar esse padrão no Boreal.**

---

## Copy: a parte mais forte

Três movimentos, todos replicáveis.

**1. Falam da decisão, não do serviço.**

> "A decisão mais difícil não é começar. É o que fazer depois que deu certo."

Isso é sobre o empresário, não sobre M&A. Nomeia o momento de vida dele. Nenhuma boutique
brasileira escreve assim.

**2. Nomeiam o custo emocional sem apelar.**

> "identidade, tempo, família, energia"
> "A confiança vem antes da transação."

**3. Diferenciam por processo, contra o alvo certo.**

> "Execução sênior, sem pirâmides ou terceirização"
> "Sell-side e buy-side são serviços e processos distintos."
> "Acesso a alvos que não aparecem em processos formais. Abordagem direta a controladores."

O ataque implícito é aos bancos grandes que colocam analista júnior no deal. É posicionamento por
contraste, e funciona porque o dono já sentiu isso na pele.

**4. CTA sem cheiro de venda.**

> "Conversas reservadas começam por aqui."

Compare com "Fale com um especialista" ou "Solicite uma demonstração".

**5. Honestidade sobre track record.** A seção de transações diz literalmente "Operações com
participação dos sócios, em outras casas", e lista Termov, Casa da Ração, Reauto, Metalplan e
Puravida. Eles não fingem que a casa de 2024 fez aqueles deals. **Essa honestidade compra mais
credibilidade do que o inverso**, e é exatamente a postura que o Boreal já tem no
`modelo-de-score.md` (citar 41,5% e não 72%).

---

## O que levar para o site do Boreal

Em ordem de retorno.

1. **Praça e ticket no hero, em mono.** Qualifica lead na primeira linha.
2. **Dado real na primeira dobra.** Eles usam mapa e um número grande. Nós temos coisa melhor:
   51.033 empresas indexadas, 4,1x melhor que sorteio, 226 empatadas viraram 11. O heat-map do
   `/heat-map` já é um ativo visual pronto e é mais impressionante que o mapa deles.
3. **Sistema de três famílias com papéis rígidos.** Serif para display, sans para corpo, mono para
   todo metadado. O contraste de tracking (negativo grande, positivo pequeno) é a assinatura.
4. **Copy sobre a decisão do dono, não sobre a feature.** Nosso equivalente do "o que fazer depois
   que deu certo" ainda não existe e é o que falta no material atual.
5. **Numeração romana de seção em mono.** Custa nada.
6. **Honestidade sobre o estágio.** Piloto em andamento com uma boutique, e ponto. Não inventar
   logo de cliente.

## O que NÃO copiar

- **A paleta.** Verde garrafa + papel é a identidade deles. Boreal é boreal: o nome pede
  frio, norte, luz baixa. Ir de verde/creme seria virar sósia.
- **A estrutura one-page.** Funciona para uma casa de 3 pessoas vendendo confiança. O Boreal tem
  produto, prova metodológica e setores, o que pede páginas separadas (uma `/validacao` de
  verdade já existe no app e é o nosso trunfo).
- **O tom "consultoria".** Eles vendem senioridade humana. Nós vendemos que a máquina acha o que
  o humano não acharia. São promessas opostas e o tom tem que refletir isso.

---

## Nota competitiva

O detalhe que só apareceu ao ler o site inteiro: a seção `#fairmind` oferece **"mapeamento sob
demanda de empresas-alvo para teses buy side, alvos no interior, conversas em estágio inicial,
leitura regional"**. Isso é originação, entregue por humano sob demanda.

O site público do Fairmind (`fairmind.com.br`) é só feed de notícias, majoritariamente
internacional, com diretório de 3.303 entidades que são **compradores** (BTG 37 deals, Goldman 32,
KKR 26, Y Combinator 26) e não alvos. Mas a oferta comercial por trás inclui o trabalho que o
Boreal automatiza.

Leitura: não é concorrente de produto, é concorrente de **job**. A vantagem do Boreal é margem e
repetibilidade, não território. E a Fairplay, sendo boutique de 2024, middle-market, interior de
SP, sem originação proprietária, é candidata natural a **cliente** depois do piloto da Setter.
Ver `brain/pending.md`.
