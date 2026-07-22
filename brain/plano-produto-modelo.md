# Plano: produto, dados, moat e modelo de negócio

> Criado: 2026-07-06. Autor: Guilherme + Claude (sessão de planejamento estratégico).
> Escopo: o mapa pra virar a melhor máquina de originação de deal fechado no mid-market
> familiar BR/LatAm. Não é backlog de sprint: dev segue pausado até a Setter fechar.
> Atualizado 06/07 com: validação do Taylor (mapa de rede), correção competitiva (Inven
> cobre BR), decisão não-Grata, selo sem snapshot obrigatório, papel do Guilherme (discovery).
> **Atualizado 20/07 — MODO SOLO:** Taylor/Juliano/Fabiano saíram (viram contatos da rede);
> o projeto agora se chama BOREAL. Contrato Setter fechado (06/07: R$2.000 + 0,5%, início
> ago/26; confirmar titularidade da minuta — o acordo original era Taylor PF). Mudanças
> marcadas com [SOLO 20/07]. Revisão completa dos anti-drifts em `decisions.md` [2026-07-20].

---

## 0. O frame certo

"Melhor produto de deal sourcing" é o frame errado. Grata/Inven ganham em amplitude com
dezenas de milhões de funding. O jogo ganhável: **melhor máquina de originação de deal
fechado no mid-market familiar**, onde o gargalo é relacional (dono não dá mandato a
desconhecido) e o sinal decisivo (sucessão) vem de dado que só o CNPJ dá em profundidade.

Três premissas que ordenam tudo:
1. **Quem paga define o produto.** Originador (success fee), advisory (OffDeal) e SaaS
   (tese da Illa) pedem produtos diferentes. A decisão fica pro dado do piloto, não pra opinião.
2. **Feature que não encurta lista→conversa é decoração.**
3. **Dev pausado até a Setter fechar.** Este plano é o mapa pra depois.

---

## 1. Cenário competitivo (corrigido 06/07)

A nota antiga "nenhuma cobre BR" estava **desatualizada/overclaimed**. Estado real:

| Player | Cobertura BR | Profundidade no nosso alvo |
|---|---|---|
| **Inven** | SIM: alega 160+ países incl. LatAm, 28M perfis, lê sites em qualquer língua | Superficial pro nosso alvo: perfil construído do SITE da empresa. Metade do mid-market do interior não tem site (medido por nós). Zero quadro societário/faixa etária/transições |
| **Grata** | Não: expansão recente é França/Alemanha/Austrália/UK. 21M empresas, foco EUA | n/a |
| **Sourcescrub** | Sem cobertura BR declarada (foco EUA/Europa, 17M empresas) | n/a |
| **Gain.pro** | Sem cobertura BR declarada (Europa-first, <5M empresas) | n/a |
| **Neoway** (BR) | SIM: maior data/analytics do BR, dados por CNPJ, 20+ setores | É plataforma de inteligência B2B genérica (vendas, crédito, jurídico), não produto de originação M&A. É o incumbente de DADO a vigiar, não de PRODUTO |
| **Econodata/BigDataCorp/Assertiva** (BR) | SIM | Enriquecimento de contato/cadastro, não deal sourcing. Potenciais FORNECEDORES, não concorrentes |

**Implicação (afia o moat em vez de enfraquecer):** a corrida não é "cobrir o Brasil"
(Inven já lista empresas BR; Neoway tem o cadastro). É **profundidade do sinal sucessório**:
quadro societário + faixa etária + transições entre snapshots + ground truth de deals
minerado. Nisso ninguém está, e é onde cada mês de operação acumula distância.

**Decisão: NÃO pagar Grata/Inven pra usar dado deles.**
(a) construir sobre dado licenciado de concorrente é anti-moat (ToS proíbe reuso, acesso
pode ser cortado, diferencial evapora); (b) o dado deles pro BR é raso justamente onde
precisamos de profundidade; (c) o que vale neles é estudar o PRODUTO (look-alike veio daí).
O que PODE valer comprar: enriquecedor BR de contato (BigDataCorp/Assertiva, centavos por
consulta) quando o piloto mostrar que contato desatualizado é gargalo. Neoway = referência
competitiva a monitorar.

---

## 2. Fase 0 (agora até ~60 dias pós-contrato Setter): provar conversão

Nada novo. Executar o decidido:
- Importar CRM da Setter em `crm_incumbente` (ativa o selo de verdade).
- **Fechar o loop de outcome com desfechos reais** (contatado→respondeu→reunião→mandato).
  É o dado que decide o modelo de negócio.
- Produtizar o **monitor forward** (`monitor-transicoes.mjs` vira worker periódico).
- Métrica do piloto: **custo por conversa qualificada** vs processo manual da Setter.
  É o número que sustenta NewCo, retainer e fee.

---

## 3. Fase 1 (3 a 9 meses): features, em ordem do funil

