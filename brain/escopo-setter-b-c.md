# Escopo das opções B e C para a Setter

> Rascunho de 14/09/2026 para a call de 21/09. **Parte 1** é texto de proposta, pode ir para a
> Setter depois de revisado. **Parte 2** são notas internas de negociação e não vão.
>
> Decisões já tomadas pelo Guilherme: ~20h/semana de out/2026 a jul/2027; C é adicional sobre B;
> SLU própria antes de C; B ancorado entre R$ 4 e 6 mil com obrigação de desfecho.
>
> Origem: call de 14/09 (`segundo-cerebro/wiki/sources/setter-call-henrique-2026-09.md`).

---

# PARTE 1 · Proposta

## Resumo

| | **B · Plataforma e evolução contínua** | **C · Caminho até o dono (adicional ao B)** |
|---|---|---|
| O que resolve | Encontrar e qualificar as empresas certas em cada tese | Descobrir quem da Setter chega no dono de cada empresa |
| Formato | Mensalidade | Projeto em três fases, com decisão de seguir ou parar entre elas |
| Preço | R$ 6.000/mês, ou R$ 4.500/mês com prazo de 6 meses e desfecho registrado | R$ 6.000 + R$ 24.000 + R$ 8.000 por fase |
| Prazo | 6 meses, renovável | ~16 semanas, out/2026 a fev/2027 |
| Contrapartida da Setter | Registrar o que acontece com cada empresa salva; um dono interno | Dados de relacionamento e exportações de contatos; um dono interno |

## O que o piloto mostrou

- A ferramenta funcionou como atalho: depois do filtro de porte, ano de fundação e Simples, a taxa de
  aproveitamento subiu de **1% para 32%**, e a Setter salvou **31 empresas** em três mandatos.
- Cada setor pede critério próprio. Não existe um filtro genérico que sirva para 50 setores.
- O gargalo agora é **acesso**. Encontrar a empresa deixou de ser o problema; chegar no dono é.
- O uso veio de uma pessoa, no tempo livre. Para continuar, a Setter precisa de um dono interno.

As duas opções abaixo respondem a esses quatro pontos, nessa ordem.

---

## Opção B · Plataforma e evolução contínua

### O que está incluído

1. **Até 5 acessos** da Setter à plataforma.
2. **Os 3 mandatos atuais**, mantidos e atualizados com a base da Receita.
3. **Um mandato novo por mês**, até 6 ativos ao mesmo tempo. Cada mandato novo começa com uma
   sessão de 1 hora com quem conhece o setor, para transformar o critério da pessoa em filtro, do
   jeito que foi feito com porte, ano de fundação e Simples. Resultado de cada sessão:
   - filtro padrão do mandato, visível e desligável
   - ordenação ajustada à tese (sucessão, consolidação ou outra)
   - investigação e dossiê prontos para as 100 primeiras empresas
4. **Contato marcado por confiabilidade.** Telefone e e-mail da Receita já aparecem para 89% das
   empresas, mas cerca de 20% se repetem em vários CNPJs, o que costuma indicar o escritório de
   contabilidade. A plataforma passa a separar contato **provavelmente direto** de **provavelmente
   do contador**. Nas 31 empresas salvas, 22 têm telefone que não se repete.
5. **Correções e melhorias contínuas**, com prioridade definida junto com a Setter.
6. **Call semanal de 30 minutos** e correção de erro que impeça o uso em até 1 dia útil.
7. **Relatório mensal:** empresas salvas, empresas novas para a Setter, avanço no funil e
   aproveitamento por mandato.

### O que a Setter faz

- **Registra o que acontece com cada empresa salva** (contatada, reunião, mandato, descartada e
  motivo), direto na plataforma, pelo menos a cada 15 dias.
- **Marca, ao salvar, se já conhecia a empresa.**
- **Indica um dono interno** da ferramenta.

O registro não é burocracia. É o que faz a plataforma melhorar para a Setter: cada desfecho ajusta a
ordenação dos mandatos. Sem ele, o que existe é uma lista, e uma lista não precisa de mensalidade.

### Preço

- **R$ 6.000/mês.**
- **R$ 4.500/mês** com prazo mínimo de 6 meses e registro de desfecho em dia. Se o registro atrasar
  mais de 30 dias, o mês seguinte volta ao valor cheio.
- **Taxa de êxito de 0,5%** sobre operações com empresas salvas na plataforma que não estavam na base
  de relacionamento da Setter na data em que foram salvas, por **24 meses** a partir dessa data. A
  data e a empresa ficam registradas com selo de proveniência. A base de relacionamento de
  referência é uma lista de CNPJs entregue pela Setter na assinatura.

### Exclusividade

Enquanto o contrato estiver vigente e em dia, a Boreal não oferece os mandatos ativos da Setter a
outra assessoria de M&A no Brasil. A exclusividade é **por mandato**: não cobre outros setores nem
usos fora de M&A.

