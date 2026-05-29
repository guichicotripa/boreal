-- 0002_oportunidade.sql — pipeline de curadoria de oportunidades.
-- Estágio 6-7 do funil de origination do Relay (Playbook §14): o operador salva, qualifica
-- e decide quais empresas apresentar a uma boutique. Base do loop de outcomes (o moat).
-- Domínio em português (dados brasileiros; não traduzir).

create table if not exists oportunidade (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresa(id) on delete cascade,
  estagio     text not null default 'a_analisar',  -- a_analisar | qualificada | apresentada | descartada
  notas       text,                                -- anotações do analista (por que segue / por que parou)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (empresa_id)                              -- uma empresa entra na watchlist uma vez só
);

create index if not exists idx_oportunidade_estagio on oportunidade (estagio);

-- RLS habilitada sem policy pública: acesso só via server (service role). Mesmo padrão das demais.
alter table oportunidade enable row level security;
