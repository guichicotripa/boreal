-- 0001_init_schema.sql — Boreal initial schema
-- Succession-risk deal sourcing: empresa (company), socio (partner), score_run (scoring result).
-- Domain names in Portuguese on purpose (data is Brazilian; do not translate).

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ── empresa ─────────────────────────────────────────────────────────────────
create table if not exists empresa (
  id                    uuid primary key default gen_random_uuid(),
  cnpj                  text not null unique,            -- 14 digits, no mask
  razao_social          text not null,
  nome_fantasia         text,
  cnae_principal        text,                            -- code, e.g. "2511" (esquadrias de metal)
  cnae_principal_desc   text,
  cnaes_secundarios     jsonb,                           -- array of {codigo, descricao}
  natureza_juridica     text,
  capital_social        numeric,
  porte                 text,                            -- ME / EPP / DEMAIS
  situacao_cadastral    text,                            -- ATIVA / BAIXADA / ...
  data_inicio_atividade date,                            -- company age signal
  municipio             text,
  uf                    text,
  site                  text,                            -- enriched later (LLM/scrape)
  telefone              text,
  email                 text,
  raw                   jsonb,                           -- full source payload for reprocessing
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_empresa_cnae          on empresa (cnae_principal);
create index if not exists idx_empresa_uf_municipio   on empresa (uf, municipio);

-- ── socio ───────────────────────────────────────────────────────────────────
create table if not exists socio (
  id                     uuid primary key default gen_random_uuid(),
  empresa_id             uuid not null references empresa(id) on delete cascade,
  nome                   text not null,
  cpf_cnpj_mascarado     text,                           -- Receita masks it (***123456**)
  qualificacao           text,                           -- e.g. "Sócio-Administrador"
  faixa_etaria           text,                           -- Receita gives a bracket, not exact age
  data_entrada_sociedade date,
  created_at             timestamptz not null default now()
);

create index if not exists idx_socio_empresa on socio (empresa_id);

-- ── score_run ─────────────────────────────────────────────────────────────────
-- One row per scoring pass. Kept separate from empresa so we keep history as the
-- heuristic evolves and can score the same company under different queries.
create table if not exists score_run (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresa(id) on delete cascade,
  score       int not null check (score between 0 and 100),
  breakdown   jsonb,                                     -- subscores: idade_socios, tempo_empresa, ...
  sinais      jsonb,                                     -- human-readable signals array
  query_text  text,                                      -- the NL query that triggered this run
  model       text,                                      -- LLM/version, if LLM-assisted
  created_at  timestamptz not null default now()
);

create index if not exists idx_score_run_empresa on score_run (empresa_id);
create index if not exists idx_score_run_score    on score_run (score desc);

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Enable RLS with no public policies: anon cannot read/write. All access goes
-- through the server (service role bypasses RLS) via API routes. Secure default.
alter table empresa   enable row level security;
alter table socio     enable row level security;
alter table score_run enable row level security;