### Fora do escopo

Envio automático de mensagens, integração com CRM, compra de contatos de terceiros, raspagem de
redes sociais, setores sem mandato contratado.

---

## Opção C · Caminho até o dono

> Adicional ao B. Não existe sem ele, porque usa a base de empresas e sócios que o B mantém.

### O que é

Na página de cada empresa, a plataforma mostra **quem da Setter tem o caminho mais curto e mais
confiável até o dono**, e por onde passa esse caminho. Exemplo de saída:

> **Laboratório X** · 2 caminhos
> 1. Fernanda → João Silva (contato no LinkedIn) → João é sócio da Empresa Y junto com Maria Souza,
>    sócia do Laboratório X
> 2. Henrique → Carlos Lima (mailing) → Carlos trabalha no Laboratório X

### Como funciona

Três fontes, e nenhuma delas é raspagem:

1. **Quadro de sócios da Receita**, público: quem é sócio de qual empresa, desde quando.
2. **Mailing da Setter** (~3 mil contatos).
3. **Contatos do LinkedIn exportados por cada pessoa da Setter**, pela função de exportação de dados
   da própria plataforma. Cada pessoa decide se participa.

O trabalho técnico central é **casar nomes**: descobrir que o "João Silva" do mailing é o mesmo João
Silva sócio de uma empresa. Casamentos duvidosos passam por revisão humana antes de virar caminho.

### O que ele não faz (dito antes, para não virar expectativa)

- **Não chega a "6 graus".** A exportação do LinkedIn traz os contatos diretos de cada pessoa, não os
  contatos dos contatos. O alcance real é de **2 a 3 passos**, usando o quadro de sócios como ponte.
- Não envia mensagem nem contata ninguém. Mostra o caminho; a apresentação é pedida por uma pessoa.
- Não enxerga relação que não esteja em nenhuma das três fontes (família, clube, faculdade).

### Fases

| Fase | Duração | O que entrega | Decisão ao final |
|---|---|---|---|
| **0 · Diagnóstico dos dados** | 2 semanas | Inventário do mailing e das exportações; teste de casamento com o mailing + 3 exportações; **quantas das 31 empresas salvas têm pelo menos um caminho de até 3 passos** | Se menos de 20% das salvas tiverem caminho, o projeto para aqui |
| **1 · Primeira versão** | 6 semanas | Caminhos na página da empresa para os mandatos ativos, com todas as exportações que a Setter reunir; revisão dos casamentos duvidosos | Uso real por 4 semanas antes da fase 2 |
| **2 · Medição** | 8 semanas | Registro de cada caminho usado: pedido de apresentação, resposta, reunião. Comparação com a taxa atual de resposta da Setter em abordagem sem vínculo (~3%). Atualização trimestral dos contatos | Relatório de eficiência: custo, tempo e diferença |

### Preço

| Fase | Valor | Pagamento |
|---|---:|---|
| 0 · Diagnóstico | R$ 6.000 | na entrega |
| 1 · Primeira versão | R$ 24.000 | 50% no início, 50% na entrega |
| 2 · Medição | R$ 8.000 | na entrega |
| **Total se as três fases acontecerem** | **R$ 38.000** | |

A Setter só se compromete com a fase seguinte depois de ver o resultado da anterior. Se a fase 0
mostrar que o grafo não encontra caminho, o custo total é R$ 6.000.

### Dados, propriedade e exclusividade

- **Os dados de relacionamento são da Setter.** Mailing, exportações e o mapa de relações montado com
  eles não são usados para nenhum outro cliente e são apagados ao fim do contrato.
- **O código e o método são da Boreal**, licenciados à Setter enquanto o contrato estiver vigente.
- **A Boreal não oferece o caminho até o dono a outra assessoria de M&A no Brasil por 12 meses**
  contados da entrega da fase 1. Usos fora de M&A ficam livres.
- A Boreal atua como **operadora** dos dados pessoais, com a Setter como controladora, e isso vai em
  cláusula própria de proteção de dados.

### Pré-requisitos para começar

- Contrato de C assinado pela empresa própria da Boreal.
- Cláusula de proteção de dados com a Boreal como operadora.
- Pelo menos 3 pessoas da Setter dispostas a exportar os contatos na fase 0.
- Dono interno definido.

---

# PARTE 2 · Notas internas (não vão para a Setter)

## Por que esses números

**Custo de servir não é o argumento.** R$ 1,08 por empresa investigada, R$ 0,21 por busca, uns R$ 300
a 560 por mês de API. A margem é quase total em qualquer preço. O preço sai de três coisas:

