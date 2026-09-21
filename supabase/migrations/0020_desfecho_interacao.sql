-- 0020_desfecho_interacao.sql — o que aconteceu quando alguém tentou falar com a empresa.
--
-- ── Por que isto é a peça mais importante do conjunto de contato ───────────────
-- A 0019 classifica o contato por dedução: domínio próprio, webmail, contabilidade, quantas
-- empresas dividem o número. Tudo dedução razoável e NENHUMA verificada em campo. Sem saber o que
-- aconteceu na ligação, "qualidade do contato" é enriquecimento feito uma vez e congelado: a
-- hierarquia que a gente supõe hoje continua sendo a de daqui a um ano, certa ou errada.
--
-- `desfecho` é o rótulo de treino. É o mesmo argumento da tabela `evento` no Radar, onde a lista
-- exibida é guardada contra a escolha do analista: o dado não é recomputável depois. Ninguém
-- reconstrói, em janeiro, que a ligação de setembro caiu no contador.
--
-- A pergunta que ele responde, e que hoje não tem resposta: e-mail em domínio próprio chega mais
-- no dono do que webmail, ou é o contrário em empresa familiar? Telefone dividido com 5 empresas
-- é de fato pior que exclusivo, e quanto pior? São hipóteses no `brain/pesquisa/brainstorm-contato.md`, e
-- só isto aqui as resolve.
--
-- ── Por que na `interacao`, e não em tabela nova ───────────────────────────────
-- A `interacao` (0004) já é o log de toques por oportunidade, com tipo e descrição. Desfecho é
-- atributo do toque, não entidade. Tabela nova exigiria manter as duas em sincronia para nada.
--
-- ── Por que `contato_usado` guarda o valor, e não uma referência ───────────────
-- O telefone da empresa muda. Guardar "usou o telefone da empresa" e ir buscar o valor atual
-- depois responderia a pergunta errada, porque o número de hoje não é o que foi discado. Vale o
-- mesmo princípio do selo de proveniência: guarda-se o que estava na tela na hora.

alter table interacao
  add column if not exists desfecho      text,
  add column if not exists contato_tipo  text,
  add column if not exists contato_usado text;

/* Check por constraint nomeada em vez de enum: a escala ainda vai mudar com o uso, e afrouxar um
   check é barato. Mesma escolha da 0017. `null` é legítimo e quer dizer "ainda não registrado",
   que é diferente de "sem resposta". */
alter table interacao drop constraint if exists interacao_desfecho_check;
alter table interacao add constraint interacao_desfecho_check check (
  desfecho is null or desfecho in (
    'falou_com_decisor',       -- chegou em quem decide sobre a empresa
    'falou_com_empresa',       -- alguém da empresa atendeu, mas não é o decisor
    'caiu_no_intermediario',   -- contador, escritório, terceiro que administra o cadastro
    'nao_atendeu',             -- linha existe, ninguém respondeu
    'contato_invalido',        -- número inexistente, e-mail voltou, linha desligada
    'recusou'                  -- falou com alguém da empresa e a resposta foi não
  )
);

alter table interacao drop constraint if exists interacao_contato_tipo_check;
alter table interacao add constraint interacao_contato_tipo_check check (
  contato_tipo is null or contato_tipo in ('telefone', 'email', 'whatsapp', 'site', 'indicacao', 'outro')
);

comment on column interacao.desfecho is
  'O que aconteceu na tentativa. E o rotulo de treino da qualidade de contato: nao e recomputavel depois. Null = ainda nao registrado, diferente de nao_atendeu.';
comment on column interacao.contato_tipo is
  'Por onde a tentativa foi feita.';
comment on column interacao.contato_usado is
  'O telefone ou e-mail efetivamente usado, como estava na tela. Guardado como valor porque o contato da empresa muda e a pergunta e sobre o que foi discado, nao sobre o numero de hoje.';

/* A consulta que vai importar é "para cada desfecho, como era o contato", cruzando com as colunas
   da 0019. Ela filtra por desfecho não nulo, que é a minoria das linhas. */
create index if not exists idx_interacao_desfecho on interacao (desfecho) where desfecho is not null;
