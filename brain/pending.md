# Pending — Próximos Passos / Em Aberto

> O que falta fazer agora. Marcar `[x]` ao concluir. Mover concluídos pro `progress.md` no fim da sessão.
>
> **Auditado e reescrito em 30/07/2026.** O arquivo tinha 462 linhas e carregava uma era inteira já
> morta: Semanas 1 a 4, Demo Day, submissão do Loom (deadline 10/06) e as frentes do Maguto, que
> parou de trabalhar no Boreal depois do fim do Clube da Programação. Histórico completo em
> `progress.md` e no git; o que sobreviveu aqui é só o que continua aberto de verdade.

---

## 🔴 Decisões abertas da calibração (02/08, atualizado 11/08)

> Contexto completo em `brain/modelo-de-score.md` §13 e **§14**. O método já mudou e está
> documentado; o que falta é decisão de produto, não de medição.
>
> **Atualização de 11/08:** a proposta ficou bem melhor com a entrada de `porte` e todos os números
> abaixo foram refeitos. Os defeitos de instrumento achados na rodada (vazamento do Simples e ruído
> de desempate) já estão corrigidos no código.

- [ ] **Aplicar ou não os pesos propostos em `scoring.ts`.** Com `porte`, ganham **+6,92** no
  holdout (31,62% → 38,54% estratificado), McNemar **z=4,30**. Quase o dobro dos +3,58 de 02/08.
  Dois custos: `sucessor_aparente` cai de 14 pra 4 pontos, o que esvazia a "inversão da tese" que
  hoje é a história central do pitch e do README; e **o proposto preenche 13,0% das vagas do top
  10% por desempate contra 4,1% do baseline**, ou seja, uma em cada oito empresas da lista entra
  por sorteio. Ganha recall e perde granularidade.
- [ ] **Se aplicar, tornar o score mais fino junto.** O problema dos 13% não é dos pesos, é de o
  score ter ~60 valores distintos pra 200 mil empresas. Sem resolver isso, `NTILE` continua
  decidindo a lista no par ou ímpar na fronteira. É o item que mais melhora a experiência real de
  quem usa a lista, e não aparece em nenhuma métrica de recall.
- [ ] **Citar recall sempre com o intervalo de desempate.** Medido em 25 sorteios: **±0,25** no
  estratificado e **±0,91 no perfil**, que é justamente a métrica citada publicamente. Uma decimal
  no "36,9%" é precisão falsa.
- [ ] **O que fazer com `idade_controle`.** Lift 1,00x dentro do estrato, ou seja, o label não
  consegue testá-lo. Não é evidência de que não sirva: a venda integral de empresa de dono único,
  que é o caso central da tese, é invisível pro registro. Manter por julgamento, reduzir, ou
  buscar outro ground truth que enxergue esse caso.
- [ ] **`quadro_plural` compra número, não ordenação.** Variar de 0 a 26 pontos não move a métrica
  estratificada e move a contaminada. Remover ou manter declaradamente como julgamento.
- [ ] **Refazer todo número público.** README, onepager da Setter, pitch-mestre e `/validacao`
  citam recall medido no universo inflado. O 41,5% em holdout vira 36,9% no universo elegível.
- [ ] **Decidir sobre `tem filial`** (lift 1,82x-2,48x estratificado, z 7-8). Exige adicionar
  contagem de estabelecimentos ao ingest e à tabela `empresa`. Hoje não é calculável em runtime.
- [ ] **Decidir sobre `tem sócio PJ`** (lift 2,12x-5,07x estratificado). É derivável em runtime,
  mas mede empresa que já tem sócio institucional, o que encosta no desfecho. Ver a ressalva de
  tese dos 29% do topo com sócio PJ. **Nota de 11/08:** o eixo `porte` já carrega parte disso sem
  querer, porque `DEMAIS` inclui empresa inelegível ao Simples por ter sócio PJ. Se `tem sócio PJ`
  virar filtro, revisar o `porte` junto.
