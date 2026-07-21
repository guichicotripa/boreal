# Roadmap de building + validação — ago/2026 → ago/2027 (e além)

> Criado: 2026-07-20, pós-reestruturação (solo) e pós-análise SoM&A. Substitui o sequenciamento
> do plano 06/07 incorporando: **lado comprador como demanda estruturada** (o nugget da SoM&A),
> caminho de indicação, snapshots mensais, selo multi-parceiro — tudo dimensionado pra UMA
> pessoa operando com SAT até 23/08 e aplicação até nov/26, e com o decision point de ago/2027
> como restrição de design (a máquina precisa rodar sem mim crescentemente).
>
> **Objetivo-fim:** destravar o middle/lower market familiar BR — virar a infraestrutura de
> originação que faz deals de R$10-50M acontecerem onde hoje não acontece nenhum.
>
> Regra de ouro do roadmap: **cada fase tem um GATE de validação com número.** Não se avança
> por vontade, avança por dado. (Disciplina Phase 0 de sempre.)

---

## Fase 0 — Pré-operação (AGORA → início de agosto)

Esforço: mínimo (SAT é prioridade até 23/08). Só o que destrava o dia 1 do piloto.

**Fazer:**
- [ ] PJ solo (LTDA unipessoal) constituída.
- [ ] Minuta Setter revisada e assinada (R$2.000 é único ou recorrente? exclusividade? duração?
      selo/atribuição contemplado — hash ou janela de contestação?).
- [ ] Confirmar os 2 setores do piloto com o Henrique e **ingerir o universo deles** no Supabase.
- [ ] **Registrar os primeiros mandatos de compra** (item novo, via SoM&A): perguntar ao
      Henrique quais teses de COMPRA a Setter tem na mesa (setor, ticket, região, perfil).
      Formato inicial: uma tabela simples. Custo ~zero, muda a Fase 1 inteira.

**Gate 0:** contrato assinado + universo dos 2 setores buscável + ≥2 mandatos de compra
registrados. Sem isso o piloto não começa direito.

---

## Fase 1 — Piloto Setter (agosto → outubro/26): PROVAR CONVERSÃO

A fase mais importante do projeto. Tudo que ela produz é dado de funil que hoje não existe.

**Operação (o loop semanal):**
1. Originar lista curada por setor do piloto (score + perfil sucessório + dossiê + gatilho).
2. **Matching reverso contra mandatos de compra** (novo): lead entregue já casado com
   comprador em tese ("esta empresa serve ao mandato X") — originação com comprador na mão
   converte mais que lista solta. É a inversão do modelo SoM&A a nosso favor.
3. Originadores da Setter abordam (humano, deles). Cada toque → pipeline (loop de outcome).
4. Selar TODA entrega (selo = direito ao 0,5% garantido desde o dia 1).

**Build (só o que serve à operação):**
- [ ] Importar CRM incumbente da Setter (`crm_incumbente`) — ativa o selo de verdade.
- [ ] Loop de outcome alimentado com desfechos reais (contatado→respondeu→reunião→mandato).
- [ ] Monitor forward como worker periódico sobre o pipeline (gatilho de abordagem).
- [ ] Tabela de mandatos de compra + matching reverso v0 (pode ser query manual — YAGNI em UI).
- [ ] **Snapshot mensal do CNPJ inicia AGORA** (rotina; cada mês acumulado é moat que não
      volta atrás — independe do piloto dar certo).

**Métricas a MEDIR (substituem as premissas da conta financeira):**
- Custo por conversa qualificada (nossa) vs processo manual da Setter (a métrica-contrato).
- Funil: leads entregues → aceitos pelos originadores → conversas → reuniões → mandatos.
- % de leads "novos pro CRM deles" (prova de valor da descoberta).
- Tempo de resposta do dono por canal (telefone vs email vs indicação).

**Gate 1 (fim de out/26):** (a) Setter renova em formato pago recorrente (retainer R$5k+), e
(b) funil medido com ≥1 mandato assinado OU pipeline de conversas que justifique projeção.
**Se falhar:** não é morte — é diagnóstico. Voltar com o dado: o problema foi lead (score),
abordagem (deles) ou timing (ciclo)? Decidir pivô de canal (outra boutique, search funds,
consolidadores diretos) COM o funil medido na mão.

