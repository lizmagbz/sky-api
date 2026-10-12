create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

-- A API usa a service role key, que ignora RLS.
-- Sem políticas públicas, o cliente anon não lê nem grava esta tabela.
