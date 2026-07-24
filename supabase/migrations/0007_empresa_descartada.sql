-- ── Descarte de empresa no Radar ──────────────────────────────────────────────
-- "Não me mostre mais isso na busca." É conceito DIFERENTE do estágio
-- `arquivado` da oportunidade: aquele é empresa que entrou no funil e parou de
-- ser trabalhada; este é triagem no Radar, antes de virar oportunidade.
--
-- `motivo` é opcional mas vale a pena: é sinal rotulado de negativo, insumo do
-- loop de outcome (o score aprende com o que foi rejeitado, não só com o salvo).

-- ── Sobre `escopo_id` ─────────────────────────────────────────────────────────
-- Chave de multi-tenancy, colocada ANTES do auth existir de propósito: a coluna
-- é barata a qualquer momento, mas retrofitar os call-sites depois de N features
-- não é. A junta nasce no lugar certo; a máquina vem depois.
--
-- HOJE NÃO ISOLA NADA. O gate é senha única compartilhada (lib/gate.ts), então
-- `escopoAtual()` devolve sempre ESCOPO_PADRAO. A RLS está ligada mas sem policy
-- (acesso só via service role, que a ignora). Isolamento real exige as três
-- coisas listadas em lib/escopo.ts. Não trate dado escopado como dado isolado.
--
-- A semântica (escopo = pessoa ou = firma?) fica em aberto porque a FORMA é a
-- mesma nos dois casos — uma coluna. A decisão de produto pode esperar.

create table if not exists empresa_descartada (
  escopo_id   uuid not null default '00000000-0000-0000-0000-000000000000',
  empresa_id  uuid not null references empresa(id) on delete cascade,
  motivo      text,
  created_at  timestamptz not null default now(),
  primary key (escopo_id, empresa_id)
);

comment on table empresa_descartada is
  'Empresas que o operador tirou do Radar. Filtradas da busca. Restauravel (delete da linha).';
comment on column empresa_descartada.escopo_id is
  'Tenant/usuario dono do descarte. STUB ate haver auth: hoje e sempre o UUID nulo e NAO isola nada. Ver src/lib/escopo.ts.';

-- A leitura na busca é sempre "escopo + este conjunto de empresas"; a PK já cobre.
-- Este índice serve a listagem completa de um escopo (visão "descartadas").
create index if not exists idx_empresa_descartada_escopo
  on empresa_descartada (escopo_id, created_at desc);

-- RLS habilitada sem policy pública: acesso só via server (service role). Mesmo padrão das demais.
-- Quando o escopo passar a valer, é AQUI que entra a policy por tenant.
alter table empresa_descartada enable row level security;
