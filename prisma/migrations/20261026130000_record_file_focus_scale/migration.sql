-- Zoom do enquadramento das fotos de registro. O app já pode ter aplicado esta coluna.

alter table public.record_files
  add column if not exists focus_scale double precision not null default 1;

alter table public.record_files
  drop constraint if exists record_files_focus_scale_check;

alter table public.record_files
  add constraint record_files_focus_scale_check
  check (focus_scale >= 1 and focus_scale <= 3);
