-- ─────────────────────────────────────────────────────────────
-- Unit roadmaps, quizzes and per-student progress
--
--   1. One visibility function per level (unit → topic → material →
--      roadmap node → quiz). The existing read policies are rewritten to
--      use them, so content and roadmaps share ONE access rule: a student
--      sees something only if it and every parent are published and
--      allowed for them. Roadmap nodes reuse content_grants.
--   2. roadmaps / roadmap_nodes / roadmap_edges / roadmap_node_materials:
--      one roadmap per unit; nodes link to existing subtopics and
--      materials (never copies). Node ids are stable across saves so
--      progress survives edits.
--   3. quizzes / questions / question_choices / question_keys: answer
--      keys live in their own staff-only table and never reach students.
--   4. quiz_attempts / attempt_responses / node_completions: written only
--      by SECURITY DEFINER functions that check access, grade on the
--      server and serialise submissions. Students have no write policies.
--   5. progress_audit: every admin reset, override and re-mark.
-- ─────────────────────────────────────────────────────────────

-- ── 1. Enums ──
create type public.node_kind          as enum ('lesson', 'resource', 'quiz', 'milestone', 'final');
create type public.completion_rule    as enum ('all_required', 'min_quizzes', 'student_mark', 'admin_confirm');
create type public.restricted_display as enum ('hide', 'lock');
create type public.question_kind      as enum ('mcq_single', 'mcq_multi', 'short', 'numeric');
create type public.answer_reveal      as enum ('never', 'after_submit', 'after_pass');
create type public.attempt_status     as enum ('awaiting_marking', 'marked');
create type public.completion_source  as enum ('auto', 'student', 'admin');
create type public.tolerance_kind     as enum ('absolute', 'percent');

