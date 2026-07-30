# Pending — Próximos Passos / Em Aberto

> O que falta fazer agora. Marcar `[x]` ao concluir. Mover concluídos pro `progress.md` no fim da sessão.
>
> **Auditado e reescrito em 30/07/2026.** O arquivo tinha 462 linhas e carregava uma era inteira já
> morta: Semanas 1 a 4, Demo Day, submissão do Loom (deadline 10/06) e as frentes do Maguto, que
> parou de trabalhar no Boreal depois do fim do Clube da Programação. Histórico completo em
> `progress.md` e no git; o que sobreviveu aqui é só o que continua aberto de verdade.

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

- [ ] **Os 2 setores + a praça do contrato.** Enquanto não vierem, `org_setor` da Setter está vazia
  e ela enxerga os 4 setores. Se vier tech, manter o enquadramento honesto de que lá o valor é
  descoberta e heat-map, não score de sucessão.
- [ ] **Importar a lista de CRM incumbente** em `crm_incumbente` (hoje vazia, então tudo marca
  "novo" e a métrica-manchete do piloto não pode ser computada).

---

## 🟡 Aberto, não bloqueia o piloto

### Score e dados

- [ ] **Nº de estabelecimentos como eixo.** Já medido: vale ~1,3pp de recall. Preso porque o ingest
  não traz contagem de filiais. É o ganho mais barato que existe hoje.
- [ ] **Proxy limpo de tamanho.** Capital social é declarado, nominal e frequentemente desatualizado
  desde a constituição, e mesmo assim é o eixo mais forte (3,80x). Empregados via RAIS/CAGED ou
  faturamento estimado deve bater isso.
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

- [ ] Fix de dados em `/validacao` · `hindcast.json`.
- [ ] Navegação `<a>` → `<Link>`, repo-wide.
- [ ] Aposentar o `dossier-cache.json`.
- [ ] Busca em 3,3s em produção (mediana, warm). O gargalo medido é a query mais o scoring, não a
  chamada de LLM.

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
