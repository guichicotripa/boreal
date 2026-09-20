-- 0017_verificacao_aquisicao.sql — "esta empresa já foi comprada?", confirmada fora do cadastro.
--
-- ── Por que existe ─────────────────────────────────────────────────────────────
-- É a pergunta que a Fernanda (Setter) faz à mão, uma por vez, no CNPJ.biz: "entro nela para olhar,
-- para entender se ela não foi adquirida" (áudio de 24/08/2026). O `scripts/detecta-aquisicao.mjs`
-- já responde pelo QUADRO SOCIETÁRIO, de graça e para todo mundo, mas o cadastro tem dois limites
-- que só a web resolve: venda fechada e ainda não registrada, e compra feita por pessoas físicas,
-- que não deixa pessoa jurídica no quadro. Medido em 20/09/2026 nas 31 do pipeline: 5 empresas
-- caem em "o quadro mudou e não dá para saber", e são exatamente essas que precisam de confirmação.
--
-- ── Uma linha por empresa, não histórico ───────────────────────────────────────
-- Diferente de `score_run`, aqui a pergunta tem uma resposta corrente: ou a empresa tem dono ou
-- não tem. Reexecutar atualiza a linha. O que muda com o tempo é o MUNDO, não a nossa leitura, e
-- `criado_em` diz de quando é a leitura.
--
-- ── `veredito` e `confianca` são texto, não enum ───────────────────────────────
-- A escala ainda vai mudar com o uso (a Setter pode querer "em negociação", por exemplo). Enum no
-- Postgres exige migration para cada valor novo; o check abaixo é barato de afrouxar.

create table if not exists verificacao_aquisicao (
  empresa_id      uuid primary key references empresa(id) on delete cascade,
  veredito        text not null check (veredito in ('comprada', 'independente', 'inconclusivo')),
  comprador       text,
  quando          text,     -- texto porque a fonte quase nunca dá data exata ("meados de 2023")
  confianca       text not null check (confianca in ('alta', 'media', 'baixa')),
  resumo          text,
  /* Sem fonte, a resposta não vale nada: é o mesmo princípio do research, onde cada sinal carrega
     a URL. Lista de {url, titulo}. */
  fontes          jsonb not null default '[]'::jsonb,
  /* O que o quadro societário dizia quando esta verificação rodou. Guardado junto para dar para
     medir, depois, quantas vezes o cadastro e a web discordaram. É o dado que diz se o detector
     de graça pode substituir a busca paga em parte dos casos. */
  sinal_cadastro  text,
  modelo          text not null,
  criado_em       timestamptz not null default now()
);

comment on table verificacao_aquisicao is
  'Resposta a "esta empresa ja foi comprada?" com fonte na web. Complementa o sinal do quadro societario (scripts/detecta-aquisicao.mjs), que e gratis mas nao ve venda nao registrada nem compra por pessoa fisica.';

-- Painel e fila de verificação pedem "as mais recentes primeiro".
create index if not exists idx_verificacao_aquisicao_tempo on verificacao_aquisicao (criado_em desc);

/* Derivada do registro público, como empresa_memo e score_run: o mesmo dado serve qualquer cliente.
   Leitura para autenticado, escrita só pela service_role, que é o pipeline. Ver 0011. */
alter table verificacao_aquisicao enable row level security;
drop policy if exists "leitura autenticada" on verificacao_aquisicao;
create policy "leitura autenticada" on verificacao_aquisicao
  for select to authenticated using (true);
