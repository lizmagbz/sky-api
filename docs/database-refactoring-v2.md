# Refatoração de Banco — App Pastoral v2.0

Documento de acompanhamento da refatoração em lotes do schema Supabase.
Objetivo: melhorar estrutura, índice, relacionamentos e desacoplamento **sem quebrar o app 1.x**.

Este arquivo mora na sky-api. O que falta para começar o backend está em [migracao-supabase-backend.md](migracao-supabase-backend.md).

## Situação em 21 de outubro de 2026

O acompanhamento da API está em [migracao-supabase-backend.md](migracao-supabase-backend.md).

| Item | Situação |
| --- | --- |
| Lotes 0–4 no dev (`owmpwtblgsamndcczvmy`, 4 de agosto de 2026) | Feito. Não reaplicar com `make supabase-push` |
| Snapshot desse schema na baseline `20261020133700_baseline_pastoral_schema` | Feito. Não rodar `npm run db:deploy` para recriar tabelas |
| Vínculo `auth.users` → `public.user` das contas já existentes | Feito (`20261021140300_link_existing_auth_users`) |
| Login da sky-api pelo Supabase Auth | Feito |
| Lote 5 Contract | Bloqueado enquanto o app 1.x estiver nas lojas |
| `memberships` / `profiles` como fonte da API | Depois. A API desta fase lê `user`, `school_user` e `user.union_id` |
| API aplicar o escopo pastor / coordenador / coordenador de união | Escolas em `GET /api/me/schools`. Registros, metas e agenda ainda não |
| Edge `delete-account` versionada | Falta. Continua fora do repositório |
| Bucket `avatars` no schema versionado | Falta. Não aparece na baseline |

---

## Princípio: Expand → Adopt → Contract

| Fase | Quem usa | O que acontece no banco |
|------|----------|-------------------------|
| **Expand** (agora) | App 1.x | Migrations aditivas: colunas novas, índices, FKs, tabelas v2, triggers de sync |
| **Adopt** (app 2.0) | App 2.0 | App passa a ler/escrever o modelo novo (`memberships`, `profiles`, etc.) |
| **Contract** (pós-sunset 1.x) | Só 2.0 | Remover colunas/tabelas legadas, triggers de sync e views de compatibilidade |

Regra dura: **nenhuma migration destes lotes pode dropar ou renomear objetos que o app 1.x usa diretamente**, sem view/alias de compatibilidade.

---

## Estado atual (v1 — inventário)

Schema base versionado na baseline da sky-api (`prisma/migrations/20261020133700_baseline_pastoral_schema`).
O inventário abaixo descreve o modelo v1 que essa baseline captura.

### Tabelas

| Tabela | Papel | Problemas |
|--------|-------|-----------|
| `user` | Perfil (id = `auth.users`) | Nome reservado; `role` + `union_id` misturam perfil com vínculo organizacional |
| `unions` | União | OK |
| `association` | Associação | Singular inconsistente |
| `school` | Escola | Singular inconsistente |
| `school_user` | N:N user↔escola | Só cobre escola; união fica em `user.union_id` |
| `topics` | Temas de atividade | Global; sem escopo futuro |
| `records` | Atividades | `author_name` e `image_url` legados; escopo escola/união assimétrico |
| `record_files` | Anexos | OK |
| `user_goals` | Metas anuais | Unique implícito `(user_id, topic_id, year)` |
| `schedule_events` | Agenda | OK |

### Hierarquia organizacional (v1)

```
unions
  └── association (union_id)
        └── school (association_id)
              └── school_user (school_id, user_id)
                    └── user (também user.union_id → unions)
```

### Roles no app

- `pastor` — várias escolas via `school_user`
- `coordenador` — escolas / filtro por associação
- `coordenador_uniao` — vínculo via `user.union_id` (não via `school_user`)

### Storage

- `record-images` (versionado)
- `avatars` (só no código)

### Lacunas conhecidas

- [x] Schema inicial e RLS versionados na baseline
- [x] Trigger de signup (`auth.users` → `user` / `school_user`) versionado na baseline
- [ ] Edge function `delete-account` fora do repo
- [x] `CREATE INDEX` versionado na baseline
- [x] FKs explícitos versionados na baseline

