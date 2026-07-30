# Submissão Clube da Programação (Boreal)

> 📁 **DOCUMENTO HISTÓRICO (submissão ao Clube da Programação, 10/06/2026). Não reutilizar os
> números sem atualizar.** O Clube acabou em junho. O conteúdo fica porque a estrutura narrativa e
> boa parte da copy continuam servindo de base para pitch, mas duas coisas envelheceram:
> os números são do score v0 ("97% a 100%, N=240"), substituído em 29/07 — ver `pitch-mestre.md`
> para os atuais; e a tese central mudou. Onde este texto diz "donos envelhecendo, **sem
> sucessor**", o dado mostrou o contrário: sucessor aparente no quadro tem lift **2,14x** e quadro
> parado tem **0,60x**. Quem vende é quem está conduzindo uma transição, não quem foi abandonado.
> Ver `brain/modelo-de-score.md`.


> Deadline: **10/06 23h59** (Loom de 1 min + form). Material pronto pra colar/gravar.
> Regras de conteúdo: Boreal é a venture (NÃO citar "Relay"); não citar Taylor (dizer "mentor");
> não citar outros projetos pessoais; sem travessões; tese cíclica + AI-native/agentic company;
> ênfase da Laura em validação com pessoas e evolução ao longo do Clube.
>
> Critérios que a Laura pesa mais: relevância da dor + diferencial competitivo; veracidade/enriquecimento
> dos dados; progresso e aprendizado durante o Clube; incorporação de feedbacks; como o Clube entra.

---

## Parte 1 — Respostas do Google Forms

### Informações do projeto

**Nome do projeto**
Boreal

**Descreva o projeto em uma frase**
Boreal é um motor AI-native de originação de M&A. Ele minera o registro público de empresas (CNPJ) para achar empresas familiares prestes a entrar em sucessão e qualifica cada uma com um score e um dossiê. Tudo isso alimenta um pipeline que aprende com cada desfecho real: quem foi contatado, quem respondeu, quem vendeu.

**Qual problema o projeto resolve?**
Existe um estoque enorme de empresas familiares viáveis e paradas no interior do Brasil (faturamento de R$ 10 a 50 milhões) cujos donos estão envelhecendo sem sucessor, mas ninguém as origina. Boutiques de M&A garimpam dados públicos na mão; bases internacionais (Grata, PitchBook, Sourcescrub) não cobrem o mid-market familiar brasileiro. O dado de empresa de pequeno e médio porte no Brasil é fragmentado e difícil de acessar, e essa própria barreira é o que mantém os players internacionais fora do país, e é exatamente essa brecha que o Boreal ocupa. O resultado é um mercado grande e ilíquido: mais de 30 mil empresas com perfil sucessório só nos setores que já mapeamos, contra um giro de menos de 0,5% ao ano.

A oportunidade é cíclica. Essas empresas não estão morrendo, estão represadas, em boa parte pela Selic em máxima histórica que travou o M&A. Montar o pipeline proprietário agora, enquanto o capital é o gargalo, é uma aposta contracíclica: construímos o ativo de dados barato e colhemos quando o ciclo virar.

**Quem é o usuário ou cliente ideal desse produto?**
Boutiques de M&A, search funds e fundos de private equity de middle-market que vivem de originação proativa e hoje queimam analista sênior garimpando alvo na mão.

**O projeto está funcionando hoje?** Check sim

