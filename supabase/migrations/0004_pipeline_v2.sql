-- 0004_pipeline_v2.sql — pipeline de originação v2.
-- Três coisas: (1) funil real de origination + campos operacionais (DRI, próxima ação);
-- (2) snapshot do score no momento do save = o "previsto" do loop de outcome (o moat);
-- (3) log de interações (toques) — relationship intelligence, manual-first.
-- Domínio em português (dados brasileiros; não traduzir).

-- ── 1. oportunidade: funil novo + operacional + snapshot do score ──────────────
alter table oportunidade
  add column if not exists dono            text,   -- DRI: quem é responsável por esta oportunidade
  add column if not exists proxima_acao    text,   -- próximo passo concreto
  add column if not exists proxima_acao_em date,   -- quando
  add column if not exists score_no_save   int;    -- score de propensão quando salvou = "previsto" do loop

-- migra os 4 estágios antigos pro funil de originação de 6 estágios
update oportunidade set estagio = case estagio
  when 'a_analisar'  then 'identificado'
  when 'qualificada' then 'qualificado'
  when 'apresentada' then 'entregue'
  when 'descartada'  then 'arquivado'
  else estagio
end
where estagio in ('a_analisar', 'qualificada', 'apresentada', 'descartada');

alter table oportunidade alter column estagio set default 'identificado';
-- novos valores: identificado | abordado | em_conversa | qualificado | entregue | arquivado

-- ── 2. interacao: log de toques (ligação/email/reunião/nota) ───────────────────
create table if not exists interacao (
  id              uuid primary key default gen_random_uuid(),
  oportunidade_id uuid not null references oportunidade(id) on delete cascade,
  tipo            text not null default 'nota',   -- ligacao | email | reuniao | whatsapp | nota
  descricao       text not null,
  autor           text,
  criado_em       timestamptz not null default now()
);

create index if not exists idx_interacao_oportunidade on interacao (oportunidade_id, criado_em desc);

-- RLS habilitada sem policy pública: acesso só via server (service role). Mesmo padrão das demais.
alter table interacao enable row level security;