---

## Modelo alvo (v2)

### Diagrama

```
auth.users
    └── profiles (1:1)
            └── memberships (N)
                    ├── role_id → roles
                    └── scope (type + id) → unions | associations | schools

unions
  └── associations
        └── schools

topics
records ──┬── school_id → schools
          ├── union_id → unions
          ├── topic_id → topics
          ├── author_id → profiles
          └── record_files

goals (ex user_goals)
schedule_events → profiles
```

### Convenções v2

| Item | Regra |
|------|-------|
| Tabelas | `snake_case`, **plural** (`schools`, `associations`, `profiles`) |
| PKs | `uuid` preferencial em tabelas novas; IDs `bigint` existentes mantidos |
| Timestamps | `created_at`, `updated_at` (`timestamptz`, default `now()`) |
| Soft delete | `deleted_at` onde fizer sentido (`records`, `profiles`) |
| FKs | Sempre explícitas, com `ON DELETE` definido |
| Índices | Toda FK + colunas de filtro/listagem |
| RLS | Obrigatório em toda tabela `public` |

### Compatibilidade com app 1.x

| Objeto v1 | Estratégia Expand |
|-----------|-------------------|
| `user` | Mantém tabela; sync com `profiles` / `memberships` via trigger |
| `school` / `association` | Mantém; aliases canônicos via **views** `schools` / `associations` apontando para as mesmas tabelas **ou** tabelas renomeadas + views com nome antigo |
| `school_user` | Mantém; sync bidirecional com `memberships` (scope=school) |
| `user.role` / `user.union_id` | Mantém; sync com `memberships` |
| `records.image_url` | Mantém até Contract; app 2.0 ignora |
| `records.author_name` | Mantém até Contract; app 2.0 usa join em `profiles` |

> Neste lote Expand usamos a abordagem **menos disruptiva**: tabelas atuais permanecem; criamos objetos **novos** (`profiles`, `roles`, `memberships`, índices, FKs, constraints) e sincronizamos. Renomes agressivos ficam para Contract.

---

## Lotes de implementação

### Checklist geral

| Lote | Tema | Migration | Status | App 1.x seguro? | App 2.0 depende? |
|------|------|-----------|--------|-----------------|------------------|
| 0 | Baseline + auditoria | `20260804170000_v2_lote0_baseline_audit.sql` | ✅ Feito em staging | Sim | Não |
| 1 | Estrutura de tabelas | `20260804170100_v2_lote1_estrutura_tabelas.sql` | ✅ Feito em staging | Sim | Parcial |
| 2 | Indexação | `20260804170200_v2_lote2_indexacao.sql` | ✅ Feito em staging | Sim | Sim |
| 3 | Relacionamentos | `20260804170300_v2_lote3_relacionamentos.sql` | ✅ Feito em staging | Sim* | Sim |
| 4 | Desacoplamento | `20260804170400_v2_lote4_desacoplamento.sql` | ✅ Feito em staging | Sim | Sim |
| 5 | Contract (futuro) | _ainda não criado_ | 🔒 Bloqueado | — | Após sunset 1.x |

\* Lote 3 valida dados órfãos antes de criar FKs. Se houver órfãos, a migration falha de propósito — corrigir dados e reaplicar.

Marque status com: `⬜ Pendente` · `🔄 Em andamento` · `✅ Feito em staging` · `🚀 Feito em prod` · `⛔ Bloqueado`

---

## Lote 0 — Baseline e auditoria

**Objetivo:** versionar o que existe, sem mudar comportamento.

### Escopo

- [x] Documentar dump do schema remoto. É a baseline `20261020133700_baseline_pastoral_schema`
- [x] Colunas e timestamps do lote presentes nessa baseline
- [x] Tabela `schema_version` na baseline
- [ ] Registrar o bucket `avatars`. Não aparece na baseline
- [x] Trigger de signup e RLS na baseline
- [ ] Edge function `delete-account` continua fora do repo

### Critérios de aceite

