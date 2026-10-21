-- Baseline do schema public do App Pastoral.
-- Engenharia reversa do Postgres no Supabase (pg_dump --schema-only).
-- Cobre tabelas, views, constraints, índices, funções, triggers, policies e RLS.
-- Não inclui o schema auth, exceto as FKs para auth.users e o trigger de cadastro.
-- Neste banco as tabelas já existem: a migration entra no histórico como aplicada,
-- sem executar este SQL de novo.

CREATE FUNCTION public.can_access_record_scope(p_school_id bigint, p_union_id bigint) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    -- Pastor / coordenador: escola vinculada
    (
      p_school_id is not null
      and public.can_access_school(p_school_id)
    )
    -- Registro ligado diretamente à união do usuário
    or (
      p_union_id is not null
      and public.can_access_union(p_union_id)
    )
    -- Escola de associação da união do usuário
    or public.school_belongs_to_user_union(p_school_id);
$$;


--
-- Name: can_access_school(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_school(target_school_id bigint) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    exists (
      select 1
      from public.school_user su
      where su.user_id = auth.uid()
        and su.school_id = target_school_id
    )
    or (
      public.current_app_role() = 'coordenador'
      and exists (
        select 1
        from public.school_user su
        join public.school user_school on user_school.id = su.school_id
        join public.school target_school on target_school.id = target_school_id
        where su.user_id = auth.uid()
          and user_school.association_id is not null
          and target_school.association_id is not null
          and user_school.association_id = target_school.association_id
      )
    )
    or (
      public.current_app_role() = 'coordenador_uniao'
      and exists (
        select 1
        from public.school_user su
        join public.school user_school on user_school.id = su.school_id
        join public.association user_assoc on user_assoc.id = user_school.association_id
        join public.school target_school on target_school.id = target_school_id
        join public.association target_assoc on target_assoc.id = target_school.association_id
        where su.user_id = auth.uid()
          and user_assoc.union_id is not null
          and target_assoc.union_id is not null
          and user_assoc.union_id = target_assoc.union_id
      )
    );
$$;


--
-- Name: can_access_union(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_union(p_union_id bigint) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    p_union_id is not null
    and public.user_union_id() = p_union_id;
$$;


--
-- Name: count_records_for_goal(bigint, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.count_records_for_goal(p_topic_id bigint, p_year integer) RETURNS bigint
    LANGUAGE sql STABLE
    AS $$
  select count(*)::bigint
  from public.records r
  where r.user_id = auth.uid()
    and r.topic_id = p_topic_id
    and extract(year from r.event_date) = p_year;
$$;


--
-- Name: current_app_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_app_role() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(
    (select u.role from public."user" u where u.id = auth.uid()),
    auth.jwt() -> 'user_metadata' ->> 'role'
  );
$$;


--
-- Name: current_user_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_user_role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  SELECT role
  FROM public.user
  WHERE id = auth.uid()
$$;


--
-- Name: delete_own_account(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_own_account() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  -- Delete de dados pessoais
  delete from public.school_user where user_id = current_user_id;
  delete from public.schedule_events where user_id = current_user_id;
  delete from public.user_goals where user_id = current_user_id;

  -- Anonimizar perfil (mantém referência histórica em records)
  update public."user"
  set
    name = 'Usuário removido',
    email = 'deleted_' || current_user_id::text || '@deleted.local',
    avatar_url = null,
    role = null,
    is_anonymized = true,
    deleted_at = now()
  where id = current_user_id;

  -- Importante: não deletamos public."user" aqui.
end;
$$;


--
-- Name: enforce_record_files_limit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_record_files_limit() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  file_count integer;
begin
  select count(*)
  into file_count
  from public.record_files
  where record_id = new.record_id;

  if file_count >= 5 then
    raise exception 'Cada atividade pode ter no máximo 5 fotos.';
  end if;

  return new;
end;
$$;


--
-- Name: enforce_schedule_event_audience(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_schedule_event_audience() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.schedule_event_audience_allowed(
    new.user_id,
    new.audience,
    new.association_id,
    new.union_id
  ) then
    raise exception 'Audiência do evento incompatível com o papel ou o escopo do autor'
      using errcode = '42501';
  end if;
  return new;
end;
$$;


--
-- Name: handle_new_auth_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_auth_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  meta_school_id bigint;
begin
  meta_school_id := nullif(new.raw_user_meta_data ->> 'school_id', '')::bigint;

  insert into public."user" (id, name, email, role, created_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data ->> 'role',
    coalesce(new.created_at, now())
  )
  on conflict (id) do update set
    name = coalesce(excluded.name, public."user".name),
    email = coalesce(excluded.email, public."user".email),
    role = coalesce(excluded.role, public."user".role);

  if meta_school_id is not null
    and not exists (
      select 1
      from public.school_user su
      where su.user_id = new.id
        and su.school_id = meta_school_id
    )
  then
    insert into public.school_user (user_id, school_id)
    values (new.id, meta_school_id);
  end if;

  return new;
end;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  school_id_value bigint;
begin
  school_id_value := (new.raw_user_meta_data->>'school_id')::bigint;

  insert into public."user" (id, name, email, role, created_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'pastor'),
    now()
  );

  if school_id_value is not null then
    insert into public.school_user (user_id, school_id)
    values (new.id, school_id_value);
  end if;

  return new;
end;
$$;


--
-- Name: schedule_event_audience_allowed(uuid, text, bigint, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.schedule_event_audience_allowed(p_user_id uuid, p_audience text, p_association_id bigint, p_union_id bigint) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  author_role text;
  author_union_id bigint;
begin
  if p_audience = 'private' then
    return p_association_id is null and p_union_id is null;
  end if;

  select u.role, u.union_id
    into author_role, author_union_id
  from public."user" u
  where u.id = p_user_id;

  if author_role is null then
    return false;
  end if;

  if p_audience = 'association' then
    if author_role <> 'coordenador' then
      return false;
    end if;
    if p_association_id is null or p_union_id is not null then
      return false;
    end if;
    return exists (
      select 1
      from public.school_user su
      join public.school s on s.id = su.school_id
      where su.user_id = p_user_id
        and s.association_id = p_association_id
    );
  end if;

  if p_audience = 'union' then
    if author_role <> 'coordenador_uniao' then
      return false;
    end if;
    if p_union_id is null or p_association_id is not null then
      return false;
    end if;
    return author_union_id is not null and author_union_id = p_union_id;
  end if;

  return false;
end;
$$;


--
-- Name: schedule_event_is_visible(uuid, text, bigint, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.schedule_event_is_visible(p_author_id uuid, p_audience text, p_association_id bigint, p_union_id bigint) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    p_author_id = auth.uid()
    or (
      p_audience = 'association'
      and p_association_id is not null
      and exists (
        select 1
        from public.school_user su
        join public.school s on s.id = su.school_id
        where su.user_id = auth.uid()
          and s.association_id = p_association_id
      )
    )
    or (
      p_audience = 'union'
      and p_union_id is not null
      and (
        exists (
          select 1
          from public."user" u
          where u.id = auth.uid()
            and u.union_id = p_union_id
        )
        or exists (
          select 1
          from public.school_user su
          join public.school s on s.id = su.school_id
          join public.association a on a.id = s.association_id
          where su.user_id = auth.uid()
            and a.union_id = p_union_id
        )
      )
    );
$$;


--
-- Name: school_belongs_to_user_union(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.school_belongs_to_user_union(p_school_id bigint) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    p_school_id is not null
    and exists (
      select 1
      from public.school s
      join public.association a on a.id = s.association_id
      where s.id = p_school_id
        and a.union_id = public.user_union_id()
    );
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: sync_legacy_from_membership(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_legacy_from_membership() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  role_code text;
begin
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    select code into role_code from public.roles where id = old.role_id;

    if old.scope_type = 'school' and role_code in ('pastor', 'coordenador') then
      delete from public.school_user
      where user_id = old.user_id
        and school_id = old.scope_id;
    end if;

    if old.scope_type = 'union' and role_code = 'coordenador_uniao' then
      update public."user"
      set union_id = null, updated_at = now()
      where id = old.user_id
        and union_id = old.scope_id;
    end if;

    return old;
  end if;

  select code into role_code from public.roles where id = new.role_id;

  if new.scope_type = 'school' and role_code in ('pastor', 'coordenador') and new.is_active then
    insert into public.school_user (user_id, school_id)
    values (new.user_id, new.scope_id)
    on conflict (user_id, school_id) do nothing;

    update public."user"
    set role = role_code, updated_at = now()
    where id = new.user_id
      and role is distinct from role_code;
  end if;

  if new.scope_type = 'union' and role_code = 'coordenador_uniao' and new.is_active then
    update public."user"
    set
      role = 'coordenador_uniao',
      union_id = new.scope_id,
      updated_at = now()
    where id = new.user_id;
  end if;

  return new;
end;
$$;


--
-- Name: sync_membership_from_school_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_membership_from_school_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  role_code text;
  role_uuid uuid;
begin
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    delete from public.memberships m
    using public.roles r
    where m.user_id = old.user_id
      and m.scope_type = 'school'
      and m.scope_id = old.school_id
      and m.role_id = r.id
      and r.code in ('pastor', 'coordenador');
    return old;
  end if;

  select coalesce(u.role, 'pastor') into role_code
  from public."user" u
  where u.id = new.user_id;

  if role_code not in ('pastor', 'coordenador') then
    role_code := 'pastor';
  end if;

  select id into role_uuid from public.roles where code = role_code;

  if tg_op = 'UPDATE' and (old.school_id is distinct from new.school_id) then
    delete from public.memberships m
    using public.roles r
    where m.user_id = old.user_id
      and m.scope_type = 'school'
      and m.scope_id = old.school_id
      and m.role_id = r.id
      and r.code in ('pastor', 'coordenador');
  end if;

  insert into public.memberships (user_id, role_id, scope_type, scope_id, is_active)
  values (new.user_id, role_uuid, 'school', new.school_id, true)
  on conflict (user_id, role_id, scope_type, scope_id) do update
  set is_active = true, updated_at = now();

  return new;
end;
$$;


--
-- Name: sync_membership_from_user_union(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_membership_from_user_union() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  role_uuid uuid;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  select id into role_uuid from public.roles where code = 'coordenador_uniao';

  -- limpa memberships de união antigas deste user
  delete from public.memberships
  where user_id = new.id
    and scope_type = 'union'
    and role_id = role_uuid;

  if new.role = 'coordenador_uniao' and new.union_id is not null then
    insert into public.memberships (user_id, role_id, scope_type, scope_id, is_active)
    values (new.id, role_uuid, 'union', new.union_id, true)
    on conflict (user_id, role_id, scope_type, scope_id) do update
    set is_active = true, updated_at = now();
  end if;

  return new;
end;
$$;


--
-- Name: sync_profile_from_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_profile_from_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  insert into public.profiles (id, name, email, avatar_url, deleted_at, created_at, updated_at)
  values (
    new.id,
    coalesce(new.name, ''),
    coalesce(new.email, ''),
    new.avatar_url,
    new.deleted_at,
    coalesce(new.created_at, now()),
    coalesce(new.updated_at, now())
  )
  on conflict (id) do update
  set
    name = excluded.name,
    email = excluded.email,
    avatar_url = excluded.avatar_url,
    deleted_at = excluded.deleted_at,
    updated_at = now();

  return new;
end;
$$;


--
-- Name: sync_user_from_profile(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_user_from_profile() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  update public."user"
  set
    name = new.name,
    email = new.email,
    avatar_url = new.avatar_url,
    deleted_at = new.deleted_at,
    updated_at = now()
  where id = new.id;

  return new;
end;
$$;


--
-- Name: user_accessible_schools(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_accessible_schools() RETURNS TABLE(school_id bigint)
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    user_role text;
BEGIN

    SELECT role
    INTO user_role
    FROM public.user
    WHERE id = auth.uid();

    -- Pastor
    IF user_role = 'pastor' THEN

        RETURN QUERY
        SELECT su.school_id
        FROM public.school_user su
        WHERE su.user_id = auth.uid();

    -- Coordenador da associação
    ELSIF user_role = 'association_coordinator' THEN

        RETURN QUERY
        SELECT s.id
        FROM public.school s
        WHERE s.association_id = (
            SELECT sc.association_id
            FROM public.school sc
            JOIN public.school_user su
                ON su.school_id = sc.id
            WHERE su.user_id = auth.uid()
        );

    -- Coordenador da união
    ELSIF user_role = 'union_coordinator' THEN

        RETURN QUERY
        SELECT s.id
        FROM public.school s
        JOIN public.association a
            ON a.id = s.association_id
        WHERE a.union_id = (
            SELECT a2.union_id
            FROM public.school sc
            JOIN public.school_user su
                ON su.school_id = sc.id
            JOIN public.association a2
                ON a2.id = sc.association_id
            WHERE su.user_id = auth.uid()
        );

    END IF;

END;
$$;


--
-- Name: user_union_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_union_id() RETURNS bigint
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select u.union_id
  from public."user" u
  where u.id = auth.uid();
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: association; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.association (
    id bigint NOT NULL,
    name text NOT NULL,
    union_id bigint
);


--
-- Name: association_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.association ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.association_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: associations; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.associations AS
 SELECT id,
    name,
    union_id
   FROM public.association;


--
-- Name: memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    scope_type text NOT NULL,
    scope_id bigint NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT memberships_scope_type_check CHECK ((scope_type = ANY (ARRAY['school'::text, 'association'::text, 'union'::text])))
);


--
-- Name: ministry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ministry (
    id bigint NOT NULL,
    name text NOT NULL,
    description text,
    school_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ministry_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.ministry ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.ministry_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    avatar_url text,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: record_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.record_files (
    id bigint NOT NULL,
    record_id bigint,
    file_url text NOT NULL,
    file_type text,
    created_at timestamp without time zone DEFAULT now(),
    is_cover boolean DEFAULT false NOT NULL,
    focus_x double precision DEFAULT 0 NOT NULL,
    focus_y double precision DEFAULT 0 NOT NULL
);


--
-- Name: record_files_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.record_files ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.record_files_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.records (
    id bigint NOT NULL,
    user_id uuid,
    topic_id bigint,
    school_id bigint,
    title text,
    description text,
    event_date date,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone,
    people_count integer,
    event_end_date date,
    author_name text,
    union_id bigint,
    image_url text,
    deleted_at timestamp with time zone,
    CONSTRAINT records_event_end_after_start CHECK (((event_end_date IS NULL) OR (event_date IS NULL) OR (event_end_date >= event_date))),
    CONSTRAINT records_event_period_check CHECK (((event_end_date IS NULL) OR (event_end_date >= event_date))),
    CONSTRAINT records_people_count_nonnegative_check CHECK (((people_count IS NULL) OR (people_count >= 0))),
    CONSTRAINT records_people_count_positive CHECK (((people_count IS NULL) OR (people_count > 0))),
    CONSTRAINT records_school_or_union_required CHECK (((school_id IS NOT NULL) OR (union_id IS NOT NULL))),
    CONSTRAINT records_scope_required_check CHECK (((school_id IS NOT NULL) OR (union_id IS NOT NULL)))
);


--
-- Name: records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.records ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.records_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: schedule_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedule_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    google_event_id text,
    google_calendar_id text,
    updated_at timestamp with time zone DEFAULT now(),
    is_all_day boolean DEFAULT false NOT NULL,
    description text,
    audience text DEFAULT 'private'::text NOT NULL,
    association_id bigint,
    union_id bigint,
    CONSTRAINT schedule_events_audience_check CHECK ((audience = ANY (ARRAY['private'::text, 'association'::text, 'union'::text]))),
    CONSTRAINT schedule_events_audience_scope_check CHECK ((((audience = 'private'::text) AND (association_id IS NULL) AND (union_id IS NULL)) OR ((audience = 'association'::text) AND (association_id IS NOT NULL) AND (union_id IS NULL)) OR ((audience = 'union'::text) AND (union_id IS NOT NULL) AND (association_id IS NULL)))),
    CONSTRAINT schedule_events_end_after_start CHECK ((end_at > start_at)),
    CONSTRAINT schedule_events_period_check CHECK ((end_at >= start_at))
);


--
-- Name: schema_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_version (
    id integer DEFAULT 1 NOT NULL,
    app_compat text DEFAULT '1.x'::text NOT NULL,
    target_release text DEFAULT '2.0'::text NOT NULL,
    lote integer DEFAULT 0 NOT NULL,
    notes text,
    applied_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT schema_version_id_check CHECK ((id = 1))
);


--
-- Name: school; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.school (
    id bigint NOT NULL,
    name text NOT NULL,
    association_id bigint
);


--
-- Name: school_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.school ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.school_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: school_user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.school_user (
    id bigint NOT NULL,
    school_id bigint NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: school_memberships; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.school_memberships AS
 SELECT id,
    user_id,
    school_id,
    created_at
   FROM public.school_user;


--
-- Name: school_user_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.school_user ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.school_user_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: schools; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.schools AS
 SELECT id,
    name,
    association_id
   FROM public.school;


--
-- Name: topics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.topics (
    id bigint NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now(),
    slug text
);


--
-- Name: topics_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.topics ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.topics_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: unions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unions (
    id bigint NOT NULL,
    name text NOT NULL
);


--
-- Name: union_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.unions ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.union_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."user" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    role text,
    created_at timestamp without time zone,
    avatar_url text,
    deleted_at timestamp with time zone,
    is_anonymized boolean DEFAULT false NOT NULL,
    union_id bigint,
    updated_at timestamp with time zone DEFAULT now(),
    avatar_focus_x double precision DEFAULT 0 NOT NULL,
    avatar_focus_y double precision DEFAULT 0 NOT NULL,
    CONSTRAINT user_role_valid_check CHECK (((role IS NULL) OR (role = ANY (ARRAY['pastor'::text, 'coordenador'::text, 'coordenador_uniao'::text]))))
);


--
-- Name: user_goals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_goals (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    topic_id bigint NOT NULL,
    target_count integer NOT NULL,
    year integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_goals_target_count_check CHECK ((target_count > 0)),
    CONSTRAINT user_goals_target_count_nonnegative_check CHECK ((target_count >= 0)),
    CONSTRAINT user_goals_year_check CHECK ((year >= 2000)),
    CONSTRAINT user_goals_year_valid_check CHECK (((year >= 2000) AND (year <= 2100)))
);


--
-- Name: user_goals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.user_goals ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.user_goals_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: user_google_calendar_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_google_calendar_connections (
    user_id uuid NOT NULL,
    google_calendar_id text NOT NULL,
    refresh_token text NOT NULL,
    sync_token text,
    connected_at timestamp with time zone DEFAULT now()
);


--
-- Name: association association_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.association
    ADD CONSTRAINT association_pkey PRIMARY KEY (id);


--
-- Name: memberships memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_pkey PRIMARY KEY (id);


--
-- Name: memberships memberships_user_role_scope_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_user_role_scope_key UNIQUE (user_id, role_id, scope_type, scope_id);


--
-- Name: ministry ministry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ministry
    ADD CONSTRAINT ministry_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: record_files record_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.record_files
    ADD CONSTRAINT record_files_pkey PRIMARY KEY (id);


--
-- Name: records records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.records
    ADD CONSTRAINT records_pkey PRIMARY KEY (id);


--
-- Name: roles roles_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_code_key UNIQUE (code);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: schedule_events schedule_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_events
    ADD CONSTRAINT schedule_events_pkey PRIMARY KEY (id);


--
-- Name: schema_version schema_version_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_version
    ADD CONSTRAINT schema_version_pkey PRIMARY KEY (id);


--
-- Name: school school_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school
    ADD CONSTRAINT school_pkey PRIMARY KEY (id);


--
-- Name: school_user school_user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_user
    ADD CONSTRAINT school_user_pkey PRIMARY KEY (id);


--
-- Name: school_user school_user_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_user
    ADD CONSTRAINT school_user_unique UNIQUE (school_id, user_id);


--
-- Name: school_user school_user_unique_pair; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_user
    ADD CONSTRAINT school_user_unique_pair UNIQUE (user_id, school_id);


--
-- Name: school_user school_user_user_school_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_user
    ADD CONSTRAINT school_user_user_school_key UNIQUE (user_id, school_id);


--
-- Name: school_user school_user_user_school_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_user
    ADD CONSTRAINT school_user_user_school_unique UNIQUE (user_id, school_id);


--
-- Name: topics topics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topics
    ADD CONSTRAINT topics_pkey PRIMARY KEY (id);


--
-- Name: unions union_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unions
    ADD CONSTRAINT union_pkey PRIMARY KEY (id);


--
-- Name: user_goals user_goals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_goals
    ADD CONSTRAINT user_goals_pkey PRIMARY KEY (id);


--
-- Name: user_goals user_goals_user_id_topic_id_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_goals
    ADD CONSTRAINT user_goals_user_id_topic_id_year_key UNIQUE (user_id, topic_id, year);


--
-- Name: user_goals user_goals_user_topic_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_goals
    ADD CONSTRAINT user_goals_user_topic_year_key UNIQUE (user_id, topic_id, year);


--
-- Name: user_google_calendar_connections user_google_calendar_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_google_calendar_connections
    ADD CONSTRAINT user_google_calendar_connections_pkey PRIMARY KEY (user_id);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- Name: idx_association_union_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_association_union_id ON public.association USING btree (union_id);


--
-- Name: idx_memberships_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_memberships_role_id ON public.memberships USING btree (role_id);


--
-- Name: idx_memberships_scope; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_memberships_scope ON public.memberships USING btree (scope_type, scope_id) WHERE is_active;


--
-- Name: idx_memberships_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_memberships_user_id ON public.memberships USING btree (user_id) WHERE is_active;


--
-- Name: idx_profiles_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_email ON public.profiles USING btree (email);


--
-- Name: idx_record_files_record_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_record_files_record_id ON public.record_files USING btree (record_id);


--
-- Name: idx_records_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_records_active ON public.records USING btree (created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_records_created_at_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_records_created_at_desc ON public.records USING btree (created_at DESC);


--
-- Name: idx_records_event_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_records_event_date ON public.records USING btree (event_date);


--
-- Name: idx_records_school; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_records_school ON public.records USING btree (school_id);


--
-- Name: idx_records_school_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_records_school_created_at ON public.records USING btree (school_id, created_at DESC) WHERE (school_id IS NOT NULL);


--
-- Name: idx_records_topic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_records_topic ON public.records USING btree (topic_id);


--
-- Name: idx_records_topic_event_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_records_topic_event_date ON public.records USING btree (topic_id, event_date);


--
-- Name: idx_records_union_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_records_union_created_at ON public.records USING btree (union_id, created_at DESC) WHERE (union_id IS NOT NULL);


--
-- Name: idx_records_user_event_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_records_user_event_date ON public.records USING btree (user_id, event_date);


--
-- Name: idx_schedule_events_association_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schedule_events_association_start ON public.schedule_events USING btree (association_id, start_at) WHERE (audience = 'association'::text);


--
-- Name: idx_schedule_events_google_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schedule_events_google_event_id ON public.schedule_events USING btree (google_event_id) WHERE (google_event_id IS NOT NULL);


--
-- Name: idx_schedule_events_union_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schedule_events_union_start ON public.schedule_events USING btree (union_id, start_at) WHERE (audience = 'union'::text);


--
-- Name: idx_schedule_events_user_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schedule_events_user_start ON public.schedule_events USING btree (user_id, start_at);


--
-- Name: idx_school_association_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_school_association_id ON public.school USING btree (association_id);


--
-- Name: idx_school_user_school_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_school_user_school_id ON public.school_user USING btree (school_id);


--
-- Name: idx_school_user_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_school_user_user_id ON public.school_user USING btree (user_id);


--
-- Name: idx_user_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_active ON public."user" USING btree (id) WHERE (deleted_at IS NULL);


--
-- Name: idx_user_goals_topic_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_goals_topic_id ON public.user_goals USING btree (topic_id);


--
-- Name: idx_user_goals_user_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_goals_user_year ON public.user_goals USING btree (user_id, year);


--
-- Name: idx_user_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_role ON public."user" USING btree (role);


--
-- Name: idx_user_union_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_union_id ON public."user" USING btree (union_id) WHERE (union_id IS NOT NULL);


--
-- Name: records_union_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX records_union_id_idx ON public.records USING btree (union_id);


--
-- Name: schedule_events_google_event_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX schedule_events_google_event_id_idx ON public.schedule_events USING btree (user_id, google_event_id) WHERE (google_event_id IS NOT NULL);


--
-- Name: schedule_events_start_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedule_events_start_at_idx ON public.schedule_events USING btree (start_at);


--
-- Name: schedule_events_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedule_events_user_id_idx ON public.schedule_events USING btree (user_id);


--
-- Name: topics_slug_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX topics_slug_unique ON public.topics USING btree (slug) WHERE (slug IS NOT NULL);


--
-- Name: user_deleted_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_deleted_at_idx ON public."user" USING btree (deleted_at) WHERE (deleted_at IS NOT NULL);


--
-- Name: user_union_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_union_id_idx ON public."user" USING btree (union_id);


--
-- Name: record_files record_files_limit_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER record_files_limit_trigger BEFORE INSERT ON public.record_files FOR EACH ROW EXECUTE FUNCTION public.enforce_record_files_limit();


--
-- Name: memberships trg_membership_sync_legacy; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_membership_sync_legacy AFTER INSERT OR DELETE OR UPDATE ON public.memberships FOR EACH ROW EXECUTE FUNCTION public.sync_legacy_from_membership();


--
-- Name: memberships trg_memberships_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_memberships_set_updated_at BEFORE UPDATE ON public.memberships FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profiles trg_profile_sync_user; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_profile_sync_user AFTER UPDATE OF name, email, avatar_url, deleted_at ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.sync_user_from_profile();


--
-- Name: profiles trg_profiles_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: records trg_records_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_records_set_updated_at BEFORE UPDATE ON public.records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: schedule_events trg_schedule_events_enforce_audience; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_schedule_events_enforce_audience BEFORE INSERT OR UPDATE ON public.schedule_events FOR EACH ROW EXECUTE FUNCTION public.enforce_schedule_event_audience();


--
-- Name: schedule_events trg_schedule_events_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_schedule_events_set_updated_at BEFORE UPDATE ON public.schedule_events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: school_user trg_school_user_sync_membership; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_school_user_sync_membership AFTER INSERT OR DELETE OR UPDATE ON public.school_user FOR EACH ROW EXECUTE FUNCTION public.sync_membership_from_school_user();


--
-- Name: user_goals trg_user_goals_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_goals_set_updated_at BEFORE UPDATE ON public.user_goals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: user trg_user_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_set_updated_at BEFORE UPDATE ON public."user" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: user trg_user_sync_profile; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_sync_profile AFTER INSERT OR UPDATE OF name, email, avatar_url, deleted_at ON public."user" FOR EACH ROW EXECUTE FUNCTION public.sync_profile_from_user();


--
-- Name: user trg_user_sync_union_membership; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_sync_union_membership AFTER INSERT OR UPDATE OF role, union_id ON public."user" FOR EACH ROW EXECUTE FUNCTION public.sync_membership_from_user_union();


--
-- Name: association association_union_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.association
    ADD CONSTRAINT association_union_id_fkey FOREIGN KEY (union_id) REFERENCES public.unions(id);


--
-- Name: memberships memberships_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE RESTRICT;


--
-- Name: memberships memberships_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: ministry ministry_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ministry
    ADD CONSTRAINT ministry_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.school(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: record_files record_files_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.record_files
    ADD CONSTRAINT record_files_record_id_fkey FOREIGN KEY (record_id) REFERENCES public.records(id) ON DELETE CASCADE;


--
-- Name: records records_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.records
    ADD CONSTRAINT records_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.school(id);


--
-- Name: records records_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.records
    ADD CONSTRAINT records_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id);


--
-- Name: records records_union_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.records
    ADD CONSTRAINT records_union_id_fkey FOREIGN KEY (union_id) REFERENCES public.unions(id);


--
-- Name: records records_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.records
    ADD CONSTRAINT records_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE SET NULL;


--
-- Name: schedule_events schedule_events_association_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_events
    ADD CONSTRAINT schedule_events_association_id_fkey FOREIGN KEY (association_id) REFERENCES public.association(id) ON DELETE RESTRICT;


--
-- Name: schedule_events schedule_events_union_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_events
    ADD CONSTRAINT schedule_events_union_id_fkey FOREIGN KEY (union_id) REFERENCES public.unions(id) ON DELETE RESTRICT;


--
-- Name: schedule_events schedule_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_events
    ADD CONSTRAINT schedule_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: school school_association_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school
    ADD CONSTRAINT school_association_id_fkey FOREIGN KEY (association_id) REFERENCES public.association(id);


--
-- Name: school_user school_user_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_user
    ADD CONSTRAINT school_user_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.school(id) ON DELETE CASCADE;


--
-- Name: school_user school_user_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_user
    ADD CONSTRAINT school_user_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: user_goals user_goals_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_goals
    ADD CONSTRAINT user_goals_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id);


--
-- Name: user_goals user_goals_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_goals
    ADD CONSTRAINT user_goals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_google_calendar_connections user_google_calendar_connections_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_google_calendar_connections
    ADD CONSTRAINT user_google_calendar_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user user_id_auth_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_id_auth_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user user_id_auth_users_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_id_auth_users_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user user_union_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_union_id_fkey FOREIGN KEY (union_id) REFERENCES public.unions(id);


--
-- Name: school Allow public read schools; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read schools" ON public.school FOR SELECT TO anon USING (true);


--
-- Name: school Authenticated users can read schools; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read schools" ON public.school FOR SELECT TO authenticated USING (true);


--
-- Name: school Authenticated users read schools; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users read schools" ON public.school FOR SELECT TO authenticated USING (true);


--
-- Name: schedule_events Authors delete own schedule events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authors delete own schedule events" ON public.schedule_events FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: schedule_events Authors insert schedule events in allowed audience; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authors insert schedule events in allowed audience" ON public.schedule_events FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND public.schedule_event_audience_allowed(user_id, audience, association_id, union_id)));


--
-- Name: record_files Authors update own record files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authors update own record files" ON public.record_files FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.records r
  WHERE ((r.id = record_files.record_id) AND (r.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.records r
  WHERE ((r.id = record_files.record_id) AND (r.user_id = auth.uid())))));


--
-- Name: schedule_events Authors update own schedule events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authors update own schedule events" ON public.schedule_events FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK (((user_id = auth.uid()) AND public.schedule_event_audience_allowed(user_id, audience, association_id, union_id)));


--
-- Name: record_files Record owners can delete record files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Record owners can delete record files" ON public.record_files FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.records r
  WHERE ((r.id = record_files.record_id) AND (r.user_id = auth.uid())))));


--
-- Name: record_files Record owners can insert record files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Record owners can insert record files" ON public.record_files FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.records r
  WHERE ((r.id = record_files.record_id) AND (r.user_id = auth.uid())))));


--
-- Name: roles Roles are readable by authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Roles are readable by authenticated" ON public.roles FOR SELECT TO authenticated USING (true);


--
-- Name: schedule_events Schedule events visible in scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Schedule events visible in scope" ON public.schedule_events FOR SELECT TO authenticated USING (public.schedule_event_is_visible(user_id, audience, association_id, union_id));


--
-- Name: user User can read own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "User can read own profile" ON public."user" FOR SELECT USING ((auth.uid() = id));


--
-- Name: school_user Users can insert own school link; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own school link" ON public.school_user FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: memberships Users can read own memberships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own memberships" ON public.memberships FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: profiles Users can read own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING ((id = auth.uid()));


--
-- Name: record_files Users can read record files for accessible records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read record files for accessible records" ON public.record_files FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.records r
  WHERE (r.id = record_files.record_id))));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));