1. **Tempo seu.** C são ~16 semanas a ~20h, ~320 horas. R$ 38 mil dá ~R$ 120 por hora. É barato para
   desenvolvimento sob medida com conhecimento de domínio, e é o que torna o C aprovável.
2. **Valor para a Setter.** Um mandato que nasça de um caminho do grafo paga o projeto inteiro muitas
   vezes. É o argumento verbal, não o escrito.
3. **O histórico deles.** Nunca pagaram ferramenta além do CRM, e o piloto fechou em R$ 2 mil. R$ 6 mil
   cheio é o triplo, e o desconto para R$ 4.500 existe para parecer uma escolha, não um recuo.

## Como negociar

- **Ancorar no cheio por escrito** (R$ 6.000). O R$ 4.500 aparece como consequência de um compromisso
  deles, não como desconto pedido.
- **Carta na manga para o C, se o Henrique empurrar preço:** reduzir a fase 1 para R$ 12 mil e subir
  a taxa de êxito para **1%** nas operações cujo primeiro contato veio de um caminho sugerido. Com o
  grafo, a atribuição fica **registrada na plataforma** (caminho sugerido, pedido de apresentação),
  o que resolve a dificuldade de controle apontada em 11/08. Só usar se precisar: troca caixa agora
  por receita incerta daqui a 12 a 24 meses.
- **O dono interno é condição, não pedido.** Foi o próprio Henrique quem disse. Repetir as palavras
  dele: "ter um líder que direcione o tempo e o esforço, até para justificar o custo".
- **Não repetir "4 meses" sem as fases.** O cronograma agora é o da tabela, com portões.

## Perguntas que o Henrique vai fazer

**"E quando você for para a faculdade?"**
Resposta a preparar antes de 21/09. Proposta: aviso prévio de 90 dias; B continua em modo de
manutenção (dados atualizando, correções) ou encerra com exportação completa do que é da Setter
(empresas salvas, estágios, notas). **Decisão sua, ainda aberta.**

**"Por que o preço triplicou se só a Fernanda usou?"**
Porque B não é o piloto: é um mandato novo por mês com critério próprio, contato marcado, relatório
e call semanal. E o valor menor existe justamente em troca do registro de desfecho e do prazo. Se
continuar só uma pessoa usando, o dono interno resolve isso, não o preço.

**"Como eu garanto que você não leva isso para o concorrente?"**
Três camadas: exclusividade por mandato no B; 12 meses de exclusividade do caminho até o dono entre
assessorias de M&A no C; e os dados de relacionamento da Setter nunca saem, porque são deles.

**"E se o grafo não achar nada?"**
A fase 0 existe para isso. Custo máximo de descobrir: R$ 6 mil e duas semanas.

**"O código fica com quem?"**
Com a Boreal, licenciado. O que é da Setter são os dados. É o mesmo desenho de qualquer software.

## O que mudar na minuta atual

| Ponto | Hoje | Proposta |
|---|---|---|
| Responsabilidade por LGPD | sem teto | teto de 12 mensalidades, exceto dolo |
| Propriedade intelectual | não existe | código e método da Boreal; dados da Setter |
| Janela da taxa de êxito | 1 mês | 24 meses a partir da data em que a empresa foi salva |
| Base de relacionamento | indefinida | lista de CNPJs entregue na assinatura |
| Exclusividade | total, por R$ 2 mil | por mandato no B; 12 meses entre assessorias no C |
| Citação da Setter | proibida | autorização para citar como cliente |
| Proteção de dados no C | não existe | Boreal operadora, Setter controladora |
| Saída | não trata | aviso de 90 dias e exportação dos dados da Setter |

## Riscos

- **Outubro a dezembro é a janela de prazo das aplicações.** Se apertar, o C desacelera, o B não.
- **O B depende de uso.** Com uma usuária no tempo livre, o relatório mensal vai mostrar pouco, e isso
  aparece na renovação. O dono interno é o que protege o B.
- **A frase de 14/09** ("não pretendo me relacionar com outras pessoas do mercado") precisa ser
  corrigida antes de falar de exclusividade. A exclusividade desta proposta é estreita de propósito:
  por mandato, e 12 meses só para o caminho até o dono.
- **Fase 0 pode dar pouco caminho.** O portão de 20% é chute inicial; vale discutir com o Henrique qual
  número faria a Setter querer a fase 1.
- **B pela EI do tio, C pela SLU.** Dois CNPJs na mesma relação; a SLU tem que existir antes da
  assinatura do C, e o teto de responsabilidade no B vira obrigatório.

## Decisões suas ainda abertas

1. Continuidade depois de agosto de 2027 (manutenção ou encerramento com exportação).
2. Se a exclusividade do B inclui compradores diretos (consolidadores e fundos) ou só assessorias.
3. O número do portão da fase 0.
4. Se a carta da taxa de êxito de 1% entra na proposta escrita ou fica guardada.
