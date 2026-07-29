-- 0010_org_membro.sql — multi-tenant de verdade, parte 1: quem é quem.
--
-- Até aqui `escopo_id` existia mas era decorativo: `escopoAtual()` devolvia sempre
-- a mesma constante e o gate era senha única compartilhada, então todo mundo que
-- entrava era indistinguível e todo escopo era o mesmo escopo. Esta migration cria
-- a identidade que faltava; a 0011 liga as policies que a usam.
--
-- ESCOPO = FIRMA, não pessoa (decisão de 28/07/2026). A boutique inteira enxerga a
-- mesma triagem: dois originadores da mesma firma ligando para o mesmo fundador é
-- um vexame real, e `novo_para_setter`, que mede o piloto, é métrica de firma. Cada
-- linha registra QUEM agiu (`autor`, `dono`), então atribuição não se perde. Se um
-- dia a semântica virar por-pessoa, muda o valor gravado em escopo_id, não a forma.

-- ── org: a firma cliente ──────────────────────────────────────────────────────
create table if not exists org (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  slug       text not null unique,
  created_at timestamptz not null default now()
);

/* A Setter recebe o UUID nulo de propósito: era o valor de ESCOPO_PADRAO, então
   TODA linha escopada que já existe no banco (descartes, oportunidades) já aponta
   pra cá. Sem backfill, sem update em massa, sem risco de deixar linha órfã num
   escopo que ninguém enxerga. O próximo cliente ganha uuid gerado normalmente. */
insert into org (id, nome, slug)
values ('00000000-0000-0000-0000-000000000000', 'Setter', 'setter')
on conflict (id) do nothing;

-- ── membro: usuário do Supabase Auth ↔ org ────────────────────────────────────
-- Um usuário pertence a uma org só. Multi-org por pessoa é YAGNI: nenhum
-- originador trabalha em duas boutiques ao mesmo tempo.
create table if not exists membro (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  org_id     uuid not null references org(id) on delete cascade,
  nome       text,
  papel      text not null default 'originador',  -- originador | admin
  created_at timestamptz not null default now()
);
create index if not exists idx_membro_org on membro (org_id);

/* Org de quem está pedindo, para as policies da 0011.
   SECURITY DEFINER é obrigatório aqui: a policy de `membro` vai chamar esta
   função, e se ela lesse `membro` sob RLS o Postgres entraria em recursão
   infinita. `search_path` fixo porque SECURITY DEFINER sem isso é vetor de
   escalação de privilégio (função resolve tabela de um schema plantado). */
create or replace function org_do_usuario() returns uuid
  language sql stable security definer set search_path = public
as $$ select org_id from membro where user_id = auth.uid() $$;

-- ── escopo nas tabelas que ainda não tinham ───────────────────────────────────

/* crm_incumbente é o export do CRM do parceiro: o ativo mais sensível que um
   cliente entrega, e até agora era uma tabela GLOBAL. O segundo cliente enxergaria
   a carteira do primeiro. A PK vira composta porque o mesmo CNPJ pode estar no CRM
   de duas boutigas diferentes, e cada uma só pode ver o seu. */
alter table crm_incumbente
  add column if not exists escopo_id uuid not null
    default '00000000-0000-0000-0000-000000000000' references org(id) on delete cascade;
alter table crm_incumbente drop constraint if exists crm_incumbente_pkey;
alter table crm_incumbente add primary key (escopo_id, cnpj);

/* oportunidade: além da coluna, o unique precisa mudar. `unique (empresa_id)`
   dizia "uma empresa entra na watchlist uma vez só" — verdade com um cliente,
   bloqueio absurdo com dois: a segunda boutique não conseguiria acompanhar uma
   empresa só porque a primeira já acompanha. */
alter table oportunidade
  add column if not exists escopo_id uuid not null
    default '00000000-0000-0000-0000-000000000000' references org(id) on delete cascade;
alter table oportunidade drop constraint if exists oportunidade_empresa_id_key;
alter table oportunidade add constraint oportunidade_escopo_empresa_key unique (escopo_id, empresa_id);
create index if not exists idx_oportunidade_escopo on oportunidade (escopo_id, updated_at desc);

/* interacao NÃO ganha escopo_id de propósito: ela já pertence a uma oportunidade,
   que tem escopo. Copiar o valor criaria duas fontes para o mesmo fato, e a cópia
   ia divergir do pai em algum update (é o mesmo motivo de o delta do v1 ser
   recalculado em vez de lido congelado). A policy da 0011 lê o escopo pelo join. */

comment on column crm_incumbente.escopo_id is
  'Org dona deste CRM. Dado privado do cliente: nunca cruza escopo.';
comment on column oportunidade.escopo_id is
  'Org dona desta oportunidade. Escopo = firma, não pessoa (ver 0010).';