**Quais são as principais funcionalidades já construídas?**
- **Busca por tese em linguagem livre:** o LLM traduz uma frase qualquer, por exemplo "metalmecânica no interior de SP com sócios 70+", em filtros estruturados sobre a base da Receita.
- **Score de risco sucessório (do v0 ao v1):** uma heurística determinística (idade, antiguidade, porte) que um research-agent eleva investigando a empresa na web e citando a fonte (acha herdeiro fora da carreira, banco contratado, menção a venda).
- **Dossiê instantâneo por empresa:** perfil do negócio, análise sucessória, red flags com "como verificar", perguntas de abordagem e próximo passo.
- **Juiz de qualidade do dossiê:** um avaliador sintético, fundamentado em pesquisa de M&A real (8 dimensões, red flags, fontes), que pontua cada memo e aponta onde ele está fraco, criando um loop fechado de sensor, correção e medição da própria qualidade do produto.
- **Trajetória societária:** reconstrói o quadro de sócios em 5 snapshots do CNPJ e detecta o que a foto de hoje não mostra: sócios saindo e envelhecendo de faixa, a sucessão em movimento.
- **Hindcast (validação retroativa):** para provar que o score funciona, pegamos empresas que de fato foram vendidas, voltamos no tempo para antes do negócio e rodamos o modelo só com o dado que existia naquela época, sem deixar ele espiar o desfecho. Mesmo assim, ele já colocava essas empresas no top 10% da fila, com nome e sobrenome, e 97% a 100% de acerto nas vendas de sucessão (N=240, Brasil inteiro).
- **Pipeline de originação com loop de outcomes:** os alvos qualificados entram num funil de estágios (identificado, abordado, em conversa, qualificado) com dono e próxima ação definidos. Cada desfecho real (respondeu, recusou, vendeu) volta para alimentar o score, então o sistema melhora de pontaria a cada deal trabalhado. Esse histórico de outcomes é o ativo defensável que um concorrente não compra pronto.

**Explique brevemente como usou IA no desenvolvimento.**
IA é o produto e o método.
- **No produto, closed loop de qualidade:** mineramos as transições entre snapshots mensais do CNPJ (sócio PJ entra e PF sai = aquisição) e geramos ground truth de M&A de graça e em escala (340 deals rotulados, contra cerca de 5 que a imprensa rende). Isso vira um benchmark automático: medimos o hit rate, a análise de lift revela o que o score erra, recalibramos, e o score subiu de 17% para 26% no top decil numa única iteração, só com dado.
- **No desenvolvimento, burn tokens, not headcount:** construímos tudo com Claude Code mais sub-agents especializados (um builder de fontes, um revisor de scoring, um guardião contra data-leakage e o research-agent). Um time de dois entrega o que uma boutique faria com vários analistas.
- **Company brain para trabalho em equipe:** mantemos um "cérebro" do projeto versionado no repo (contexto, decisões, progresso, divisão de domínio) que todo agente lê antes de operar. Foi o que deu gestão de contexto suficiente para coordenarmos um codebase real em paralelo sem nos atropelar.
- **Claude Design para identidade visual e wireframe:** geramos e iteramos a marca inteira (paleta, logo, brand guide) e os wireframes das telas com IA. A decisão foi estratégica: enquanto Grata, PitchBook e DealCloud usam o mesmo azul corporativo, escolhemos um minimalismo quente pro Boreal se ler como diferente em dois segundos, antes de qualquer copy.

Em duas semanas o Boreal saiu de uma busca que devolvia lista filtrada, com quase dois minutos de latência, para o motor com score, dossiê, validação retroativa e loop de outcomes de hoje. Para um de nós foi a primeira experiência construindo software: começou o Clube sem nunca ter programado e aprendeu, na prática, a tocar um projeto AI-native de ponta a ponta, da gestão de contexto e do company brain até entregar a interface inteira do produto com o Claude Code.

### Conversas com clientes

**Com quantas pessoas você teve conversas sobre o problema desde que o Clube começou?**
6 conversas, com profissionais de M&A e do mercado financeiro e com donos de empresa familiar. Entre elas, a Illa, manager de M&A da PwC, que conhecemos no próprio Clube, e o contato da Setter, hoje uma possível design partner.

