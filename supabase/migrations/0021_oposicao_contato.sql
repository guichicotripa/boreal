-- 0021_oposicao_contato.sql — "não quero ser contatado", respeitado pelo banco, não pela tela.
--
-- ── Por que existe ─────────────────────────────────────────────────────────────
-- A base legal da prospecção B2B é legítimo interesse (LGPD, art. 7º, IX), e ela vem com um
-- preço: o direito de oposição do titular (art. 18, §2º). Até aqui não havia nem campo nem
-- processo. Pior: quem pedisse para sair voltaria sozinho, porque o backfill da Receita reescreve
-- `telefone` e `email` a cada recarga. Ver `brain/pesquisa/lgpd-contato.md`.
--
-- ── Por que no banco, e não nas rotas ──────────────────────────────────────────
-- Contato sai por cinco rotas hoje (busca, empresa, oportunidade, similares, dossiê) e vai sair
-- por outras. Esconder em cada uma é garantir que a sexta esqueça. Aqui o trigger impede o
-- contato de EXISTIR na linha de quem se opôs: nenhuma rota tem o que vazar, e nenhum backfill
-- consegue devolvê-lo, porque todo INSERT e UPDATE em `empresa` passa pelo trigger.
--
-- ── Por que chave por CNPJ, e não por `empresa.id` ─────────────────────────────
-- A oposição é do titular sobre aquele cadastro. Se a linha de `empresa` for apagada e ingerida de
-- novo, ela ganha outro `id`, e uma oposição presa ao id antigo se perderia em silêncio.
--
-- ── O contato NÃO é guardado em outro lugar ─────────────────────────────────────
-- Seria tentador mover o telefone para uma tabela restrita "para o caso de reverter". Isso anula a
-- oposição: o dado continuaria sendo tratado. Guarda-se o PEDIDO, que é o que prova que ele foi
-- honrado. O contato é público na Receita; se a oposição for revertida, a próxima recarga o traz.

create table if not exists oposicao_contato (
  cnpj            text primary key,
  motivo          text,
  canal           text check (canal is null or canal in ('email', 'telefone', 'whatsapp', 'pessoalmente', 'outro')),
  registrado_por  uuid references auth.users(id) on delete set null,
  criado_em       timestamptz not null default now()
);

comment on table oposicao_contato is
  'Pedido do titular para nao ser contatado (LGPD art. 18 par. 2). Enquanto a linha existir, o trigger de empresa impede que telefone, e-mail e site sejam gravados para este CNPJ.';

/* Marca visível na empresa, para a tela explicar POR QUE não há contato. Sem isso o originador vê
   o campo vazio, acha que é falta de dado e vai procurar o telefone em outro lugar, que é
   exatamente o que a oposição pede para não fazer. */
alter table empresa add column if not exists nao_contatar boolean not null default false;

create or replace function respeita_oposicao() returns trigger
  language plpgsql security definer set search_path = public
as $$
begin
  if exists (select 1 from oposicao_contato o where o.cnpj = new.cnpj) then
    new.nao_contatar         := true;
    new.telefone             := null;
    new.email                := null;
    new.site                 := null;
    new.email_procedencia    := null;
    new.email_empresas_br    := null;
    new.telefone_empresas_br := null;
    new.telefone_suspeito    := null;
  else
    new.nao_contatar := false;
  end if;
  return new;
end $$;

drop trigger if exists trg_respeita_oposicao on empresa;
create trigger trg_respeita_oposicao
  before insert or update on empresa
  for each row execute function respeita_oposicao();

/* Quando a oposição nasce, a linha que já existe precisa ser limpa agora, não na próxima recarga.
   O UPDATE vazio (set cnpj = cnpj) basta: ele passa pelo trigger acima, que faz o trabalho. Assim
   a regra de O QUE apagar mora num lugar só. */
create or replace function aplica_oposicao() returns trigger
  language plpgsql security definer set search_path = public
as $$
begin
  update empresa set cnpj = cnpj where cnpj = coalesce(new.cnpj, old.cnpj);
  return null;
end $$;

drop trigger if exists trg_aplica_oposicao on oposicao_contato;
create trigger trg_aplica_oposicao
  after insert or delete on oposicao_contato
  for each row execute function aplica_oposicao();

/* RLS. Qualquer usuário autenticado REGISTRA, porque o pedido chega a quem ligou: a Setter recebe o
   "não me ligue mais" e é ela quem precisa poder anotar na hora. Ninguém autenticado APAGA: reverter
   uma oposição é decisão sensível, fica com a service_role, que é a Boreal. */
alter table oposicao_contato enable row level security;

drop policy if exists "leitura autenticada" on oposicao_contato;
create policy "leitura autenticada" on oposicao_contato
  for select to authenticated using (true);

drop policy if exists "registra autenticado" on oposicao_contato;
create policy "registra autenticado" on oposicao_contato
  for insert to authenticated with check (registrado_por = auth.uid());
