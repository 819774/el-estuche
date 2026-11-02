-- El Estuche: base de datos completa.
-- Pega este archivo entero en Supabase > SQL Editor y pulsa Run.
-- Se puede ejecutar más de una vez sin perder datos.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text not null default '📚',
  color text not null default '#38BDF8',
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.works (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null,
  description text not null default '',
  status text not null default 'activo' check (status in ('activo', 'entregado')),
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  title text not null,
  assignees text[] not null default '{}',
  done_by text[] not null default '{}',
  due_date date,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  author text not null,
  body text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  entry_id uuid references public.entries(id) on delete cascade,
  kind text not null check (kind in ('file', 'link')),
  name text not null,
  url text,
  path text,
  mime text,
  size bigint,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references public.subjects(id) on delete cascade,
  work_id uuid references public.works(id) on delete cascade,
  kind text not null default 'entrega' check (kind in ('entrega', 'examen', 'otro')),
  title text not null,
  date date not null,
  time time,
  notes text not null default '',
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  author text,
  role text not null check (role in ('user', 'model')),
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  key text primary key,
  value text not null
);

create index if not exists works_subject_idx on public.works (subject_id);
create index if not exists tasks_work_idx on public.tasks (work_id);
create index if not exists entries_work_idx on public.entries (work_id);
create index if not exists attachments_work_idx on public.attachments (work_id);
create index if not exists events_date_idx on public.events (date);

-- ---------------------------------------------------------------------------
-- Permisos: solo entra la cuenta del grupo, que es el primer usuario creado en
-- Authentication. Aunque alguien se registrase con otro correo, no vería nada.
-- ---------------------------------------------------------------------------

create or replace function public.is_team()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and auth.uid() = (select u.id from auth.users u order by u.created_at, u.id limit 1);
$$;

revoke all on function public.is_team() from public, anon;
grant execute on function public.is_team() to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['subjects', 'works', 'tasks', 'entries', 'attachments', 'events', 'ai_messages', 'settings']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists team_all on public.%I', t);
    execute format(
      'create policy team_all on public.%I for all to authenticated using ((select public.is_team())) with check ((select public.is_team()))',
      t
    );
  end loop;
end;
$$;

-- Marcar una tarea como hecha sin pisar a otra persona que marque a la vez.
create or replace function public.toggle_task(task_id uuid, person text)
returns public.tasks
language sql
security invoker
set search_path = ''
as $$
  update public.tasks t
  set done_by = case
    when person = any(t.done_by) then array_remove(t.done_by, person)
    else array_append(t.done_by, person)
  end
  where t.id = task_id
  returning t.*;
$$;

revoke all on function public.toggle_task(uuid, text) from public, anon;
grant execute on function public.toggle_task(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Sincronización en directo
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['subjects', 'works', 'tasks', 'entries', 'attachments', 'events', 'ai_messages']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Archivos e imágenes
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('archivos', 'archivos', false, 52428800)
on conflict (id) do nothing;

drop policy if exists estuche_read on storage.objects;
drop policy if exists estuche_insert on storage.objects;
drop policy if exists estuche_update on storage.objects;
drop policy if exists estuche_delete on storage.objects;

create policy estuche_read on storage.objects for select to authenticated
  using (bucket_id = 'archivos' and (select public.is_team()));
create policy estuche_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'archivos' and (select public.is_team()));
create policy estuche_update on storage.objects for update to authenticated
  using (bucket_id = 'archivos' and (select public.is_team()));
create policy estuche_delete on storage.objects for delete to authenticated
  using (bucket_id = 'archivos' and (select public.is_team()));

-- ---------------------------------------------------------------------------
-- Calendario del grupo para Google Calendar (enlace secreto)
-- ---------------------------------------------------------------------------

