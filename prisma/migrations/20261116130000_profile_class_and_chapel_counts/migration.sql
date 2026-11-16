-- Quantidade de aulas e de celebrações/capelas no perfil.

alter table public.profiles
  add column if not exists class_count integer not null default 0;

alter table public.profiles
  add column if not exists chapel_count integer not null default 0;

alter table public.profiles
  drop constraint if exists profiles_class_count_check;

alter table public.profiles
  add constraint profiles_class_count_check
  check (class_count >= 0);

alter table public.profiles
  drop constraint if exists profiles_chapel_count_check;

alter table public.profiles
  add constraint profiles_chapel_count_check
  check (chapel_count >= 0);

comment on column public.profiles.class_count is
  'Quantidade de aulas informada no perfil.';

comment on column public.profiles.chapel_count is
  'Quantidade de celebrações/capelas informada no perfil.';