- [x] ~~**Trazer a tabela `simples` pro ingest.**~~ **Medido e descartado em 11/08.**
  `saiu_simples` tem lift 2,15x isolado, mas incluí-lo **piora** o dev CV (42,32% contra 42,57%):
  é redundante com capital e porte. Resultado negativo que economiza a obra. A flag `opcao_simples`
  está **proibida** e há guarda no `calibra-score.py`, porque ela lê o desfecho.
- [x] ~~**Proxy de tamanho melhor que capital social.**~~ **Resolvido em 11/08 com `porte`**, que já
  estava no ingest e não exigiu obra nenhuma. Cuidado com a justificativa: `porte` **não** é mais
  atualizado que capital (99,0% congelado contra 96,8%). O que sustenta o eixo é o lift medido e o
  ganho no holdout, não frescor. Empregados via RAIS/CAGED continua sendo o proxy limpo de verdade
  e continua aberto.

---

## 🔴 Antes ou durante o piloto da Setter

- [x] ~~**Os números do onepager e do pitch estavam defasados.**~~ **Resolvido 30/07.** Afirmavam
  "97% a 100%, N=240", medido com o v0 e **inflado por construção**: a métrica filtra as adquiridas
  por sócio 61+ e empresa 25+, e o v0 dava 60 dos 100 pontos exatamente a esses dois campos. Os dois
  documentos agora citam **63% a 95% por setor (N=317)** mais **41,5% no perfil sucessório em
  holdout (n=978, z=2,59, 4,1x vs sorteio)**. O pitch também abria com a tese invertida ("dono
  envelhecendo e sem sucessor") e exibia o caso `PRENSA 100→75` como prova de sofisticação, que era
  justamente o peso derrubado pela medição. `submissao-clube.md` ganhou aviso de documento histórico.

- [ ] **Os outros pesos do research nunca passaram por validação nenhuma.**
  `banco_investimento` +15, `mencao_sucessao_venda` +12, `csuite_externo` +6, `big4_auditoria` +5,
  `sem_presenca_digital` +3. Escolhidos por intuição, que é exatamente o que o score deixou de
  fazer. Alguns não têm proxy de registro para medir; nesses, o melhor possível é ancorar a direção
  e declarar que a magnitude é arbitrada. O `sucessor_familiar_ativo` e o `herdeiro_fora_carreira`
  já foram corrigidos (29/07), e o `herdeiro_fora_carreira` **nunca disparou em 20 investigações**,
  então a correção dele é teórica por enquanto.

- [ ] **29% do topo da lista (score >= 90) já tem sócio PJ no quadro.** Pode ser holding da família
  (segue alvo), já parcialmente vendida (não é mais sucessão) ou sócio institucional (outro jogo), e
  hoje as três aparecem iguais. **Decisão de tese, não bug:** definir se PJ controlador desqualifica
  e então testar como **filtro**, nunca como eixo (o lift de 3,15x está confundido com a definição
  do ground truth).

- [ ] **Recarregar crédito da `ANTHROPIC_API_KEY`.** Acabou em 25/07. Não bloqueia os lotes (rodam
  por assinatura), mas bloqueia o que o servidor faz ao vivo: research e dossiê sob demanda, e o
  parser LLM da busca. A busca **não** quebra sem ele, cai no parser heurístico, que resolve setor,
  praça e idade corretamente.

---

## 🟡 Bloqueado no Henrique / Setter

- [x] ~~**Os 2 setores.**~~ **Chegaram em 11/08**, por WhatsApp, e foram **refinados no mesmo dia**:
  **foco A = laboratório de diagnóstico veterinário**, **foco B = operadora de plano de saúde pet**.
  Death care caiu do foco declarado. **A praça continua não definida.** Nenhum dos dois está entre
  os 4 verticais atuais.
- [ ] **Isto não é setor, é mandato.** "Foco A" e "foco B" é linguagem de mandato comprador, não de
  escolha de vertical. **Números corrigidos pelo proxy de porte** (o corte por capital ≥ R$1 mi
  subestimava tudo em ~2,5x): foco A tem **93 empresas de porte relevante no Brasil, 6 delas no
  perfil sucessório**; foco B tem **49** somando os dois recortes, nenhuma no perfil. Death care tem
  **962, com 163 no perfil**. Em São Paulo: foco A+B **66**, death care **265**.
  **Nesse tamanho o ranking do Boreal importa pouco:** o que vale é achar todo mundo e resolver
  contato, ou seja, a camada de descoberta e enriquecimento, não o score. **Perguntar direto na call
  de quinta se existe mandato comprador nos dois.** Se existir, o piloto muda de forma:
  exaustividade e dado de contato viram a métrica, não recall@top10%.
- [ ] **Call marcada: quinta 13/08, 9:30.** Pauta em `progress.md` nas entradas de 11 e 12/08.
- [ ] **A minuta escorregou pra semana que vem (avisado em 12/08).** Não é só atraso: o piloto do
  onepager (2 originadores, 1h/semana, um mês, **R$2.000**, fechado em 12/08) **não cabe** num foco A de 93 empresas.
  Assinar aquela minuta seria travar um piloto incompatível com o escopo. **Levar pra call as duas
  formas alternativas:** (a) escopo fixo, mapa completo de A e B com contato resolvido, critério de
  sucesso = exaustividade e taxa de contato; (b) o mês de uso em death care, que tem 265 empresas de
  porte relevante em SP e 47 no perfil. As duas somam bem.
- [ ] **Não entregar a lista nominal do foco A antes do contrato.** Com 93 empresas, a lista É o
  produto. Mostrar a **forma** do universo (contagem, UF, concentração, quantas no perfil) prova a
  capacidade sem entregar o entregável.
- [x] ~~**Sondar os dois setores no BigQuery.**~~ **Feito em 11/08**, e refeito no mesmo dia depois
  que o proxy de tamanho foi corrigido. Tabelas completas em `progress.md`. Pelo corte antigo de
  capital (**subestima, não usar**): foco A 11 empresas, foco B 4. Death care mais plano
  funerário, que ele tirou do foco, tem 11.712 empresas e **392 acima de R$1 mi**, com prevalência
  de aquisição 11,6x maior. **A hipótese de que os focos eram pequenos demais se confirmou, e por
  margem maior do que eu esperava.**
- [ ] **Levar pra quinta a recomendação de inverter o foco pra death care.** Não como "seu setor é
  ruim", e sim: se existe mandato comprador em lab veterinário, o Boreal entrega a lista completa
  em dias e não precisa de piloto de um mês pra isso; o piloto de um mês só se justifica onde tem
  universo. E o setor com universo é o que ele já tinha citado primeiro.
- [ ] **`death care` é um CNAE limpo, `pet` não é.** Death care é a classe **9603-3** inteira
  (gestão de cemitérios, cremação, sepultamento, funerárias, somatoconservação), mais **6511-1/02**
  (planos de auxílio funeral), que existe como CNAE próprio. Prefixos ingeríveis hoje: `9603` e
  `65111`. Já **"diagnóstico para PET" e "plano de saúde PET" não têm CNAE**: os dois caem dentro
  de **7500-1/00 (atividades veterinárias)**, junto com toda clínica de bairro, hospital veterinário
  e serviço de vacinação. Segmentar isso é problema de classificação por nome e site, não de filtro
  de CNAE, e cai na mesma pendência de "descoberta residual" mais abaixo. **Levar essa restrição
  pra call em vez de aceitar o setor e descobrir depois.**
- [ ] **Definir a praça.** Sem ela o universo de death care e de veterinária provavelmente é
  nacional inteiro, o que muda o custo de ingest.
- [ ] **Importar a lista de CRM incumbente** em `crm_incumbente` (hoje vazia, então tudo marca
  "novo" e a métrica-manchete do piloto não pode ser computada).
- [ ] **A minuta travou do lado deles, duas vezes.** Pedro (Comercial) saiu da Setter e o jurídico
  não devolveu a minuta. O piloto não tem contrato e não tem data. Na call, pedir nome de quem
  assumiu a minuta agora que o Pedro saiu, com data, em vez de aceitar "o jurídico está vendo".

---

## 🟡 Aberto, não bloqueia o piloto

### Score e dados

- [ ] **Nº de estabelecimentos como eixo.** Já medido: vale ~1,3pp de recall. Preso porque o ingest
  não traz contagem de filiais. É o ganho mais barato que existe hoje.
- [ ] **Proxy limpo de tamanho (o que ainda falta).** Empregados via RAIS/CAGED ou faturamento
  estimado. `porte` resolveu parte do problema em 11/08, mas é tão congelado quanto capital.

  **Medido em 11/08:** o capital é **idêntico entre 2023 e 2025 em 91% a 95%
  das empresas**. O substituto imediato é `empresas.porte` (ME/EPP/DEMAIS), mantido porque tem
  consequência tributária, e que sobe com a idade da empresa como proxy real (4,4% DEMAIS nas
  fundadas nos anos 2020 contra 21,8% nas anteriores a 1979). Trocar o corte mudou os números da
  sondagem da Setter em 2,5x. **Ressalva:** DEMAIS é "nem ME nem EPP", então inclui inelegível por
  natureza jurídica (S/A, empresa com sócio PJ) e superestima tamanho onde já há sócio
  institucional. A data de exclusão do Simples **foi medida** em 11/08 e não agrega (ver acima).
  Ver `modelo-de-score.md` §14 e `scripts/sonda-proxy-tamanho.mjs`.
- [ ] **Validar o proxy de ground truth contra desfecho real da Setter.** Quando houver ~20
  conversas com desfecho no pipeline, checar se as empresas que ela realmente destravou estavam no
  nosso topo. **Maior valor da lista inteira** e sai de graça de operar o piloto.
- [ ] **Teto de mandato.** O topo da lista tem empresa grande demais: capital mediano de R$ 4,4 mi
  em metalmec e máximo de R$ 274 mi, com CSN e ROMI (ambas de capital aberto) aparecendo. A Fairplay
  declara publicamente trabalhar R$ 20M a R$ 500M de deal; se a Setter for parecida, isso é corte
  por cima. É filtro de mandato, não eixo. **Guilherme pediu para não tratar agora (30/07).**
- [ ] **Separar v0 e v1 em duas dimensões.** Hoje `v1 = clamp(v0 + ajuste, 0, 100)` e o teto apaga a
  magnitude do research (medido: ajustes de +12 a +30 viraram todos +3). O desempate por ajuste
  bruto (30/07) é paliativo. A correção real é v0 responder "tem o perfil" e o research responder
  "está acontecendo agora", cada um com seu indicador. Mudança de produto, com UI e tipos: pós-piloto.

### Produto e originação

- [ ] **Fechar o loop de outcome.** Realimentar `resultado` (deal_fechado / perdido) no score.
  Precisa de dado do piloto.
- [ ] **Sensor forward vivo.** Transição societária das empresas salvas vira sinal no pipeline; o
  `scripts/monitor-transicoes.mjs` já minera.
- [ ] **Descoberta de tech** (CNAEs 62xx/63xx) como mapeamento e descoberta, não predição de
  sucessão. O enquadramento honesto já está definido.
- [ ] **Moat de descoberta:** ligar CNPJ ao site da empresa de forma sistemática. Guilherme pediu
  para desenvolver.
- [ ] **Descoberta residual:** empresa sem email próprio e com nome genérico (ex: clínica IMUNE) não
  é resolvida pelo SERP.
- [ ] **Deploy do Scrapling.** É Python com browser e **não roda no Vercel**; a coleta tem que ficar
  em worker offline.
- [ ] **Trajetória societária** (removida da home em 07/06, handoff para Guilherme).

### Prospecção

- [ ] **Fairplay Capital como prospect, não como ameaça.** Boutique de 2024, Sorocaba/SP,
  middle-market R$ 20M a R$ 500M, três pessoas, sem originação proprietária. É a Setter com outro
  nome. Análise completa em `brain/referencia-site-fairplay.md`.

  **Estado (30/07):** convite de conversa de aprendizado enviado ao José Venancio (Mom Test, sem
  demo). Ele respondeu em ~3h, caloroso, mas **não aceitou o 1:1**: ofereceu no lugar uma
  "masterclass com jovens talentosos interessados em M&A". Ou seja, reclassificou o Guilherme de
  quem-constrói-em-originação para plateia. Provavelmente é o mesmo motor do Fairmind, construção
  de audiência e funil de recrutamento.

  Resposta enviada aceita a masterclass **e** repropõe os 20 minutos, ancorando no fato do piloto
  em agosto para desfazer o enquadramento sem se gabar. Se ele empurrar de novo, reconsiderar
  mandar um recorte de dado (ex: heat-map de M&A da praça de Sorocaba) como presente, não como
  demo: ficar em silêncio dentro do enquadramento de aluno é pior que o risco de mostrar output.

  Ir na masterclass mesmo assim, com expectativa correta: é jogada de relacionamento, não de
  aprendizado. O valor está em virar rosto conhecido antes da conversa comercial e em quem mais
  estará na sala (público adjacente ao da BRHSIC Academy).

---

## 🔵 Dívida técnica

> Herdados da auditoria de 30/07 sem reverificação. Confirmar se ainda valem antes de agir.

- [ ] **`PRODUCT.md` está na condição em que o README estava** (achado de 02/08, não corrigido).
  Descreve o Maguto como co-dono com fronteira de domínio por arquivo (`page.tsx` dele, `lib/` do
  Guilherme) e o produto como submissão de competição de clube de programação com Loom de 1 minuto.
  Nada disso vale desde junho. Decidir entre reescrever (vira doc de produto de verdade) ou marcar
  como documento histórico, igual foi feito com `submissao-clube.md`.
- [ ] Fix de dados em `/validacao` · `hindcast.json`.
- [ ] Navegação `<a>` → `<Link>`, repo-wide.
- [ ] Aposentar o `dossier-cache.json`.
- [ ] Busca em 3,3s em produção (mediana, warm). O gargalo medido é a query mais o scoring, não a
  chamada de LLM.
- [ ] **`/api/research` não tem guarda de teto.** Exposto pelo mapa de fluxo (31/07): o lote
  (`precompute-research.ts`) ganhou `--min/--max` justamente porque investigar quem já está em
  score_v0 = 100 não move nada (o clamp come o ajuste), mas a rota sob demanda, que é a que
  **custa dinheiro** (US$ 0,04 a 0,22 por chamada), não herdou nada disso. O originador clica
  "investigar" no 1º da lista, que é exatamente quem está no teto. Opções: avisar na UI antes de
  gastar, ou passar a exibir o `ajuste_bruto` como o resultado visível quando o score satura (o
  campo já existe e já é usado no desempate).

---

## ⚪ Decisões em aberto

- **Estimativa financeira no memo.** Já decidido **não fazer**: proxy de EBITDA cheira a dado
  inventado para quem entende de PE, e é melhor ser honesto com capital social e porte do que
  fabricar número. Fica registrado porque o juiz de M&A penaliza a ausência (0-1/10) e a tensão
  volta toda vez. Se mudar, tem que vir com metodologia declarada.
- **Qualificação do sócio** (código "49" = Sócio-Administrador, "Inventariante" = sinal sucessório
  direto): resolver via dicionário do BigQuery. Barato e alto valor pro dossiê.
- **Enrichment nível 1** (site/web da empresa): job assíncrono, não bloqueante. Metade das
  empresas-alvo não tem presença digital, e a ausência é ela mesma um sinal.

---

## Removido nesta auditoria (30/07)

Registrado para ninguém procurar depois:

| o que | por quê |
|---|---|
| Semanas 1, 2, 2.5, 3, 4 e Demo Day | cronograma do Clube da Programação, encerrado em junho |
| Submissão do Loom (deadline 10/06) | submetido a tempo; `brain/submissao-clube.md` fica como material reaproveitável de pitch |
| Deploy no Vercel | **feito**, verificado em produção nesta sessão |
| Selo de proveniência | **feito**, testado ponta a ponta e verificado nesta sessão |
| Pré-cachear saúde e educação | **feito** no cache de 25/07 (4 setores + 15 chaves de tese) |
| Pipeline remodel, home restyle, restyle sistema v1, handoff Maguto | frentes do Maguto, que parou depois do fim do Clube |
| Enquadramentos de "atinge os jurados" | não há mais jurados |
