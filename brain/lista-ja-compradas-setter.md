# Empresas do pipeline da Setter que provavelmente já têm dono

> Gerado em 20/09/2026 por `scripts/detecta-aquisicao.mjs` sobre as 31 empresas salvas pela Setter. Fonte única: quadro societário do CNPJ (Receita Federal), snapshot de 09/11/2025. **Sinal de cadastro, não confirmação de negócio.**

As 31 empresas que vocês salvaram, verificadas em duas camadas: o **quadro societário do CNPJ** (Receita Federal, snapshot de 09/11/2025) e **busca na web**, com fonte registrada para cada resposta. É sinal de cadastro, não confirmação de negócio, então trata como ponto de partida.

## 1. Provavelmente já compradas (8)

Sócio pessoa jurídica sem sobrenome em comum com o quadro, com o ano em que entrou.

| Empresa                                          | Praça                     | Quem entrou                         | Ano  |
| ------------------------------------------------ | ------------------------- | ----------------------------------- | ---- |
| **VETGUARD PLANO DE SAUDE VETERINARIO**          | Rio de Janeiro/RJ         | GRP VEPET PARTICIPACOES             | 2020 |
| **LOTUS LABORATORIO VETERINARIO**                | Cascavel/PR               | LIFE INVESTIMENTS BRASIL            | 2022 |
| **DIAGNOSTIC CENTRO DE DIAGNOSTICO VETERINARIO** | Brasília/DF               | MAAB PARTICIPACOES EMPRESARIAIS     | 2022 |
| **AMIGOO PET (APET)**                            | São Paulo/SP              | PROFITUS PARTICIPACOES              | 2023 |
| **CEMITERIO MEMORIAL VALE DA SAUDADE**           | Cruz do Espírito Santo/PB | PROADM HOLDING                      | 2023 |
| **JARDIM DA PAZ ADMINISTRACAO DE CEMITERIO**     | S. J. do Rio Preto/SP     | C4 PARTICIPACOES E INVESTIMENTOS    | 2023 |
| **VERSAN EMPREENDIMENTOS**                       | Arapiraca/AL              | MCB PARTICIPACOES                   | 2023 |
| **GENEAL DIAGNOSTICOS**                          | Uberaba/MG                | GENESIS ADMINISTRACAO PARTICIPACOES | 2025 |

**Dois compradores aparecem mais de uma vez na base**, o que sugere consolidação em curso no death care: **PROADM HOLDING** está em 6 empresas e **MCB PARTICIPACOES** em 5.

## 2. Têm holding, mas é da própria família (4)

O nome da holding divide sobrenome com os sócios pessoa física. Não é venda, é organização patrimonial. Seguem disponíveis.

| Empresa                                   | Praça          | Holding                              |
| ----------------------------------------- | -------------- | ------------------------------------ |
| INTERNATIONAL PET (DR PET)                | São Paulo/SP   | RENE EMPREENDIMENTOS E PARTICIPACOES |
| MORADA CEMITERIOS (MORADA DA PAZ)         | Parnamirim/RN  | VILA PARTICIPACOES                   |
| SAO FRANCISCO SERVICOS FUNERARIOS         | João Pessoa/PB | VILA PARTICIPACOES                   |
| SAFRA SAO FRANCISCO ASSISTENCIA FUNERARIA | Natal/RN       | IRMAOS VILA PARTICIPACOES            |

**Atenção:** as três últimas são do mesmo grupo. VILA PARTICIPACOES aparece em 4 empresas da base e IRMAOS VILA em 5. Tratar como um interlocutor só, não como três alvos.

## 3. Não dá para saber, mas o quadro mudou (5)

Nenhum sócio atual estava na empresa na fundação. Pode ter sido compra por pessoas físicas, saída de fundador ou sucessão. Vale confirmar antes de investir tempo.

