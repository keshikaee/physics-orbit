-- ─────────────────────────────────────────────────────────────
-- Admin-managed content with per-student access
--
--   1. One admin role: existing 'teacher' accounts become 'admin'.
--      ('teacher' stays in the enum as a legacy value; is_staff() still
--      accepts it so nothing breaks mid-deploy.)
--   2. Unit → Subtopic (topics table) → Materials (pdf/video/link/note).
--      The unused, empty lessons table is replaced by materials.
--   3. Access: every unit, topic and material has access_mode
--      'all' (every student) or 'selected' (only students in
--      content_grants). A student sees a row only if it is published,
--      allowed for them, AND its parent is visible to them — the parent
--      check is an EXISTS against the RLS-filtered parent table, so a
--      restriction higher up can never be overridden lower down.
--   4. Files live in the private 'materials' bucket. Students can read an
--      object only if they can see the materials row that points to it.
-- ─────────────────────────────────────────────────────────────

-- ── 1. Unified admin role ──
update public.profiles set role = 'admin' where role = 'teacher';

-- ── 2. Access mode ──
create type public.access_mode as enum ('all', 'selected');

alter table public.units  add column access_mode public.access_mode not null default 'all';
alter table public.topics add column access_mode public.access_mode not null default 'all';

-- ── 3. Replace lessons with materials ──
do $$
begin
  if exists (select 1 from public.lessons) then
    raise exception 'public.lessons contains rows; refusing to drop it';
  end if;
end $$;
drop table public.lessons;

create type public.material_kind as enum ('pdf', 'video', 'link', 'note');

create table public.materials (
  id            uuid primary key default gen_random_uuid(),
  topic_id      uuid not null references public.topics (id) on delete cascade,
  kind          public.material_kind not null,
  title         text not null check (char_length(title) between 1 and 200),
  description   text not null default '' check (char_length(description) <= 2000),
  notes         text not null default '' check (char_length(notes) <= 20000),
  url           text check (url is null or (url ~* '^https?://' and char_length(url) <= 2000)),
  storage_path  text unique check (storage_path is null or char_length(storage_path) <= 500),
  file_name     text check (file_name is null or char_length(file_name) <= 255),
  file_size     bigint check (file_size is null or file_size >= 0),
  mime_type     text check (mime_type is null or char_length(mime_type) <= 100),
  order_index   integer not null default 0,
  is_published  boolean not null default false,
  access_mode   public.access_mode not null default 'all',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint materials_source check (
    case kind
      when 'pdf'   then storage_path is not null and url is null
      when 'video' then (url is null) <> (storage_path is null)
      when 'link'  then url is not null and storage_path is null
      when 'note'  then url is null and storage_path is null and char_length(btrim(notes)) > 0
    end
  )
);
create index materials_topic_order_idx on public.materials (topic_id, order_index);
create trigger materials_touch before update on public.materials
  for each row execute function public.touch_updated_at();

-- ── 4. Per-student grants (one table for all three levels) ──
create table public.content_grants (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.profiles (id) on delete cascade,
  unit_id      uuid references public.units (id) on delete cascade,
  topic_id     uuid references public.topics (id) on delete cascade,
  material_id  uuid references public.materials (id) on delete cascade,
  created_at   timestamptz not null default now(),
  constraint content_grants_one_target check (num_nonnulls(unit_id, topic_id, material_id) = 1)
);
-- (student, item) lookups used by the RLS policies; also prevent duplicates.
create unique index content_grants_student_unit_idx     on public.content_grants (student_id, unit_id)     where unit_id is not null;
create unique index content_grants_student_topic_idx    on public.content_grants (student_id, topic_id)    where topic_id is not null;
create unique index content_grants_student_material_idx on public.content_grants (student_id, material_id) where material_id is not null;
-- Item → students lookups for the admin screens.
create index content_grants_unit_idx     on public.content_grants (unit_id)     where unit_id is not null;
create index content_grants_topic_idx    on public.content_grants (topic_id)    where topic_id is not null;
create index content_grants_material_idx on public.content_grants (material_id) where material_id is not null;

-- Grants may only point at student accounts.
create or replace function public.check_grant_student()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles where id = new.student_id and role = 'student') then
    raise exception 'access can only be granted to student accounts';
  end if;
  return new;
end;
$$;
create trigger content_grants_student_only before insert or update on public.content_grants
  for each row execute function public.check_grant_student();

-- ── 5. Row Level Security ──
alter table public.materials      enable row level security;
alter table public.content_grants enable row level security;

drop policy "Read units"  on public.units;
drop policy "Read topics" on public.topics;

create policy "Read units" on public.units for select to authenticated
  using (
    (select public.is_staff())
    or (
      is_published
      and (
        access_mode = 'all'
        or exists (select 1 from public.content_grants g
                   where g.unit_id = units.id and g.student_id = (select auth.uid()))
      )
      and exists (select 1 from public.courses c where c.id = units.course_id)
    )
  );

