-- ─────────────────────────────────────────────────────────────
-- Curricula (Edexcel, Cambridge, Local, Other)
--
--   Curriculum → Course → Unit → Subtopic → Materials / Roadmap / Quizzes.
--   Each curriculum has exactly one course; everything below it is the
--   existing hierarchy, unchanged. Nothing is copied or deleted.
--
--   • The existing course "Pearson Edexcel International AS Physics"
--     (slug edexcel-ias-physics) and its units are Edexcel content, so it
--     is linked to the Edexcel curriculum. Any other pre-existing course is
--     left unassigned (invisible to students) rather than guessed.
--   • Students get a curriculum on their profile. Existing students are
--     NOT guessed: their curriculum stays empty until they complete their
--     profile once, or an admin sets it.
--   • Access: a student sees content only in their own curriculum. "All
--     students" now means all students of that curriculum — including
--     future registrations — without copying any per-student rows.
--     "Selected students" grants may only name students of that curriculum.
--   • Students can set their curriculum once (when empty); only admins can
--     change it. A change removes grants on other curricula's content and
--     is written to progress_audit. Progress rows are kept.
--
--   Reversal (if ever needed): drop the added policies/columns/table and
--   re-run the previous versions of the functions; no data was removed.
-- ─────────────────────────────────────────────────────────────

-- ── 1. Curricula ──
create table public.curricula (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 40),
  name         text not null check (char_length(name) between 1 and 80),
  description  text not null default '' check (char_length(description) <= 300),
  status       text not null default 'active' check (status in ('active', 'archived')),
  order_index  integer not null default 0,
  created_at   timestamptz not null default now()
);

insert into public.curricula (slug, name, description, order_index) values
  ('edexcel',   'Edexcel',   'Pearson Edexcel International AS Physics', 0),
  ('cambridge', 'Cambridge', 'Cambridge International Physics',          1),
  ('local',     'Local',     'Sri Lankan G.C.E. Advanced Level Physics', 2),
  ('other',     'Other',     'Other curricula',                          3);

alter table public.curricula enable row level security;
-- Names only; needed by the registration form and labels.
create policy "Anyone reads curricula" on public.curricula for select to anon, authenticated using (true);
create policy "Staff write curricula" on public.curricula for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- ── 2. One course per curriculum ──
alter table public.courses add column curriculum_id uuid unique references public.curricula (id) on delete restrict;

update public.courses
set curriculum_id = (select id from public.curricula where slug = 'edexcel')
where slug = 'edexcel-ias-physics';

insert into public.courses (slug, title, description, is_published, curriculum_id)
select v.slug, v.title, v.description, true, c.id
from (values
  ('cambridge-physics', 'cambridge', 'Cambridge International Physics', 'Physics for students following the Cambridge International curriculum.'),
  ('local-al-physics',  'local',     'G.C.E. Advanced Level Physics',   'Physics for students following the Sri Lankan G.C.E. A/L syllabus.'),
  ('other-physics',     'other',     'Physics',                         'Physics for students following other curricula.')
) as v (slug, curriculum, title, description)
join public.curricula c on c.slug = v.curriculum
where not exists (select 1 from public.courses where curriculum_id = c.id);

-- ── 3. Student profile details ──
alter table public.profiles
  add column curriculum_id      uuid references public.curricula (id) on delete restrict,
  add column date_of_birth      date check (date_of_birth is null or date_of_birth >= date '1900-01-01'),
  add column gender             text check (gender is null or gender in ('male', 'female', 'other', 'prefer_not_to_say')),
  add column district           text check (district is null or district in (
    'ampara', 'anuradhapura', 'badulla', 'batticaloa', 'colombo', 'galle', 'gampaha', 'hambantota',
    'jaffna', 'kalutara', 'kandy', 'kegalle', 'kilinochchi', 'kurunegala', 'mannar', 'matale', 'matara',
    'monaragala', 'mullaitivu', 'nuwara-eliya', 'polonnaruwa', 'puttalam', 'ratnapura', 'trincomalee', 'vavuniya')),
  add column institute          text check (institute is null or char_length(institute) between 1 and 200),
  add column phone              text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),  -- E.164, e.g. +94771234567
  add column whatsapp_available boolean not null default false,
  add column privacy_consent_at timestamptz;
create index profiles_curriculum_idx on public.profiles (curriculum_id) where role = 'student';

