-- 0011_rls_policies.sql — multi-tenant de verdade, parte 2: o banco passa a recusar.
--
-- A RLS já estava LIGADA em todas estas tabelas desde a 0001, mas SEM POLICY
-- nenhuma. Isso não protegia nada: significava apenas que ninguém além da
-- service_role conseguia ler, e como as 11 rotas usavam a service_role (que ignora
-- RLS por definição), o isolamento era zero. Policy sem trocar o cliente não isola,
-- e trocar o cliente sem policy derruba o app. As duas coisas andam juntas.
--
-- Duas famílias de tabela, tratadas de forma diferente de propósito:
--
--   GLOBAIS  — empresa, socio, empresa_memo, score_run. Derivadas do registro
--              público do CNPJ: o mesmo dado serve qualquer cliente e é justamente
--              onde está a economia de escala entre eles. Leitura liberada pra
--              qualquer autenticado; escrita só pela service_role (pipeline).
--
--   ESCOPADAS — oportunidade, interacao, empresa_descartada, crm_incumbente. É o
--              trabalho e o julgamento da firma. Nunca cruza escopo, nem lendo.

-- ── globais: leitura pra quem está autenticado, escrita só pelo pipeline ───────
-- Sem policy de insert/update/delete: o Postgres nega por omissão. A ingestão e os
-- lotes rodam com service_role, que passa por cima da RLS e continua funcionando.
create policy "leitura autenticada" on empresa
  for select to authenticated using (true);
create policy "leitura autenticada" on socio
  for select to authenticated using (true);
create policy "leitura autenticada" on empresa_memo
  for select to authenticated using (true);
create policy "leitura autenticada" on score_run
  for select to authenticated using (true);

-- ── identidade ────────────────────────────────────────────────────────────────
-- RLS precisa ser LIGADA nestas duas: as tabelas nasceram na 0010 e, sem isto, as
-- policies abaixo não valeriam nada (policy só é avaliada com RLS ativa).
alter table org    enable row level security;
alter table membro enable row level security;

-- O usuário enxerga a própria org e os colegas dela. `org_do_usuario()` é
-- SECURITY DEFINER (ver 0010), então ler `membro` aqui não recorre na própria policy.
create policy "vê a própria org" on org
  for select to authenticated using (id = org_do_usuario());
create policy "vê os colegas de org" on membro
  for select to authenticated using (org_id = org_do_usuario());

-- ── escopadas: tudo pela org, inclusive escrita ───────────────────────────────
-- `with check` além de `using`: sem ele o usuário lê só o próprio escopo mas
-- consegue GRAVAR com escopo_id de outra org. É o furo clássico de RLS.
create policy "escopo da org" on oportunidade
  for all to authenticated
  using (escopo_id = org_do_usuario())
  with check (escopo_id = org_do_usuario());

create policy "escopo da org" on empresa_descartada
  for all to authenticated
  using (escopo_id = org_do_usuario())
  with check (escopo_id = org_do_usuario());

create policy "escopo da org" on crm_incumbente
  for all to authenticated
  using (escopo_id = org_do_usuario())
  with check (escopo_id = org_do_usuario());

/* interacao herda o escopo do pai em vez de guardar cópia (ver 0010). O join no
   `using` é o preço de não ter duas fontes para o mesmo fato; o índice
   idx_interacao_oportunidade da 0004 cobre a busca. */
create policy "escopo da org via oportunidade" on interacao
  for all to authenticated
  using (exists (
    select 1 from oportunidade o
    where o.id = interacao.oportunidade_id and o.escopo_id = org_do_usuario()
  ))
  with check (exists (
    select 1 from oportunidade o
    where o.id = interacao.oportunidade_id and o.escopo_id = org_do_usuario()
  ));

-- membro e org são administradas pela service_role (criar cliente, convidar
-- originador). Sem policy de escrita aqui: usuário não se auto-promove nem se muda
-- de org por conta própria.
