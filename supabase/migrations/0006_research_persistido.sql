-- ── Persistência da investigação v1 ───────────────────────────────────────────
-- Antes: score_run era write-only. Cada abertura da página da empresa re-rodava o
-- research-agent (30-60s + custo de API) e o resultado só sobrevivia em sessionStorage
-- do browser. Agora o score_run vira a fonte de verdade do v1: guarda o ResearchResult
-- COMPLETO (não só o número), a leitura reaproveita, e a busca reordena por ele.

alter table score_run add column if not exists research jsonb;

comment on column score_run.research is
  'ResearchResult completo do agente v1 (sinais, resumo, gatilho, perfil_negocio, score_v0/v1, delta). Null em runs antigos, anteriores a esta migration.';

-- Busca "último run desta empresa" — o padrão de leitura novo (research cache-first
-- e overlay de v1 na busca). Sem este índice a leitura vira scan por empresa_id.
create index if not exists idx_score_run_empresa_recente
  on score_run (empresa_id, created_at desc);
