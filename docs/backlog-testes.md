# Backlog de testes — sky-api

A API é construída ao lado do app. O app nas lojas e o dev antigo continuam no Supabase. Nenhum teste desta lista troca o client do Flutter.

Cada bloco só começa quando o anterior está marcado. O teste descreve o que o app já faz. A API precisa devolver o mesmo resultado.

## Como rodar os dois

Dois terminais, sem ligar um no outro.

App, no repositório do app, ambiente development:

```bash
flutter run --dart-define=ENV=development
```

API:

```bash
cd sky-api
npm run dev
```

A API fica em `http://localhost:3000`. O app não chama essa URL. Login, listas e cadastro do app seguem no Supabase.

Não use `flutter run --dart-define=ENV=production` para este trabalho. Não aponte o `.env` da sky-api para o projeto das lojas.

## O que não pode acontecer

- Mudar `supabase_flutter`, `SUPABASE_URL` ou `SUPABASE_ANON_KEY` do app.
- Rodar `npm run db:deploy` da baseline de novo. As tabelas já existem.
- Dropar ou renomear coluna, tabela ou policy que o app lê.
- Criar conta, registro, meta ou evento de teste e deixar no banco. O dev antigo enxerga esse dado. Use um e-mail descartável e apague a conta no fim.
- Teste de escrita só no dev que a sky-api já usa. Produção fica de fora.

Leitura com uma conta que já existe é segura: a API só consulta.

## Contas para os testes de leitura

Use três contas que já estão no dev, uma de cada papel: `pastor`, `coordenador`, `coordenador_uniao`. Anote o e-mail. Não anote a senha neste arquivo.

O token de cada uma sai de `POST /api/auth/login`. O app, no mesmo momento, entra por `AuthService.login` no Supabase. Os dois logins precisam aceitar a mesma senha.

## 0. Os dois sobem e o app antigo segue inteiro

- [ ] `GET http://localhost:3000/api/health` responde `{ "status": "ok" }`.
- [ ] O app em development abre, entra e lista o que já listava, sem a API no ar.
- [ ] Com a API no ar, o app entra de novo. O caminho continua o Supabase.

## 1. Login, sessão e cadastro mínimo

Espelho de `AuthService.login`, `SplashService.fetchCurrentSession` e `SignUpService.signUp` só com nome, e-mail e senha.

- [x] E-mail inexistente e senha errada respondem 401 com a mesma mensagem.
- [x] Login certo devolve `accessToken` e a ficha `id`, `name`, `email`, `role`.
- [x] `GET /api/auth/me` com esse token devolve a mesma ficha. Sem token, 401. Token inválido, 401.
- [x] Cadastro mínimo cria a conta no Auth e a linha em `public.user` com o mesmo id. A resposta não traz token.
- [x] E-mail repetido responde 409.
- [ ] Repita o login no app com a mesma conta. O app entra pelo Supabase.
- [ ] Apague a conta criada neste teste antes de seguir.

## 2. Escolas que cada papel vê

Espelho de `SchoolScopeService`: pastor pelas escolas de `school_user`, coordenador pela associação, coordenador de união pelas escolas da união em `user.union_id`.

- [x] `GET /api/me/schools` sem token responde 401.
- [ ] Pastor recebe só as escolas do vínculo. Conferir o número com o app na tela de escolas desse pastor.
- [ ] Coordenador recebe as escolas da associação, não a lista inteira.
- [ ] Coordenador de união recebe as escolas da união, mesmo sem linha em `school_user`.
- [ ] Um papel não recebe a escola que o app esconde para esse usuário.

## 3. Catálogos do cadastro, antes do login

Espelho de `SignUpService.getSchools` e `getUnions`. São listas públicas de `id` e `name`, ordenadas por nome. Não trazem usuários.

- [ ] `GET /api/schools` sem token devolve as mesmas escolas que o app mostra no cadastro.
- [ ] `GET /api/unions` sem token devolve as mesmas uniões.
- [ ] As duas rotas não devolvem e-mail, papel nem vínculo.

## 4. Cadastro com papel, escola e união

Espelho de `SignUpService.signUp` com `role`, `schoolId`, `additionalSchoolIds` e `unionId`.

- [ ] Pastor com uma escola: `user.role` é `pastor` e existe `school_user` dessa escola.
- [ ] Pastor com escolas adicionais: cada id extra vira uma linha em `school_user`.
- [ ] Coordenador de união com `unionId`: `user.union_id` fica preenchido e não sobra `school_user` desse usuário.
- [ ] A resposta não traz token. O login seguinte, na API e no app, entra.
- [ ] Apague essas contas de teste.

## 5. Perfil

Espelho de `UserProfileService.fetchCurrentProfile` e `updateUser`.

Campos que o app lê: `id`, `name`, `email`, `role`, `avatar_url`, `avatar_focus_x`, `avatar_focus_y`, `union_id`, união (`id`, `name`) e `school_user` com escola, associação e união.

- [ ] `GET /api/users/me` devolve esse formato para os três papéis.
- [ ] `PATCH` altera o nome. Papel e união não mudam por esse caminho se o app não permite.
- [ ] Trocar vínculos apaga os links informados e insere os novos, como `deleteSchoolLinks` e `insertSchoolLinks`.
- [ ] Coordenador de união não ganha `school_user` por essa troca.
- [ ] O app, ainda no Supabase, abre o perfil da mesma conta e mostra o nome novo. Apague o teste ou volte o nome.