-- ── 2. Roadmap tables ──
create table public.roadmaps (
  id                  uuid primary key default gen_random_uuid(),
  unit_id             uuid not null unique references public.units (id) on delete cascade,
  is_published        boolean not null default false,
  restricted_display  public.restricted_display not null default 'hide',
  version             integer not null default 1,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger roadmaps_touch before update on public.roadmaps
  for each row execute function public.touch_updated_at();

create table public.roadmap_nodes (
  id                  uuid primary key default gen_random_uuid(),
  roadmap_id          uuid not null references public.roadmaps (id) on delete cascade,
  kind                public.node_kind not null default 'lesson',
  title               text not null check (char_length(title) between 1 and 200),
  description         text not null default '' check (char_length(description) <= 2000),
  pos_x               double precision not null default 0,
  pos_y               double precision not null default 0,
  topic_id            uuid references public.topics (id) on delete set null,
  is_required         boolean not null default true,
  completion_rule     public.completion_rule not null default 'all_required',
  min_quizzes         integer check (min_quizzes is null or min_quizzes between 1 and 100),
  lock_until_prereqs  boolean not null default false,
  access_mode         public.access_mode not null default 'all',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index roadmap_nodes_roadmap_idx on public.roadmap_nodes (roadmap_id);
create index roadmap_nodes_topic_idx   on public.roadmap_nodes (topic_id) where topic_id is not null;
create trigger roadmap_nodes_touch before update on public.roadmap_nodes
  for each row execute function public.touch_updated_at();

create table public.roadmap_node_materials (
  node_id      uuid not null references public.roadmap_nodes (id) on delete cascade,
  material_id  uuid not null references public.materials (id) on delete cascade,
  order_index  integer not null default 0,
  primary key (node_id, material_id)
);
create index roadmap_node_materials_material_idx on public.roadmap_node_materials (material_id);

create table public.roadmap_edges (
  roadmap_id  uuid not null references public.roadmaps (id) on delete cascade,
  source_id   uuid not null references public.roadmap_nodes (id) on delete cascade,
  target_id   uuid not null references public.roadmap_nodes (id) on delete cascade,
  primary key (source_id, target_id),
  check (source_id <> target_id)
);
create index roadmap_edges_roadmap_idx on public.roadmap_edges (roadmap_id);
create index roadmap_edges_target_idx  on public.roadmap_edges (target_id);

-- Linked content must belong to the roadmap's own unit; edges stay inside one roadmap.
create or replace function public.check_roadmap_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_unit uuid;
begin
  if tg_table_name = 'roadmap_nodes' then
    if new.topic_id is not null then
      select unit_id into v_unit from public.roadmaps where id = new.roadmap_id;
      if not exists (select 1 from public.topics where id = new.topic_id and unit_id = v_unit) then
        raise exception 'linked subtopic must belong to this unit';
      end if;
    end if;
  elsif tg_table_name = 'roadmap_node_materials' then
    if not exists (
      select 1 from public.roadmap_nodes n
      join public.roadmaps r on r.id = n.roadmap_id
      join public.materials m on m.id = new.material_id
      join public.topics t on t.id = m.topic_id
      where n.id = new.node_id and t.unit_id = r.unit_id
    ) then
      raise exception 'linked material must belong to this unit';
    end if;
  elsif tg_table_name = 'roadmap_edges' then
    if (select count(*) from public.roadmap_nodes
        where id in (new.source_id, new.target_id) and roadmap_id = new.roadmap_id) <> 2 then
      raise exception 'connections must join steps of the same roadmap';
    end if;
  end if;
  return new;
end;
$$;
create trigger roadmap_nodes_links before insert or update on public.roadmap_nodes
  for each row execute function public.check_roadmap_links();
create trigger roadmap_node_materials_links before insert or update on public.roadmap_node_materials
  for each row execute function public.check_roadmap_links();
create trigger roadmap_edges_links before insert or update on public.roadmap_edges
  for each row execute function public.check_roadmap_links();

-- ── 3. Node access reuses content_grants ──
alter table public.content_grants add column node_id uuid references public.roadmap_nodes (id) on delete cascade;
alter table public.content_grants drop constraint content_grants_one_target;
alter table public.content_grants add constraint content_grants_one_target
  check (num_nonnulls(unit_id, topic_id, material_id, node_id) = 1);
create unique index content_grants_student_node_idx on public.content_grants (student_id, node_id) where node_id is not null;
create index content_grants_node_idx on public.content_grants (node_id) where node_id is not null;

-- ── 4. Quiz tables ──
create table public.quizzes (
  id            uuid primary key default gen_random_uuid(),
  node_id       uuid not null references public.roadmap_nodes (id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 200),
  description   text not null default '' check (char_length(description) <= 2000),
  order_index   integer not null default 0,
  pass_percent  integer not null default 60 check (pass_percent between 0 and 100),
  max_attempts  integer check (max_attempts is null or max_attempts between 1 and 100),  -- null = unlimited
  reveal        public.answer_reveal not null default 'after_submit',
  require_pass  boolean not null default true,   -- false: any submitted attempt counts
  is_required   boolean not null default true,   -- counts towards the node's completion
  is_published  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index quizzes_node_idx on public.quizzes (node_id, order_index);
create trigger quizzes_touch before update on public.quizzes
  for each row execute function public.touch_updated_at();

create table public.questions (
  id           uuid primary key default gen_random_uuid(),
  quiz_id      uuid not null references public.quizzes (id) on delete cascade,
  kind         public.question_kind not null,
  prompt       text not null check (char_length(prompt) between 1 and 5000),
  image_path   text unique check (image_path is null or char_length(image_path) <= 500),
  marks        numeric(6, 2) not null default 1 check (marks > 0 and marks <= 1000),
  order_index  integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index questions_quiz_idx on public.questions (quiz_id, order_index);
create trigger questions_touch before update on public.questions
  for each row execute function public.touch_updated_at();

create table public.question_choices (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references public.questions (id) on delete cascade,
  label        text not null check (char_length(label) between 1 and 1000),
  order_index  integer not null default 0
);
create index question_choices_question_idx on public.question_choices (question_id, order_index);

-- Everything that gives the answer away. Staff-only; students never read it.
create table public.question_keys (
  question_id       uuid primary key references public.questions (id) on delete cascade,
  correct_choice_ids uuid[] not null default '{}',
  numeric_answer    double precision,
  tolerance         double precision not null default 0 check (tolerance >= 0),
  tolerance_kind    public.tolerance_kind not null default 'absolute',
  units             text[] not null default '{}',       -- accepted units; empty = no unit required
  auto_exact        boolean not null default false,     -- short answer: exact-match marking switched on
  accepted_answers  text[] not null default '{}',
  case_sensitive    boolean not null default false,
  model_answer      text not null default '' check (char_length(model_answer) <= 5000),
  explanation       text not null default '' check (char_length(explanation) <= 5000)
);

-- ── 5. Attempts, responses, completions, audit ──
create table public.quiz_attempts (
  id            uuid primary key default gen_random_uuid(),
  quiz_id       uuid not null references public.quizzes (id) on delete cascade,
  student_id    uuid not null references public.profiles (id) on delete cascade,
  attempt_no    integer not null check (attempt_no >= 1),
  status        public.attempt_status not null,
  score         numeric(8, 2) not null default 0,
  max_score     numeric(8, 2) not null default 0,
  passed        boolean,              -- null while answers await marking
  submitted_at  timestamptz not null default now(),
  marked_at     timestamptz,
  marked_by     uuid references public.profiles (id) on delete set null,
  unique (quiz_id, student_id, attempt_no)
);
create index quiz_attempts_student_idx on public.quiz_attempts (student_id, quiz_id);
create index quiz_attempts_awaiting_idx on public.quiz_attempts (submitted_at) where status = 'awaiting_marking';

create table public.attempt_responses (
  id               uuid primary key default gen_random_uuid(),
  attempt_id       uuid not null references public.quiz_attempts (id) on delete cascade,
  question_id      uuid references public.questions (id) on delete set null,
  -- Snapshot so past attempts still make sense after the quiz is edited.
  question_kind    public.question_kind not null,
  prompt           text not null,
  marks_available  numeric(6, 2) not null,
  answer           jsonb not null default '{}',
  auto_marks       numeric(6, 2),
  awarded_marks    numeric(6, 2),     -- null = awaiting manual marking
  feedback         text not null default '' check (char_length(feedback) <= 2000),
  marked_by        uuid references public.profiles (id) on delete set null,
  marked_at        timestamptz
);
create index attempt_responses_attempt_idx on public.attempt_responses (attempt_id);

create table public.node_completions (
  student_id    uuid not null references public.profiles (id) on delete cascade,
  node_id       uuid not null references public.roadmap_nodes (id) on delete cascade,
  source        public.completion_source not null,
  completed_at  timestamptz not null default now(),
  completed_by  uuid references public.profiles (id) on delete set null,
  primary key (student_id, node_id)
);
create index node_completions_node_idx on public.node_completions (node_id);

create table public.progress_audit (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid references public.profiles (id) on delete set null,
  student_id  uuid not null references public.profiles (id) on delete cascade,
  action      text not null,
  node_id     uuid,          -- no FKs: the record outlives deleted content
  quiz_id     uuid,
  attempt_id  uuid,
  details     jsonb not null default '{}',
  reason      text not null default '' check (char_length(reason) <= 1000),
  created_at  timestamptz not null default now()
);
create index progress_audit_student_idx on public.progress_audit (student_id, created_at desc);

-- ── 6. Visibility functions (the single access rule) ──
-- SECURITY DEFINER so they can follow the parent chain without RLS
-- recursion; each one checks the CURRENT user via auth.uid().

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
      and public.is_active_member()
      and (u.access_mode = 'all'
           or exists (select 1 from public.content_grants g where g.unit_id = u.id and g.student_id = auth.uid()))
  );
$$;

create or replace function public.can_view_topic(p_topic uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_staff() or exists (
    select 1 from public.topics t
    where t.id = p_topic
      and t.is_published
      and (t.access_mode = 'all'
           or exists (select 1 from public.content_grants g where g.topic_id = t.id and g.student_id = auth.uid()))
      and public.can_view_unit(t.unit_id)
  );
$$;

create or replace function public.can_view_material(p_material uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_staff() or exists (
    select 1 from public.materials m
    where m.id = p_material
      and m.is_published
      and (m.access_mode = 'all'
           or exists (select 1 from public.content_grants g where g.material_id = m.id and g.student_id = auth.uid()))
      and public.can_view_topic(m.topic_id)
  );
$$;

-- A node is visible when its roadmap is published, the unit is visible,
-- the node itself is allowed, its linked subtopic (if any) is visible,
-- and — when it links materials — at least one of them is visible.
create or replace function public.can_view_node(p_node uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_staff() or exists (
    select 1
    from public.roadmap_nodes n
    join public.roadmaps r on r.id = n.roadmap_id
    where n.id = p_node
      and r.is_published
      and public.can_view_unit(r.unit_id)
      and (n.access_mode = 'all'
           or exists (select 1 from public.content_grants g where g.node_id = n.id and g.student_id = auth.uid()))
      and (n.topic_id is null or public.can_view_topic(n.topic_id))
      and (not exists (select 1 from public.roadmap_node_materials nm where nm.node_id = n.id)
           or exists (select 1 from public.roadmap_node_materials nm
                      where nm.node_id = n.id and public.can_view_material(nm.material_id)))
  );
$$;

create or replace function public.can_view_quiz(p_quiz uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_staff() or exists (
    select 1 from public.quizzes q
    where q.id = p_quiz and q.is_published and public.can_view_node(q.node_id)
  );
$$;

do $$
declare f text;
begin
  foreach f in array array['can_view_unit', 'can_view_topic', 'can_view_material', 'can_view_node', 'can_view_quiz'] loop
    execute format('revoke all on function public.%I(uuid) from public', f);
    execute format('grant execute on function public.%I(uuid) to authenticated', f);
  end loop;
end $$;

-- ── 7. Row Level Security ──
-- Existing content policies now use the shared functions (same rule as before).
drop policy "Read units"     on public.units;
drop policy "Read topics"    on public.topics;
drop policy "Read materials" on public.materials;
create policy "Read units"     on public.units     for select to authenticated using (public.can_view_unit(id));
create policy "Read topics"    on public.topics    for select to authenticated using (public.can_view_topic(id));
create policy "Read materials" on public.materials for select to authenticated using (public.can_view_material(id));

alter table public.roadmaps               enable row level security;
alter table public.roadmap_nodes          enable row level security;
alter table public.roadmap_node_materials enable row level security;
alter table public.roadmap_edges          enable row level security;
alter table public.quizzes                enable row level security;
alter table public.questions              enable row level security;
alter table public.question_choices       enable row level security;
alter table public.question_keys          enable row level security;
alter table public.quiz_attempts          enable row level security;
alter table public.attempt_responses      enable row level security;
alter table public.node_completions       enable row level security;
alter table public.progress_audit         enable row level security;

create policy "Read roadmaps" on public.roadmaps for select to authenticated
  using ((select public.is_staff()) or (is_published and public.can_view_unit(unit_id)));
create policy "Read roadmap nodes" on public.roadmap_nodes for select to authenticated
  using (public.can_view_node(id));
create policy "Read node materials" on public.roadmap_node_materials for select to authenticated
  using ((select public.is_staff()) or (public.can_view_node(node_id) and public.can_view_material(material_id)));
create policy "Read roadmap edges" on public.roadmap_edges for select to authenticated
  using ((select public.is_staff()) or (public.can_view_node(source_id) and public.can_view_node(target_id)));
create policy "Read quizzes" on public.quizzes for select to authenticated
  using (public.can_view_quiz(id));
create policy "Read questions" on public.questions for select to authenticated
  using ((select public.is_staff()) or public.can_view_quiz(quiz_id));
create policy "Read choices" on public.question_choices for select to authenticated
  using ((select public.is_staff())
         or exists (select 1 from public.questions q where q.id = question_id and public.can_view_quiz(q.quiz_id)));
create policy "Staff read keys" on public.question_keys for select to authenticated
  using ((select public.is_staff()));

-- Structure: staff write directly; students never.
create policy "Staff write roadmaps" on public.roadmaps for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "Staff write roadmap nodes" on public.roadmap_nodes for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "Staff write node materials" on public.roadmap_node_materials for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "Staff write roadmap edges" on public.roadmap_edges for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "Staff write quizzes" on public.quizzes for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "Staff write questions" on public.questions for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "Staff write choices" on public.question_choices for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "Staff write keys" on public.question_keys for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- Progress: read own (or staff). No write policies — only the functions below write.
create policy "Read own attempts" on public.quiz_attempts for select to authenticated
  using (student_id = (select auth.uid()) or (select public.is_staff()));
create policy "Read own responses" on public.attempt_responses for select to authenticated
  using ((select public.is_staff())
         or exists (select 1 from public.quiz_attempts a where a.id = attempt_id and a.student_id = (select auth.uid())));
create policy "Read own completions" on public.node_completions for select to authenticated
  using (student_id = (select auth.uid()) or (select public.is_staff()));
create policy "Staff read audit" on public.progress_audit for select to authenticated
  using ((select public.is_staff()));

-- ── 8. Access functions learn about roadmap nodes ──
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
  elsif p_kind = 'topic' then
    update public.topics set access_mode = p_mode where id = p_id;
    if not found then raise exception 'topic not found'; end if;
    delete from public.content_grants where topic_id = p_id;
  elsif p_kind = 'material' then
    update public.materials set access_mode = p_mode where id = p_id;
    if not found then raise exception 'material not found'; end if;
    delete from public.content_grants where material_id = p_id;
  elsif p_kind = 'node' then
    update public.roadmap_nodes set access_mode = p_mode where id = p_id;
    if not found then raise exception 'roadmap step not found'; end if;
    delete from public.content_grants where node_id = p_id;
  else
    raise exception 'unknown content kind %', p_kind;
  end if;

  if p_mode = 'selected' then
    insert into public.content_grants (student_id, unit_id, topic_id, material_id, node_id)
    select distinct s,
      case when p_kind = 'unit' then p_id end,
      case when p_kind = 'topic' then p_id end,
      case when p_kind = 'material' then p_id end,
      case when p_kind = 'node' then p_id end
    from unnest(coalesce(p_students, '{}')) as s;
  end if;
end;
$$;

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
  elsif p_kind = 'node' then
    select access_mode into v_mode from public.roadmap_nodes where id = p_id;
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
      array(select id from public.profiles where role = 'student' and id <> p_student)
    );
  else
    delete from public.content_grants
    where student_id = p_student
      and (unit_id = p_id or topic_id = p_id or material_id = p_id or node_id = p_id);
  end if;
end;
$$;

-- ── 9. Saving a roadmap (whole diagram, one transaction) ──
-- Nodes are upserted by id, so existing steps — and the progress attached
-- to them — survive. Steps missing from the payload are deleted.
-- p_version guards against two editors overwriting each other.
create or replace function public.save_roadmap(
  p_roadmap uuid, p_version integer, p_nodes jsonb, p_edges jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_version integer;
  v_ids uuid[];
  n jsonb;
  v_id uuid;
begin
  if not public.is_staff() then
    raise exception 'admin only';
  end if;

  select version into v_version from public.roadmaps where id = p_roadmap for update;
  if not found then raise exception 'roadmap not found'; end if;
  if v_version <> p_version then
    raise exception 'roadmap_conflict: this roadmap was saved somewhere else';
  end if;

  v_ids := array(select (e ->> 'id')::uuid from jsonb_array_elements(p_nodes) e);
  if exists (select 1 from public.roadmap_nodes where id = any (v_ids) and roadmap_id <> p_roadmap) then
    raise exception 'a step belongs to another roadmap';
  end if;

  delete from public.roadmap_edges where roadmap_id = p_roadmap;
  delete from public.roadmap_nodes where roadmap_id = p_roadmap and not (id = any (v_ids));

  for n in select * from jsonb_array_elements(p_nodes) loop
    v_id := (n ->> 'id')::uuid;
    insert into public.roadmap_nodes as rn (
      id, roadmap_id, kind, title, description, pos_x, pos_y, topic_id,
      is_required, completion_rule, min_quizzes, lock_until_prereqs
    ) values (
      v_id, p_roadmap,
      (n ->> 'kind')::public.node_kind,
      n ->> 'title',
      coalesce(n ->> 'description', ''),
      (n ->> 'x')::double precision,
      (n ->> 'y')::double precision,
      nullif(n ->> 'topicId', '')::uuid,
      coalesce((n ->> 'isRequired')::boolean, true),
      (n ->> 'completionRule')::public.completion_rule,
      nullif(n ->> 'minQuizzes', '')::integer,
      coalesce((n ->> 'lockUntilPrereqs')::boolean, false)
    )
    on conflict (id) do update set
      kind = excluded.kind,
      title = excluded.title,
      description = excluded.description,
      pos_x = excluded.pos_x,
      pos_y = excluded.pos_y,
      topic_id = excluded.topic_id,
      is_required = excluded.is_required,
      completion_rule = excluded.completion_rule,
      min_quizzes = excluded.min_quizzes,
      lock_until_prereqs = excluded.lock_until_prereqs;

    delete from public.roadmap_node_materials where node_id = v_id;
    insert into public.roadmap_node_materials (node_id, material_id, order_index)
    select v_id, m::uuid, (ord - 1)::integer
    from jsonb_array_elements_text(coalesce(n -> 'materialIds', '[]')) with ordinality as t(m, ord);

    perform public.set_content_access(
      'node', v_id,
      coalesce(n ->> 'accessMode', 'all')::public.access_mode,
      array(select s::uuid from jsonb_array_elements_text(coalesce(n -> 'studentIds', '[]')) s)
    );
  end loop;

  insert into public.roadmap_edges (roadmap_id, source_id, target_id)
  select distinct p_roadmap, (e ->> 'source')::uuid, (e ->> 'target')::uuid
  from jsonb_array_elements(p_edges) e;

  update public.roadmaps set version = version + 1 where id = p_roadmap returning version into v_version;
  return v_version;
end;
$$;

-- ── 10. Saving a quiz (settings + questions + keys, one transaction) ──
create or replace function public.save_quiz(p_quiz jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := (p_quiz ->> 'id')::uuid;
  v_node uuid := (p_quiz ->> 'nodeId')::uuid;
  v_existing_node uuid;
  q jsonb;
  c jsonb;
  v_qid uuid;
  v_kind public.question_kind;
  v_qids uuid[];
  v_cids uuid[];
  v_correct uuid[];
  v_order integer := 0;
begin
  if not public.is_staff() then
    raise exception 'admin only';
  end if;

  select node_id into v_existing_node from public.quizzes where id = v_id;
  if v_existing_node is not null and v_existing_node <> v_node then
    raise exception 'a quiz cannot move to another step';
  end if;

  insert into public.quizzes as qz (
    id, node_id, title, description, order_index, pass_percent, max_attempts,
    reveal, require_pass, is_required, is_published
  ) values (
    v_id, v_node,
    p_quiz ->> 'title',
    coalesce(p_quiz ->> 'description', ''),
    coalesce((select max(order_index) + 1 from public.quizzes where node_id = v_node), 0),
    (p_quiz ->> 'passPercent')::integer,
    nullif(p_quiz ->> 'maxAttempts', '')::integer,
    (p_quiz ->> 'reveal')::public.answer_reveal,
    (p_quiz ->> 'requirePass')::boolean,
    (p_quiz ->> 'isRequired')::boolean,
    (p_quiz ->> 'isPublished')::boolean
  )
  on conflict (id) do update set
    title = excluded.title,
    description = excluded.description,
    pass_percent = excluded.pass_percent,
    max_attempts = excluded.max_attempts,
    reveal = excluded.reveal,
    require_pass = excluded.require_pass,
    is_required = excluded.is_required,
    is_published = excluded.is_published;

  v_qids := array(select (e ->> 'id')::uuid from jsonb_array_elements(p_quiz -> 'questions') e);
  if exists (select 1 from public.questions where id = any (v_qids) and quiz_id <> v_id) then
    raise exception 'a question belongs to another quiz';
  end if;
  delete from public.questions where quiz_id = v_id and not (id = any (v_qids));

  for q in select * from jsonb_array_elements(p_quiz -> 'questions') loop
    v_qid := (q ->> 'id')::uuid;
    v_kind := (q ->> 'kind')::public.question_kind;

    insert into public.questions (id, quiz_id, kind, prompt, image_path, marks, order_index)
    values (v_qid, v_id, v_kind, q ->> 'prompt', nullif(q ->> 'imagePath', ''), (q ->> 'marks')::numeric, v_order)
    on conflict (id) do update set
      kind = excluded.kind,
      prompt = excluded.prompt,
      image_path = excluded.image_path,
      marks = excluded.marks,
      order_index = excluded.order_index;
    v_order := v_order + 1;

    -- Choices (only for multiple choice; other kinds have none).
    if v_kind in ('mcq_single', 'mcq_multi') then
      v_cids := array(select (e ->> 'id')::uuid from jsonb_array_elements(q -> 'choices') e);
      if cardinality(v_cids) < 2 then raise exception 'multiple choice needs at least two choices'; end if;
      if exists (select 1 from public.question_choices where id = any (v_cids) and question_id <> v_qid) then
        raise exception 'a choice belongs to another question';
      end if;
    else
      v_cids := '{}';
    end if;
    delete from public.question_choices where question_id = v_qid and not (id = any (v_cids));
    if v_kind in ('mcq_single', 'mcq_multi') then
      insert into public.question_choices (id, question_id, label, order_index)
      select (c2 ->> 'id')::uuid, v_qid, c2 ->> 'label', (ord - 1)::integer
      from jsonb_array_elements(q -> 'choices') with ordinality as t(c2, ord)
      on conflict (id) do update set label = excluded.label, order_index = excluded.order_index;
    end if;

    v_correct := array(select (x)::uuid from jsonb_array_elements_text(coalesce(q -> 'key' -> 'correctChoiceIds', '[]')) x);
    if v_kind in ('mcq_single', 'mcq_multi') then
      if not (v_correct <@ v_cids) then raise exception 'correct answer must be one of the choices'; end if;
      if v_kind = 'mcq_single' and cardinality(v_correct) <> 1 then
        raise exception 'single-answer questions need exactly one correct choice';
      end if;
      if v_kind = 'mcq_multi' and cardinality(v_correct) < 1 then
        raise exception 'mark at least one correct choice';
      end if;
    else
      v_correct := '{}';
    end if;
    if v_kind = 'numeric' and nullif(q -> 'key' ->> 'numericAnswer', '') is null then
      raise exception 'numerical questions need a correct answer';
    end if;

    insert into public.question_keys (
      question_id, correct_choice_ids, numeric_answer, tolerance, tolerance_kind, units,
      auto_exact, accepted_answers, case_sensitive, model_answer, explanation
    ) values (
      v_qid, v_correct,
      case when v_kind = 'numeric' then (q -> 'key' ->> 'numericAnswer')::double precision end,
      coalesce((q -> 'key' ->> 'tolerance')::double precision, 0),
      coalesce(q -> 'key' ->> 'toleranceKind', 'absolute')::public.tolerance_kind,
      array(select jsonb_array_elements_text(coalesce(q -> 'key' -> 'units', '[]'))),
      v_kind = 'short' and coalesce((q -> 'key' ->> 'autoExact')::boolean, false),
      array(select jsonb_array_elements_text(coalesce(q -> 'key' -> 'acceptedAnswers', '[]'))),
      coalesce((q -> 'key' ->> 'caseSensitive')::boolean, false),
      coalesce(q -> 'key' ->> 'modelAnswer', ''),
      coalesce(q -> 'key' ->> 'explanation', '')
    )
    on conflict (question_id) do update set
      correct_choice_ids = excluded.correct_choice_ids,
      numeric_answer = excluded.numeric_answer,
      tolerance = excluded.tolerance,
      tolerance_kind = excluded.tolerance_kind,
      units = excluded.units,
      auto_exact = excluded.auto_exact,
      accepted_answers = excluded.accepted_answers,
      case_sensitive = excluded.case_sensitive,
      model_answer = excluded.model_answer,
      explanation = excluded.explanation;
  end loop;

  return v_id;
end;
$$;

-- ── 11. Progress internals (not callable by users) ──

-- Units are compared after removing spaces and multiplication dots, so
-- "m s^-1", "m s⁻¹"-style input typed as "m s-1" and "ms^-1" all match "ms-1".
-- Case is kept (mm ≠ Mm).
create or replace function public._norm_unit(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(replace(replace(coalesce(p, ''), '−', '-'), '⁻', '-'), '[\s·⋅*^]', '', 'g');
$$;

create or replace function public._norm_text(p text, p_case_sensitive boolean)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_case_sensitive then x else lower(x) end
  from (select btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g')) as x) s;
$$;

-- Is this node locked for the current user by unfinished prerequisites?
-- Only required, visible predecessor steps count, so a step the student
-- can't see never blocks them.
create or replace function public._node_locked(p_node uuid, p_student uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select n.lock_until_prereqs and exists (
      select 1
      from public.roadmap_edges e
      join public.roadmap_nodes s on s.id = e.source_id
      where e.target_id = n.id
        and s.is_required
        and public.can_view_node(s.id)
        and not exists (select 1 from public.node_completions c where c.node_id = s.id and c.student_id = p_student)
    )
    from public.roadmap_nodes n where n.id = p_node
  ), false);
$$;

-- Record completion if the node's rule is now satisfied. Completion is
-- sticky: later rule changes never silently take it away (admins can reset).
create or replace function public._refresh_completion(p_node uuid, p_student uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule public.completion_rule;
  v_min integer;
  v_required integer;
  v_required_done integer;
  v_done integer;
begin
  if exists (select 1 from public.node_completions where node_id = p_node and student_id = p_student) then
    return;
  end if;
  select completion_rule, min_quizzes into v_rule, v_min from public.roadmap_nodes where id = p_node;
  if v_rule is null or v_rule in ('student_mark', 'admin_confirm') then
    return;
  end if;

  with qs as (
    select q.is_required,
      exists (
        select 1 from public.quiz_attempts a
        where a.quiz_id = q.id and a.student_id = p_student
          and (case when q.require_pass then a.passed is true else true end)
      ) as done
    from public.quizzes q
    where q.node_id = p_node and q.is_published
  )
  select count(*) filter (where is_required),
         count(*) filter (where is_required and done),
         count(*) filter (where done)
  into v_required, v_required_done, v_done
  from qs;

  if (v_rule = 'all_required' and v_required > 0 and v_required_done = v_required)
     or (v_rule = 'min_quizzes' and v_done >= coalesce(v_min, 1)) then
    insert into public.node_completions (student_id, node_id, source)
    values (p_student, p_node, 'auto')
    on conflict do nothing;
  end if;
end;
$$;

-- Recalculate an attempt's totals from its responses.
create or replace function public._finalise_attempt(p_attempt uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_score numeric;
  v_max numeric;
  v_pending integer;
  v_pass integer;
begin
  select coalesce(sum(awarded_marks), 0), coalesce(sum(marks_available), 0), count(*) filter (where awarded_marks is null)
  into v_score, v_max, v_pending
  from public.attempt_responses where attempt_id = p_attempt;

  select q.pass_percent into v_pass
  from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id where a.id = p_attempt;

  update public.quiz_attempts set
    score = v_score,
    max_score = v_max,
    status = case when v_pending > 0 then 'awaiting_marking'::public.attempt_status else 'marked' end,
    passed = case when v_pending > 0 then null else v_max > 0 and v_score * 100 >= v_pass * v_max end
  where id = p_attempt;
end;
$$;

revoke all on function public._node_locked(uuid, uuid) from public, anon, authenticated;
revoke all on function public._refresh_completion(uuid, uuid) from public, anon, authenticated;
revoke all on function public._finalise_attempt(uuid) from public, anon, authenticated;

-- ── 12. Student actions ──

-- Submit answers. Grades on the server; the student sends only answers.
-- p_answers: { "<question id>": { "choices": [uuid…] } | { "text": "…" } | { "value": 1.5, "unit": "m s^-1", "raw": "1.5" } }
create or replace function public.submit_quiz(p_quiz uuid, p_answers jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_quiz public.quizzes;
  v_count integer;
  v_attempt uuid;
  r record;
  a jsonb;
  v_choices uuid[];
  v_value double precision;
  v_marks numeric;
  v_allowed double precision;
begin
  if v_uid is null or not exists (
    select 1 from public.profiles where id = v_uid and role = 'student' and status = 'active'
  ) then
    raise exception 'only active students can submit quizzes';
  end if;
  if not public.can_view_quiz(p_quiz) then
    raise exception 'quiz not available';
  end if;
  select * into v_quiz from public.quizzes where id = p_quiz;
  if public._node_locked(v_quiz.node_id, v_uid) then
    raise exception 'finish the earlier steps first';
  end if;
  if jsonb_typeof(coalesce(p_answers, '{}')) <> 'object' then
    raise exception 'invalid answers';
  end if;

  -- One submission at a time per student per quiz: no duplicate attempt numbers,
  -- no racing past the attempt limit.
  perform pg_advisory_xact_lock(hashtextextended(p_quiz::text || ':' || v_uid::text, 0));

  select count(*) into v_count from public.quiz_attempts where quiz_id = p_quiz and student_id = v_uid;
  if v_quiz.max_attempts is not null and v_count >= v_quiz.max_attempts then
    raise exception 'no attempts left';
  end if;
  if not exists (select 1 from public.questions where quiz_id = p_quiz) then
    raise exception 'this quiz has no questions yet';
  end if;

  insert into public.quiz_attempts (quiz_id, student_id, attempt_no, status)
  values (p_quiz, v_uid, v_count + 1, 'awaiting_marking')
  returning id into v_attempt;

  for r in
    select qu.id, qu.kind, qu.prompt, qu.marks, k.correct_choice_ids, k.numeric_answer, k.tolerance,
           k.tolerance_kind, k.units, k.auto_exact, k.accepted_answers, k.case_sensitive
    from public.questions qu
    left join public.question_keys k on k.question_id = qu.id
    where qu.quiz_id = p_quiz
    order by qu.order_index
  loop
    a := coalesce(p_answers -> r.id::text, '{}');
    if jsonb_typeof(a) <> 'object' then a := '{}'; end if;
    v_marks := null;

    if r.kind in ('mcq_single', 'mcq_multi') then
      -- Keep only real choices of this question; ignore anything else sent.
      v_choices := array(
        select c.id from public.question_choices c
        where c.question_id = r.id
          and c.id::text in (select jsonb_array_elements_text(case when jsonb_typeof(a -> 'choices') = 'array' then a -> 'choices' else '[]' end))
        order by c.id
      );
      if r.kind = 'mcq_single' and cardinality(v_choices) > 1 then v_choices := '{}'; end if;
      a := jsonb_build_object('choices', to_jsonb(v_choices));
      v_marks := case
        when cardinality(v_choices) > 0
         and v_choices = array(select x from unnest(coalesce(r.correct_choice_ids, '{}')) x order by x)
        then r.marks else 0 end;

    elsif r.kind = 'numeric' then
      v_value := case when jsonb_typeof(a -> 'value') = 'number' then (a ->> 'value')::double precision end;
      a := jsonb_build_object(
        'value', a -> 'value',
        'unit', left(coalesce(a ->> 'unit', ''), 50),
        'raw', left(coalesce(a ->> 'raw', ''), 100)
      );
      v_allowed := case when r.tolerance_kind = 'percent' then abs(r.numeric_answer) * r.tolerance / 100 else r.tolerance end;
      v_marks := case
        when v_value is not null and r.numeric_answer is not null
         and abs(v_value - r.numeric_answer) <= v_allowed + 1e-9 * greatest(abs(r.numeric_answer), 1e-300)
         and (cardinality(coalesce(r.units, '{}')) = 0
              or public._norm_unit(a ->> 'unit') in (select public._norm_unit(u) from unnest(r.units) u))
        then r.marks else 0 end;

    else -- short answer
      a := jsonb_build_object('text', left(coalesce(a ->> 'text', ''), 5000));
      if coalesce(r.auto_exact, false) then
        v_marks := case
          when public._norm_text(a ->> 'text', r.case_sensitive)
               in (select public._norm_text(x, r.case_sensitive) from unnest(r.accepted_answers) x)
          then r.marks else 0 end;
      end if; -- otherwise null: waits for manual marking
    end if;

    insert into public.attempt_responses (
      attempt_id, question_id, question_kind, prompt, marks_available, answer, auto_marks, awarded_marks
    ) values (v_attempt, r.id, r.kind, r.prompt, r.marks, a, v_marks, v_marks);
  end loop;

  perform public._finalise_attempt(v_attempt);
  perform public._refresh_completion(v_quiz.node_id, v_uid);
  return v_attempt;
end;
$$;

-- Student-marked steps ("I've done this"), only where the admin chose that rule.
create or replace function public.set_own_node_done(p_node uuid, p_done boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists (
    select 1 from public.profiles where id = v_uid and role = 'student' and status = 'active'
  ) then
    raise exception 'only active students can do this';
  end if;
  if not public.can_view_node(p_node) then
    raise exception 'step not available';
  end if;
  if (select completion_rule from public.roadmap_nodes where id = p_node) <> 'student_mark' then
    raise exception 'this step is completed by its tasks, not by hand';
  end if;
  if public._node_locked(p_node, v_uid) then
    raise exception 'finish the earlier steps first';
  end if;

  if p_done then
    insert into public.node_completions (student_id, node_id, source)
    values (v_uid, p_node, 'student')
    on conflict do nothing;
  else
    delete from public.node_completions
    where student_id = v_uid and node_id = p_node and source = 'student';
  end if;
end;
$$;

-- An attempt with the answers revealed according to the quiz's setting.
create or replace function public.attempt_review(p_attempt uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_attempt public.quiz_attempts;
  v_quiz public.quizzes;
  v_staff boolean := public.is_staff();
  v_reveal boolean;
begin
  select * into v_attempt from public.quiz_attempts where id = p_attempt;
  if not found or (v_attempt.student_id <> auth.uid() and not v_staff) then
    return null;
  end if;
  select * into v_quiz from public.quizzes where id = v_attempt.quiz_id;
  v_reveal := v_staff
    or v_quiz.reveal = 'after_submit'
    or (v_quiz.reveal = 'after_pass' and v_attempt.passed is true);

  return jsonb_build_object(
    'attempt', to_jsonb(v_attempt),
    'quiz', jsonb_build_object('id', v_quiz.id, 'title', v_quiz.title, 'pass_percent', v_quiz.pass_percent,
                               'reveal', v_quiz.reveal, 'node_id', v_quiz.node_id),
    'revealed', v_reveal,
    'responses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'question_id', r.question_id,
        'kind', r.question_kind,
        'prompt', r.prompt,
        'marks_available', r.marks_available,
        'answer', r.answer,
        'awarded_marks', r.awarded_marks,
        'feedback', r.feedback,
        'image', q.image_path is not null,
        'choices', coalesce((
          select jsonb_agg(jsonb_build_object('id', c.id, 'label', c.label) order by c.order_index)
          from public.question_choices c where c.question_id = r.question_id
        ), '[]'),
        'key', case when v_reveal and k.question_id is not null then jsonb_build_object(
          'correct_choice_ids', k.correct_choice_ids,
          'numeric_answer', k.numeric_answer,
          'tolerance', k.tolerance,
          'tolerance_kind', k.tolerance_kind,
          'units', k.units,
          'accepted_answers', k.accepted_answers,
          'model_answer', k.model_answer,
          'explanation', k.explanation
        ) end
      ) order by q.order_index nulls last, r.id)
      from public.attempt_responses r
      left join public.questions q on q.id = r.question_id
      left join public.question_keys k on k.question_id = r.question_id
      where r.attempt_id = p_attempt
    ), '[]')
  );
end;
$$;

-- Locked-but-visible steps: when a roadmap is set to show restricted steps
-- as locked, students see ONLY their title, type and position — never the
-- description, links or questions.
create or replace function public.roadmap_locked_steps(p_roadmap uuid)
returns table (id uuid, kind public.node_kind, title text, pos_x double precision, pos_y double precision)
language sql
stable
security definer
set search_path = ''
as $$
  select n.id, n.kind, n.title, n.pos_x, n.pos_y
  from public.roadmap_nodes n
  join public.roadmaps r on r.id = n.roadmap_id
  where r.id = p_roadmap
    and r.is_published
    and r.restricted_display = 'lock'
    and public.can_view_unit(r.unit_id)
    and not public.can_view_node(n.id);
$$;

-- Connections touching locked steps (both ends must be visible or locked-visible).
create or replace function public.roadmap_locked_edges(p_roadmap uuid)
returns table (source_id uuid, target_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select e.source_id, e.target_id
  from public.roadmap_edges e
  join public.roadmaps r on r.id = e.roadmap_id
  where r.id = p_roadmap
    and r.is_published
    and r.restricted_display = 'lock'
    and public.can_view_unit(r.unit_id)
    and not (public.can_view_node(e.source_id) and public.can_view_node(e.target_id));
$$;

-- ── 13. Admin actions (audited) ──

create or replace function public.mark_response(p_response uuid, p_marks numeric, p_feedback text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resp public.attempt_responses;
  v_attempt public.quiz_attempts;
  v_node uuid;
begin
  if not public.is_staff() then raise exception 'admin only'; end if;
  select * into v_resp from public.attempt_responses where id = p_response for update;
  if not found then raise exception 'answer not found'; end if;
  if p_marks is null or p_marks < 0 or p_marks > v_resp.marks_available then
    raise exception 'marks must be between 0 and %', v_resp.marks_available;
  end if;
  select * into v_attempt from public.quiz_attempts where id = v_resp.attempt_id for update;

  -- Re-marking changes a result the student may already have seen: record it.
  if v_resp.awarded_marks is not null then
    insert into public.progress_audit (admin_id, student_id, action, quiz_id, attempt_id, details)
    values (auth.uid(), v_attempt.student_id, 'remark', v_attempt.quiz_id, v_attempt.id,
            jsonb_build_object('response_id', p_response, 'from', v_resp.awarded_marks, 'to', p_marks));
  end if;

  update public.attempt_responses set
    awarded_marks = p_marks,
    feedback = left(coalesce(p_feedback, ''), 2000),
    marked_by = auth.uid(),
    marked_at = now()
  where id = p_response;

  perform public._finalise_attempt(v_attempt.id);
  update public.quiz_attempts set marked_at = now(), marked_by = auth.uid()
  where id = v_attempt.id and status = 'marked';

  select node_id into v_node from public.quizzes where id = v_attempt.quiz_id;
  perform public._refresh_completion(v_node, v_attempt.student_id);
end;
$$;

-- Mark a step complete / not complete for a student (override). Reason required.
create or replace function public.admin_set_completion(p_student uuid, p_node uuid, p_completed boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before boolean;
begin
  if not public.is_staff() then raise exception 'admin only'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) = 0 then raise exception 'a reason is required'; end if;
  if not exists (select 1 from public.profiles where id = p_student and role = 'student') then
    raise exception 'student not found';
  end if;
  if not exists (select 1 from public.roadmap_nodes where id = p_node) then
    raise exception 'step not found';
  end if;

  v_before := exists (select 1 from public.node_completions where student_id = p_student and node_id = p_node);
  if p_completed then
    insert into public.node_completions (student_id, node_id, source, completed_by)
    values (p_student, p_node, 'admin', auth.uid())
    on conflict do nothing;
  else
    delete from public.node_completions where student_id = p_student and node_id = p_node;
  end if;

  insert into public.progress_audit (admin_id, student_id, action, node_id, details, reason)
  values (auth.uid(), p_student, case when p_completed then 'mark_complete' else 'mark_incomplete' end, p_node,
          jsonb_build_object('was_completed', v_before), left(btrim(p_reason), 1000));
end;
$$;

-- Clear a student's attempts and completion for one step. Reason required.
create or replace function public.admin_reset_node(p_student uuid, p_node uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempts integer;
  v_was boolean;
begin
  if not public.is_staff() then raise exception 'admin only'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) = 0 then raise exception 'a reason is required'; end if;

  v_was := exists (select 1 from public.node_completions where student_id = p_student and node_id = p_node);
  with gone as (
    delete from public.quiz_attempts a
    using public.quizzes q
    where a.quiz_id = q.id and q.node_id = p_node and a.student_id = p_student
    returning a.id
  )
  select count(*) into v_attempts from gone;
  delete from public.node_completions where student_id = p_student and node_id = p_node;

  insert into public.progress_audit (admin_id, student_id, action, node_id, details, reason)
  values (auth.uid(), p_student, 'reset_step', p_node,
          jsonb_build_object('attempts_removed', v_attempts, 'was_completed', v_was), left(btrim(p_reason), 1000));
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'save_roadmap(uuid, integer, jsonb, jsonb)',
    'save_quiz(jsonb)',
    'submit_quiz(uuid, jsonb)',
    'set_own_node_done(uuid, boolean)',
    'attempt_review(uuid)',
    'roadmap_locked_steps(uuid)',
    'roadmap_locked_edges(uuid)',
    'mark_response(uuid, numeric, text)',
    'admin_set_completion(uuid, uuid, boolean, text)',
    'admin_reset_node(uuid, uuid, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ── 14. Question images (private, in the existing materials bucket) ──
update storage.buckets
set allowed_mime_types = array[
  'application/pdf', 'video/mp4', 'video/webm', 'video/quicktime',
  'image/png', 'image/jpeg', 'image/webp', 'image/gif'
]
where id = 'materials';

-- questions is RLS-filtered for the caller, so this only matches images of
-- questions in quizzes the student may open.
create policy "Students read permitted question images" on storage.objects for select to authenticated
  using (
    bucket_id = 'materials'
    and exists (select 1 from public.questions q where q.image_path = storage.objects.name)
  );
