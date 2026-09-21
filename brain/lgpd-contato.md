# LGPD no trabalho de contato: o que me preocupou enquanto eu construía

> 21/09/2026, depois de entregar os quatro itens de qualidade de contato. Não é parecer jurídico. É a lista honesta do que eu vi passando perto da linha, com o que fiz a respeito e o que ficou aberto.

## A regra que resolve 90% disso, em uma frase

A LGPD não olha o nome do campo. Ela olha se o dado **identifica uma pessoa natural**. "Contato da empresa" não é uma categoria que a lei reconheça: se o telefone é da empresa, é dado de empresa e a lei não se aplica; se o telefone é do João, é dado do João mesmo estando num campo chamado `telefone` de uma tabela chamada `empresa`.

## O que me preocupou de verdade

### 1. Quase metade da nossa base é dado pessoal disfarçado de dado de empresa

Medido hoje: **27.370 das 65.520 empresas (41,8%) têm e-mail em provedor gratuito.** `joaosilva@gmail.com` no cadastro de uma empresa familiar é o e-mail do João, não da empresa. Some a isso MEI e empresário individual, onde o CNPJ É a pessoa.

A ironia é que o trabalho de hoje **melhorou** essa situação em vez de piorar: até ontem esses 41,8% estavam misturados com o resto e indistinguíveis. Agora estão rotulados como `pessoal`, e dá para tratá-los diferente. Mas o tamanho do problema ficou visível, e ele é grande.

**Não fiz nada a respeito ainda.** É o primeiro item da lista do fim.

### 2. `contato_usado` é o registro mais sensível que criei hoje

A migration 0020 guarda o telefone ou e-mail efetivamente usado em cada tentativa. Quando esse contato é webmail, estou gravando dado pessoal num log que **não tem prazo de expurgo nem finalidade declarada**.

Guardar o valor foi decisão deliberada e continuo achando certa, porque o contato da empresa muda e a pergunta é sobre o que foi discado. Mas a decisão tem consequência: esse campo precisa de prazo de retenção antes de virar hábito.

### 3. `desfecho` cria perfil de comportamento de pessoa identificável

"Ligamos para o João e ele recusou" é dado sobre o João. Registrar isso é legítimo. **Registrar e não respeitar depois é o que a ANPD olha.** Hoje nada impede que a mesma empresa apareça na busca amanhã com `recusou` no histórico e alguém ligue de novo.

O desfecho `recusou` existe desde hoje e não tem nenhuma consequência no produto. Isso precisa mudar antes de o volume crescer.

### 4. A lacuna mais concreta: não existe caminho para oposição

A base legal para prospecção B2B é **legítimo interesse** (art. 7º, IX), e ela não é de graça: vem acompanhada do **direito de oposição do titular** (art. 18, §2º). Se alguém escrever "tira meu contato da sua base", hoje **não existe campo nem processo**. A pessoa seria atendida no braço, e voltaria na próxima recarga da base da Receita.

Essa é a que eu resolveria primeiro. É barata e é a que mais expõe.

### 5. Não temos proveniência por linha

A LGPD exige saber de onde veio cada dado. Temos "Receita Federal, snapshot de 09/11/2025" no nível da base inteira, não por linha. Para dado público em bloco isso provavelmente basta, mas no minuto em que entrar qualquer fonte que não seja a Receita, deixa de bastar.

### 6. Transferência internacional, a conferir

Supabase e Vercel. **Não verifiquei em que região o banco está.** Se estiver fora do Brasil, é transferência internacional de dado pessoal e pede cláusula própria no contrato com a Setter. Fica como item de checagem, não como afirmação.

## O que eu evitei de propósito hoje

**Não enriqueci contato de sócio pessoa física.** Tudo que construí opera no contato da empresa. A linha entre "contato da empresa" e "contato do sócio" é justamente onde o risco muda de categoria, e eu parei antes dela de propósito.

**Não derivei site de domínio pessoal.** Quando apertei a regra do site, o motivo principal era acurácia, mas tem um segundo: `marciorene.eng.br` é o domínio pessoal de alguém, e publicá-lo como "site da INTERNATIONAL PET" expõe o domínio de uma pessoa num contexto que não é dela.

**Não construí disparo automático de mensagem.** Já estava fora do escopo da proposta por escolha comercial. Do lado da lei, é também o ponto em que o risco reputacional sai da Boreal e cai na Setter.

**Não guardei e-mail completo na lista de intermediários.** `scripts/data/intermediarios.json` guarda domínio e contagem, nunca o endereço inteiro. "Este domínio atende 185 mil empresas" não identifica ninguém. A lista dos e-mails teria identificado.

## O salto de categoria que ainda vem: a opção C

A exportação de contatos do LinkedIn da equipe da Setter é **dado pessoal de terceiros que nunca ouviram falar da Boreal**. Isso não é uma versão maior do problema de hoje, é outro problema.

A proposta já trata a Setter como controladora e a Boreal como operadora, com cláusula própria e finalidade documentada antes da coleta. **Nada disso está assinado.** Concretamente: nenhum arquivo de exportação pode entrar antes do contrato, e vale dizer isso em voz alta na call, porque é o tipo de coisa que alguém faz por conta própria achando que ajuda.

## O que eu faria, em ordem

| # | O quê | Esforço | Por que nessa ordem |
|---|---|---|---|
| 1 | Campo `nao_contatar` com motivo e data, respeitado na busca e no pipeline | meio dia | É o direito de oposição, que é a contrapartida obrigatória do legítimo interesse. Hoje não existe |
| 2 | `recusou` passar a ter consequência: a empresa sai da lista de trabalho | horas | Registrar recusa e ignorar é pior que não registrar |
| 3 | Prazo de retenção do `contato_usado` | horas | Log sem expurgo vira passivo sozinho |
| 4 | Conferir a região do Supabase | minutos | Ou está resolvido, ou vira cláusula |
| 5 | Finalidade documentada, por escrito | meio dia | A proposta já promete entregar antes da coleta do C |

Os cinco somam cerca de um dia e meio. Nenhum deles é urgente hoje, com 31 empresas e nenhuma ligação feita. Todos ficam urgentes no dia em que o volume subir, e aí custam mais.

## Uma coisa que eu não faria

Pedir consentimento para prospecção B2B. Consentimento é a base legal errada aqui: ele é revogável a qualquer momento, exige granularidade e, na prática, ninguém consegue coletar antes do primeiro contato, que é justamente o momento em que se precisa dele. Legítimo interesse é a base certa, e o preço dela é o teste de balanceamento documentado mais o direito de oposição funcionando. É esse preço que a lista acima paga.
