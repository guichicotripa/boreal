-- 0014_mandato_no_contrato.sql — mandato entra no contrato, do mesmo jeito que setor.
--
-- O BURACO QUE ISTO FECHA. A Setter fechou piloto em R$2.000 por TRÊS mandatos
-- (diagnóstico veterinário, plano de saúde pet, death care). `org_setor` está
-- vazia pra ela, e vazia significa "sem restrição": hoje um originador logado da
-- Setter enxerga as 1,4 milhão de empresas dos quatro setores validados. Não é
-- problema de tela, é o produto inteiro entregue pelo preço do piloto.
--
-- Não dava pra resolver com as tabelas que já existiam: `org_setor.setor_id`
-- referencia `setor`, que é espelho de src/lib/setores.json, e mandato foi
-- mantido FORA do registry de propósito (ver o cabeçalho de src/lib/mandatos.ts:
-- o registry carrega recall e universo, e mandato não tem nenhum dos dois; pôr
-- zero lá sujaria /setores, /validacao e /mercado, que existem justamente pra
-- dizer o que é medido). Então mandato ganha espelho próprio e dimensão própria,
-- espelhando a forma de `setor` + `org_setor` linha a linha.
--
-- ATÉ ONDE ISTO PROTEGE. A policy filtra por PREFIXO DE CNAE, e mandato é CNAE +
-- filtro de nome ("laboratório dentro do 7500"). O banco vai liberar o 7500
-- inteiro, não só os 1.671 laboratórios. É sobra de leitura dentro do universo
-- contratado, não vazamento entre clientes: nenhuma firma passa a ver dado de
-- outra. A alternativa seria levar o filtro de nome pra dentro da policy, o que
-- escreveria a mesma regra em dois lugares (mandatos.ts e Postgres) e encareceria
-- a avaliação linha a linha. Decisão registrada em prefixosDe(), src/lib/mandatos.ts.
--
-- ORDEM DE APLICAÇÃO (a migration NÃO semeia contrato, de propósito):
--   1. esta migration                                    (schema + função + policies)
--   2. scripts/sync-mandatos.ts                          (enche o espelho `mandato`)
--   3. scripts/contrato-setter.ts                        (grava o contrato da Setter)
-- Semear org_mandato aqui daria violação de FK, porque o espelho só é preenchido
-- no passo 2. Três passos explícitos, cada um verificável, em vez de um insert
-- que falha no meio e deixa a migration pela metade.

-- ── mandato: o espelho de src/lib/mandatos.ts ────────────────────────────────
/* Mesma disciplina de `setor`: cópia sem guarda é drift. `mandatos-sync.test.ts`
   falha se o espelho divergir do código, e quem manda é sempre o código. */
create table if not exists mandato (
  id       text primary key,
  nome     text not null,
  prefixos text[] not null
);
comment on table mandato is
  'Espelho de src/lib/mandatos.ts para uso em RLS. Alimentada por scripts/sync-mandatos.ts — não editar à mão. Guarda só os prefixos de CNAE; o filtro de nome do mandato vive no código e NÃO é aplicado pela policy.';

create table if not exists org_mandato (
  org_id     uuid not null references org(id) on delete cascade,
  mandato_id text not null references mandato(id) on delete restrict,
  primary key (org_id, mandato_id)
);
comment on table org_mandato is
  'Quarta dimensão do contrato, irmã de org_setor. Vazia = sem mandato contratado; some com org_setor para formar o universo da firma.';

-- ── o universo da firma = setores contratados ∪ mandatos contratados ─────────
/* Nome novo. `regex_setores_da_org()` passou a decidir sobre mandato também, e
   nome mentiroso em função de segurança é como uma policy erra em silêncio.
   A antiga é derrubada no fim, depois de a policy deixar de referenciá-la.

   Continua devolvendo REGEX e não array, pelo mesmo motivo da 0012: o padrão é
   igual pra todas as linhas, então o Postgres avalia uma vez (InitPlan) e aplica
   `~` linha a linha, em vez de varrer um array dentro de EXISTS 51 mil vezes.

   NULL = sem restrição. Duas causas distintas caem no mesmo NULL, e isso é
   proposital: staff (vê através das orgs) e firma sem nenhuma das duas dimensões
   preenchida (contrato sem recorte de universo). */
create or replace function regex_universo_da_org() returns text
  language sql stable security definer set search_path = public
as $$
  with prefixo as (
    select unnest(s.prefixos) as p
      from org_setor os join setor s on s.id = os.setor_id
     where os.org_id = org_do_usuario()
    union
    select unnest(m.prefixos)
      from org_mandato om join mandato m on m.id = om.mandato_id
     where om.org_id = org_do_usuario()
  )
  select case when eh_staff() or count(*) = 0 then null
              else '^(' || string_agg(p, '|') || ')' end
  from prefixo
$$;
comment on function regex_universo_da_org() is
  'Prefixos de CNAE que a firma do usuário pode ler, de setores E mandatos contratados. NULL = sem restrição (staff, ou contrato sem recorte de universo).';

-- ── a policy de `empresa` passa a usar a função nova ─────────────────────────
/* Só `empresa` carrega a regra; socio, empresa_memo e score_run derivam dela por
   EXISTS e não mudam. `(select fn())` de novo para forçar InitPlan. */
drop policy if exists "setor e praca do contrato" on empresa;
create policy "setor e praca do contrato" on empresa
  for select to authenticated
  using (
    ((select regex_universo_da_org()) is null
      or empresa.cnae_principal ~ (select regex_universo_da_org()))
    and
    (cardinality((select ufs_da_org())) = 0
      or (select ufs_da_org()) @> array[empresa.uf::text])
  );

drop function if exists regex_setores_da_org();

-- ── leitura das próprias permissões ──────────────────────────────────────────
-- Mesmo motivo da 0012: a aplicação precisa SABER o contrato pra explicar, em vez
-- de devolver lista vazia com cara de defeito. `mandato` é legível por qualquer
-- autenticado (é catálogo, não dado de cliente); `org_mandato` só pela própria org.
alter table mandato     enable row level security;
alter table org_mandato enable row level security;

drop policy if exists "leitura autenticada" on mandato;
create policy "leitura autenticada" on mandato
  for select to authenticated using (true);

drop policy if exists "o proprio contrato" on org_mandato;
create policy "o proprio contrato" on org_mandato
  for select to authenticated using (org_id = org_do_usuario());

-- Escrita só pela service_role: contrato é ato comercial, não self-service.