**Quais perguntas você fez? E quais deixou de fazer por conta dos insights da 2ª reunião do Clube?**
A 2ª reunião do Clube foi uma virada de chave no nosso aprendizado: a partir dela, e do The Mom Test que veio como recomendação do próprio Clube, mudamos por completo a forma de perguntar. Paramos de fazer perguntas hipotéticas e enviesadas que só geram elogio educado, do tipo "você usaria uma ferramenta que prevê quem vai vender?" ou "quanto pagaria por isso?". Elas validam o ego, mas não o negócio. Seria melhor descobrir que a nossa ideia é uma merda o mais rápido possível pra podermos pivotar.

Passamos a perguntar sobre comportamento passado e fatos concretos: "como você achou o último deal que originou e quanto tempo levou?", "qual foi a última vez que perdeu um deal por falta de informação?". Com donos de empresa: "quem te procurou nos últimos 2 anos pra falar de venda?", "o que aconteceu com a empresa do seu vizinho de setor?". Concreto, passado, sem vender nada.

**Como achou essas pessoas?**
Três canais. Primeiro, a rede de um mentor com background em IB e no setor de educação, que dá acesso a algumas empresas do mercado financeiro. Segundo, nossa própria rede no ecossistema de finanças. Terceiro, outreach no LinkedIn para boutiques, somado à relação com a Setter, que abriu portas. Quarto e mais importante, networking no Clube da Programação com pessoas do mercado financeiro, como a Illa, manager de M&A da PwC.

**Dê um exemplo específico de feedback que você incorporou.**
A manager de M&A da PwC disse: "mesmo tendo o número, eu não colocaria um EBITDA, tem normalização demais, é arriscado demais". A gente estava tentado a estimar EBITDA por proxy de porte, mas cortamos. O dossiê hoje é explícito: capital social não é tamanho, e onde não há base a gente escreve "não estimável sem dados". Numa sala de quem entende de PE, honestidade vale mais que um número bonito inventado. No mesmo papo ela chegou sozinha à nossa distinção de "lentes" (industrial é sucessão; saúde e tech são consolidação), e isso virou feature de primeira classe no produto.

**Teve feedback que você decidiu não incorporar? Qual e por quê?**
Sim, dois. A Illa sugeriu construirmos uma ferramenta que gera automaticamente um deck de slides (um datapack) de cada empresa, para facilitar o trabalho do analista na hora de apresentar o alvo internamente. É uma sugestão forte e válida; só não a implementamos nestas 4 semanas por prioridade e tempo, mas está no nosso roadmap. A Gabi, ex-funcionária da Setter, sugeriu criar um "score de consolidação" preditivo. Seria possível, mas recusamos: isso diluiria a tese de sucessão (nosso princípio anti-drift). Disciplina de não fazer vale tanto quanto o que fazemos.

**O que você descobriu que as pessoas já fazem hoje para resolver esse problema?**
Boutiques fazem originação manualmente: analista buscando o snapshot atual do CNPJ, LinkedIn, associações setoriais e indicação de contador ou advogado. Fundos compram Grata, PitchBook ou Sourcescrub, que não cobrem o mercado familiar brasileiro do interior. E quase todo mundo espera o inbound, o contador que liga avisando que o dono quer vender. Ninguém compara os snapshots do CNPJ ao longo do tempo, que é exatamente o nosso wedge. E o custo disso é de tempo: montar uma lista de alvos qualificados desse jeito manual leva de uma a duas semanas de trabalho de analista sênior; com o Boreal, a mesma triagem inicial sai em minutos, já com score e fonte.

**Alguém já testou/usou o produto? O que aprendeu observando o comportamento?**
Sim, rodamos com o contato da Setter, com um analista sênior de dados e LLM, um chefe de cybersegurança e em calls de validação com pessoas do clube que trabalham no mercado financeiro. Três aprendizados de comportamento. Primeiro, a primeira coisa que todo banker faz ao abrir uma empresa é caçar a fonte: clicam no dossiê procurando "isso é real?". Isso confirmou nossa decisão de citar fonte em cada sinal. Segundo, todos quiseram filtrar por região na hora, o que nos levou a construir o switcher de setor e a página de setores. Terceiro, alguns analistas apontaram falta de clareza no design inicial, e isso nos fez repensar todo o visual: hierarquia da informação, legibilidade e acessibilidade passaram a guiar um redesign completo da interface, da primeira versão para a atual. Com o link público, agora eles se servem sozinhos e a gente observa onde clicam.

