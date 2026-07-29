-- 0013_evento_e_staff.sql — o loop de aprendizado, e quem é gente da casa.
--
-- ── Por que `evento` existe ───────────────────────────────────────────────────
-- NÃO é analytics de produto. É o sensor do loop auto-aprimorante do score.
--
-- O score v0 é heurística escrita por nós; o v1 soma sinais da web. Nenhum dos
-- dois aprende. O que ensina é a REVELAÇÃO DE PREFERÊNCIA do analista: a lista
-- ranqueada que mostramos contra o que ele efetivamente salvou e descartou. Se o
-- originador pula os 16 primeiros e salva o 17º, isso é o score errando, com
-- rótulo de graça e sem ninguém precisar anotar nada.
--
-- Por isso o payload de uma busca guarda o TOP RANQUEADO (id, score, posição), e
-- não só o texto da query. Sem a lista exibida, "ele pulou os dezesseis primeiros"
-- é irreconstruível depois — e diferente de quase tudo neste repo, isto NÃO pode
-- ser recomputado: dia não gravado é dia perdido.
--
-- Fecha o ciclo que o pipeline já começou: `oportunidade.score_no_save` guarda o
-- previsto e `resultado` guarda o real. O evento preenche o meio, que é o que
-- estava faltando (o que foi oferecido e recusado, não só o que foi aceito).

create table if not exists evento (
  id         bigserial primary key,
  org_id     uuid not null references org(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null,
  tipo       text not null,   -- busca | dossie | investigacao | salvou | descartou | estagio
  empresa_id uuid references empresa(id) on delete set null,
  payload    jsonb,
  criado_em  timestamptz not null default now()
);

create index if not exists idx_evento_org_tempo  on evento (org_id, criado_em desc);
create index if not exists idx_evento_tipo_tempo on evento (tipo, criado_em desc);
-- Parcial: as consultas de treino partem quase sempre de uma empresa concreta.
create index if not exists idx_evento_empresa    on evento (empresa_id, criado_em desc)
  where empresa_id is not null;

comment on table evento is
  'Sensor do loop de aprendizado do score (lista exibida × escolha do analista). Não recomputável: nunca truncar.';

-- ── Staff ─────────────────────────────────────────────────────────────────────
/* `membro.papel` existia desde a 0010 e NÃO era lido por lugar nenhum: todo mundo
   que entrava tinha exatamente o mesmo poder. Pior, quando `org_setor` da Setter
   fosse preenchida, quem opera o Boreal ficaria limitado ao contrato do cliente.

   O bypass vive AQUI, nas funções que as policies já chamam, e não em `if`
   espalhado por rota. Uma regra, um lugar: rota nova nasce com o comportamento
   certo sem ninguém lembrar de nada. */
create or replace function eh_staff() returns boolean
  language sql stable security definer set search_path = public
as $$ select exists (select 1 from membro where user_id = auth.uid() and papel = 'boreal') $$;

-- Staff ignora as três dimensões do contrato: null/vazio = sem restrição.
create or replace function regex_setores_da_org() returns text
  language sql stable security definer set search_path = public
as $$
  select case when eh_staff() or count(*) = 0 then null
              else '^(' || string_agg(p, '|') || ')' end
  from org_setor os
  join setor s on s.id = os.setor_id
  cross join unnest(s.prefixos) as p
  where os.org_id = org_do_usuario()
$$;

create or replace function ufs_da_org() returns text[]
  language sql stable security definer set search_path = public
as $$
  select case when eh_staff() then '{}'::text[]
              else coalesce(array_agg(uf), '{}') end
  from org_uf where org_id = org_do_usuario()
$$;

create or replace function tem_modulo(nome text) returns boolean
  language sql stable security definer set search_path = public
as $$
  select eh_staff() or exists (
    select 1 from org_modulo where org_id = org_do_usuario() and modulo = nome
  )
$$;

-- ── Staff enxerga através das orgs, mas só LENDO ──────────────────────────────
/* Policies são permissivas e se somam, então uma policy SÓ DE SELECT dá leitura
   cross-org sem tocar em escrita: as de `for all` continuam sendo as únicas que
   autorizam update e delete, e elas seguem presas ao próprio escopo.

   A distinção importa: staff precisa MONITORAR o piloto (e os testadores, que
   ficam em org separada), não editar o julgamento de um analista. Descarte
   alterado por fora seria contaminar justamente o dado que o loop usa. */
drop policy if exists "staff le tudo" on oportunidade;
create policy "staff le tudo" on oportunidade for select to authenticated using (eh_staff());

drop policy if exists "staff le tudo" on empresa_descartada;
create policy "staff le tudo" on empresa_descartada for select to authenticated using (eh_staff());

drop policy if exists "staff le tudo" on interacao;
create policy "staff le tudo" on interacao for select to authenticated using (eh_staff());

drop policy if exists "staff le tudo" on crm_incumbente;
create policy "staff le tudo" on crm_incumbente for select to authenticated using (eh_staff());

drop policy if exists "staff ve as orgs" on org;
create policy "staff ve as orgs" on org for select to authenticated using (eh_staff());

drop policy if exists "staff ve os membros" on membro;
create policy "staff ve os membros" on membro for select to authenticated using (eh_staff());

drop policy if exists "staff ve os contratos" on org_setor;
create policy "staff ve os contratos" on org_setor for select to authenticated using (eh_staff());
drop policy if exists "staff ve os contratos" on org_uf;
create policy "staff ve os contratos" on org_uf for select to authenticated using (eh_staff());
drop policy if exists "staff ve os contratos" on org_modulo;
create policy "staff ve os contratos" on org_modulo for select to authenticated using (eh_staff());

-- ── RLS de evento ─────────────────────────────────────────────────────────────
/* Qualquer sessão GRAVA no próprio escopo (é o app registrando o que aconteceu),
   mas só staff LÊ. Telemetria de uso de um cliente não é dado do cliente: expor
   pra ele o ranking que ele ignorou seria estranho, e pra outra firma seria
   vazamento. Sem update nem delete pra ninguém: log que dá pra editar não serve
   de evidência. */
alter table evento enable row level security;

drop policy if exists "grava no proprio escopo" on evento;
create policy "grava no proprio escopo" on evento
  for insert to authenticated with check (org_id = org_do_usuario());

drop policy if exists "staff le" on evento;
create policy "staff le" on evento for select to authenticated using (eh_staff());
