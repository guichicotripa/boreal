-- MEMO PERSISTIDO — o dossiê deixa de ser gerado e jogado fora.
--
-- Antes: /api/dossier lia de src/lib/dossier-cache.json (51 empresas, embutido no
-- bundle da função) e, no miss, gerava pelo LLM e DESCARTAVA. Abrir a mesma
-- empresa duas vezes pagava duas vezes, e nada do que era gerado no uso real
-- ficava. Só as 51 do arquivo eram instantâneas.
--
-- O research (v1) já resolvia isso desde a migration 0006, gravando em
-- score_run.research. Esta migration dá ao memo o mesmo tratamento, para que
-- "deixar o universo carregado antes do dia 1" seja questão de rodar um lote, e
-- não de aumentar um arquivo que vai dentro do deploy.
--
-- POR QUE TABELA PRÓPRIA e não coluna em score_run: score_run é append-only, uma
-- linha por investigação, com histórico versionado. O memo é um artefato ATUAL
-- por empresa, sempre lido por empresa_id. Chave primária em empresa_id dá o
-- upsert idempotente que o lote precisa.
--
-- POR QUE SEM escopo_id (diferente de empresa_descartada): descarte é decisão do
-- operador, logo é por escopo. O memo é análise derivada de dado público do CNPJ,
-- igual para qualquer cliente — separar por escopo faria a mesma empresa ser
-- analisada de novo a cada cliente, sem nada em troca. Se algum dia o memo passar
-- a incorporar a tese ou o CRM do cliente, aí vira dado por escopo e esta decisão
-- precisa ser revista.

create table if not exists empresa_memo (
  empresa_id  uuid primary key references empresa(id) on delete cascade,
  analise     jsonb not null,          -- DossierAnalise (overview, red_flags, ...)
  modelo      text,                    -- de onde veio (assinatura/API, versão)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table empresa_memo is
  'Memo (dossiê) por empresa, materializado. Gerado por scripts/precompute-sub.ts ou '
  'pela rota /api/dossier no primeiro acesso. Substitui src/lib/dossier-cache.json, '
  'que ia embutido no bundle e não crescia sem custo de deploy.';

-- Para o lote saber o que falta sem varrer a tabela inteira de empresas.
create index if not exists idx_empresa_memo_criado on empresa_memo (created_at desc);

-- Mesmo padrão das outras tabelas: RLS ligada sem policy — acesso só via
-- service role no servidor. Ver 0001_init_schema.sql.
alter table empresa_memo enable row level security;