---

## Fase 2 — Produtizar demanda + 2º e 3º parceiro (nov/26 → fev/27)

Pré-condição: Gate 1 passado. Aplicação de faculdade domina até nov/1 — dimensionar de acordo.

**Comercial:**
- [ ] Fechar parceiro 2 e 3 (boutiques/fundos em vertical-região que não canibalizam a Setter;
      candidatos naturais: rede BRHSIC — Vinci, Lazuli —, contatos das calls de validação).
      Pitch com o dado do piloto (pitch-mestre.md + funil medido).
- [ ] 1-2 relatórios setoriais vendidos (R$20-40k) como caixa-ponte.

**Build:**
- [ ] **Registro de mandatos de compradores v1** (a feature SoM&A-derived vira produto):
      boutiques e compradores diretos registram teses; matching reverso automático; alerta
      quando empresa nova casa com mandato. O dado de demanda também vira insumo de
      priorização (originar onde há pressão compradora).
- [ ] **Grafo societário v1** (sócios em comum, grupos econômicos — sai do dado que já temos).
- [ ] Selo multi-parceiro (hash de CNPJs + janela de contestação no contrato-padrão).
- [ ] Multi-tenant MÍNIMO quando o parceiro 2 assinar (gatilho definido na revisão de
      anti-drifts — não antes).

**Gate 2 (fev/27):** ≥2 parceiros pagando retainer ≥ R$5k/mês (receita recorrente > custo de
servir por >10x) + ≥3 mandatos ativos no pipeline agregado.

---

## Fase 3 — Caminho de indicação + máquina autônoma (mar → jul/27)

O tema desta fase é duplo: a feature de maior valor + preparar ago/2027.

**Build:**
- [ ] **Caminho de indicação** (grafo societário + rede importada dos parceiros): "quem te
      leva até este dono". A feature que o Taylor descreveu e a Setter admitiu não ter — agora
      com 2-3 redes de parceiros como insumo.
- [ ] Automação da operação: ingest, snapshot-diff, alertas do monitor, relatório mensal do
      parceiro — tudo sem toque manual. **Teste explícito: a semana roda sem mim?**
- [ ] DataJud/CNJ (inventário/disputa societária) como fonte de gatilho — a essa altura o
      pipeline justifica o esforço.

**Gate 3 (jul/27) = DECISION POINT (coincide com faculdade, de propósito):** com 11 meses de
dado real, escolher entre:
- **(A) Escalar** — funil provado, receita recorrente ≥ R$25-30k/mês: buscar capital/sócio
  operador OU NewCo whitelabel com parceiro estabelecido.
- **(B) Modo máquina** — receita menor mas positiva e operação automatizada: manter rodando
  da faculdade (retainers + fees pingando), decidir de novo em 2028.
- **(C) Encerrar/vender** — funil reprovado: o ativo (dados, ground truth, código) tem valor
  de venda pra Neoway/SoM&A/boutique; sair com aprendizado e caixa, sem zumbi.

---

## Fase 4 — pós-ago/27 (esboço, decidido pelo Gate 3)

Rota A: 5+ parceiros, LatAm em análise (registry-agnostic já pronto), NewCo pra capturar fee
cheio. Rota B: manutenção + snapshots acumulando (o moat cresce sozinho enquanto decido).

---

# A CONTA: quanto destravamos em deal e quanto faturamos

> **Toda a conta é [estimativa] com premissas à mostra.** Não temos funil medido (zero deals
> fechados até hoje) — os ranges vêm de: ciclo de deal 9-15 meses (playbook + Henrique),
> ticket-alvo R$10-50M (tese), fees contratados (Setter: 0,5% + R$2k), custo de servir medido
> (~R$300-560/mês/parceiro), e taxas de conversão CHUTADAS conservadoramente. O piloto existe
> pra substituir cada chute por número. Revisar esta página quando o Gate 1 fechar.

## Premissas do funil (por parceiro ativo, por ano)

| Etapa | Taxa assumida | Resultado |
|---|---|---|
| Leads curados entregues | 10-15/mês | ~120-180/ano |
| Lead → conversa com dono | 15% (com gatilho + indicação; frio seria <5%) | ~20-27 conversas |
| Conversa → mandato de venda | 15% | **~3-4 mandatos/ano** |
| Mandato → closing | 40% em 9-15 meses | **~1,3-1,6 deals fechados/ano** (defasados) |
| Ticket médio | R$18M (meio da faixa 10-50, puxado pra baixo) | — |

