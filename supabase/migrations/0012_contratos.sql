-- 0012_contratos.sql — o que cada firma pode ver.
--
-- Até aqui, qualquer pessoa logada lia as 51.033 empresas dos quatro setores. Um
-- cliente que contratou dois setores levava a base inteira.
--
-- TRÊS DIMENSÕES INDEPENDENTES, cada uma opcional. Lista VAZIA numa dimensão
-- significa "sem restrição nela". É isso que dá os três tipos de contrato sem
-- inventar um campo `tipo_de_contrato`, que envelheceria no dia em que aparecesse
-- o quarto tipo:
--
--   só setor   → org_setor preenchida, org_uf vazia
--   só praça   → org_setor vazia,      org_uf preenchida
--   setor+praça→ as duas preenchidas
--
-- org_modulo é ortogonal às outras duas: não filtra DADO, libera SUPERFÍCIE
-- (o heat-map é inteligência de mercado cross-setor, vendida à parte).

-- ── setor: o registry materializado ───────────────────────────────────────────
/* A regra de "que CNAE é esse setor" vive em src/lib/setores.json, e o Postgres
   não lê JSON do bundle. Materializar é o mesmo movimento do score_v0, que virou
   coluna justamente pra o banco conseguir ordenar antes de cortar.

   Cópia sem guarda é drift, então NÃO é para editar esta tabela à mão:
   `scripts/sync-setores.ts` a reescreve a partir do registry, e
   `setores-sync.test.ts` falha se as duas divergirem. */
create table if not exists setor (
  id        text primary key,
  nome      text not null,
  prefixos  text[] not null
);
comment on table setor is
  'Espelho de src/lib/setores.json para uso em RLS. Alimentada por scripts/sync-setores.ts — não editar à mão.';

-- ── as três dimensões do contrato ─────────────────────────────────────────────
create table if not exists org_setor (
  org_id   uuid not null references org(id) on delete cascade,
  setor_id text not null references setor(id) on delete restrict,
  primary key (org_id, setor_id)
);

create table if not exists org_uf (
  org_id uuid not null references org(id) on delete cascade,
  uf     char(2) not null,
  primary key (org_id, uf)
);

create table if not exists org_modulo (
  org_id uuid not null references org(id) on delete cascade,
  modulo text not null,            -- 'heatmap'
  primary key (org_id, modulo)
);

-- ── as permissões, em forma que a policy consegue usar ────────────────────────
/* SECURITY DEFINER pelo mesmo motivo de org_do_usuario(): estas funções são
   chamadas de dentro de policies e leem tabelas que também têm policy. Sem isso,
   recursão. search_path fixo porque SECURITY DEFINER sem ele é escalação de
   privilégio esperando acontecer. */
create or replace function prefixos_da_org() returns text[]
  language sql stable security definer set search_path = public
as $$
  select coalesce(array_agg(p), '{}')
  from org_setor os
  join setor s on s.id = os.setor_id
  cross join unnest(s.prefixos) as p
  where os.org_id = org_do_usuario()
$$;

create or replace function ufs_da_org() returns text[]
  language sql stable security definer set search_path = public
as $$
  select coalesce(array_agg(uf), '{}') from org_uf where org_id = org_do_usuario()
$$;

create or replace function tem_modulo(nome text) returns boolean
  language sql stable security definer set search_path = public
as $$ select exists (select 1 from org_modulo where org_id = org_do_usuario() and modulo = nome) $$;

-- ── a regra, num lugar só ─────────────────────────────────────────────────────
/* Só `empresa` carrega a regra de setor e praça. socio, empresa_memo e score_run
   derivam dela com um EXISTS contra empresa — que já vem filtrada pela policy
   acima, porque RLS vale também dentro de subquery. Uma fonte, sem a mesma regra
   escrita em quatro lugares para divergir depois.

   `(select fn())` em vez de `fn()`: assim o Postgres avalia como InitPlan, UMA
   vez por query, em vez de uma vez por linha em 51 mil linhas. */
drop policy if exists "leitura autenticada" on empresa;
create policy "setor e praca do contrato" on empresa
  for select to authenticated
  using (
    (cardinality((select prefixos_da_org())) = 0
      or exists (select 1 from unnest((select prefixos_da_org())) p
                 where empresa.cnae_principal like p || '%'))
    and
    (cardinality((select ufs_da_org())) = 0 or empresa.uf = any((select ufs_da_org())))
  );

drop policy if exists "leitura autenticada" on socio;
create policy "so de empresa visivel" on socio
  for select to authenticated
  using (exists (select 1 from empresa e where e.id = socio.empresa_id));

drop policy if exists "leitura autenticada" on empresa_memo;
create policy "so de empresa visivel" on empresa_memo
  for select to authenticated
  using (exists (select 1 from empresa e where e.id = empresa_memo.empresa_id));

drop policy if exists "leitura autenticada" on score_run;
create policy "so de empresa visivel" on score_run
  for select to authenticated
  using (exists (select 1 from empresa e where e.id = score_run.empresa_id));

-- ── leitura das próprias permissões ───────────────────────────────────────────
-- A aplicação precisa SABER o contrato pra explicar ("esse setor não está no seu
-- contrato") em vez de devolver lista vazia parecendo defeito.
alter table setor      enable row level security;
alter table org_setor  enable row level security;
alter table org_uf     enable row level security;
alter table org_modulo enable row level security;

create policy "leitura autenticada" on setor for select to authenticated using (true);
create policy "o proprio contrato" on org_setor
  for select to authenticated using (org_id = org_do_usuario());
create policy "o proprio contrato" on org_uf
  for select to authenticated using (org_id = org_do_usuario());
create policy "o proprio contrato" on org_modulo
  for select to authenticated using (org_id = org_do_usuario());

-- Escrita só pela service_role: contrato é ato comercial, não self-service.

-- ── Setter ────────────────────────────────────────────────────────────────────
/* Heat-map LIGADO pra Setter: o onepager do piloto vende "heat-map de setor e
   lente de consolidação" como entrega. O mecanismo existe pro próximo cliente;
   a Setter não pode perder o que já foi prometido por escrito.

   org_setor e org_uf ficam VAZIAS de propósito = a Setter vê tudo por enquanto.
   Só dá pra preencher quando o Henrique confirmar os 2 setores e a praça. */
insert into org_modulo (org_id, modulo)
values ('00000000-0000-0000-0000-000000000000', 'heatmap')
on conflict do nothing;
