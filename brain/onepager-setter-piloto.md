# Follow-up pós-call — Piloto Boreal x Setter (REVISAR OS NÚMEROS ANTES DE MANDAR)

> ⚠️ **NÚMEROS DEFASADOS (auditoria de 30/07/2026). Não enviar antes de resolver.**
> Este documento afirma **"97% a 100% de acerto, N=240"**. Esse intervalo foi medido com o score
> v0, que foi substituído em 29/07, e era **inflado por construção**: a métrica filtra as adquiridas
> por sócio 61+ e empresa 25+, e o v0 dava 60 dos 100 pontos exatamente a esses dois campos.
> Com o v1 o mesmo cálculo dá **63% a 95% (N=317)**.
> Número recomendado, medido em holdout e sem esse viés: **41,5% de recall no perfil sucessório,
> 4,1x melhor que sorteio, n=978, z=2,59**. Ver `brain/modelo-de-score.md` §6 e `pending.md`.

> Preenchido com o que saiu da call de 25/06. Faltam só 3 campos que dependem da confirmação interna
> do Henrique: os 2 setores, os 2 nomes e a data. Valor reposicionado pro jogo da Setter (consolidação
> + descoberta + heat-map de setor), não só sucessão. Sem travessões.

---

**Para:** Henrique (Setter)
**De:** Guilherme Augusto
**Assunto:** Boreal x Setter, proposta de piloto

Henrique, obrigado pela conversa de hoje. Achei muito valiosa, principalmente a leitura de que a maior alavanca de vocês não é cold outbound, e sim ter inteligência sobre quais setores e empresas estão mais quentes pra priorizar o esforço. Foi exatamente isso que tentamos construir. Segue o resumo e a proposta do piloto, pra você circular internamente.

## O que o Boreal entrega pra Setter
Um motor que lê o registro público de empresas (CNPJ) do Brasil inteiro e devolve, pro setor e praça que vocês escolherem:
- **Descoberta e priorização de alvos:** uma lista rankeada de empresas, cada uma com um dossiê pronto (sócios, contato, red flags, ângulo de abordagem). Economiza o tempo de garimpo manual.
- **Heat-map de setor e lente de consolidação:** quais setores e empresas estão no jogo de M&A agora, e quem são os consolidadores ativos. Útil tanto pra outbound quanto pra priorizar o inbound de vocês.
- **Sinal de sucessão onde ele se aplica:** em setores familiares clássicos, prevemos com alta precisão quem tende a vender. Em setores de consolidação (como saúde e tech), o valor é mais a descoberta e o heat-map do que a previsão de sucessão, e somos honestos sobre isso.

Resolve a brecha que Grata e PitchBook não cobrem: o mid-market brasileiro, onde o dado é fragmentado e essas ferramentas (US$12k a 25k por assento ao ano) nem entram.

## A prova
- Nas vendas por sucessão, o modelo já colocava a empresa no top 10% **12 meses antes** do negócio, com 97% a 100% de acerto (N=240, Brasil), sem espiar o desfecho.
- Geramos nosso próprio ground truth minerando as transições do CNPJ: 340 deals rotulados contra cerca de 5 que a imprensa rende.
- Cada sinal vem com a fonte. Nada de EBITDA fabricado.

## A proposta de piloto (1 mês)
- **Quem usa:** 2 originadores de vocês, em [A CONFIRMAR: 2 setores distintos, ex. saúde + um segundo].
- **Como:** eles usam o Boreal nos deals que já caçam; eu sento com o time uma vez por semana pra ajustar a ferramenta ao fluxo real de vocês. A modelagem é rápida, dá pra iterar dentro do mês.
- **Custo:** R$2.500 no mês, cobrindo o custo operacional. É desconto de piloto.
- **Critério de sucesso (proposta minha, aberto a ajuste):** ao fim do mês, o Boreal entregou a cada originador um punhado de alvos qualificados que eles não tinham no radar, e pelo menos 1 ou 2 viraram abordagem real. Como métrica de apoio, o tempo de achar e qualificar uma empresa cai de horas para minutos. Não amarro em "fechar deal", porque deal leva quase um ano.

## O que preciso de vocês pra começar
- Os 2 originadores: [A CONFIRMAR].
- Os 2 setores e a praça: [A CONFIRMAR] (eu deixo o universo deles carregado antes do dia 1).
- Data de início: [A CONFIRMAR].
- Cerca de 1h por semana do time, comigo, durante o mês.

## Se o piloto provar o valor
Evoluímos pra um modelo contínuo: retainer por assento mais um success fee modesto (na faixa de 10% do fee de vocês) sobre os deals que saírem das listas finais da plataforma, com o escopo dessas listas bem delimitado pra não te amarrar em nada fora delas. Aí sentamos pra desenhar pra firma inteira.

## Próximo passo
Você circula internamente e me retorna até dia 8. Se rolar alguma dúvida da equipe antes disso, é só me chamar que a gente resolve. Assim que vocês confirmarem os 2 setores, eu já começo a ingerir o universo deles pra ferramenta estar pronta no dia 1.

Qualquer coisa, à disposição.

Guilherme Augusto

---

## Faltam preencher antes de mandar (3 campos)
- [ ] Os 2 setores + praça (Henrique confirma internamente; se vier tech, manter o enquadramento honesto de "lá o valor é descoberta + heat-map, não score de sucessão")
- [ ] Os 2 nomes dos originadores
- [ ] Data de início