Sanidade externa: OffDeal, com US$17M e time inteiro, lançou ~30 mandatos em ~2 anos.
Uma pessoa + 3 boutiques gerando 8-12 mandatos/ano agregados é agressivo mas plausível.

## Três cenários (horizonte: ago/26 → dez/27, caixa quando ENTRA, não quando assina)

**CONSERVADOR — só a Setter, piloto morno (probabilidade real: ~35%)**
- Receita 2026-27: R$2k (piloto) + retainer R$5k×6-10m se renovar + 0-1 closing tardio.
- **Faturamento: R$30-100k. Deal destravado: R$0-18M.**
- Valor real do cenário: funil medido + snapshots acumulados + aprendizado de canal. Não é
  fracasso, é o custo da informação.

**BASE — Gate 1 e 2 passam, 3 parceiros, 2 closings até dez/27 (~45%)**
- Retainers: Setter R$5k (a partir de nov) + P2 R$8k (dez) + P3 R$8k (mar) ≈ **R$180-220k**
  no período.
- Relatórios setoriais: 2 × R$25k = **R$50k**.
- Success fees: 6-9 mandatos agregados em 2027 → 2 closings até dez/27 (ciclo joga o resto
  pra 2028) × R$18M × 0,5% = **R$180k**.
- **Faturamento no período: ~R$400-450k · Deal destravado: ~R$36M (+ pipeline de 4-7 mandatos
  vivos que fecham em 2028 = R$70-130M contratados a caminho).**
- Custo de operar: servidor+APIs+dados ≈ R$15-25k/ano → margem >90% (o burn é meu tempo).

**OTIMISTA — 5 parceiros, funil converte no topo das premissas (~20%)**
- Retainers 5 × R$10k médio × ~10m = R$500k + relatórios R$75k + 4 closings × R$20M × 0,5%
  = R$400k.
- **Faturamento: ~R$1M · Deal destravado: ~R$80M (+R$150-250M em mandatos vivos).**

## Regime estabilizado (2028+, se rota A) — e o teto que a conta revela

- 5 boutiques × ~2 closings/ano = **10-12 deals/ano × R$20M = R$200-250M/ano destravados**.
- Nossa captura: retainers ~R$600k + fees ~R$1-1,2M ≈ **R$1,6-1,8M/ano**, margem altíssima.
- **O teto honesto do modelo originador: ~R$3-4M/ano** (bate exatamente com o diagnóstico de
  31/05 que motivou a virada de tese). A conta MOSTRA a alavanca: os mesmos 10-12 deals com
  fee de advisory cheio (3-4%, via NewCo whitelabel) = **R$7-10M/ano** — sem originar um deal
  a mais, só capturando mais de cada um. É por isso que o Gate 3 rota A leva pra NewCo.
- E o "destravar o mercado" em perspectiva: 10-12 deals/ano de middle market familiar que hoje
  NÃO acontecem, num país que registra 1.581 transações totais [fonte: KPMG], é adicionar
  ~0,7% ao mercado nacional inteiro operando de um laptop. Em regime maduro (20-30 boutiques,
  LatAm), o destravável é R$0,5-1bi/ano em transações — esse é o número de visão pro pitch,
  sempre apresentado como visão, não projeção.

## Os 3 números que mais mexem a conta (sensibilidade)

1. **Conversa → mandato (15% chutado):** se for 5%, o base vira o conservador; se for 25%,
   vira o otimista. É O número que o piloto precisa medir.
2. **Ticket médio (R$18M):** cada R$5M pra cima = +28% em todos os fees.
3. **Retainer médio (R$5-10k):** é o que paga a conta ENQUANTO os fees não chegam (ciclo de
   9-15 meses significa: caixa de fee de 2026 quase não existe; 2027 é o ano do retainer,
   2028 é o ano do fee).

---

*Ver também: `pitch-mestre.md` (domínio de mercado) · `plano-produto-modelo.md` (produto/moat)
· `decisions.md` [2026-07-20] (reestruturação + anti-drifts).*