--
-- Name: user Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public."user" FOR UPDATE USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: school_user Users can update own school link; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own school link" ON public.school_user FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_goals Users delete own goals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users delete own goals" ON public.user_goals FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: schedule_events Users delete own schedule events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users delete own schedule events" ON public.schedule_events FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: school_user Users delete own school links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users delete own school links" ON public.school_user FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: user_goals Users insert own goals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users insert own goals" ON public.user_goals FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: schedule_events Users insert own schedule events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users insert own schedule events" ON public.schedule_events FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: school_user Users insert own school link; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users insert own school link" ON public.school_user FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: user_goals Users read own goals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users read own goals" ON public.user_goals FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: user Users read own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users read own profile" ON public."user" FOR SELECT TO authenticated USING ((id = auth.uid()));


--
-- Name: schedule_events Users read own schedule events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users read own schedule events" ON public.schedule_events FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: school_user Users read own school links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users read own school links" ON public.school_user FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: user_goals Users update own goals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users update own goals" ON public.user_goals FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: user Users update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users update own profile" ON public."user" FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));


--
-- Name: schedule_events Users update own schedule events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users update own schedule events" ON public.schedule_events FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: school_user Users update own school link; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users update own school link" ON public.school_user FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: association; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.association ENABLE ROW LEVEL SECURITY;

