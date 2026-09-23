# Pending — o que está aberto

> **O que é:** tudo que falta fazer, agrupado **por tema**, não por data de quando entrou.
> Marcar `[x]` ao concluir e mover para a tabela do fim.
>
> **Reorganizado em 21/09/2026.** Até aqui o arquivo crescia por empilhamento: cada sessão colava
> um bloco novo no fim ("vindo do uso real do piloto", "da call de 14/09", "do trabalho de
> contato"), e o mesmo assunto acabava em três lugares. Sócio PJ aparecia na seção de calibração
> e na de piloto; situação cadastral numa ponta e a dívida técnica correlata na outra. Ler as 392
> linhas era o único jeito de saber o que fazer no dia seguinte.
>
> Agora são seis temas fixos. Item novo entra no tema, não no fim.
>
> Auditorias anteriores: 30/07/2026 (de 462 para 392 linhas). Histórico completo em `progress.md`
> e no git.

---

## Índice

| Tema | O que vive aqui |
|---|---|
| [1. Setter: comercial e contrato](#1-setter-comercial-e-contrato) | O que depende de decisão deles ou da minuta |
| [2. Contato e acesso](#2-contato-e-acesso) | A frente atual: transformar empresa achada em conversa |
| [3. Score e dados](#3-score-e-dados) | Modelo, eixos, ground truth, qualidade da base |
| [4. Dívida técnica](#4-dívida-técnica) | Bug e encanamento, sem valor de produto direto |
| [5. Decisões em aberto](#5-decisões-em-aberto) | Escolhas de produto que voltam toda sessão |
| [6. Prospecção](#6-prospecção) | Clientes fora da Setter |
| [Resolvido](#resolvido) | Registro de uma linha, para ninguém procurar de novo |

---

# 1. Setter: comercial e contrato

> Estado em 21/09: **contrato assinado e nota emitida.** A decisão de continuidade vai a uma
> agenda com todos os sócios, com três opções na mesa, encerrar incluída. Henrique é patrocinador
> interno, não decisor. Ver `wiki/sources/setter-call-henrique-2026-09-21` no segundo cérebro.

### Bloqueia a assinatura de B ou C

- [ ] **Definir a base de cálculo do 0,5%.** Sobre o valor pago pelas ações ou sobre o fee da
  Setter na operação? São ordens de grandeza diferentes. A proposta de 21/09 já leva a pergunta
  explícita, e a referência de julho era cerca de 10% do fee deles. **É a única parte da proposta
  em que um mal-entendido sai caro para um dos dois lados.**
- [ ] **Cláusula de PI na minuta**, antes de qualquer fase do C.
- [ ] **Exclusividade do C:** campo de uso (boutique de M&A sell-side concorrente) × setor × praça
  × janela, com uso fora de M&A livre.
- [ ] **Nomear a pessoa alocada.** A exigência deixou de ser nossa: em 21/09 o Henrique chegou
  nela sozinho (*"vai ter que botar alguém meio que dedicado a esse projeto"*). Falta o nome.
- [ ] **Quem cobre death care, e tem login?** Fernanda é a especialista de pet e fez 21 das 25
  buscas dela ali. Death care teve 1 busca dela e 2 do Henrique, 2 minutos no total. Bruno nunca
  entrou. Sem dono, 100 das 300 empresas pré-cacheadas foram gastas num mandato que ninguém abre.

### Antes de o próximo mandato começar

- [ ] **Medir a novidade das 31 salvas.** `novo_para_setter` está null em todas. É o argumento de
  renovação e o único jeito de saber se a lista entrega cobertura incremental ou repete o que eles
  já conheciam.
- [ ] **Separar o entregável por mandato, e dizer isso antes do dia 1.** Foco A e B = censo
  completo e enriquecido (a afirmação é cobertura exaustiva, não previsão). Death care = ranking
  por sucessão. Prometer score de sucessão num universo com 1,9% de perfil é vender a régua errada.
- [ ] **Fechar o critério de sucesso em novidade e conversa, não em recall.** Recall não é
  verificável em um mês. O que dá para julgar: quantas do top N eles não conheciam, e quantas
  viraram abordagem.
- [ ] **Dizer o tamanho do universo antes de abrir cada mandato.** Dois dos três renderam poucas
  empresas e um rendeu 676. Já está escrito na proposta; falta virar rotina.

### Operacional

- [ ] **Recarregar crédito da `ANTHROPIC_API_KEY`.** Acabou em 25/07. Não bloqueia os lotes (rodam
  por assinatura), mas **research e dossiê sob demanda estão travados para o cliente**, e isso foi
  dito ao Henrique em 21/09. Agora que a nota foi emitida, destravar assim que o pagamento entrar.
- [ ] **Decidir a postura sobre venda da plataforma.** Vender para a Setter converte ativo que
  compõe (as notas de vários mandatos treinam o modelo de todos) em consultoria de cliente único.
  A alternativa é exclusividade por setor e praça com prêmio. Decisão de negócio, não tomada.

---

# 2. Contato e acesso

> A frente aberta em 21/09. Diagnóstico completo em `brain/pesquisa/brainstorm-contato.md`.
> **O gargalo não é a qualidade do contato ainda:** as 31 continuam paradas e houve 5 eventos na
> plataforma entre 14 e 20/09, todos no dia 14. Contato perfeito vezes zero ligação é zero.

- [ ] **Contagem nacional de compartilhamento de telefone e e-mail.**
  `scripts/backfill-contato-nacional.mjs` está pronto e testado até a consulta. **Bloqueado pela
  cota gratuita do BigQuery** (projeto em sandbox, 1 TiB por mês, renova dia 1). Ou esperar 01/10,
  ou habilitar billing. É o número que mais muda a decisão de ligar e o único dos quatro itens da
  versão de acesso que não está na tela.
- [ ] **A hierarquia de contato é hipótese, não medida.** Supomos domínio próprio > webmail >
  compartilhado. Em empresa familiar pode ser o contrário, porque o gmail do cadastro costuma ser
  do dono. Só o `desfecho` da `interacao` responde, e ele precisa de volume de uso.
- [ ] **Recarregar a situação cadastral.** A base congelou no snapshot de 09/11/2025 e nunca
  reconfere. Dois casos concretos na lista do cliente: **VETGUARD** consta suspensa na Receita e
  **LABORATÓRIO SÃO FRANCISCO (Blumenau)** consta suspenso nos credenciados do MAPA, e as duas
  aparecem como ativas. Precisa de rotina, não de correção pontual.
- [ ] **Ingerir os estabelecimentos, não só as matrizes.** A base tem 65.466 matrizes e 54 filiais,
  e **zero raízes com mais de um estabelecimento**. A SAFRA tem 9 filiais e enxergamos 1. Cada
  estabelecimento tem contato próprio na Receita: multiplica as portas por empresa.
- [ ] **O `site` derivado perde sigla legítima.** A regra exige que o domínio case com o nome, então
  `eds.org.br` para ASSOCIAÇÃO EXPEDICIONÁRIOS DA SAÚDE fica de fora. São 2.686 sites a menos, e a
  troca foi deliberada: vazio é recuperável, errado e convincente não é.
- [ ] **Descoberta residual:** empresa sem e-mail próprio e com nome genérico (ex: clínica IMUNE)
  não é resolvida pelo SERP.
- [ ] **Deploy do Scrapling.** É Python com browser e **não roda no Vercel**; a coleta tem que ficar
  em worker offline.
- [ ] **A TOMOVET segue como limite conhecido do detector.** Vínculo por pessoa física, sem holding
  no quadro, não é pego. Documentado, não resolvido.

### LGPD, aberta desde 21/09

> Análise completa em `brain/pesquisa/lgpd-contato.md`. Nenhum item é urgente com 31 empresas e
> zero ligações. Todos ficam urgentes no dia em que o volume subir, e aí custam mais.

- [ ] **`contato_usado` sem prazo de expurgo.** A migration 0020 guarda o telefone ou e-mail usado
  em cada tentativa, e em 41,8% da base o e-mail é webmail, ou seja, dado pessoal.
- [ ] **Conferir a região do Supabase.** Se o banco estiver fora do Brasil, é transferência
  internacional de dado pessoal e pede cláusula no contrato.
- [ ] **Finalidade documentada por escrito**, que a proposta já promete entregar antes da coleta do C.
- [ ] **Nenhuma exportação de LinkedIn entra antes do contrato assinado.** Dizer isso em voz alta:
  é o tipo de coisa que alguém faz por conta própria achando que ajuda.

---

# 3. Score e dados

> Contexto completo em `brain/produto/modelo-de-score.md`, §13, §14 e §16.

### Calibração: falta decisão de produto, não de medição

- [ ] **Aplicar ou não os pesos propostos em `scoring.ts`.** Com `porte`, ganham **+6,92** no
  holdout (31,62% → 38,54% estratificado), McNemar **z=4,30**. Dois custos: `sucessor_aparente` cai
  de 14 para 4 pontos, o que esvazia a "inversão da tese" que é a história central do pitch; e o
  proposto preenche **13,0% das vagas do top 10% por desempate** contra 4,1% do baseline, ou seja,
  uma em cada oito empresas da lista entra por sorteio. Ganha recall e perde granularidade.
- [ ] **Se aplicar, tornar o score mais fino junto.** O problema dos 13% não é dos pesos, é de o
  score ter ~60 valores distintos para 200 mil empresas. Sem resolver, `NTILE` decide a fronteira
  da lista no par ou ímpar. **É o item que mais melhora a experiência real de quem usa a lista, e
  não aparece em nenhuma métrica de recall.**
- [ ] **Citar recall sempre com o intervalo de desempate.** Medido em 25 sorteios: ±0,25 no
  estratificado e **±0,91 no perfil**, que é justamente a métrica citada publicamente. Uma decimal
  no "36,9%" é precisão falsa.
- [ ] **Refazer todo número público.** README, onepager da Setter, pitch-mestre e `/validacao`
  citam recall medido no universo inflado. O 41,5% em holdout vira 36,9% no universo elegível.
- [ ] **O que fazer com `idade_controle`.** Lift 1,00x dentro do estrato: o label não consegue
  testá-lo. Não é evidência de que não sirva, porque a venda integral de empresa de dono único, que
  é o caso central da tese, é invisível para o registro. Manter por julgamento, reduzir, ou buscar
  outro ground truth.
- [ ] **`quadro_plural` compra número, não ordenação.** Variar de 0 a 26 pontos não move a métrica
  estratificada e move a contaminada. Remover ou manter declaradamente como julgamento.
- [ ] **Os outros pesos do research nunca passaram por validação.** `banco_investimento` +15,
  `mencao_sucessao_venda` +12, `csuite_externo` +6, `big4_auditoria` +5, `sem_presenca_digital` +3.
  Escolhidos por intuição, que é exatamente o que o score deixou de fazer. Alguns não têm proxy de
  registro para medir; nesses, o melhor possível é ancorar a direção e declarar a magnitude como
  arbitrada. `herdeiro_fora_carreira` **nunca disparou em 20 investigações**, então a correção de
  29/07 é teórica por enquanto.

### Eixos novos, presos em dado que falta

- [ ] **Nº de estabelecimentos.** Lift 1,82x a 2,48x estratificado, z entre 7 e 8, e vale ~1,3pp de
  recall. Preso porque o ingest não traz contagem de filiais. **É o ganho mais barato que existe**,
  e casa com o item de ingerir estabelecimentos na seção 2.
- [ ] **Sócio PJ: decidir se é filtro ou nada, nunca eixo.** Lift 2,12x a 5,07x estratificado, mas
  mede empresa que já tem sócio institucional, o que encosta no desfecho, e o lift de 3,15x está
  confundido com a definição do ground truth. Some a isso que **29% do topo (score ≥ 90) já tem
  sócio PJ**, que pode ser holding da família (segue alvo), já parcialmente vendida (não é mais
  sucessão) ou sócio institucional (outro jogo), e hoje as três aparecem iguais. O detector de
  aquisição de 20/09 já sabe separar holding familiar de comprador de fora: usar isso aqui.
  **Nota:** o eixo `porte` já carrega parte disso sem querer, porque `DEMAIS` inclui inelegível ao
  Simples por ter sócio PJ. Se virar filtro, revisar o `porte` junto.
- [ ] **Proxy limpo de tamanho.** Empregados via RAIS/CAGED ou faturamento estimado. `porte`
  resolveu parte em 11/08, mas é tão congelado quanto capital (99,0% contra 96,8%), e **DEMAIS
  superestima tamanho onde já há sócio institucional**. O capital é idêntico entre 2023 e 2025 em
  91% a 95% das empresas. Ver `modelo-de-score.md` §14 e `scripts/sonda-proxy-tamanho.mjs`.

### Ground truth e loop

- [ ] **Validar o proxy de ground truth contra desfecho real da Setter.** Quando houver ~20
  conversas com desfecho no pipeline, checar se as empresas que ela realmente destravou estavam no
  nosso topo. **Maior valor da lista inteira**, e sai de graça de operar o piloto.
- [ ] **Fechar o loop de outcome.** Realimentar `resultado` (deal_fechado / perdido) no score.
  Precisa de dado do piloto.
- [ ] **Sensor forward vivo.** Transição societária das empresas salvas vira sinal no pipeline; o
  `scripts/monitor-transicoes.mjs` já minera.

### Qualidade da base e dos mandatos

- [ ] **Percentil de capital por mandato.** Os três mandatos do piloto caem no percentil geral
  (p95 = R$ 600 mil) porque `capital-percentis.json` só tem agro, saúde, educação e metalmecânica.
  O eixo satura abaixo da faixa em que a decisão acontece.
- [ ] **Resolver os 2.391 score zero de death care.** É a primeira coisa em que um cético clica.
- [ ] **Separar v0 e v1 em duas dimensões.** Hoje `v1 = clamp(v0 + ajuste, 0, 100)` e o teto apaga a
  magnitude do research (medido: ajustes de +12 a +30 viraram todos +3). O desempate por ajuste
  bruto (30/07) é paliativo. A correção real é v0 responder "tem o perfil" e o research responder
  "está acontecendo agora", cada um com seu indicador. Mudança de produto, com UI e tipos.
- [ ] **Teto de mandato.** O topo da lista tem empresa grande demais: capital mediano de R$ 4,4 mi
  em metalmecânica e máximo de R$ 274 mi, com CSN e ROMI (ambas de capital aberto) aparecendo. É
  filtro de mandato, não eixo. **Guilherme pediu para não tratar agora (30/07).**

---

# 4. Dívida técnica

> Os de 30/07 foram herdados sem reverificação. Confirmar se ainda valem antes de agir.

- [ ] **Instrumentar o peek panel.** Sem isso não dá para saber se o score foi lido antes do
  descarte.
- [ ] **`/api/research` não tem guarda de teto.** O lote (`precompute-research.ts`) ganhou
  `--min/--max` justamente porque investigar quem já está em score_v0 = 100 não move nada (o clamp
  come o ajuste), mas a rota sob demanda, que é a que **custa dinheiro** (US$ 0,04 a 0,22 por
  chamada), não herdou nada disso. O originador clica "investigar" no 1º da lista, que é exatamente
  quem está no teto. Opções: avisar na UI antes de gastar, ou exibir o `ajuste_bruto` quando o
  score satura (o campo já existe e já é usado no desempate).
- [ ] **`PRODUCT.md` está na condição em que o README estava.** Descreve o Maguto como co-dono com
  fronteira por arquivo e o produto como submissão de competição de clube. Nada disso vale desde
  junho. Reescrever ou marcar como histórico, igual foi feito com `submissao-clube.md`.
- [ ] Fix de dados em `/validacao` · `hindcast.json`.
- [ ] Navegação `<a>` → `<Link>`, repo-wide.
- [ ] Aposentar o `dossier-cache.json`.
- [ ] Busca em 3,3s em produção (mediana, warm). O gargalo medido é a query mais o scoring, não a
  chamada de LLM.
- [ ] **Trajetória societária** (removida da home em 07/06, handoff para Guilherme).

---

# 5. Decisões em aberto

- **Estimativa financeira no memo.** Já decidido **não fazer**: proxy de EBITDA cheira a dado
  inventado para quem entende de PE, e é melhor ser honesto com capital social e porte do que
  fabricar número. Fica registrado porque o juiz de M&A penaliza a ausência (0-1/10) e a tensão
  volta toda vez. Se mudar, tem que vir com metodologia declarada.
- **Enrichment nível 1** (site e web da empresa): job assíncrono, não bloqueante. Metade das
  empresas-alvo não tem presença digital, e a ausência é ela mesma um sinal. **Parcialmente
  resolvido em 21/09:** 5.320 sites derivados do domínio do e-mail. O que falta é ler o site.
- **Descoberta de tech** (CNAEs 62xx e 63xx) como mapeamento e descoberta, não predição de
  sucessão. O enquadramento honesto já está definido.
- **Por que ninguém abre dossiê.** Zero em 299 eventos. Em 21/09 o Henrique atribuiu a falta de uso
  a tempo (*"a questão é mais tempo, de fato, de parar e sentar"*), o que explica o volume mas não
  explica a escolha: quem buscou, buscou e não abriu. Ou o caminho até `/empresa/[id]` não é
  achado, ou o card basta para recusar. Perguntar à Fernanda antes de gastar mais cota em pré-cache.

---

# 6. Prospecção

- [ ] **Fairplay Capital como prospect, não como ameaça.** Boutique de 2024, Sorocaba/SP,
  middle-market R$ 20M a R$ 500M, três pessoas, sem originação proprietária. É a Setter com outro
  nome. Análise completa em `brain/pitch/referencia-site-fairplay.md`.

  **Estado (30/07, não revisitado desde então):** convite de conversa de aprendizado enviado ao
  José Venancio (Mom Test, sem demo). Ele respondeu em ~3h, caloroso, mas **não aceitou o 1:1**:
  ofereceu no lugar uma "masterclass com jovens talentosos interessados em M&A", ou seja,
  reclassificou o Guilherme de quem-constrói-em-originação para plateia.

  A resposta enviada aceita a masterclass **e** repropõe os 20 minutos, ancorando no fato do piloto
  para desfazer o enquadramento sem se gabar. Se ele empurrar de novo, considerar mandar um recorte
  de dado (ex: heat-map de M&A da praça de Sorocaba) como presente, não como demo.

---

# Resolvido

> Registro de uma linha, para ninguém procurar de novo. O detalhe está em `progress.md`,
> `decisions.md` e no git.

| Quando | O que | Como ficou |
|---|---|---|
| 23/09 | Detector de aquisição dentro da plataforma | Regra movida para `src/lib/aquisicao.ts`, usada pela tela e pelo script (conferido em 1.031 empresas, zero divergência). Chip na busca, no painel e no pipeline; bloco "Quem controla" na página, juntando cadastro e web. **O CPF mascarado é lido no servidor e apagado antes da resposta**: a tela recebe o veredito, nunca o CPF |
| 23/09 | Lista de trabalho das 31 | O pipeline passou a ser a lista: cada linha mostra de quem é o contato, se o número vale discar, se há oposição e quem controla a empresa. **Falta só a contagem nacional**, que tem item próprio e depende da cota do BigQuery |
| 23/09 | Qualificação do sócio por extenso | A base guardava o código (`22`, `49`) e ele chegava cru até o memo. Dicionário da Receita em `src/lib/qualificacao.ts`, com quem tem gestão em destaque e marca de "sucessão em curso" para herdeiro menor ou incapaz. **222 empresas da base têm esse sinal, 102 no death care.** Só exibido: peso no score depende do protocolo de calibração |
| 23/09 | Caminho para oposição do titular (LGPD art. 18 §2º) | **O banco recusa guardar o contato**: trigger na `empresa` apaga telefone, e-mail e site de quem se opôs e **impede o backfill da Receita de devolver**, que era o furo. Chave por CNPJ, o pedido fica registrado e o contato não é retido em outro lugar. Só a Boreal reverte. Testado no banco com empresa sintética |
| 23/09 | `recusou` sem consequência | Registrar "disseram não" marca a oportunidade como não receptiva, **só se estava pendente**: decisão humana explícita vence a automática. Não arquiva, porque recusa pode ser "agora não" |
| 23/09 | Filtrar organização sem fins lucrativos | **O corte padrão SELECIONAVA associação**, porque ela é sempre DEMAIS e nunca optante: passava em 79% a 100% dos casos contra 2% a 5% de empresa comum. Virou parte do corte, rotulado "com dono". Saem 74 do death care (585 para 511) e o hospital da faculdade das 31. Cooperativa fica, porque funde |
| 23/09 | Separar 6511101 de 6511102 no death care | **92 seguradoras de vida saíram das 676 empresas da tela** (13,6%). O 6511101 só entra com nome funerário, o que preserva a única funerária real ali, a PAX CAROLINA. Contrato de RLS com cobertura idêntica |
| 23/09 | Corrigir `score_no_save` | Select completo no endpoint. **24 das 31 estavam gravadas em média 28,5 pontos abaixo** do que a tela mostrou, e foram recalculadas. Os 38 eventos `salvou` não foram reescritos, ver `decisions.md` de 23/09 |
| 21/09 | Ligar CNPJ ao site da empresa de forma sistemática | Derivado do domínio do e-mail, com exigência de o domínio casar com o nome. **5.320 sites**, de zero |
| 21/09 | Proposta escrita de B e C, para a call | Entregue em PDF, com valores estimados e a base do 0,5% em aberto |
| 21/09 | Escopo do grafo (opção C) | Escrito: QSA + mailing + exportação de LinkedIn, em três fases com decisão entre elas |
| 21/09 | Dono interno na Setter como condição | O Henrique chegou nela sozinho na call. Falta só o nome da pessoa |
| 21/09 | Convites do Teams para 21/09 e 28/09 | A call de 21/09 aconteceu |
| 20/09 | Detector de "esta empresa já foi comprada" | `detecta-aquisicao.mjs` pelo quadro societário, mais verificação na web. 31 de 31 verificadas |
| 25-26/08 | Filtro de porte e capital nos `Filtros` | Virou o corte padrão por mandato, ligado por padrão e desligável. Save subiu de 1% para 32% |
| 12/08 | Migration 0014 e contrato da Setter gravado | Aplicada, espelho sincronizado, 88/88 nos testes com zero skip. **Fica aberto:** a policy nunca foi exercida por sessão de originador da Setter |
| 11/08 | Os 2 setores do piloto | Foco A = laboratório de diagnóstico veterinário, foco B = operadora de plano de saúde pet. Death care caiu do foco declarado |
| 11/08 | Trazer a tabela `simples` para o ingest | **Medido e descartado.** `saiu_simples` tem lift 2,15x isolado mas **piora** o dev CV (42,32% contra 42,57%): redundante com capital e porte. `opcao_simples` está **proibida** como feature, com guarda em `calibra-score.py`, porque lê o desfecho |
| 11/08 | Proxy de tamanho melhor que capital social | Resolvido com `porte`, que já estava no ingest. **Cuidado com a justificativa:** não é mais atualizado que capital; o que sustenta o eixo é o lift medido, não frescor |
| 30/07 | Números defasados no onepager e no pitch | Afirmavam "97% a 100%, N=240", inflado por construção. Agora citam 63% a 95% por setor (N=317) e 41,5% no perfil sucessório em holdout |
| 30/07 | Semanas 1 a 4, Demo Day, submissão do Loom, frentes do Maguto | Era do Clube da Programação, encerrada em junho. `submissao-clube.md` ficou como material de pitch |
| 30/07 | Deploy no Vercel, selo de proveniência, pré-cache de saúde e educação | Feitos e verificados em produção |