| Empresa                                    | Praça            | Fundação | Primeiro sócio atual entrou em |
| ------------------------------------------ | ---------------- | -------: | -----------------------------: |
| CANIS FELIS DIAGNOSTICO VETERINARIO        | São Paulo/SP     |     2010 |                           2017 |
| NUCLEO DIAGNOSTICO VETERINARIO MARINGA     | Maringá/PR       |     2014 |                           2017 |
| LAB & VET DIAGNOSTICO E CONSULTORIA        | São Paulo/SP     |     1995 |                           2004 |
| EMEDAUX ADMINISTRACAO DE CEMITERIOS        | Florianópolis/SC |     1975 |                           2000 |
| GESTORA E ADMINISTRADORA JARDIM DA SAUDADE | Curitiba/PR      |     1983 |                           2007 |

## 4. Sem sinal de venda (14)

Só sócios pessoa física, com pelo menos um desde a fundação.

AXYS ANALISES · CARE PLANO DE SAUDE ANIMAL · DIMEVET · FRLAC · HISTOPATO · HOSPITAL VETERINARIO SAO FRANCISCO DE ASSIS (ver seção 5: é OSC ligada a faculdade, não é alvo) · LABORATORIO SAO FRANCISCO (Blumenau) · LABORATORIOS BOTEGA (CENTERVET) · NARDOTTO SCAN · NUCLEO DIAGNOSTICO VETERINARIO · ROUS PATOLOGIA ANIMAL · SERVICOS DE ASSISTENCIA FAMILIAR FOZ · ZELLE PATOLOGIA VETERINARIA · ZIIGO ASSISTENCIA FUNERARIA

---

## Teste de acurácia contra o que a Setter já sabia

Na call de 24/08 a Fernanda citou de memória três empresas que já tinham dono. O detector, olhando só o cadastro, chegou nas mesmas:

| O que ela disse                               | O que o cadastro mostra                                                                           |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| "NEW PROVET já tinha sido adquirida"          | NEW PROVET recebeu a PROVET como sócia em 2025                                                    |
| "Consolidada pela Petlove"                    | PROVET recebeu PETSUPERMARKET COMERCIO DE PRODUTOS PARA ANIMAIS, razão social da Petlove, em 2025 |
| "TECSA, empresa consolidadora e já investida" | TECSA recebeu PET CARE CENTRO VETERINARIO SA em 2021                                              |
| "TOMOVET, sócios de grupo grande"             | **não detectado**: não há pessoa jurídica no quadro, o vínculo está nas pessoas                   |

Três de quatro, e a falha é explicável. Serve como calibração honesta do que o método pega e do que não pega.

## Limites, para dizer junto

- É cadastro, não notícia. Uma venda fechada e ainda não registrada não aparece.
- Sócio pessoa jurídica pode ser holding patrimonial de um sócio individual, e não comprador. A separação por sobrenome pega a maioria dos casos, não todos.
- O snapshot é de novembro de 2025. Movimentos posteriores entram na próxima atualização da base.
- Quem foi comprado por pessoas físicas não aparece na categoria 1, só na 3.

---


## 5. O que a busca na web acrescentou (21/09)

**As 31 foram verificadas**, uma por uma, com busca na web e fonte registrada para cada resposta.

### O veredito de controle

| Veredito da busca na web | Empresas |
|---|---:|
| Aquisição confirmada pela web | **0** |
| **Independência confirmada**, com fonte | **4** |
| Sem informação pública suficiente | 27 |

**Nenhuma aquisição saiu na imprensa, e isso é sobre o mercado, não sobre as empresas.** Compra de empresa familiar de médio porte no Brasil quase nunca vira notícia. É a mesma razão pela qual a Boreal minera o registro do CNPJ: o registro rende centenas de transações onde a imprensa rende unidades. **Para este segmento, o quadro societário é a fonte forte e a web é a fraca.**

### As quatro independências confirmadas valem dinheiro

Saber que uma empresa **não** foi comprada é tão útil quanto o contrário: é a diferença entre abordar com confiança e gastar a ligação para descobrir.

