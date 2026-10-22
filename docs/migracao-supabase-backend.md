# Backend sky-api — o que falta para começar

A engenharia reversa já está feita. A baseline `20261020133700_baseline_pastoral_schema` descreve o schema que o app usa hoje. Não há projeto novo, nem tabela nova, nem coluna de senha.

O Postgres é o que já existe. A tabela de pessoa continua sendo `public.user`. O login continua no Supabase Auth. A API não passa a guardar nem a comparar senha.

Os apps nas lojas e o dev antigo seguem no client Supabase. Esta fase não troca o Flutter. Os testes para implementar o restante, sem quebrar esses apps, estão em [backlog-testes.md](backlog-testes.md).

Fonte: `prisma/schema.prisma`, a baseline e as rotas em `src/`, lidos em 21 de outubro de 2026.

## O que já está ligado

`public.user.id` é o mesmo uuid de `auth.users.id`. As chaves `user_id_auth_fkey` e `user_id_auth_users_fkey` já fazem esse vínculo. O trigger `on_auth_user_created` chama `handle_new_auth_user()`: em cada cadastro novo no Auth, insere a linha em `user` (e em `school_user`, quando a metadata traz `school_id`).

A baseline está marcada como aplicada nesse banco. Não rodar `npm run db:deploy` para recriar tabelas. O SQL é `CREATE` e as tabelas já existem.

## Situação em 21 de outubro de 2026

- [x] Engenharia reversa na baseline `20261020133700_baseline_pastoral_schema`
- [x] Vínculo das contas que já existem (`20261021140300_link_existing_auth_users`). No banco havia 17 contas no Auth e 17 em `public.user`
- [x] Login, cadastro e `/me` pelo Supabase Auth
- [x] Regra de pastor, coordenador e coordenador de união escrita no SQL da baseline (`can_access_school` e funções vizinhas)
- [x] `GET /api/me/schools` aplica a regra com o id de quem logou. Pastor e coordenador usam `can_access_school`. Coordenador de união também vê as escolas da união em `user.union_id`
- [ ] Recuperação de senha, reautenticação, perfil, registros, metas, agenda e exclusão de conta

### 1. Vínculo das contas que já existem

- [x] Migration aplicada. Cria a linha em `public.user` só para quem está no Auth e ainda não tem ficha. Quem já tem linha não muda. A senha continua no Auth.

### 2. Login da API pelo Auth

- [x] `POST /api/auth/login` autentica no Supabase Auth e lê `public.user` pelo id. A resposta traz o `accessToken` do Auth.
- [x] `POST /api/auth/register` cria a conta no Auth, com o nome na metadata. O trigger grava `user`. A resposta não traz token.
- [x] `GET /api/auth/me` valida o token no Auth e lê `public.user`.
- [x] Credencial inválida responde 401 com a mesma mensagem para e-mail inexistente e senha errada.
- [x] E-mail duplicado no cadastro responde 409.
- [ ] Recuperação de senha na sky-api. Continua só no Auth do app.

### 3. Escopo, depois do login

- [x] Funções na baseline: `can_access_school`, `can_access_union`, `can_access_record_scope`, `current_app_role`
- [x] `GET /api/me/schools` usa essas funções com o id de quem logou
- [ ] Registros, metas e agenda ainda não passam por essa regra

| Papel               | Escopo                                             |
| ------------------- | -------------------------------------------------- |
| `pastor`            | Escolas em `school_user`                           |
| `coordenador`       | Escolas da mesma associação das escolas vinculadas |
| `coordenador_uniao` | União em `user.union_id`, sem `school_user`        |

## Backlog da API

O app Flutter não entra nestes itens. Google Calendar, PDF e Excel continuam no aparelho. `memberships` e `profiles` estão em [database-refactoring-v2.md](database-refactoring-v2.md). A API desta fase lê `user`, `school_user` e `user.union_id`.

### Autenticação

