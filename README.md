# sky-api

API REST em Node.js (JavaScript), organizada em Clean Architecture e alinhada aos princípios SOLID. O Postgres fica no Supabase. A autenticação emite JWT próprio da API.

## Arquitetura

```
src/
  domain/            regras e contratos (entidades, repositórios, erros)
  application/       casos de uso
  infra/             Supabase, bcrypt e JWT
  presentation/      Express: rotas, validação e middlewares
  app.js             composição das dependências
```

O domínio não importa Express nem Supabase. Os casos de uso dependem de contratos (`UserRepository`, `PasswordHasher`, `TokenProvider`). As implementações concretas entram só em `app.js`.

## Pré-requisitos

- Node.js 20 ou superior
- Projeto no [Supabase](https://supabase.com)

## Configuração

1. Copie as variáveis de ambiente:

```bash
cp .env.example .env
```

2. No painel do Supabase, em **Project Settings > API**, preencha `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.
3. Defina um `JWT_SECRET` longo e aleatório.
4. No **SQL Editor** do Supabase, execute o arquivo `supabase/migrations/20261012000000_create_users.sql`.

A service role key fica só no servidor. Ela ignora RLS. A tabela `users` não tem política pública, então a chave anônima do Supabase não acessa os registros.

## Executar

```bash
npm install
npm run dev
```

Produção: `npm start`.

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
