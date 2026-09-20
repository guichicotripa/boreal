-- 0018_verificacao_eventos.sql — a pergunta estreita demais ganha um campo.
--
-- A primeira rodada (20/09/2026, 13 empresas) perguntou só "foi adquirida?" e voltou 13
-- inconclusivos. O diagnóstico: aquisição de empresa familiar de médio porte quase não vira
-- notícia no Brasil, então o veredito de controle raramente vem da web.
--
-- Só que a busca ACHOU coisa útil e não tinha onde guardar. A AMIGOO PET tinha aporte de R$ 10
-- milhões noticiado em 2023, parceria com o Itaú e troca de marca, o que muda a leitura da entrada
-- da PROFITUS no quadro: parece rodada de investimento, não venda de controle. Isso ficou preso no
-- campo `resumo`, em texto solto.
--
-- `veredito` continua sendo sobre CONTROLE, que é a decisão que a Setter toma (trabalho esta
-- empresa ou descarto). `eventos` guarda o resto do que a web sabe, estruturado.

alter table verificacao_aquisicao add column if not exists eventos jsonb not null default '[]'::jsonb;

comment on column verificacao_aquisicao.eventos is
  'Eventos societarios ou financeiros achados na web: [{tipo, quando, quem, url}]. tipo = aquisicao | aporte | fusao | grupo_economico | mudanca_marca | situacao_cadastral | outro. Cada evento exige url, pela mesma razao do veredito: sem fonte nao entra.';
