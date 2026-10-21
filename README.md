# sky-api

API REST em Node.js (JavaScript), organizada em Clean Architecture. O Postgres fica no Supabase que já existe e o acesso é feito pelo Prisma. O login continua no Supabase Auth. A tabela de pessoa é `public.user`, com o mesmo id de `auth.users`.

## Arquitetura

```
src/
  domain/            regras e contratos (entidades, repositórios, erros)
  application/       casos de uso
  infra/             Prisma e Supabase Auth
  presentation/      Express: rotas, validação e middlewares
  app.js             composição das dependências
prisma/              schema e migrations
```

O domínio não importa Express nem Prisma. Os casos de uso dependem de contratos (`UserRepository`, `AuthGateway`). As implementações concretas entram só em `app.js`.

## Pré-requisitos

- Node.js 22.12 ou superior
- Projeto Postgres no Supabase

## Configuração

1. Copie as variáveis de ambiente:

```bash
cp .env.example .env
```

2. Troque `[YOUR-PASSWORD]` em `DATABASE_URL` e `DIRECT_URL` pela senha do banco (Project Settings > Database).
3. Preencha `SUPABASE_URL` e `SUPABASE_ANON_KEY` do mesmo projeto. A senha continua no Supabase Auth.
4. Instale as dependências e gere o client:

```bash
npm install
npm run db:generate
```

5. Use o Supabase que já existe. A baseline `20261020133700_baseline_pastoral_schema` já está marcada como aplicada nele. Não rode `npm run db:deploy` para recriar tabelas.

`DATABASE_URL` é o pooler em modo transação (porta 6543). A API usa essa URL em runtime. `DIRECT_URL` é o pooler em modo sessão (porta 5432). O Prisma Migrate usa essa URL.

O schema `public` é o do app: `user`, `school`, `unions`, `association`, `school_user`, `topics`, `records`, `record_files`, `user_goals`, `schedule_events` e as tabelas da refatoração v2. `user.id` acompanha `auth.users.id`. O login continua no Supabase Auth. O que falta para começar está em [`docs/migracao-supabase-backend.md`](docs/migracao-supabase-backend.md).

## Executar

```bash
npm run dev
```

Produção: `npm start`.

Depois de alterar `prisma/schema.prisma`, rode `npm run db:generate` e crie uma nova migration antes do deploy.

## Endpoints

| Método | Rota | Auth | Descrição |
| --- | --- | --- | --- |
| GET | `/api/health` | não | Saúde da API |
| POST | `/api/auth/register` | não | Cria usuário |
| POST | `/api/auth/login` | não | Retorna `accessToken` |
| GET | `/api/auth/me` | Bearer do Auth | Usuário autenticado |
| GET | `/api/me/schools` | Bearer do Auth | Escolas que o papel pode ver |

Cadastro e login autenticam no Supabase Auth. A ficha lida é `public.user`, pelo mesmo id. O `accessToken` devolvido no login é o token do Auth. Detalhe em [`docs/migracao-supabase-backend.md`](docs/migracao-supabase-backend.md).

Cadastro:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ana","email":"ana@email.com","password":"senha1234"}'
```

Login:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ana@email.com","password":"senha1234"}'
```

Perfil:

```bash
curl http://localhost:3000/api/auth/me \
  -H 'Authorization: Bearer SEU_TOKEN'
```