## 6. Avatar

Espelho de `UserProfileService.uploadAvatar`. Bucket `avatars`, caminho `{userId}/avatar.jpg`.

- [ ] `POST /api/users/me/avatar` grava o arquivo e devolve a URL.
- [ ] Um segundo envio substitui o arquivo. A URL que o app abriria continua válida.
- [ ] O app não passa a chamar `storage.from`. Este teste é só na API.

## 7. Tópicos

Espelho de `TopicService.fetchTopics`: `id` e `name` para quem está logado. Sem usuário, o app devolve lista vazia. Na API, sem token, 401.

- [ ] `GET /api/topics` com token devolve os mesmos tópicos do app.
- [ ] Sem token, 401.

## 8. Registros

Espelho de `RecordService`. A lista usa o escopo de `can_access_record_scope`: escola que a pessoa alcança, união dela, ou escola da união dela.

O app seleciona o registro com `school(name, association(name))`, `unions(name)`, `topics(name)` e `record_files` (`id`, `record_id`, `file_url`, `file_type`, `created_at`, `is_cover`, `focus_x`, `focus_y`), do mais novo para o mais antigo.

- [ ] `GET /api/records` de um pastor não inclui registro de escola fora do vínculo.
- [ ] O coordenador vê os registros das escolas da associação.
- [ ] O coordenador de união vê os registros das escolas da união e o registro ligado direto à união.
- [ ] `POST` grava `title`, `description`, `event_date`, `event_end_date`, `people_count`, `author_name`, `user_id`, `school_id`, `union_id`, `topic_id` e devolve o id.
- [ ] `school_id` ou `union_id` fora do escopo do autor responde erro e não grava.
- [ ] `PATCH` altera só `title`, `description`, `event_date`, `event_end_date` e `people_count`.
- [ ] `DELETE` remove o registro.
- [ ] O registro criado no teste é apagado. O app antigo não fica com atividade de teste.

## 9. Arquivos do registro

Espelho de `RecordFileService`. Bucket `record-images`, caminho `{userId}/{recordId}/{timestamp}.{ext}`.

- [ ] Upload devolve a URL e cria `record_files`.
- [ ] Listar por `record_id` traz os arquivos.
- [ ] Atualizar `is_cover`, `focus_x` e `focus_y`.
- [ ] Apagar um arquivo remove a linha e o objeto no bucket.
- [ ] Apagar o registro remove os arquivos antes, na mesma ordem do app.
- [ ] Limpe o registro de teste.

## 10. Metas

Espelho de `GoalService`.

- [ ] `GET /api/goals?year=` devolve `id`, `topic_id`, `target_count`, `year` e o nome do tópico, só do usuário do token.
- [ ] `PUT` faz upsert em `user_id`, `topic_id`, `year` e grava `updated_at`.
- [ ] O progresso conta registros e soma `people_count` com `event_date` entre 1 de janeiro e 31 de dezembro daquele ano.
- [ ] A meta de teste é removida ou volta ao valor anterior.

## 11. Agenda

Espelho de `ScheduleService`. O Google continua no aparelho. A API só guarda `schedule_events`, inclusive `google_event_id`.

- [ ] Listar os eventos do usuário, ordenados por `start_at`.
- [ ] Criar, editar e apagar um evento.
- [ ] Buscar por `google_event_id`.
- [ ] A resposta inclui a `association_id` que o app hoje lê de `school_user` para `school.association_id`, quando o evento é da associação.
- [ ] Apague o evento de teste.

## 12. Senha de novo e exclusão

Espelho de `AuthService.reauthenticateWithPassword`, `sendPasswordResetEmail`, `updatePassword` e `AccountDeletionService`.

- [x] `POST /api/auth/reauthenticate` com senha certa responde sucesso e não emite outro token. Senha errada, 401.
- [ ] Pedido de recuperação para e-mail inexistente responde como sucesso.
- [ ] Código expirado ou incorreto não altera a senha no Auth.
- [ ] `POST /api/account` pede a senha de novo e apaga usuário, `school_user`, metas, agenda, registros e arquivos dos buckets `avatars` e `record-images`.
- [ ] Use só a conta descartável. Confirme no app que essa conta não entra mais e que uma conta antiga continua entrando.

## 13. Regressão do app que não pode quebrar

Rodar no app em development, com a API desligada e com a API ligada. O resultado é o mesmo.

- [ ] Login e logout de pastor, coordenador e coordenador de união.
- [ ] Cadastro desses papéis pelo app, se for repetir: apagar em seguida.
- [ ] Perfil, avatar e vínculos.
- [ ] Lista, criação e edição de registro com imagem.
- [ ] Metas do ano.
- [ ] Agenda, com Google só se já estiver configurado no aparelho.
- [ ] Produção não recebe migration, conta de teste nem connection string da sky-api.

## Fora destes testes

PDF, Excel e Google Calendar continuam no aparelho. Não há endpoint para eles. `fetchAssociationSchools` antigo de `SchoolUserService` não vira rota: o fluxo vivo é o de `SchoolScopeService`.