insert into public.settings (key, value)
values ('calendar_token', replace(gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

do $$
begin
  if not exists (select 1 from pg_type where typname = '*/*' and typnamespace = 'public'::regnamespace) then
    create domain public."*/*" as bytea;
  end if;
end;
$$;

create or replace function public.ics_text(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select replace(replace(replace(replace(coalesce(value, ''),
    E'\\', E'\\\\'), ';', E'\\;'), ',', E'\\,'), E'\n', E'\\n');
$$;

create or replace function public.ics_fold(line text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  result text := left(line, 70);
  rest text := substr(line, 71);
begin
  while length(rest) > 0 loop
    result := result || E'\r\n ' || left(rest, 69);
    rest := substr(rest, 70);
  end loop;
  return result;
end;
$$;

create or replace function public.calendario(token text)
returns public."*/*"
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  body text := '';
  r record;
  stamp text := to_char(now() at time zone 'utc', 'YYYYMMDD"T"HH24MISS"Z"');
  start_at timestamp;
begin
  if token is null or token is distinct from (
    select s.value from public.settings s where s.key = 'calendar_token'
  ) then
    raise sqlstate 'PT403' using message = 'Enlace de calendario no válido';
  end if;

  perform set_config(
    'response.headers',
    '[{"Content-Type": "text/calendar; charset=utf-8"}, {"Cache-Control": "max-age=900"}]',
    true
  );

  body := E'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//El Estuche//ES\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\nX-WR-CALNAME:El Estuche\r\nX-WR-TIMEZONE:Europe/Madrid\r\n';

  for r in
    select e.id::text as uid, e.date, e.time, e.notes,
      case e.kind when 'examen' then 'Examen: ' when 'entrega' then 'Entrega: ' else '' end
        || e.title
        || coalesce(' (' || s.name || ')', '') as summary
    from public.events e
    left join public.subjects s on s.id = e.subject_id
    union all
    select 't' || t.id::text, t.due_date, null, t.title,
      'Pendiente: ' || t.title || ' (' || w.title || ')'
    from public.tasks t
    join public.works w on w.id = t.work_id
    where t.due_date is not null
      and not (t.assignees <@ t.done_by and cardinality(t.assignees) > 0)
  loop
    body := body || E'BEGIN:VEVENT\r\n'
      || 'UID:' || r.uid || E'@el-estuche\r\n'
      || 'DTSTAMP:' || stamp || E'\r\n';
    if r.time is null then
      body := body
        || 'DTSTART;VALUE=DATE:' || to_char(r.date, 'YYYYMMDD') || E'\r\n'
        || 'DTEND;VALUE=DATE:' || to_char(r.date + 1, 'YYYYMMDD') || E'\r\n';
    else
      start_at := r.date + r.time;
      body := body
        || 'DTSTART:' || to_char(start_at, 'YYYYMMDD"T"HH24MISS') || E'\r\n'
        || 'DTEND:' || to_char(start_at + interval '1 hour', 'YYYYMMDD"T"HH24MISS') || E'\r\n';
    end if;
    body := body || public.ics_fold('SUMMARY:' || public.ics_text(r.summary)) || E'\r\n';
    if coalesce(r.notes, '') <> '' then
      body := body || public.ics_fold('DESCRIPTION:' || public.ics_text(r.notes)) || E'\r\n';
    end if;
    body := body || E'END:VEVENT\r\n';
  end loop;

  body := body || E'END:VCALENDAR\r\n';
  return convert_to(body, 'UTF8')::public."*/*";
end;
$$;

revoke all on function public.calendario(text) from public;
grant execute on function public.calendario(text) to anon, authenticated;

-- Lo usa la tarea automática de GitHub para que Supabase no pause el proyecto.
create or replace function public.ping()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.settings);
$$;

revoke all on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Primer trabajo: POAT
-- ---------------------------------------------------------------------------

do $$
declare
  subject_id uuid := '11111111-1111-4111-8111-111111111111';
  work_id uuid := '22222222-2222-4222-8222-222222222222';
begin
  if exists (select 1 from public.settings where key = 'seeded') then
    return;
  end if;

  insert into public.subjects (id, name, emoji, color, created_by)
  values (subject_id, 'Sin asignatura', '✏️', '#38BDF8', 'Almudena');

  insert into public.works (id, subject_id, title, description, created_by)
  values (work_id, subject_id, 'Trabajo POAT', '', 'Almudena');

  insert into public.entries (work_id, author, body)
  values (work_id, 'Almudena', 'He creado el Word del trabajo.');

  insert into public.tasks (work_id, title, assignees, created_by)
  values (
    work_id,
    'Revisar si tengo acceso al Word',
    array['Paula', 'Belén', 'María', 'Raquel'],
    'Almudena'
  );

  insert into public.settings (key, value) values ('seeded', 'true');
end;
$$;