--
-- Name: records delete_own_records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY delete_own_records ON public.records FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: school_user insert_own_school_user; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY insert_own_school_user ON public.school_user FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: user insert_own_user; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY insert_own_user ON public."user" FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));


--
-- Name: records insert_records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY insert_records ON public.records FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND public.can_access_record_scope(school_id, union_id)));


--
-- Name: memberships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

--
-- Name: ministry; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ministry ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: record_files; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.record_files ENABLE ROW LEVEL SECURITY;

--
-- Name: records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;

--
-- Name: roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

--
-- Name: schedule_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.schedule_events ENABLE ROW LEVEL SECURITY;

--
-- Name: school; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.school ENABLE ROW LEVEL SECURITY;

--
-- Name: school_user; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.school_user ENABLE ROW LEVEL SECURITY;

--
-- Name: association select_association; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY select_association ON public.association FOR SELECT TO authenticated USING (true);


--
-- Name: association select_associations_by_union; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY select_associations_by_union ON public.association FOR SELECT TO authenticated USING ((union_id = public.user_union_id()));


--
-- Name: school_user select_own_school_user; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY select_own_school_user ON public.school_user FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: user select_own_user; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY select_own_user ON public."user" FOR SELECT TO authenticated USING ((id = auth.uid()));


