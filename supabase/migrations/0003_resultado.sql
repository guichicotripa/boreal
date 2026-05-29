-- 0003_resultado.sql — outcome da oportunidade (ground truth do propensity score).
-- Ortogonal ao estágio: estágio = onde está no meu processo; resultado = o que o mundo
-- real devolveu depois de apresentar à boutique. É o feedback que realimenta o score
-- (Playbook Relay §11, score v2) — a base do moat.

alter table oportunidade
  add column if not exists resultado text not null default 'pendente';
  -- pendente | receptivo | nao_receptivo | deal_fechado | perdido

create index if not exists idx_oportunidade_resultado on oportunidade (resultado);