- [x] Lotes 0–4 aplicados no dev em 4 de agosto de 2026
- [ ] Smoke do app 1.x depois desse push não foi registrado neste doc
- [x] Inventário remoto substituído pela baseline. O anexo A abaixo fica como histórico vazio

### Notas de execução

```bash
# Antes de aplicar em prod: dump de segurança
supabase db dump -f backups/pre_v2_lote0.sql
supabase db push   # ou migration up no pipeline
```

---

## Lote 1 — Estrutura de tabelas

**Objetivo:** completar colunas, tipagem e padronização **aditiva**.

### Escopo

- [x] Timestamps `created_at` / `updated_at` na baseline
- [x] `deleted_at` em `records` e `user`
- [x] Constraint de escopo em `records`: escola ou união (`records_school_or_union_required`)
- [x] Check de roles válidos em `user.role` (`user_role_valid_check`)
- [x] Checks e unique de `user_goals` na baseline
- [x] Colunas de `schedule_events` na baseline, inclusive `updated_at`
- [x] Função `set_updated_at()` e triggers na baseline

### O que **não** fazer neste lote

- Renomear tabelas
- Remover `image_url` / `author_name`
- Mudar PKs de `int` → `uuid` em tabelas existentes

### Critérios de aceite

- [x] Objetos do lote presentes na baseline, aplicada no dev
- [ ] Inserts do app 1.x e a falha de record sem escola e sem união não foram retestados neste doc

---

## Lote 2 — Indexação para performance

**Objetivo:** acelerar listagens e filtros usados pelos services.

### Índices planejados

| Tabela | Índice | Motivo (código) |
|--------|--------|-----------------|
| `records` | `(user_id, event_date)` | Metas / contagem por tema-ano |
| `records` | `(topic_id, event_date)` | Progresso de metas |
| `records` | `(school_id, created_at DESC)` | Filtro por escola |
| `records` | `(union_id, created_at DESC)` | Atividades de união |
| `records` | `(created_at DESC)` | `fetchRecords` order |
| `record_files` | `(record_id)` | Embed / delete por record |
| `school_user` | `(user_id)` | Escopo do usuário |
| `school_user` | `(school_id)` | Membros da escola |
| `school_user` | `UNIQUE (user_id, school_id)` | Evitar vínculo duplicado |
| `user` | `(union_id)` | Coordenador união |
| `user` | `(role)` | Filtros administrativos |
| `school` | `(association_id)` | Escolas da associação |
| `association` | `(union_id)` | Associações da união |
| `user_goals` | `(user_id, year)` | Listagem de metas |
| `schedule_events` | `(user_id, start_at)` | Agenda por período |
| `schedule_events` | `(google_event_id)` | Sync Google (parcial, onde not null) |

### Critérios de aceite

- [x] Índices do lote presentes na baseline
- [ ] `EXPLAIN ANALYZE` e tempo de `fetchRecords` não foram registrados
- [ ] Regressão do app 1.x não foi retestada neste doc

---

## Lote 3 — Relacionamentos

**Objetivo:** FKs reais + regras de exclusão previsíveis.

### FKs alvo

| De | Para | ON DELETE |
|----|------|-----------|
| `association.union_id` | `unions.id` | `RESTRICT` |
| `school.association_id` | `association.id` | `RESTRICT` |
| `school_user.user_id` | `user.id` | `CASCADE` |
| `school_user.school_id` | `school.id` | `CASCADE` |
| `user.union_id` | `unions.id` | `SET NULL` |
| `records.user_id` | `user.id` | `SET NULL` (mantém histórico + “Usuário removido”) |
| `records.school_id` | `school.id` | `SET NULL` |
| `records.union_id` | `unions.id` | `SET NULL` |
| `records.topic_id` | `topics.id` | `RESTRICT` |
| `record_files.record_id` | `records.id` | `CASCADE` |
| `user_goals.user_id` | `user.id` | `CASCADE` |
| `user_goals.topic_id` | `topics.id` | `RESTRICT` |
| `schedule_events.user_id` | `user.id` | `CASCADE` |

### Pré-requisito

Antes de criar FKs, a migration **detecta e lista órfãos**. Se existir órfão, aborta.

### Critérios de aceite