-- The caller's curriculum (null for staff and students who haven't chosen).
create or replace function public.my_curriculum()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select curriculum_id from public.profiles where id = auth.uid();
$$;
revoke all on function public.my_curriculum() from public, anon;
grant execute on function public.my_curriculum() to authenticated;

-- ── 4. Sign-up stores the details (validated; bad values become null) ──
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}');
  v_dob date;
  v_district text := lower(btrim(m ->> 'district'));
  v_gender text := m ->> 'gender';
  v_phone text := btrim(m ->> 'phone');
  v_institute text := nullif(btrim(m ->> 'institute'), '');
begin
  begin
    v_dob := (m ->> 'date_of_birth')::date;
    if v_dob < date '1900-01-01' or v_dob > current_date then v_dob := null; end if;
  exception when others then
    v_dob := null;
  end;

  insert into public.profiles (
    id, email, full_name, role,
    curriculum_id, date_of_birth, gender, district, institute, phone, whatsapp_available, privacy_consent_at
  )
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(m ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    'student',  -- never trust client-supplied metadata for the role
    (select id from public.curricula where slug = m ->> 'curriculum' and status = 'active'),
    v_dob,
    case when v_gender in ('male', 'female', 'other', 'prefer_not_to_say') then v_gender end,
    case when v_district in (
      'ampara', 'anuradhapura', 'badulla', 'batticaloa', 'colombo', 'galle', 'gampaha', 'hambantota',
      'jaffna', 'kalutara', 'kandy', 'kegalle', 'kilinochchi', 'kurunegala', 'mannar', 'matale', 'matara',
      'monaragala', 'mullaitivu', 'nuwara-eliya', 'polonnaruwa', 'puttalam', 'ratnapura', 'trincomalee', 'vavuniya')
      then v_district end,
    case when char_length(v_institute) <= 200 then v_institute end,
    case when v_phone ~ '^\+[1-9][0-9]{7,14}$' then v_phone end,
    coalesce(m ->> 'whatsapp_available', '') = 'true',
    case when (m ->> 'privacy_consent') = 'true' then now() end
  );
  return new;
end;
$$;

-- ── 5. Only admins change a curriculum once it is set ──
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();

  if auth.uid() is null then
    return new; -- service role / SQL editor
  end if;

  if new.id <> old.id or new.email <> old.email then
    raise exception 'id and email cannot be changed here';
  end if;

  if new.role <> old.role then
    raise exception 'role can only be changed by an administrator';
  end if;

  if new.status <> old.status then
    if not public.is_staff() then
      raise exception 'only staff can change account status';
    end if;
    if old.role <> 'student' then
      raise exception 'staff account status can only be changed by an administrator';
    end if;
  end if;

  if new.curriculum_id is distinct from old.curriculum_id and not public.is_staff() then
    -- A student may choose once (profile completion); after that only an admin can change it.
    if old.curriculum_id is not null or new.curriculum_id is null then
      raise exception 'only an administrator can change your curriculum';
    end if;
    if not exists (select 1 from public.curricula where id = new.curriculum_id and status = 'active') then
      raise exception 'unknown curriculum';
    end if;
  end if;

  if new.date_of_birth is distinct from old.date_of_birth and new.date_of_birth > current_date then
    raise exception 'date of birth cannot be in the future';
  end if;

  return new;
end;
$$;