---

## Parte 2 — Roteiro do Loom (60s) v11

> Tagline: "O modelo que prevê quem vai vender, e prova que acerta."
> Estrutura founder (Vale): segredo, contraste de custo, prova com closed loop, validação, jornada. ~185 palavras, ritmo brisk.

| Tempo                            | NARRAÇÃO (falar)                                                                                                                                                                                                                                                                                                                  | TELA (mostrar)                                                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 0 a 12s · O SEGREDO              | "**Tem uma onda de M&A chegando no Brasil que quase ninguém vê: milhares de empresas familiares, donos envelhecendo, sem sucessor. O juro alto travou o mercado, que agora tende a voltar**."                                                                                                                                     | Home: hero + switcher de setor + painel de dinâmica do setor à direita                                               |
| 12 a 28s · O CONTRASTE + SOLUÇÃO | "O que uma boutique tradicional faz com um analista sênior em uma a duas semanas, a Boreal faz em minutos e por centavos. Escrevo uma tese em português, recebo empresas reais priorizadas, e um agente de IA investiga cada uma, sempre com a fonte e sem inventar número."                                                      | Tese → lista em segundos → clica empresa → /empresa/[id]: Sobre, Contexto do setor, Investigar (sinais com fonte)    |
| 28 a 44s · O PRODUTO + LOOP      | "**Cada empresa vem com um score de risco sucessório, e as melhores eu organizo num pipeline que acompanha cada contato e cada desfecho.** E não é chute: é uma arquitetura auto-aprimorante. O sistema minera o próprio registro de empresas do Brasil pra criar um ground truth próprio e se corrige sozinho, num closed loop." | Card com score (badge por tier) → Pipeline (funil + próxima ação) → /validacao (97%, nomes reais: Polimold, Fischer) |
| 44 a 53s · VALIDAÇÃO + ESCALA    | **"Conversamos com vários bankers do mercado que confirmaram a tese. E vale em todo setor: temos de 88 a 100% de acerto, no Brasil inteiro.**"                                                                                                                                                                                    | /setores (3 setores + lente + contexto de mercado/consolidadores)                                                    |
| 53 a 60s · FECHO                 | **"E um de nós começou esse Clube sem nunca ter programado**. Esse é a Boreal: a infraestrutura pra originar a maior onda de M&A da década, bem na hora que ela começa."                                                                                                                                                          | Logo                                                                                                                 |

**Antes de gravar (tudo instantâneo, cache pronto):**
- Home com a busca de metalmecânica já feita.
- Uma empresa aberta em /empresa/[id] com "Investigar" já rodado. Sugestão: Prensa Jundiaí (perfil rico + trajetória com sócio cruzando pra 80+).
- /validacao e /setores abertas em abas. Ritmo brisk, sem hedge.

**Se passar de 60s, corte nesta ordem:** "nas alturas" no beat 1, depois "sempre com a fonte e" no beat 2. Não corte o contraste de custo, os 97%, nem o fecho.

**Se sobrar tempo (reforço opcional):** mostrar a Movimentação societária no dossiê (fundador envelhecendo de faixa + sócio saindo) com a fala "a gente vê a sucessão acontecendo, não só a foto de hoje".

**Citação da PwC:** Illa Elias (Manager M&A PwC Belgium), fala real da call de 07/06. Alternativa, se preferir entusiasmo a substância: "você está no futuro, quero ser a primeira a usar".

---

*Criado: 2026-06-10. Material recording-ready para a submissão do Clube. Fonte única (Parte 1 + Parte 2) consolidada no brain do Boreal.*