- [x] FKs do lote presentes na baseline
- [ ] Zero órfãos, embeds PostgREST e delete de usuário não foram retestados neste doc

---

## Lote 4 — Desacoplamento para expansão

**Objetivo:** separar **perfil**, **papel** e **vínculo organizacional**, abrindo caminho para novos escopos (associação, múltiplas uniões, novos roles).

### Novos objetos

| Objeto | Responsabilidade |
|--------|------------------|
| `profiles` | Dados de pessoa (espelho canônico de `user` no Expand) |
| `roles` | Catálogo de papéis (`pastor`, `coordenador`, `coordenador_uniao`, …) |
| `memberships` | Vínculo user + role + escopo (`school` \| `association` \| `union`) |
| Views / triggers de sync | Mantêm `user`, `school_user`, `user.role`, `user.union_id` atualizados para o app 1.x |

### Modelo `memberships`

```text
memberships
  id            uuid PK
  user_id       uuid → user/profiles
  role_id       uuid → roles
  scope_type    text CHECK IN ('school','association','union')
  scope_id      bigint  -- id na tabela do escopo
  is_active     boolean default true
  created_at    timestamptz
  updated_at    timestamptz
  UNIQUE (user_id, role_id, scope_type, scope_id)
```

### Backfill

1. Seed `roles` com os 3 papéis atuais  
2. `profiles` ← `user`  
3. Pastor/coordenador: `school_user` → `memberships` (scope=school)  
4. Coordenador união: `user.union_id` → `memberships` (scope=union)  
5. Triggers: escrita em `school_user` / `user` espelha em `memberships` e vice-versa (Expand)

### O que o app 2.0 passa a usar

- Leitura de escopo via `memberships` (uma API só)
- Novos roles sem alterar colunas de `user`
- Vínculo a associação sem gambiarra em `school_user`

### Critérios de aceite

- [x] Tabelas `profiles`, `roles` e `memberships`, com triggers de sync, presentes na baseline
- [ ] Conferir no banco se toda linha de `school_user` tem membership e se todo `coordenador_uniao` com `union_id` tem membership de união
- [ ] Smoke de signup, troca de escola, troca de união e perfil do app 1.x não foi retestado neste doc

---

## Lote 5 — Contract (futuro, pós app 2.0 estável)

**Não executar enquanto houver usuários no app 1.x.**

- [ ] Remover triggers de sync
- [ ] Remover colunas legadas (`records.image_url`, `records.author_name`, `user.role`, `user.union_id` se migrados)
- [ ] Opcional: renomear `user` → só `profiles`, `school` → `schools`, etc.
- [ ] Dropar views de compatibilidade
- [ ] Ajustar edge `delete-account` e trigger de signup para o modelo final

---

## Ordem de aplicação em produção

Esta ordem já foi executada no dev (lotes 0–4). Não repetir. A sky-api usa o schema já existente; o que falta para o backend está em [migracao-supabase-backend.md](migracao-supabase-backend.md).

> **Regra histórica:** rode tudo em **dev** primeiro (`make supabase-push`).  
> Prod só com `make supabase-push-prod` / `--production` (pede para digitar `production`).  
> Ver [`docs/commands.md`](commands.md) e [`supabase/README.md`](../supabase/README.md).

1. Backup completo em **dev** (`make supabase-dump`) e validar preflight (`make supabase-preflight`)
2. Aplicar Lotes 0→4 em **dev** (`make supabase-push`) → validar app 1.x
3. Backup em **prod** (`make supabase-dump-prod`)
4. Preflight prod (`make supabase-preflight-prod`) — zerar órfãos se houver
5. Aplicar migrations em **prod** (`make supabase-push-prod`)
6. Validar smoke tests no app 1.x apontando para prod
7. Liberar app **2.0** apontando para `memberships` / estrutura nova
8. (Meses depois) Lote 5 Contract

### Smoke tests obrigatórios (após cada lote)

- [ ] Login / logout
- [ ] Signup pastor com 1+ escolas
- [ ] Signup coordenador união
- [ ] Criar / editar / listar record com imagens
- [ ] Metas do ano (upsert + contagem)
- [ ] Agenda (CRUD + Google se configurado)
- [ ] Editar perfil / avatar / vínculos de escola
- [ ] Exclusão de conta (edge function)

