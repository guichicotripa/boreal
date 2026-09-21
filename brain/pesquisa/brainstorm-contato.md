# Brainstorm: melhorar o contato

> 21/09/2026. Tudo que dá para fazer para transformar "empresa achada" em "conversa com quem decide". Os números vieram de medição na base de 65.520 empresas feita neste dia, não de estimativa.

---

## Antes das ideias: o gargalo de hoje não é o contato

Entre 14 e 20 de setembro houve 5 eventos na plataforma, todos no dia 14. As 31 empresas continuam paradas no primeiro estágio. **Contato perfeito multiplicado por zero ligação continua zero.**

Isso não invalida o trabalho de contato, que é o que a proposta B vende e é o gargalo real assim que eles começarem. Mas muda a ordem: a coisa que mais move o ponteiro não é a décima fonte de telefone, é a Setter ligar uma vez e registrar o que aconteceu. Toda ideia abaixo de classificação e enriquecimento vale mais depois que existir um desfecho registrado para comparar.

---

## O que a base tem hoje, medido

| Campo | Cobertura |
|---|---|
| Telefone | 58.570 de 65.520 · 89,4% |
| E-mail | 52.247 de 65.520 · 79,7% |
| Site | **0 de 65.520** |

### Repetição do telefone, dentro da nossa base

| Aparece em | Empresas | % |
|---|---:|---:|
| 1 empresa (exclusivo) | 40.752 | 69,6% |
| 2 a 4 | 10.435 | 17,8% |
| 5 a 9 | 3.048 | 5,2% |
| 10 a 49 | 2.565 | 4,4% |
| 50 ou mais | 1.770 | 3,0% |

Cuidado com esse número: **é a repetição dentro das nossas 65 mil, não no Brasil**. Medido nacionalmente nas 31 do pipeline, só 8 têm telefone exclusivo. A base pequena faz a qualidade parecer muito melhor do que é.

### Classificação do e-mail por domínio

| Tipo | Empresas | % |
|---|---:|---:|
| Provedor gratuito (gmail, hotmail, terra...) | 30.987 | 47,3% |
| Domínio de terceiro | 15.079 | 23,0% |
| Domínio próprio, confirmado pelo nome | 6.155 | 9,4% |
| Sem e-mail | 13.299 | 20,3% |

E-mail: 70,6% exclusivos, 29,4% compartilhados com outra empresa.

---

## O achado que muda a conversa

**Os domínios de e-mail não gratuitos mais repetidos da base são, literalmente, escritórios de contabilidade.**

| Repetições | Domínio |
|---:|---|
| 391 | contabilizei.com.br |
| 315 | laparo.com.br |
| 297 | rissicontabilidade.com.br |
| 95 | netsite.com.br |
| 71 | sahcontabil.com.br |
| 70 | maismei.com.br |
| 65 | healthcarecontabilidade.com.br |
| 59 | jcpcontabil.com.br |
| 54 | corporacaocontabil.com.br |

E os e-mails individuais mais repetidos são explícitos no propósito: `meucnpj@contabilizei.com.br` em 315 empresas, `gestor.societario@rissicontabilidade.com.br` em 128, `abertura@maismei.com.br` em 70.

**Por que isso importa:** a hipótese de que o contato da Receita é do contador deixa de ser hipótese. E o classificador é grátis, instantâneo, e já está no banco. Não precisa de fornecedor, de raspagem nem de cota.

**A regra que sai daí sozinha:** qualquer domínio não gratuito que aparece em 5 ou mais empresas é candidato a intermediário. A lista se mantém sozinha conforme a base cresce, sem ninguém curar nada à mão.

---

# As ideias

## A · Classificar o que já temos (horas, custo zero)

**A1. Classificar o domínio do e-mail** em próprio / gratuito / contabilidade / outro terceiro. É o melhor classificador de contato que temos e sai de graça.

**A2. Lista automática de intermediários** pela regra de repetição acima, crescendo com a base.

