-- Zoom do enquadramento da foto de perfil. O app já pode ter aplicado esta coluna.

alter table public."user"
  add column if not exists avatar_focus_scale double precision not null default 1;

alter table public."user"
  drop constraint if exists user_avatar_focus_scale_check;

alter table public."user"
  add constraint user_avatar_focus_scale_check
  check (avatar_focus_scale >= 1 and avatar_focus_scale <= 3);