---

## Mapa migration ↔ lote

| Arquivo | Lote |
|---------|------|
| `supabase/migrations/20260804170000_v2_lote0_baseline_audit.sql` | 0 |
| `supabase/migrations/20260804170100_v2_lote1_estrutura_tabelas.sql` | 1 |
| `supabase/migrations/20260804170200_v2_lote2_indexacao.sql` | 2 |
| `supabase/migrations/20260804170300_v2_lote3_relacionamentos.sql` | 3 |
| `supabase/migrations/20260804170400_v2_lote4_desacoplamento.sql` | 4 |

Migration já existente (pré-v2):

- `supabase/migrations/20260523220000_add_record_image_url.sql`

---

## Impacto no app Flutter

| Versão | Serviços | Mudança |
|--------|----------|---------|
| 1.x | Continua em `user`, `school`, `school_user`, `records`, … | Nenhuma obrigatória após Expand |
| 2.0 | Novos services/repos lendo `memberships`, `profiles`, `roles` | Troca de camada de dados; Views sem lógica de papel espalhada |

Sugestão de ordem no código 2.0 (fora deste doc de DB):

1. `MembershipRepository` / service  
2. Migrar `SchoolScopeService` e signup para memberships  
3. Migrar records/goals para FKs/colunas canônicas  
4. Remover fallbacks de `image_url` / `author_name`

---

## Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Órfãos bloqueiam Lote 3 | Script de relatório no próprio SQL; limpar em staging primeiro |
| Trigger de sync em loop | Função com `pg_trigger_depth()` / flag de sessão |
| Drift do schema remoto vs migrations | Lote 0 + dump versionado |
| RLS atual desconhecida | Auditar no Dashboard antes do Lote 4; policies novas só em objetos novos no Expand |
| Downtime | Todas as migrations Expand são online-safe (ADD COLUMN, CREATE INDEX IF NOT EXISTS) |

---

## Anexos

### Scripts auxiliares

Estes arquivos ficam no repositório do app. Servem ao app 1.x. A sky-api não os executa.

| Arquivo | Uso |
|---------|-----|
| `appPastoral/docs/commands.md` | Índice de comandos (Supabase + build APK/IPA) |
| `appPastoral/scripts/supabase.sh` | Migrations/integração — **dev por padrão**, prod com `--production` |
| `appPastoral/scripts/build.sh` | APK / IPA / AAB — **dev por padrão**, prod com `--production` |
| `appPastoral/Makefile` | Atalhos `make supabase-push`, `make apk-prod`, etc. |
| `appPastoral/supabase/scripts/preflight_v2_checks.sql` | Rodar **antes** dos Lotes 1 e 3; lista órfãos, duplicatas e roles inválidos |
| `appPastoral/supabase/README.md` | Índice das migrations e fluxo de apply |

### A. Dump do schema remoto

- Data: 20 de outubro de 2026 (arquivo da baseline)
- Ambiente: development (`owmpwtblgsamndcczvmy`)
- Arquivo: `sky-api/prisma/migrations/20261020133700_baseline_pastoral_schema/migration.sql`

### B. Decisões abertas

| # | Pergunta | Decisão | Data |
|---|----------|---------|------|
| 1 | PKs novas serão uuid ou manter bigint nas tabelas v1? | Expand: bigint nas existentes; uuid só em tabelas novas (`roles`, `memberships`, `profiles.id` = auth uuid) | — |
| 2 | App 2.0 precisa de vínculo a **associação** já no lançamento? | Memberships já suportam; UI pode vir depois | — |
| 3 | Soft delete de records na UI 2.0? | Coluna pronta no Lote 1; UI opcional | — |

### C. Histórico de aplicação

| Data | Ambiente | Lotes | Quem | Observação |
|------|----------|-------|------|------------|
| 2026-08-04 | development (`owmpwtblgsamndcczvmy`) | 0–4 (+ pré-v2 `image_url`) | `make supabase-push` | Push único; Lote 0 já remoto — reexecução é no-op |
