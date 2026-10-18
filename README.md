# sky-api

API REST em Node.js (JavaScript), organizada em Clean Architecture. O Postgres fica no Supabase e o acesso é feito pelo Prisma. A autenticação emite JWT próprio da API.

## Arquitetura

```
src/
  domain/            regras e contratos (entidades, repositórios, erros)
  application/       casos de uso
  infra/             Prisma, bcrypt e JWT
  presentation/      Express: rotas, validação e middlewares
  app.js             composição das dependências
prisma/              schema e migrations
```

O domínio não importa Express nem Prisma. Os casos de uso dependem de contratos (`UserRepository`, `PasswordHasher`, `TokenProvider`). As implementações concretas entram só em `app.js`.

## Pré-requisitos

- Node.js 22.12 ou superior
- Projeto Postgres no Supabase

## Configuração

1. Copie as variáveis de ambiente:

```bash
cp .env.example .env
```

2. Troque `[YOUR-PASSWORD]` em `DATABASE_URL` e `DIRECT_URL` pela senha do banco (Project Settings > Database).
3. Defina um `JWT_SECRET` longo e aleatório.
4. Instale as dependências e gere o client:

```bash
npm install
npm run db:generate
```

5. Aplique a migration:

```bash
npm run db:deploy
```

`DATABASE_URL` é o pooler em modo transação (porta 6543). A API usa essa URL em runtime. `DIRECT_URL` é o pooler em modo sessão (porta 5432). O Prisma Migrate usa essa URL.

A tabela `users` fica com RLS ligado e sem política pública. A conexão da API usa o papel `postgres`, que ignora o RLS. A chave anônima do Supabase não lê nem grava os registros.

Se a tabela `users` já tiver sido criada pelo SQL antigo, não rode o deploy de novo. Marque a migration como aplicada:

```bash
npx prisma migrate resolve --applied 20261018000000_create_users
```

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
| GET | `/api/auth/me` | Bearer JWT | Usuário autenticado |

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
