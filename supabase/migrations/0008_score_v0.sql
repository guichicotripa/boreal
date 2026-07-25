-- SCORE v0 PERSISTIDO — para a busca ORDENAR no banco antes de cortar em 50.
--
-- O defeito que isto conserta: /api/search fazia `.limit(50)` SEM `order by`, e só
-- depois pontuava e ordenava essas 50 linhas em JS. O resultado era 50 empresas
-- arbitrárias ranqueadas entre si e apresentadas como shortlist priorizada.
--
-- Ficava invisível porque o ingest antigo (`ORDER BY max_faixa_etaria DESC LIMIT 2000`)
-- já entregava só a cauda extrema: qualquer 50 daquelas 2.000 pareciam boas — a
-- ordenação real morava no ingest, não na query. Ao ampliar a cobertura para o
-- universo quente (saúde 2.000 → 34.599), o disfarce caiu: medido em 25/07/2026,
-- ZERO das 50 empresas devolvidas em saúde estavam no top-50 real do setor
-- (score médio 50,6 contra 100).
--
-- score_v0 é função determinística de dados já gravados (faixa etária dos sócios,
-- data de abertura, porte, nº de sócios PF), então pode ser materializado. Quem
-- calcula é `scripts/backfill-score-v0.ts`, que importa a MESMA `calcScore` de
-- src/lib/scoring.ts — sem réplica da regra, que é como as duas versões divergem.
--
-- ACOPLAMENTO: todo ingest que mexe em empresa/socio precisa rodar o backfill
-- depois, senão a linha nova entra com score_v0 NULL e afunda no fim da ordenação.

alter table empresa add column if not exists score_v0 smallint;

comment on column empresa.score_v0 is
  'Score heurístico v0 materializado (0-100), calculado por scripts/backfill-score-v0.ts '
  'a partir de src/lib/scoring.ts. Existe para a busca ordenar no banco antes do LIMIT. '
  'NULL = ainda não calculado (empresa recém-ingerida).';

-- Ordenação desc com NULLS LAST casa com o que o PostgREST emite
-- (order=score_v0.desc.nullslast), então o índice cobre a ordenação da busca.
create index if not exists idx_empresa_score_v0
  on empresa (score_v0 desc nulls last);

-- A busca quase sempre filtra CNAE por prefixo E ordena por score. O índice
-- composto evita varrer o setor inteiro só para ordenar.
create index if not exists idx_empresa_cnae_score
  on empresa (cnae_principal, score_v0 desc nulls last);
