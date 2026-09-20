# Empresas do pipeline da Setter que provavelmente já têm dono

> Gerado em 20/09/2026 por `scripts/detecta-aquisicao.mjs` sobre as 31 empresas salvas pela Setter.
> Fonte única: quadro societário do CNPJ (Receita Federal), snapshot de 09/11/2025.
> **Sinal de cadastro, não confirmação de negócio.**

## Mensagem curta, para mandar

> Henrique, rodei uma verificação no quadro societário das 31 empresas que vocês salvaram, para
> responder aquela pergunta da Fernanda de "essa aqui já foi comprada?".
>
> **8 têm sócio pessoa jurídica de fora da família, ou seja, provavelmente já têm dono.** Outras 4
> têm holding, mas é da própria família, então continuam disponíveis. E 5 trocaram o quadro inteiro
> depois da fundação, o que não prova venda mas merece um olhar antes de vocês investirem tempo.
>
> Testei o método contra o que a Fernanda já sabia de cabeça, e ele achou sozinho a PROVET comprada
> pela Petlove, a NEW PROVET comprada pela PROVET e a TECSA pela Pet Care. Não pegou a TOMOVET,
> porque lá o vínculo está nas pessoas e não numa holding.
>
> Segue a lista. É sinal de cadastro, não confirmação de negócio, então trata como ponto de partida.

---

## 1. Provavelmente já compradas (8)

Sócio pessoa jurídica sem sobrenome em comum com o quadro, com o ano em que entrou.

| Empresa | Praça | Quem entrou | Ano |
|---|---|---|---|
| **VETGUARD PLANO DE SAUDE VETERINARIO** | Rio de Janeiro/RJ | GRP VEPET PARTICIPACOES | 2020 |
| **LOTUS LABORATORIO VETERINARIO** | Cascavel/PR | LIFE INVESTIMENTS BRASIL | 2022 |
| **DIAGNOSTIC CENTRO DE DIAGNOSTICO VETERINARIO** | Brasília/DF | MAAB PARTICIPACOES EMPRESARIAIS | 2022 |
| **AMIGOO PET (APET)** | São Paulo/SP | PROFITUS PARTICIPACOES | 2023 |
| **CEMITERIO MEMORIAL VALE DA SAUDADE** | Cruz do Espírito Santo/PB | PROADM HOLDING | 2023 |
| **JARDIM DA PAZ ADMINISTRACAO DE CEMITERIO** | S. J. do Rio Preto/SP | C4 PARTICIPACOES E INVESTIMENTOS | 2023 |
| **VERSAN EMPREENDIMENTOS** | Arapiraca/AL | MCB PARTICIPACOES | 2023 |
| **GENEAL DIAGNOSTICOS** | Uberaba/MG | GENESIS ADMINISTRACAO PARTICIPACOES | 2025 |

**Dois compradores aparecem mais de uma vez na base**, o que sugere consolidação em curso no death
care: **PROADM HOLDING** está em 6 empresas e **MCB PARTICIPACOES** em 5.

## 2. Têm holding, mas é da própria família (4)

O nome da holding divide sobrenome com os sócios pessoa física. Não é venda, é organização
patrimonial. Seguem disponíveis.

| Empresa | Praça | Holding |
|---|---|---|
| INTERNATIONAL PET (DR PET) | São Paulo/SP | RENE EMPREENDIMENTOS E PARTICIPACOES |
| MORADA CEMITERIOS (MORADA DA PAZ) | Parnamirim/RN | VILA PARTICIPACOES |
| SAO FRANCISCO SERVICOS FUNERARIOS | João Pessoa/PB | VILA PARTICIPACOES |
| SAFRA SAO FRANCISCO ASSISTENCIA FUNERARIA | Natal/RN | IRMAOS VILA PARTICIPACOES |

**Atenção:** as três últimas são do mesmo grupo. VILA PARTICIPACOES aparece em 4 empresas da base e
IRMAOS VILA em 5. Tratar como um interlocutor só, não como três alvos.

## 3. Não dá para saber, mas o quadro mudou (5)

Nenhum sócio atual estava na empresa na fundação. Pode ter sido compra por pessoas físicas, saída de
fundador ou sucessão. Vale confirmar antes de investir tempo.

| Empresa | Praça | Fundação | Primeiro sócio atual entrou em |
|---|---|---:|---:|
| CANIS FELIS DIAGNOSTICO VETERINARIO | São Paulo/SP | 2010 | 2017 |
| NUCLEO DIAGNOSTICO VETERINARIO MARINGA | Maringá/PR | 2014 | 2017 |
| LAB & VET DIAGNOSTICO E CONSULTORIA | São Paulo/SP | 1995 | 2004 |
| EMEDAUX ADMINISTRACAO DE CEMITERIOS | Florianópolis/SC | 1975 | 2000 |
| GESTORA E ADMINISTRADORA JARDIM DA SAUDADE | Curitiba/PR | 1983 | 2007 |

## 4. Sem sinal de venda (14)

Só sócios pessoa física, com pelo menos um desde a fundação.

AXYS ANALISES · CARE PLANO DE SAUDE ANIMAL · DIMEVET · FRLAC · HISTOPATO · HOSPITAL VETERINARIO SAO
FRANCISCO DE ASSIS · LABORATORIO SAO FRANCISCO (Blumenau) · LABORATORIOS BOTEGA (CENTERVET) ·
NARDOTTO SCAN · NUCLEO DIAGNOSTICO VETERINARIO · ROUS PATOLOGIA ANIMAL · SERVICOS DE ASSISTENCIA
FAMILIAR FOZ · ZELLE PATOLOGIA VETERINARIA · ZIIGO ASSISTENCIA FUNERARIA

---

## Teste de acurácia contra o que a Setter já sabia

Na call de 24/08 a Fernanda citou de memória três empresas que já tinham dono. O detector, olhando
só o cadastro, chegou nas mesmas:

| O que ela disse | O que o cadastro mostra |
|---|---|
| "NEW PROVET já tinha sido adquirida" | NEW PROVET recebeu a PROVET como sócia em 2025 |
| "Consolidada pela Petlove" | PROVET recebeu PETSUPERMARKET COMERCIO DE PRODUTOS PARA ANIMAIS, razão social da Petlove, em 2025 |
| "TECSA, empresa consolidadora e já investida" | TECSA recebeu PET CARE CENTRO VETERINARIO SA em 2021 |
| "TOMOVET, sócios de grupo grande" | **não detectado**: não há pessoa jurídica no quadro, o vínculo está nas pessoas |

Três de quatro, e a falha é explicável. Serve como calibração honesta do que o método pega e do que
não pega.

## Limites, para dizer junto

- É cadastro, não notícia. Uma venda fechada e ainda não registrada não aparece.
- Sócio pessoa jurídica pode ser holding patrimonial de um sócio individual, e não comprador. A
  separação por sobrenome pega a maioria dos casos, não todos.
- O snapshot é de novembro de 2025. Movimentos posteriores entram na próxima atualização da base.
- Quem foi comprado por pessoas físicas não aparece na categoria 1, só na 3.