create policy "Read topics" on public.topics for select to authenticated
  using (
    (select public.is_staff())
    or (
      is_published
      and (
        access_mode = 'all'
        or exists (select 1 from public.content_grants g
                   where g.topic_id = topics.id and g.student_id = (select auth.uid()))
      )
      and exists (select 1 from public.units u where u.id = topics.unit_id)
    )
  );

create policy "Read materials" on public.materials for select to authenticated
  using (
    (select public.is_staff())
    or (
      is_published
      and (
        access_mode = 'all'
        or exists (select 1 from public.content_grants g
                   where g.material_id = materials.id and g.student_id = (select auth.uid()))
      )
      and exists (select 1 from public.topics t where t.id = materials.topic_id)
    )
  );

create policy "Staff write materials" on public.materials for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- Students may read their own grants (needed by the policies above); only staff write.
create policy "Read own grants" on public.content_grants for select to authenticated
  using (student_id = (select auth.uid()) or (select public.is_staff()));
create policy "Staff write grants" on public.content_grants for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- ── 6. Atomic access changes (shared by content-wise and student-wise screens) ──

-- Content-wise: set an item's mode and, for 'selected', exactly which students.
create or replace function public.set_content_access(
  p_kind text, p_id uuid, p_mode public.access_mode, p_students uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'admin only';
  end if;

  if p_kind = 'unit' then
    update public.units set access_mode = p_mode where id = p_id;
    if not found then raise exception 'unit not found'; end if;
    delete from public.content_grants where unit_id = p_id;
    if p_mode = 'selected' then
      insert into public.content_grants (student_id, unit_id)
      select distinct s, p_id from unnest(coalesce(p_students, '{}')) as s;
    end if;
  elsif p_kind = 'topic' then
    update public.topics set access_mode = p_mode where id = p_id;
    if not found then raise exception 'topic not found'; end if;
    delete from public.content_grants where topic_id = p_id;
    if p_mode = 'selected' then
      insert into public.content_grants (student_id, topic_id)
      select distinct s, p_id from unnest(coalesce(p_students, '{}')) as s;
    end if;
  elsif p_kind = 'material' then
    update public.materials set access_mode = p_mode where id = p_id;
    if not found then raise exception 'material not found'; end if;
    delete from public.content_grants where material_id = p_id;
    if p_mode = 'selected' then
      insert into public.content_grants (student_id, material_id)
      select distinct s, p_id from unnest(coalesce(p_students, '{}')) as s;
    end if;
  else
    raise exception 'unknown content kind %', p_kind;
  end if;
end;
$$;

-- Student-wise: allow or block one student on one item.
-- Blocking a student on an 'all' item switches it to 'selected' with every
-- other student granted, so nobody else loses access.
create or replace function public.set_student_access(
  p_student uuid, p_kind text, p_id uuid, p_allow boolean
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_mode public.access_mode;
begin
  if not public.is_staff() then
    raise exception 'admin only';
  end if;
  if not exists (select 1 from public.profiles where id = p_student and role = 'student') then
    raise exception 'student not found';
  end if;

  if p_kind = 'unit' then
    select access_mode into v_mode from public.units where id = p_id;
  elsif p_kind = 'topic' then
    select access_mode into v_mode from public.topics where id = p_id;
  elsif p_kind = 'material' then
    select access_mode into v_mode from public.materials where id = p_id;
  else
    raise exception 'unknown content kind %', p_kind;
  end if;
  if v_mode is null then
    raise exception '% not found', p_kind;
  end if;

  if p_allow then
    if v_mode = 'selected' then
      insert into public.content_grants (student_id, unit_id, topic_id, material_id)
      values (
        p_student,
        case when p_kind = 'unit' then p_id end,
        case when p_kind = 'topic' then p_id end,
        case when p_kind = 'material' then p_id end
      )
      on conflict do nothing;
    end if;
    return;
  end if;

  if v_mode = 'all' then
    perform public.set_content_access(
      p_kind, p_id, 'selected',
      array(select id from public.profiles where role = 'student' and id <> p_student)
    );
  else
    delete from public.content_grants
    where student_id = p_student
      and (unit_id = p_id or topic_id = p_id or material_id = p_id);
  end if;
end;
$$;

revoke all on function public.set_content_access(text, uuid, public.access_mode, uuid[]) from public;
revoke all on function public.set_student_access(uuid, text, uuid, boolean) from public;
grant execute on function public.set_content_access(text, uuid, public.access_mode, uuid[]) to authenticated;
grant execute on function public.set_student_access(uuid, text, uuid, boolean) to authenticated;

-- ── 7. Private file storage ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'materials', 'materials', false, 52428800,  -- 50 MB
  array['application/pdf', 'video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do nothing;

create policy "Staff manage material files" on storage.objects for all to authenticated
  using (bucket_id = 'materials' and (select public.is_staff()))
  with check (bucket_id = 'materials' and (select public.is_staff()));

-- The materials table is RLS-filtered for the caller, so this only matches
-- files attached to materials the student is allowed to see.
create policy "Students read permitted material files" on storage.objects for select to authenticated
  using (
    bucket_id = 'materials'
    and exists (select 1 from public.materials m where m.storage_path = storage.objects.name)
  );
