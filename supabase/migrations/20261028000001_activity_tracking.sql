-- ─────────────────────────────────────────────────────────────
-- Student interaction tracking (admin analytics)
--
--   1. activity_events: one row per student interaction (sign-in, page
--      visits, material opens, quiz opens). Quiz submissions and step
--      completions are NOT copied here — the analytics read them from
--      quiz_attempts / node_completions, which already record them.
--   2. log_activity(): the ONLY way to write an event. SECURITY DEFINER;
--      it records for the current user only, only for active students,
--      only for content they can actually see (the same can_view_*
--      functions as everywhere else), and ignores repeats of the same
--      event within a short window so refreshes don't inflate counts.
--   3. RLS: staff read; nobody writes directly (students cannot read,
--      insert, change or delete events).
-- Additive only: no existing table, policy or function is changed.
-- ─────────────────────────────────────────────────────────────

create type public.activity_kind as enum (
  'sign_in',
  'dashboard_view',
  'courses_view',
  'unit_view',
  'topic_view',
  'material_view',
  'quiz_view'
);

create table public.activity_events (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.profiles (id) on delete cascade,
  kind         public.activity_kind not null,
  -- Context, resolved on the server. Kept (set null) if content is deleted;
  -- `title` is a snapshot so history still reads sensibly afterwards.
  unit_id      uuid references public.units (id) on delete set null,
  topic_id     uuid references public.topics (id) on delete set null,
  material_id  uuid references public.materials (id) on delete set null,
  quiz_id      uuid references public.quizzes (id) on delete set null,
  title        text not null default '' check (char_length(title) <= 300),
  created_at   timestamptz not null default now()
);
create index activity_events_student_idx on public.activity_events (student_id, created_at desc);
create index activity_events_created_idx on public.activity_events (created_at desc);
create index activity_events_material_idx on public.activity_events (material_id) where material_id is not null;

alter table public.activity_events enable row level security;
create policy "Staff read activity" on public.activity_events for select to authenticated
  using ((select public.is_staff()));
-- No insert/update/delete policies: writes go through log_activity() only.

create or replace function public.log_activity(p_kind public.activity_kind, p_target uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_unit     uuid;
  v_topic    uuid;
  v_material uuid;
  v_quiz     uuid;
  v_title    text := '';
  v_window   interval := case when p_kind = 'sign_in' then interval '1 minute' else interval '10 minutes' end;
begin
  -- Only active students are tracked; anyone else is silently ignored.
  if v_uid is null or not exists (
    select 1 from public.profiles where id = v_uid and role = 'student' and status = 'active'
  ) then
    return;
  end if;

  if p_kind in ('unit_view', 'topic_view', 'material_view', 'quiz_view') and p_target is null then
    return;
  end if;

  if p_kind = 'unit_view' then
    if not public.can_view_unit(p_target) then return; end if;
    select u.id, u.code || ': ' || u.title into v_unit, v_title from public.units u where u.id = p_target;
  elsif p_kind = 'topic_view' then
    if not public.can_view_topic(p_target) then return; end if;
    select t.unit_id, t.id, t.title into v_unit, v_topic, v_title from public.topics t where t.id = p_target;
  elsif p_kind = 'material_view' then
    if not public.can_view_material(p_target) then return; end if;
    select t.unit_id, t.id, m.id, m.title into v_unit, v_topic, v_material, v_title
    from public.materials m join public.topics t on t.id = m.topic_id where m.id = p_target;
  elsif p_kind = 'quiz_view' then
    if not public.can_view_quiz(p_target) then return; end if;
    select r.unit_id, q.id, q.title into v_unit, v_quiz, v_title
    from public.quizzes q
    join public.roadmap_nodes n on n.id = q.node_id
    join public.roadmaps r on r.id = n.roadmap_id
    where q.id = p_target;
  end if;

  -- Ignore a repeat of the same event within the window (refreshes, double renders).
  if exists (
    select 1 from public.activity_events e
    where e.student_id = v_uid
      and e.kind = p_kind
      and e.created_at > now() - v_window
      and e.unit_id is not distinct from v_unit
      and e.topic_id is not distinct from v_topic
      and e.material_id is not distinct from v_material
      and e.quiz_id is not distinct from v_quiz
  ) then
    return;
  end if;

  insert into public.activity_events (student_id, kind, unit_id, topic_id, material_id, quiz_id, title)
  values (v_uid, p_kind, v_unit, v_topic, v_material, v_quiz, left(coalesce(v_title, ''), 300));
end;
$$;

revoke all on function public.log_activity(public.activity_kind, uuid) from public, anon;
grant execute on function public.log_activity(public.activity_kind, uuid) to authenticated;