--
-- Name: records select_records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY select_records ON public.records FOR SELECT TO authenticated USING (public.can_access_record_scope(school_id, union_id));


--
-- Name: school select_school; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY select_school ON public.school FOR SELECT TO authenticated USING (public.can_access_school(id));


--
-- Name: school select_schools_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY select_schools_authenticated ON public.school FOR SELECT TO authenticated USING (true);


--
-- Name: school select_schools_by_union; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY select_schools_by_union ON public.school FOR SELECT TO authenticated USING (public.school_belongs_to_user_union(id));


--
-- Name: topics select_topics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY select_topics ON public.topics FOR SELECT TO authenticated USING (true);


--
-- Name: unions select_unions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY select_unions ON public.unions FOR SELECT TO authenticated USING (true);


--
-- Name: unions select_unions_for_signup; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY select_unions_for_signup ON public.unions FOR SELECT TO authenticated, anon USING (true);


--
-- Name: topics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

--
-- Name: unions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.unions ENABLE ROW LEVEL SECURITY;

--
-- Name: records update_own_records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY update_own_records ON public.records FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK (((user_id = auth.uid()) AND public.can_access_record_scope(school_id, union_id)));


--
-- Name: user; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."user" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_google_calendar_connections user owns connection; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user owns connection" ON public.user_google_calendar_connections USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_goals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_goals ENABLE ROW LEVEL SECURITY;

--
-- Name: user_google_calendar_connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_google_calendar_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: on_auth_user_created; Type: TRIGGER; Schema: auth
--

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

COMMENT ON VIEW public.associations IS 'Alias de leitura plural de association (compat naming v2).';
COMMENT ON TABLE public.memberships IS 'Vínculos role+escopo. App 2.0; sync com school_user/user.';
COMMENT ON TABLE public.profiles IS 'Perfil canônico Expand. Sync com public.user.';
COMMENT ON TABLE public.roles IS 'Catálogo de papéis. App 2.0.';
COMMENT ON COLUMN public.schedule_events.audience IS 'Alcance: private (autor), association (escolas da associação) ou union (união do autor).';
COMMENT ON COLUMN public.schedule_events.association_id IS 'Obrigatório quando audience = association. Associação das escolas do coordenador.';
COMMENT ON COLUMN public.schedule_events.union_id IS 'Obrigatório quando audience = union. União em user.union_id do coordenador da união.';
COMMENT ON TABLE public.schema_version IS 'Controle interno da refatoração v2. App 1.x não deve consultar esta tabela.';
COMMENT ON VIEW public.schools IS 'Alias de leitura plural de school (compat naming v2).';
