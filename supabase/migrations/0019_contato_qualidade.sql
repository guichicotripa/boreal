-- 0019_contato_qualidade.sql — o que a Setter precisa saber ANTES de discar.
--
-- ── Por que existe ─────────────────────────────────────────────────────────────
-- Medido em 21/09/2026 na base de 65.520 empresas: telefone existe em 89,4% e e-mail em 79,7%,
-- mas `site` está em ZERO, e os domínios de e-mail não gratuitos mais repetidos do país são
-- escritórios de contabilidade (contabilizei.com.br atende 185.105 CNPJs, maismei.com.br 107.255).
-- O campo "Contato" da tela mostra os três casos iguais, então o originador manda a abordagem
-- para o contador achando que fala com o dono.
--
-- Nada aqui inventa contato novo. Tudo é leitura do que já está na base, mais uma contagem no
-- CNPJ nacional. A diferença é dizer de QUEM é o contato antes de alguém gastar a ligação.
--
-- ── Por que colunas na empresa, e não uma tabela ao lado ───────────────────────
-- É atributo do contato corrente, não histórico: quando o e-mail muda, a classificação velha não
-- serve para nada. Mesmo critério de `opcao_simples` na 0015. Quem quiser série histórica precisa
-- de snapshot do registro inteiro, que é outro problema.
--
-- ── Por que `email_procedencia` é texto e é gravada, se existe função em TS ────
-- `procedenciaEmail()` em `src/lib/contato.ts` classifica por regex e roda em qualquer lugar. Mas
-- a classificação BOA precisa da lista de 32 mil domínios compartilhados do CNPJ nacional
-- (`scripts/data/intermediarios.json`, quase 1 MB), e isso nunca vai para o browser. Então o
-- backfill classifica uma vez e grava. A função em TS continua servindo de reserva na UI enquanto
-- a coluna estiver nula, e é por isso que ela não foi removida.

alter table empresa
  add column if not exists email_procedencia     text,
  add column if not exists email_empresas_br     integer,
  add column if not exists telefone_empresas_br  integer,
  add column if not exists telefone_suspeito     boolean,
  add column if not exists contato_aferido_em    timestamptz;

comment on column empresa.email_procedencia is
  'De quem e o e-mail: contabilidade | intermediario | pessoal | empresa. Ver src/lib/contato.ts.';
comment on column empresa.email_empresas_br is
  'Quantas empresas no CNPJ nacional usam ESTE MESMO e-mail. 1 = exclusivo.';
comment on column empresa.telefone_empresas_br is
  'Quantas empresas no CNPJ nacional usam ESTE MESMO telefone. Medido nas 31 do piloto: 16 dividem com 5 ou mais, uma delas com 454.';
comment on column empresa.telefone_suspeito is
  'Numero que nem vale discar: comprimento errado, DDD inexistente ou digito de preenchimento. Nao confundir com telefone compartilhado, que e real.';
comment on column empresa.contato_aferido_em is
  'Quando esta linha foi classificada. Contato envelhece; sem isto nao da para saber se a leitura e de ontem ou de um ano atras.';

-- A busca vai filtrar por "contato confiável", e o painel conta por procedência.
create index if not exists idx_empresa_email_procedencia on empresa (email_procedencia);
create index if not exists idx_empresa_telefone_br       on empresa (telefone_empresas_br);

/* Mesma razão da 0016: `upsert` do PostgREST é INSERT ON CONFLICT e esbarra em `razao_social`
   NOT NULL. Um `.update()` por linha seriam 65 mil idas ao banco. Aqui um lote de 500 vira uma. */
create or replace function aplica_contato(dados jsonb) returns integer
  language plpgsql security definer set search_path = public
as $$
declare n integer;
begin
  with entrada as (
    select d->>'cnpj'                              as cnpj,
           nullif(d->>'procedencia', '')           as procedencia,
           nullif(d->>'site', '')                  as site,
           (d->>'tel_suspeito')::boolean           as tel_suspeito,
           nullif(d->>'tel_br', '')::integer       as tel_br,
           nullif(d->>'email_br', '')::integer     as email_br
      from jsonb_array_elements(dados) d
  )
  update empresa e
     set email_procedencia    = coalesce(en.procedencia,  e.email_procedencia),
         telefone_suspeito    = coalesce(en.tel_suspeito,  e.telefone_suspeito),
         telefone_empresas_br = coalesce(en.tel_br,        e.telefone_empresas_br),
         email_empresas_br    = coalesce(en.email_br,      e.email_empresas_br),
         /* `site` é derivado do domínio, que é palpite com boa base. Se alguém já preencheu à mão
            ou por research, o valor humano vence: `coalesce` do lado do que já existe. */
         site                 = coalesce(e.site, en.site),
         contato_aferido_em   = now()
    from entrada en
   where e.cnpj = en.cnpj;
  get diagnostics n = row_count;
  return n;
end $$;

comment on function aplica_contato(jsonb) is
  'Backfill em lote da qualidade de contato. Usada por scripts/backfill-contato.mjs. NAO chamar de rota de usuario.';

revoke all on function aplica_contato(jsonb) from public, anon, authenticated;