-- ── 6. Which curriculum does a piece of content belong to? ──
create or replace function public.unit_curriculum(p_unit uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.curriculum_id from public.units u join public.courses c on c.id = u.course_id where u.id = p_unit;
$$;

create or replace function public.grant_curriculum(p_unit uuid, p_topic uuid, p_material uuid, p_node uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select public.unit_curriculum(coalesce(
    p_unit,
    (select unit_id from public.topics where id = p_topic),
    (select t.unit_id from public.materials m join public.topics t on t.id = m.topic_id where m.id = p_material),
    (select r.unit_id from public.roadmap_nodes n join public.roadmaps r on r.id = n.roadmap_id where n.id = p_node)
  ));
$$;
revoke all on function public.unit_curriculum(uuid) from public, anon;
revoke all on function public.grant_curriculum(uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.unit_curriculum(uuid) to authenticated;
grant execute on function public.grant_curriculum(uuid, uuid, uuid, uuid) to authenticated;

-- Selected-student grants: students of the content's own curriculum only.
create or replace function public.check_grant_student()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_curriculum uuid;
begin
  select curriculum_id into v_student_curriculum
  from public.profiles where id = new.student_id and role = 'student';
  if not found then
    raise exception 'access can only be granted to student accounts';
  end if;
  if v_student_curriculum is null
     or v_student_curriculum is distinct from public.grant_curriculum(new.unit_id, new.topic_id, new.material_id, new.node_id) then
    raise exception 'access can only be granted to students of this curriculum';
  end if;
  return new;
end;
$$;

-- ── 7. Curriculum changes: drop grants on other curricula's content; audit ──
create or replace function public.on_curriculum_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_removed integer;
begin
  with gone as (
    delete from public.content_grants g
    where g.student_id = new.id
      and public.grant_curriculum(g.unit_id, g.topic_id, g.material_id, g.node_id) is distinct from new.curriculum_id
    returning 1
  )
  select count(*) into v_removed from gone;

  if old.curriculum_id is not null then
    insert into public.progress_audit (admin_id, student_id, action, details)
    values (
      auth.uid(), new.id, 'curriculum_change',
      jsonb_build_object(
        'from', (select name from public.curricula where id = old.curriculum_id),
        'to', (select name from public.curricula where id = new.curriculum_id),
        'grants_removed', v_removed
      )
    );
  end if;
  return new;
end;
$$;
create trigger profiles_curriculum_change after update of curriculum_id on public.profiles
  for each row when (old.curriculum_id is distinct from new.curriculum_id)
  execute function public.on_curriculum_change();

-- ── 8. Visibility: the unit check now includes the curriculum ──
-- (topics, materials, roadmap steps and quizzes all chain through this.)
create or replace function public.can_view_unit(p_unit uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_staff() or exists (
    select 1
    from public.units u
    join public.courses c on c.id = u.course_id
    where u.id = p_unit
      and u.is_published
      and c.is_published
      and c.curriculum_id is not null
      and c.curriculum_id = public.my_curriculum()
      and public.is_active_member()
      and (u.access_mode = 'all'
           or exists (select 1 from public.content_grants g where g.unit_id = u.id and g.student_id = auth.uid()))
  );
$$;

drop policy "Read courses" on public.courses;
create policy "Read courses" on public.courses for select to authenticated
  using (
    (select public.is_staff())
    or (is_published and curriculum_id is not null and curriculum_id = (select public.my_curriculum())
        and (select public.is_active_member()))
  );

-- ── 9. Student-wise blocking keeps everyone else in the same curriculum ──
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
  v_curriculum uuid;
begin
  if not public.is_staff() then
    raise exception 'admin only';
  end if;
  if not exists (select 1 from public.profiles where id = p_student and role = 'student') then
    raise exception 'student not found';
  end if;

  if p_kind = 'unit' then
    select access_mode into v_mode from public.units where id = p_id;
    v_curriculum := public.grant_curriculum(p_id, null, null, null);
  elsif p_kind = 'topic' then
    select access_mode into v_mode from public.topics where id = p_id;
    v_curriculum := public.grant_curriculum(null, p_id, null, null);
  elsif p_kind = 'material' then
    select access_mode into v_mode from public.materials where id = p_id;
    v_curriculum := public.grant_curriculum(null, null, p_id, null);
  elsif p_kind = 'node' then
    select access_mode into v_mode from public.roadmap_nodes where id = p_id;
    v_curriculum := public.grant_curriculum(null, null, null, p_id);
  else
    raise exception 'unknown content kind %', p_kind;
  end if;
  if v_mode is null then
    raise exception '% not found', p_kind;
  end if;

  if p_allow then
    if v_mode = 'selected' then
      insert into public.content_grants (student_id, unit_id, topic_id, material_id, node_id)
      values (
        p_student,
        case when p_kind = 'unit' then p_id end,
        case when p_kind = 'topic' then p_id end,
        case when p_kind = 'material' then p_id end,
        case when p_kind = 'node' then p_id end
      )
      on conflict do nothing;
    end if;
    return;
  end if;

  if v_mode = 'all' then
    perform public.set_content_access(
      p_kind, p_id, 'selected',
      array(select id from public.profiles
            where role = 'student' and id <> p_student and curriculum_id = v_curriculum)
    );
  else
    delete from public.content_grants
    where student_id = p_student
      and (unit_id = p_id or topic_id = p_id or material_id = p_id or node_id = p_id);
  end if;
end;
$$;