**A3. Detectar telefone lixo.** `1199999999` aparece em 167 empresas. Dígito repetido, comprimento inválido e DDD inexistente somam cerca de 2,5% da base. É descarte barato e evita fazer a Setter perder ligação.

**A4. Contagem nacional de compartilhamento, para telefone e e-mail.** A consulta de telefone já está validada contra o CNPJ nacional. Falta fazer o mesmo para e-mail e virar coluna. **É o item 1 da versão de acesso, já prometido na proposta.**

**A5. Casar o domínio com o nome fantasia, não só com a razão social.** Os 9,4% de "domínio próprio" estão subestimados: `prontodog.vet.br` é domínio próprio de uma empresa cuja razão social não tem "prontodog". Corrigir isso deve mover vários pontos percentuais.

**A6. DDD contra UF: descartado.** Medi em amostra de 1.000 empresas com telefone: 96,8% do DDD bate com o estado, 3,1% é de outro estado. Sinal fraco demais para justificar trabalho. Fica registrado para ninguém tentar de novo.

## B · Extrair contato novo do que já temos (dias)

**B1. Derivar o site a partir do domínio do e-mail.** A coluna `site` está em **zero de 65.520** e estamos sentados em pelo menos 6 mil domínios próprios confirmados, mais boa parte dos 23% classificados como terceiro que na verdade são próprios. É site de graça, sem raspar nada.

**B2. Do site, tirar o que o cadastro não tem:** telefone da operação, WhatsApp, nome do fundador, página "quem somos", Instagram. Isso é exatamente o que o `research.ts` já sabe fazer, só que hoje ele não tem por onde começar porque não tem URL.

**B3. Contato pelas outras empresas do mesmo sócio.** O QSA nacional já está na base, é o que alimenta o detector de aquisição. O mesmo grafo responde "este sócio tem outra empresa, e lá o contato é melhor que aqui".

**B4. Filiais: não temos, e faz falta.** A base tem 65.466 matrizes e 54 filiais, e **zero raízes com mais de um estabelecimento**. A SAFRA tem 9 filiais e nós enxergamos 1. Cada estabelecimento tem contato próprio na Receita. Ingerir estabelecimentos é trabalho de base, não de tela, e multiplica o número de portas por empresa.

## C · Confirmar o contato (é aqui que o valor sobe)

**C1. Cruzar o telefone da Receita com o telefone do site.** Se os dois batem, é da empresa, e isso é confirmação de verdade sem pagar fornecedor. Se divergem, o do site quase sempre é melhor.

**C2. Verificar existência de WhatsApp Business no número**, com o nome do perfil. Diz se a linha está viva. Precisa checar termos de uso antes.

**C3. A Setter marca o contato como validado quando confirma.** Já está na proposta. É barato e é o único caminho para verdade de campo.

## D · O loop que falta, e sem o qual nada disso compõe

**D1. Registrar o desfecho de cada tentativa:** atendeu, caiu no contador, número errado, secretária, falou com o dono. Hoje não existe nada disso.

**D2. Isso não é métrica, é rótulo de treino.** É o mesmo argumento que já usamos para a busca: sem o desfecho, "qualidade do contato" é enriquecimento feito uma vez e congelado. Com o desfecho, a regra vira medida: "domínio próprio mais telefone exclusivo dá X% de chance de falar com alguém da empresa" deixa de ser achismo.

**D3. E vira produto defensável.** Qualquer um compra base de contato. Ninguém mais tem o registro de o que funcionou nas ligações da Setter.

## E · Reenquadramentos (mudam a estratégia, não só o dado)

**E1. Gmail não é contato ruim em empresa familiar.** O reflexo é tratar os 47,3% de provedor gratuito como lixo. Numa empresa de 20 pessoas, o gmail do cadastro costuma ser do dono ou do filho, e um `contato@empresa.com.br` pode ser **pior**, porque cai numa caixa que ninguém lê. A hierarquia certa provavelmente é: domínio próprio nominal (`joao@`) primeiro, gratuito depois, genérico corporativo (`contato@`) terceiro, contabilidade por último. **Isso é hipótese, e só o registro de desfecho do D1 resolve.**