- [x] Login, cadastro mínimo (`name`, `email`, `password`) e `/me` pelo Supabase Auth, lendo `public.user` pelo mesmo id
- [x] Cadastro com `role`, `schoolId`, `additionalSchoolIds` e `unionId`. Com `unionId`, gravar `user.union_id` e não criar `school_user`. Sem `unionId` e com escolas, inserir `school_user`
- [x] A resposta do cadastro não devolve token
- [x] Logout fica no app: descartar a sessão do Auth
- [ ] `POST /api/auth/reauthenticate` confere a senha de novo no Auth. Senha errada responde 401
- [ ] Recuperação de senha em três passos na API

### Perfil e organização

- [ ] `GET /api/users/me`: nome, e-mail, papel, união, avatar e vínculos `school_user` com a escola
- [ ] `PATCH /api/users/me`: campos editáveis. Recusar mudança de papel ou de união fora da regra do app
- [ ] Listagens no escopo da matriz: escolas vinculadas, escolas da associação, escolas e associações da união, união atual, mapa escola–associação
- [ ] Um caso de uso substitui os vínculos: apaga os links informados e insere os novos. Coordenador de união não ganha `school_user` por esse caminho
- [ ] `POST /api/users/me/avatar` grava no bucket `avatars`, caminho `{userId}/avatar.jpg`, e devolve a URL. A service key fica só na API
- [ ] `GET /api/schools` e `GET /api/unions`, sem token: `id` e `name`, ordenados por nome. Sem vínculos de usuários

### Registros, arquivos e tópicos

- [ ] `GET /api/topics`: `id` e `name` para usuário autenticado. Sem sessão, 401
- [ ] `GET /api/records`: ordenado por `created_at` descendente, com escola, união, tópico e `record_files` (`id`, `record_id`, `file_url`, `file_type`, `created_at`, `is_cover`, `focus_x`, `focus_y`)
- [ ] `POST` grava `title`, `description`, `event_date`, `event_end_date`, `people_count`, `author_name`, `user_id`, `school_id`, `union_id` e `topic_id`, e devolve o id. `school_id` e `union_id` ficam dentro do escopo do autor
- [ ] `PATCH` altera `title`, `description`, `event_date`, `event_end_date` e `people_count`. `DELETE` remove o registro. Listagem, alteração e exclusão seguem a matriz
- [ ] Upload em `record-images`, caminho `{userId}/{recordId}/{timestamp}.{ext}`, insert em `record_files` e URL na resposta
- [ ] Listar por `record_id`, atualizar capa e foco, apagar um arquivo e apagar todos os arquivos de um registro, inclusive o objeto no bucket. Apagar o registro remove os arquivos

### Metas e agenda

- [ ] `GET /api/goals?year=`: `id`, `topic_id`, `target_count`, `year` e o nome do tópico, só do usuário autenticado
- [ ] `PUT` faz upsert em `user_goals` na chave `user_id`, `topic_id`, `year`
- [ ] Progresso: contagem de registros e soma de `people_count` do tópico no ano (`event_date` de 1 de janeiro a 31 de dezembro)
- [ ] CRUD de `schedule_events` do usuário autenticado, ordenado por `start_at`, com busca por `google_event_id`
- [ ] Campo com a `association_id` do autor para o público do evento. A sincronização com o Google continua no aparelho; a API guarda `google_event_id`

### Exclusão de conta

- [ ] `POST /api/account` exige a senha de novo no Auth e apaga o usuário no Auth, os vínculos, metas, agenda, registros e arquivos dos buckets `avatars` e `record-images`
- [ ] Falha no meio do caminho deixa registrado o que ficou

## Fora desta fase

- [x] O app nas lojas e o dev antigo continuam com `supabase.auth` e as tabelas atuais
- [ ] Troca do Flutter para a sky-api. Até lá, nenhuma alteração em `supabase_flutter`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` nem `make supabase-push` / `make supabase-push-prod`
