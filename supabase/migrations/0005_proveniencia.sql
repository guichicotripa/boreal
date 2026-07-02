-- 0005_proveniencia.sql — selo de proveniência: prova de que um lead veio do Boreal.
-- Destrava o success fee no piloto: origem + data + score no momento + "não estava no CRM do parceiro",
-- com hash assinado (tamper-evident). Sem isso, o piloto roda mas não dá pra provar que o deal foi nosso.
-- Domínio em português (dados brasileiros; não traduzir).

-- CRM incumbente do parceiro (ex: Setter): CNPJs que já estavam no pipeline deles ANTES do Boreal.
-- Serve pra provar NOVIDADE de um lead. Populado importando a lista do parceiro (só números, 14 dígitos).
create table if not exists crm_incumbente (
  cnpj         text primary key,
  fonte        text,                     -- de onde veio (ex: 'setter-2026-07')
  importado_em timestamptz not null default now()
);
alter table crm_incumbente enable row level security;

-- Selo na oportunidade: carimbo (idealmente imutável) do momento da entrega.
alter table oportunidade
  add column if not exists origem            text default 'boreal',
  add column if not exists selado_em         timestamptz,   -- quando o selo foi emitido
  add column if not exists proveniencia_hash text,          -- HMAC(cnpj|data_origem|score) — tamper-evident
  add column if not exists novo_para_setter  boolean;       -- true = não estava no crm_incumbente