| Empresa | Quem controla hoje, segundo a web |
|---|---|
| **MORADA CEMITÉRIOS** (Morada da Paz) | Família Vila, com Daniel, Ibsen e José Eduardo Vila como administradores |
| **LABORATÓRIOS BOTEGA** (Centervet) | Lucas e Marilda Botega Spinelli, desde a fundação em 1997 |
| **DIMEVET** | Dra. Débora L. Dalzochio, sócia fundadora e responsável técnica |
| **HISTOPATO** | Os três sócios originais de 2014: André Santos, Guilherme Blume e Letícia Batelli |

Uma ressalva sobre a DIMEVET: ela aparece como credenciada da rede Petlove Saúde. Isso é **parceria comercial, não mudança de controle**, e vale saber antes da conversa.

### A web confirmou a leitura do cadastro

A separação entre "comprador de fora" e "holding da própria família", que o detector faz por sobrenome, bateu com o que a web diz de forma independente:

- SÃO FRANCISCO SERVIÇOS FUNERÁRIOS e SAFRA aparecem publicamente como **Grupo Morada da Paz**, e a SAFRA tem a Irmãos Vila Participações descrita como holding familiar dos irmãos Vila
- MORADA CEMITÉRIOS se declara parte do Grupo Morada

Ou seja: as três continuam disponíveis como alvo, e continuam sendo **um interlocutor só**.

### Três coisas que o cadastro não pegaria

**ZIIGO ASSISTÊNCIA FUNERÁRIA** aparece como "sem sinal de venda" no quadro societário, mas a web mostra **aporte milionário em novembro de 2019**, de um empresário do setor funerário cujo nome e valor ficaram sob sigilo, e depois **conversão de Ltda para S.A.**, com Vicente Conte Neto no Conselho de Administração e ligação dos sócios à Zion Invest e ao fundo CARE11. Os cinco fundadores seguem no quadro. É exatamente o caso em que a busca agrega sobre o registro: dinheiro de fundo entra sem necessariamente mudar o quadro de sócios.

**HOSPITAL VETERINÁRIO SÃO FRANCISCO DE ASSIS (RS)** não é empresa familiar. É vinculado à faculdade IDEAU de Getúlio Vargas e está cadastrado como **organização da sociedade civil** no MapaOSC do IPEA. Não é alvo de M&A, e sai da lista de trabalho.

**LABORATÓRIO SÃO FRANCISCO (Blumenau)** consta como **suspenso na lista de laboratórios credenciados do MAPA**. Segue independente, mas o credenciamento é o que sustenta parte da operação de um laboratório veterinário. Vale entender antes de investir tempo.

### As observações da primeira rodada, revisadas

| Empresa | O que a web mostrou | Como isso muda |
|---|---|---|
| **AMIGOO PET (APET)** | Aporte de R$ 10 milhões noticiado em 2023, parceria de distribuição com o Itaú e rebranding para APet | A entrada da PROFITUS em 2023 tem cara de **rodada de investimento**, não de venda de controle. Pode seguir como alvo |
| **GENEAL DIAGNÓSTICOS** | Brasif S/A e Genesis Administração Participações no quadro, vinculando ao **grupo Brasif** | Não é familiar independente, é ativo de grupo grande. Sem notícia que confirme a operação |
| **VERSAN EMPREENDIMENTOS** | Vaga anunciada como "Previda Versan, Arapiraca, **Grupo Parque das Flores**" e matéria de 2021 citando unidade do grupo na cidade | Reforça que já tem dono. Não distingue aquisição de origem societária comum |
| **VETGUARD** | **Cadastro da Receita consta como suspenso**, e o site institucional segue no ar | Confirmado em segunda checagem. Entender a situação cadastral antes de abordar |

**Uma consequência para a ferramenta:** a base foi carregada com o snapshot de novembro de 2025 e a situação cadastral não é reconferida desde então. Empresa baixada ou suspensa depois disso continua aparecendo como ativa, e a VETGUARD e o LABORATÓRIO SÃO FRANCISCO são os dois casos concretos disso na lista de vocês. Entrou na lista de correções.