**Descoberta (topo)**
1. Cobertura Brasil completo nos setores validados no Supabase (validação já é nacional; a busca não).
2. Registry de setores em expansão contínua (adicionar setor = rodar validação + medir mix
   sucessão×consolidação). Rotina trimestral.

**Qualificação (meio)**
3. **Grafo societário / grupo econômico**: sócios comuns, holdings da família, participações
   cruzadas. O grupo é a unidade real da decisão de venda. Sai do dado que já temos (`socios`).
4. **Qualificação de porte honesta**: sem EBITDA fabricado (princípio mantido). Empilhar
   sinais públicos com faixa + confiança declarada: porte RF, saída do Simples (como
   QUALIFICADOR ao lado do score, nunca dentro, conforme decisão 03/07), filiais, capital
   social, headcount LinkedIn. Resolve o corte por ticket mínimo que o juiz de M&A apontou.

**Conversão (o gargalo relacional, a parte mais valiosa)**
5. **Caminho de indicação / mapa de rede. ★ VALIDADO PELO TAYLOR (06/07, áudio):** a própria
   Setter admite não ter a rede mapeada ("eles não têm indicação pra chegar nas empresas").
   Cliente descrevendo a feature antes de existir = melhor sinal de demanda.
   Desenho (com as 2 correções sobre a versão do Taylor):
   - **LinkedIn NÃO é a espinha**: dono de 68 anos no interior não está lá; scraping viola
     ToS + LGPD (dado pessoal). Fica como complemento pontual (executivos, herdeiros).
   - Camadas, na ordem: (1) **grafo societário do CNPJ** (grátis, já nosso: sócios em comum,
     ex-sócios, contador registrado); (2) **rede da própria boutique** importada com
     consentimento (clientes passados, contrapartes, relações dos sócios); (3) LinkedIn residual.
   - Consequência comercial: a feature nasce como projeto conjunto com a Setter no piloto
     (a rede deles é insumo), não produto de prateleira. Cada parceiro que carrega a rede
     aumenta o grafo e o custo de sair (moat).
