-- 0016_aplica_simples.sql — UPDATE em lote para o backfill do Simples.
--
-- ── Por que uma função, e não `upsert` do PostgREST ────────────────────────────
-- `upsert` é INSERT ... ON CONFLICT, então o payload precisa satisfazer TODAS as constraints da
-- tabela, `razao_social NOT NULL` inclusive. Mandar só {cnpj, opcao_simples} estoura na primeira
-- linha. Descoberto na marra em 26/08/2026.
--
-- A alternativa sem função seria um `.update()` por linha: 65 mil idas ao banco. Ou agrupar por
-- valor, o que resolve o booleano mas não a data de exclusão, que tem milhares de valores
-- distintos. Aqui um lote de 500 vira uma ida.
--
-- Serve para qualquer recomposição futura, não só a primeira: a tabela `simples` da Receita é
-- estado atual e muda quando empresa entra ou sai do regime.

create or replace function aplica_simples(dados jsonb) returns integer
  language plpgsql security definer set search_path = public
as $$
declare n integer;
begin
  with entrada as (
    select d->>'cnpj'                        as cnpj,
           (d->>'opcao')::boolean            as opcao,
           nullif(d->>'exclusao', '')::date  as exclusao
      from jsonb_array_elements(dados) d
  )
  update empresa e
     set opcao_simples         = en.opcao,
         data_exclusao_simples = en.exclusao
    from entrada en
   where e.cnpj = en.cnpj;
  get diagnostics n = row_count;
  return n;
end $$;

comment on function aplica_simples(jsonb) is
  'Backfill em lote de empresa.opcao_simples / data_exclusao_simples. Usada por scripts/backfill-simples.mjs. NAO chamar de rota de usuario.';

/* Só o service role. É escrita em massa numa coluna que a busca usa para filtrar; sessão de
   originador não tem motivo nenhum para poder rodar isto. */
revoke all on function aplica_simples(jsonb) from public, anon, authenticated;
