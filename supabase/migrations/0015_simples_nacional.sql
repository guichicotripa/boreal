-- 0015_simples_nacional.sql — o regime tributário entra na base, como FATO e como FILTRO.
--
-- ── Por que ────────────────────────────────────────────────────────────────────
-- O corte de porte que subiu em 24/08 usa `porte = DEMAIS` como proxy de faturamento acima de
-- R$ 4,8 milhões (LC 123/2006). Fernanda Arbage (Setter) apontou o furo em 26/08: empresa pode
-- estar em DEMAIS e ser optante pelo Simples, ou seja, faturar MENOS que o teto. Medido no dia:
-- 28% do universo qualificado do Foco A, 35% do Foco B, 13% do death care. Ela conferia isso
-- uma empresa por vez no CNPJ.biz.
--
-- ── Por que NÃO é scraping ─────────────────────────────────────────────────────
-- CNPJ.biz é revenda dos dados abertos da Receita. A mesma informação está em
-- `basedosdados.br_me_cnpj.simples`, que já usamos com a credencial que já existe. Raspar o site
-- seria uma página por CNPJ contra um lote, quebraria a cada mudança de HTML deles, e violaria os
-- termos de uso, tudo isso para chegar no mesmo dado.
--
-- ── ATENÇÃO: estes campos são PROIBIDOS no treino do score ─────────────────────
-- Decisão de 11/08/2026, com guarda que aborta `scripts/calibra-score.py`. A LC 123 proíbe sócio
-- PJ no Simples, e o rótulo de aquisição do nosso ground truth É "entra sócio PJ": toda adquirida
-- foi OBRIGADA a sair. A flag deu lift 0,00x com z=11,4, que é o desfecho disfarçado de sinal.
--
-- Filtrar a lista e mostrar o fato na tela são usos DIFERENTES e legítimos. Confundir os dois é
-- exatamente como o vazamento volta. Quem for mexer no ingest ou na extração de treino lê isto
-- antes: ver `scripts/check-vazamento-simples.mjs` para a prova.

alter table empresa add column if not exists opcao_simples          boolean;
alter table empresa add column if not exists data_exclusao_simples  date;

comment on column empresa.opcao_simples is
  'Optante pelo Simples Nacional hoje (fatura < R$ 4,8 MM/ano). NULL = nao verificado, diferente de false. PROIBIDO como feature de treino do score: ver 0015 e calibra-score.py.';
comment on column empresa.data_exclusao_simples is
  'Quando deixou o Simples. Duas causas OPOSTAS: estourou o teto de receita (cresceu, e alvo) ou entrou socio PJ, que a LC 123 proibe (foi adquirida). Sinal, nao prova de faturamento.';

/* Parcial e sobre `is not true`: a consulta da busca é sempre "tire os optantes", nunca "liste os
   optantes". NULL (não verificado) e false (não é optante) ficam do mesmo lado de propósito — o
   filtro degrada mostrando a empresa em vez de escondê-la, que é o lado certo de errar quando o
   dado ainda não chegou. */
create index if not exists idx_empresa_nao_simples
  on empresa (cnae_principal, porte, data_inicio_atividade)
  where opcao_simples is not true;
