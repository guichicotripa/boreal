# brain/ — o cérebro do Boreal

> Onde mora o porquê. O código diz o que o sistema faz; aqui fica **por que ficou assim, o que já
> foi medido e descartado, e o que está em aberto.**
>
> Regra que vale para qualquer agente e para mim: **toda conversa sobre Boreal atualiza esta
> pasta.** Responder no chat e não registrar é perder o trabalho.

---

## Por onde começar

| Se você quer... | Abra |
|---|---|
| Saber o que fazer agora | [`pending.md`](pending.md) |
| Entender por que algo ficou assim | [`decisions.md`](decisions.md), que tem índice por data |
| Saber o que já foi construído | [`progress.md`](progress.md), que tem índice por sessão |
| Entender o score | [`produto/modelo-de-score.md`](produto/modelo-de-score.md) |
| Ver o que foi mandado para o cliente | [`setter/`](setter/) |

---

## Os três da raiz são a espinha, e ficam aqui

Estes três **não se movem**: os comandos `/boreal` e `/salve` e o `CLAUDE.md` apontam para eles
pelo caminho. Mover quebra o fluxo de sessão.

| Arquivo | O que é | Como cresce |
|---|---|---|
| [`pending.md`](pending.md) | O que está aberto, **agrupado por tema** | Item novo entra no tema, nunca colado no fim |
| [`decisions.md`](decisions.md) | Uma entrada por decisão que muda escopo, stack, nome ou lógica | Append em ordem de data |
| [`progress.md`](progress.md) | Uma entrada por sessão de trabalho: o que foi feito, o que travou, o que se aprendeu | Append, nunca reescrito |

A diferença entre os três, que é fácil de confundir: **`decisions` guarda o porquê, `progress`
guarda a jornada, `pending` guarda a dívida.** Um fato que não é nenhum dos três provavelmente é
pesquisa, e vai em `pesquisa/`.

---

## As pastas

### [`produto/`](produto/) — como o sistema funciona e por quê

| Arquivo | O que é |
|---|---|
| [`modelo-de-score.md`](produto/modelo-de-score.md) | **O documento mais importante da pasta.** Como o score é calculado, o que foi medido, o que foi descartado por medição. Citado no `CLAUDE.md` como leitura obrigatória antes de mexer em scoring |
| [`fluxo-de-dados.excalidraw`](produto/fluxo-de-dados.excalidraw) | Mapa do caminho do dado, do BigQuery à tela |
| [`plano-produto-modelo.md`](produto/plano-produto-modelo.md) | Plano de produto de julho. **Histórico**, com aviso no topo |
| [`plano-ui-workbench.md`](produto/plano-ui-workbench.md) | Plano do redesign F1-F5, já executado. **Histórico** |
| [`roadmap-2026-27.md`](produto/roadmap-2026-27.md) | Sequenciamento de julho. **Histórico** |

### [`setter/`](setter/) — o cliente

Tudo que foi escrito para a Setter ou sobre a relação com ela. O que sai daqui em PDF vai para
`entregas/`, gerado por `scripts/md-para-pdf.py`.

| Arquivo | O que é | Estado |
|---|---|---|
| [`proposta-setter-b-c.md`](setter/proposta-setter-b-c.md) | **Documento de cliente.** Proposta de continuidade, opções B e C | Entregue 21/09 |
| [`lista-ja-compradas-setter.md`](setter/lista-ja-compradas-setter.md) | **Documento de cliente.** As 31 do pipeline com verificação de quem já tem dono | Entregue 21/09 |
| [`escopo-setter-b-c.md`](setter/escopo-setter-b-c.md) | Escopo completo com notas internas e roteiro de call. **Não é de cliente** | Interno |
| [`revisao-codex-escopo-b-c.md`](setter/revisao-codex-escopo-b-c.md) | Revisão do Codex sobre a v1 do escopo, na íntegra | Interno |
| [`semana-2026-09-14-a-21.md`](setter/semana-2026-09-14-a-21.md) | O que andou na semana da segunda call | Interno |
| [`onepager-setter-piloto.md`](setter/onepager-setter-piloto.md) | Proposta do piloto, de agosto | Histórico |

### [`pesquisa/`](pesquisa/) — investigação que não virou decisão ainda

| Arquivo | O que é |
|---|---|
| [`brainstorm-contato.md`](pesquisa/brainstorm-contato.md) | Tudo que dá para fazer em contato, com os números medidos na base de 65 mil em 21/09. Inclui ideias **descartadas com dado**, que é metade do valor |
| [`lgpd-contato.md`](pesquisa/lgpd-contato.md) | O que passa perto da linha no trabalho de contato, o que foi evitado de propósito e o que ficou aberto |
| [`roteiro-validacao.md`](pesquisa/roteiro-validacao.md) | Roteiro de validação de junho. **Histórico**, anterior à calibração |

### [`pitch/`](pitch/) — material de venda e concorrência

| Arquivo | O que é |
|---|---|
| [`pitch-mestre.md`](pitch/pitch-mestre.md) | Narrativa central. **Atenção:** cita números do universo inflado, ver `pending.md` §3 |
| [`referencia-site-fairplay.md`](pitch/referencia-site-fairplay.md) | Análise da Fairplay Capital, que é prospect e não ameaça. **Histórico** |
| [`submissao-clube.md`](pitch/submissao-clube.md) | Submissão do Clube da Programação. **Histórico**, reaproveitável como pitch |

---

## Convenções

**Documento de cliente vs documento interno.** Os dois convivem em `setter/`, e a tabela acima diz
qual é qual. Antes de mandar qualquer coisa, conferir: nota interna dentro de documento de cliente
é o erro mais caro desta pasta.

**Nada de número sem fonte.** Toda afirmação quantitativa carrega de onde veio e de quando é. Se o
número foi medido por um script, o nome do script vai junto.

**Resultado negativo vale tanto quanto positivo.** Ideia medida e descartada fica registrada com o
número que a matou, para ninguém tentar de novo. Exemplos: DDD contra UF diverge em só 3,1%; a
tabela `simples` no ingest piora o dev CV.

**Histórico não se apaga, se marca.** Documento vencido ganha aviso no topo dizendo de quando é e o
que mudou desde então. Apagar destrói o registro de como se chegou aqui.

---

*Reorganizado em 21/09/2026: de 20 arquivos soltos para quatro pastas temáticas mais os três da
raiz. O `pending.md` foi reagrupado por tema, e o `decisions.md` foi reordenado por data e ganhou
índice.*
