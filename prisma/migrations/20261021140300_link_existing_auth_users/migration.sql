-- Liga contas que já existem no Supabase Auth e ainda não têm linha em public.user.
-- O id é o de auth.users. A senha permanece no Auth.
-- Quem já tem linha em public.user não é alterado.

INSERT INTO public."user" (id, name, email, role, created_at)
SELECT
  au.id,
  coalesce(
    nullif(au.raw_user_meta_data ->> 'name', ''),
    nullif(split_part(au.email, '@', 1), ''),
    'Usuário'
  ),
  au.email,
  CASE
    WHEN au.raw_user_meta_data ->> 'role' IN ('pastor', 'coordenador', 'coordenador_uniao')
      THEN au.raw_user_meta_data ->> 'role'
    ELSE NULL
  END,
  coalesce(au.created_at, now())::timestamp
FROM auth.users au
LEFT JOIN public."user" u ON u.id = au.id
WHERE u.id IS NULL
  AND au.email IS NOT NULL;
