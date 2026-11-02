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
4. Preencha `SUPABASE_SERVICE_ROLE_KEY` do mesmo projeto. Ela fica só na API e grava o avatar no bucket `avatars` e as fotos no bucket `record-images`.
5. Instale as dependências e gere o client:

```bash
npm install
npm run db:generate
```

6. Use o Supabase que já existe. A baseline `20261020133700_baseline_pastoral_schema` já está marcada como aplicada nele. Não rode `npm run db:deploy` para recriar tabelas.

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
| GET | `/api/users/me` | Bearer do Auth | Perfil com união, avatar e vínculos |
| PATCH | `/api/users/me` | Bearer do Auth | Atualiza nome, papel, união e foco do avatar |
| PUT | `/api/users/me/schools` | Bearer do Auth | Substitui vínculos `school_user` |
| POST | `/api/users/me/avatar` | Bearer do Auth | Grava `avatars/{userId}/avatar.jpg` |
| GET | `/api/me/schools/linked` | Bearer do Auth | Escolas do vínculo |
| GET | `/api/me/association/schools` | Bearer do Auth | Escolas da associação no escopo |
| GET | `/api/me/union` | Bearer do Auth | União atual |
| GET | `/api/me/union/schools` | Bearer do Auth | Escolas da união |
| GET | `/api/me/union/associations` | Bearer do Auth | Associações da união |
| GET | `/api/me/schools/associations` | Bearer do Auth | Mapa escola–associação no escopo |
| GET | `/api/schools` | não | Catálogo `id` e `name` |
| GET | `/api/unions` | não | Catálogo `id` e `name` |
| GET | `/api/topics` | Bearer do Auth | Tópicos `id` e `name` |
| GET | `/api/records` | Bearer do Auth | Registros no escopo, do mais novo ao mais antigo |
| POST | `/api/records` | Bearer do Auth | Cria registro e devolve `id` |
| PATCH | `/api/records/:id` | Bearer do Auth | Altera título, descrição, datas e quantidade |
| DELETE | `/api/records/:id` | Bearer do Auth | Apaga o registro e os arquivos |
| GET | `/api/records/:id/files` | Bearer do Auth | Arquivos do registro |
| POST | `/api/records/:id/files` | Bearer do Auth | Envia foto para `record-images` |
| PATCH | `/api/records/:id/files/:fileId` | Bearer do Auth | Atualiza capa e foco |
| DELETE | `/api/records/:id/files/:fileId` | Bearer do Auth | Apaga um arquivo e o objeto |
| DELETE | `/api/records/:id/files` | Bearer do Auth | Apaga todos os arquivos do registro |
| GET | `/api/goals?year=` | Bearer do Auth | Metas do ano do usuário, com o nome do tópico |
| PUT | `/api/goals` | Bearer do Auth | Upsert em `user_id`, `topic_id`, `year` |
| GET | `/api/goals/progress?year=&topicId=` | Bearer do Auth | Contagem de registros e soma de `people_count` no ano |
| GET | `/api/schedule-events` | Bearer do Auth | Agenda visível, ordenada por `start_at`. `googleEventId` busca o evento do autor |
| POST | `/api/schedule-events` | Bearer do Auth | Cria evento. Público `association` sem `associationId` usa a associação do autor |
| PATCH | `/api/schedule-events/:id` | Bearer do Auth | Altera o evento do autor |
| DELETE | `/api/schedule-events/:id` | Bearer do Auth | Apaga o evento do autor |

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