**E2. O contador não é obstáculo, é um nó do grafo.** Um escritório regional com 297 clientes no setor não é ruído, é canal de originação, e conhece o dono de cada um. Conversa direto com a opção C: em vez de tentar furar o contador, a Setter fala com o contador. Vale testar com um antes de construir qualquer coisa.

**E3. Contato não é campo, é caminho.** A pergunta certa não é "qual o telefone desta empresa" e sim "qual a maneira mais barata de chegar numa conversa com quem decide". Telefone é uma das maneiras e provavelmente não é a melhor. A opção C é a mesma pergunta por outro lado.

## F · Fontes novas (custa dinheiro ou autorização)

**F1. Google Places:** telefone e site do estabelecimento físico, mais avaliações recentes como sinal de que a operação está viva. É a fonte com melhor relação custo-benefício fora da Receita.

**F2. Junta Comercial e contrato social:** endereço real e às vezes contato do sócio. Caro e lento, por estado.

**F3. LinkedIn do sócio:** é a opção C, já escopada.

**F4. Instagram e redes da marca:** em pet e death care o perfil costuma responder mais rápido que o telefone.

**F5. Base paga de contato:** última opção, ver abaixo.

---

## O que eu não faria

**Comprar base de contato pronta.** Na maior parte é a mesma Receita revendida, que já temos, com um número de celular a mais de procedência duvidosa. Gasta dinheiro e não cria nada que nos diferencie.

**Raspar o LinkedIn.** Quebra os termos e queima justamente a opção C, que depende de exportação consentida.

**Prometer "o celular do dono".** Não entregamos de forma confiável, e prometer é o tipo de coisa que cancela contrato no segundo mês.

**Disparo automático de mensagem.** Já está fora do escopo por escolha. Além da LGPD, quem paga a conta reputacional é a Setter.

---

## LGPD, em uma linha

Contato de sócio pessoa física é dado pessoal mesmo vindo de fonte pública. A base legal para prospecção é legítimo interesse, e ela exige finalidade documentada e procedimento para pedidos do titular. A proposta já coloca a Boreal como operadora e a Setter como controladora. Antes de enriquecer contato de pessoa física, e não só da empresa, isso precisa estar escrito.

---

## Se fosse minha escolha, a ordem desta semana

| # | O quê | Esforço | Por que primeiro |
|---|---|---|---|
| 1 | Classificação de domínio do e-mail (A1, A2, A5) | horas | Melhor razão valor/esforço da lista inteira, e o dado já está no banco |
| 2 | Telefone lixo e contagem nacional (A3, A4) | 1 dia | Já prometido na proposta como item 1 da versão de acesso |
| 3 | Derivar o site do domínio (B1) | horas | Destrava o research inteiro, que hoje não tem por onde começar |
| 4 | Registro de desfecho da tentativa (D1) | 1 dia | Sem isso, tudo acima é enriquecimento congelado e nada aprende |

Os quatro somam menos de uma semana e cabem dentro do que a proposta B já promete para o primeiro dia.

---

## A decisão que é sua, não minha

**Enriquecer contato de pessoa física, ou parar na empresa?**

Tudo acima fica no contato **da empresa**, que é de baixo risco. O salto de qualidade de verdade está no contato **do sócio**, e ele muda a natureza do produto: entra LGPD com base legal a declarar, entra risco reputacional para a Setter, e entra a chance de a Boreal virar "empresa de lista de contato", que é o oposto do que queremos ser.

A opção C responde a mesma pergunta por um caminho que não tem esse problema, porque parte de exportação consentida em vez de enriquecimento. Vale decidir isso antes de construir, e não depois.
