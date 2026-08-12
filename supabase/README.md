# Migrations

## Por que este arquivo existe

Até 12/08/2026 as migrations eram aplicadas **na mão**, coladas no SQL editor do dashboard. Isso
não é preferência: o repo simplesmente não tinha ferramenta. Os scripts falam com o banco por
`@supabase/supabase-js`, que é um cliente do PostgREST e faz `select/insert/update` — `create
table`, `create policy` e `create function` não passam por ali. Daí ser possível semear
`org_mandato` por script e impossível criar a tabela.

Consequência prática: das 14 migrations, as 13 primeiras foram aplicadas sem deixar registro, e o
banco não sabe quais rodaram.

## Como aplicar agora

A CLI do Supabase é a ferramenta. Ela precisa de duas coisas que só o dono da conta faz, uma vez:

```bash
supabase login
```

```bash
supabase link --project-ref hoomnogktlvjekkpdouz
```

O `link` pede a senha do banco (Dashboard → Settings → Database). Ela fica no keyring da CLI e em
`supabase/.temp/`, que está no `.gitignore`. **O ref do Boreal é `hoomnogktlvjekkpdouz`**, tirado
de `NEXT_PUBLIC_SUPABASE_URL`; em 12/08 ele não aparecia em `supabase projects list`, o que quer
dizer que a CLI estava logada em outra conta Supabase.

Feito isso, aplicar vira:

```bash
supabase db push
```

## O passo que não pode ser pulado: reconciliar as 13

`db push` aplica toda migration que o banco não registrou como aplicada. Como nenhuma foi
registrada, ele tentaria rodar as 13 antigas de novo. A maioria é idempotente de propósito
(`create table if not exists`, `drop policy if exists` antes do `create policy`), mas a **0010 faz
`drop constraint` e `add primary key`** e quebra na segunda passada.

Marcar como aplicadas sem executar:

```bash
supabase migration repair --status applied 0001 0002 0003 0004 0005 0006 0007 0008 0009 0010 0011 0012 0013
```

Conferir antes e depois com `supabase migration list`, que mostra local × remoto lado a lado.

**Incerteza conhecida:** a CLI espera versão em timestamp de 14 dígitos e os arquivos aqui usam
`0001_`, `0004_`. Não deu pra testar se ela aceita 4 dígitos sem o link estar feito. Se recusar, a
alternativa é uma das duas, nesta ordem de preferência:

1. conectar direto por `SUPABASE_DB_URL` (session pooler) e usar um script com livro-razão próprio;
2. renomear os 13 arquivos para timestamps, que suja o histórico e quebra as referências a
   "migration 0012" espalhadas pelos comentários do código.

## Ordem quando a migration tem passo de dados

Migration cria schema; dado vai em script, com `--dry`. Contrato é ato comercial e merece um passo
explícito, não uma linha escondida no meio de um arquivo de schema. A 0014 é o exemplo:

```bash
supabase db push
```

```bash
node --experimental-strip-types --env-file=.env.local scripts/sync-mandatos.ts
```

```bash
node --experimental-strip-types --env-file=.env.local scripts/contrato-setter.ts --dry
```

Depois, `npm run test:db` — as guardas de espelho (`setores-sync`, `mandatos-sync`) saem de SKIP e
falham se o banco divergir do código.

## config.toml

Gerado por `supabase init` em 12/08. São 396 linhas de default para `supabase start` (stack local
em Docker), que este projeto **não usa**. O que importa dele é o `project_id` na linha 5, sem o
qual `link` e `db push` não acham o projeto. Ficou como veio de propósito: podar agora economiza
ruído e cria risco de a CLI reclamar de campo faltando numa versão futura.
