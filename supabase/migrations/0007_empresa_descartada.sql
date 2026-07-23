-- ── Descarte de empresa no Radar ──────────────────────────────────────────────
-- "Não me mostre mais isso na busca." É conceito DIFERENTE do estágio
-- `arquivado` da oportunidade: aquele é empresa que entrou no funil e parou de
-- ser trabalhada; este é triagem no Radar, antes de virar oportunidade.
--
-- Escopo GLOBAL (não por usuário) porque o gate de acesso é senha única
-- compartilhada — não existe identidade de usuário no app hoje (ver lib/gate.ts).
-- Quando houver auth, basta adicionar `descartado_por` e trocar a PK por
-- (empresa_id, descartado_por); a leitura já é por conjunto de ids.
--
-- `motivo` é opcional mas vale a pena: é sinal rotulado de negativo, insumo do
-- loop de outcome (o score aprende com o que foi rejeitado, não só com o salvo).

create table if not exists empresa_descartada (
  empresa_id  uuid primary key references empresa(id) on delete cascade,
  motivo      text,
  created_at  timestamptz not null default now()
);

comment on table empresa_descartada is
  'Empresas que o operador tirou do Radar. Filtradas da busca. Restauravel (delete da linha).';

-- RLS habilitada sem policy pública: acesso só via server (service role). Mesmo padrão das demais.
alter table empresa_descartada enable row level security;