6. **Dossiê de abordagem + gatilho de timing** alimentado pelo monitor forward ("sócio mudou
   de faixa no último snapshot" é o melhor motivo de ligação desse mercado).

**Prova (fundo)**
7. **Selo de proveniência multi-parceiro** (ver §5, desenho revisto).

**NÃO construir** (decisões já tomadas com dado): score de consolidação preditivo, EBITDA
proxy, CRM de execução, outreach automatizado, data lake/RAG genérico, compra de dado Grata/Inven.

---

## 4. Dados: coleta e interpretação

**Novas fontes, por valor ÷ esforço:**

| Fonte | O que dá | Esforço | Nota |
|---|---|---|---|
| **Snapshots próprios do CNPJ (mensal)** | Sensor forward em escala de universo + arquivo temporal proprietário | Baixo | Prioridade 1. Cada mês acumulado é história que entrante não compra |
| PGFN dívida ativa (site, não BigQuery) | Red flag verificável por CNPJ | Baixo | Distress não PREDIZ deal (sonda 02/07), mas vale como red flag de DD no dossiê |
| DataJud/CNJ + TJs | **Inventário e disputa societária = gatilho sucessório mais forte que existe** | Médio | Ninguém faz isso sistematicamente pra originação no BR |
| Juntas comerciais (atos) | Alteração contratual semanas antes do CNPJ refletir | Alto (UF a UF) | Só JUCESP + juntas do NE primeiro |
| Site oficial (Scrapling) + índice CNPJ→domínio | Perfil + sinais qualitativos | Já iniciado | Cada domínio confirmado é ativo permanente |
| LinkedIn | Herdeiros, C-suite externo | Alto + LGPD | Só com desenho jurídico; não é o próximo passo |
| BigDataCorp/Assertiva (pago) | Contato validado por CNPJ | Baixo (R$) | Comprar SÓ quando contato desatualizado provar ser gargalo no piloto |

**Interpretação (onde o LLM entra):**
- Pipeline de extração estruturada: ato de junta / notícia / "quem somos" → JSON tipado
  (sinal, fonte, data, confiança). Padrão híbrido já validado.
- **Resolução de entidade** (mesma família em CNPJs distintos, mesmo grupo com razões
  sociais diferentes). Pré-requisito do grafo e do caminho de indicação.
- Classificador sucessão×consolidação treinado no ground truth (7.877 deals limpos) pra
  refinar a lente na re-mineração trimestral.

---

## 5. Selo de proveniência: desenho revisto (06/07)

Pergunta do Guilherme: sempre precisa de snapshot do CRM da boutique? Todas vão aceitar?
**Resposta: não precisa, e muitas não vão aceitar** (CRM é o ativo mais sensível delas).
Três mecanismos, por ordem de fricção:

1. **Snapshot com HASH** (default comercial): a boutique roda um script nosso que envia só
   os CNPJs hasheados. Checagem "novo pra vocês" funciona igual; pipeline deles não é exposto.
   CNPJ de empresa nem é dado pessoal; a resistência é comercial e o hash resolve.
2. **Janela de contestação no contrato** (fallback que dispensa snapshot): lead entregue com
   selo é PRESUMIDO novo; boutique tem X dias (ex: 10) pra contestar com evidência de contato
   anterior. Sem contestação, atribuição é nossa. O selo prova origem + data de forma
   inforjável; o contrato resolve o resto.
3. **Snapshot completo** = opção premium de confiança mútua (caso Setter, design partner).

Implicações: ajustar o contrato-padrão nessa direção ao formalizar com a Setter; produto
não depende de convencer boutique a abrir CRM. Visão: se 5+ boutiques adotarem o selo como
regra de atribuição, viramos a infraestrutura de confiança da originação terceirizada no BR.

---

## 6. Moat não copiável (teste honesto)

NÃO são moat: dado público, score determinístico, features de LLM (replicáveis em meses).
São moat (acumulam com o tempo, não se compram):
1. **Loop de outcomes** (quem foi contatado, respondeu, vendeu, a que múltiplo).
2. **Arquivo temporal proprietário** (série mensal de snapshots + diffs; quem começar em
   2028 nunca terá 2026).
3. **Índice CNPJ→domínio→contato confirmado** (cada confirmação humana vira registro verificado).
4. **Grafo relacional / caminho de indicação** (compõe a cada parceiro e deal; ataca o
   gargalo relacional; validado pelo Taylor).
5. **Selo como padrão de atribuição** (efeito de rede entre boutiques).
6. **A organização** (lente AI-native face b): margem escala com o sistema, não com sênior.
   Company brain (este `brain/`), DRI por deal, burn tokens not headcount.

---

## 7. Modelo de negócio: recomendação

Leitura crítica dos 3 caminhos na mesa:
- **Originador puro** (success fee): teto ~R$4M, lumpy, migalha. Certo como FASE, ruim como destino.
- **SaaS puro** (tese Illa): comprador BR (boutique mid-market) é mercado pequeno e mal
  pagante; se a lista gera mandato de R$500k de fee, cobrar R$2k/mês dá o upside de graça.
- **Advisory direto** (OffDeal): captura o fee cheio, é onde a lente AI-native paga.
  Furos: gargalo sênior, capital de giro (ciclo 9-15m), conflito com vender pra boutiques
  com a mesma marca.

**Recomendação: híbrido sequenciado, selo como espinha dorsal.**
- **Ano 1: camada de inteligência de originação.** Retainer R$5-15k/mês por boutique/fundo
  (dimensionado por vertical + exclusividade regional) + success fee override 0,3-0,5%
  garantido pelo selo. Retainer paga o burn (modelo Setter AI Practice); override captura
  upside; selo torna o override executável. Meta: 3-5 parceiros em verticais/regiões que
  não se canibalizam. Relatórios setoriais (R$20-40k) como caixa-ponte.
- **Ano 2, gatilho por dado: decisão advisory.** [SOLO 20/07] **Advisory próprio esfria**
  (dependia de sênior interno fechando — não existe mais). O caminho que sobrevive é a **NewCo
  whitelabel** (que foi desenhada exatamente pra suprir o que o Guilherme não tem: licença,
  marca, sêniores) — e só se o piloto + ano 1 provarem queda do custo de originação. Educação-NE
  como vertical de advisory morre junto (era o moat do Taylor). Ressalvas mantidas: cap table
  desenhado ANTES de propor; conversa de 2º tempo.
- **LatAm só depois do BR provado.** México/Colômbia têm registros análogos (RUES colombiano
  é até melhor que o CNPJ). Agora: só manter arquitetura registry-agnostic (custo ~zero).

**Risco a vigiar** (o nosso, de sempre): a cada deal, "o sistema deu conta ou puxou mais um
sênior?". Se puxa sênior toda vez, virou boutique tradicional e o caso venture morre.

---

## 8. Papel do Guilherme (06/07)

**Prospectar pra fechar mandato: NÃO** (sem credibilidade com dono 3x a idade, sem PJ, alto
risco de queimar alvo bom; [SOLO 20/07] conversão é papel dos sêniores da SETTER no piloto
hands-on — não há mais sênior interno).
**Discovery: SIM, já.** É a pendência da tese ("ligar pra ~10 donos" separa "não abordado"
de "não quer vender"). Formato: pesquisa, não venda (The Mom Test): 5-10 conversas de 30min,
via caminho morno (rede BRHSIC, indicação do Taylor), sem pitch, só escuta. Restrição
honesta: tempo até 23/08 é SAT + aplicação; discovery cabe sem comprometer.

---

## 9. Resumo em uma frase

Provar conversão com a Setter; construir as 3 peças de dado que acumulam com o tempo
(snapshots, índice de contato, grafo relacional); vender a camada de inteligência com
retainer + selo enquanto o dado decide se o destino é advisory; e não gastar um dia em
feature que não encurta a distância entre lista e conversa com o dono.
