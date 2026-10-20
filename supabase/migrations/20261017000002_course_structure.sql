-- ─────────────────────────────────────────────────────────────
-- Phase 2b: course hierarchy  Course → Unit → Topic → Lesson
--
-- Visibility
--   • Staff (active teacher/admin) can read and write everything.
--   • Active students can read only published rows whose parents are
--     also visible. The parent check is an EXISTS against the parent
--     table, which is itself RLS-filtered — so unpublishing a unit hides
--     all of its topics and lessons automatically.
--   • Suspended accounts see nothing.
--
-- needs_review marks names/structure that have not yet been checked
-- against the official Pearson Edexcel specification.
-- ─────────────────────────────────────────────────────────────

-- ── Helper: signed-in AND not suspended ──
create or replace function public.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active'
  );
$$;

revoke all on function public.is_active_member() from public;
grant execute on function public.is_active_member() to authenticated;

-- ── Shared updated_at trigger ──
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Slugs: lowercase letters, digits and single hyphens.
create domain public.slug as text
  check (value ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(value) <= 80);

-- ── Courses ──
create table public.courses (
  id            uuid primary key default gen_random_uuid(),
  slug          public.slug not null unique,
  title         text not null check (char_length(title) between 1 and 200),
  description   text not null default '' check (char_length(description) <= 2000),
  is_published  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── Units ──
create table public.units (
  id              uuid primary key default gen_random_uuid(),
  course_id       uuid not null references public.courses (id) on delete cascade,
  slug            public.slug not null,
  code            text not null check (char_length(code) between 1 and 40),  -- e.g. "Unit 1"
  title           text not null check (char_length(title) between 1 and 200),
  description     text not null default '' check (char_length(description) <= 2000),
  order_index     integer not null default 0,
  is_published    boolean not null default false,
  is_placeholder  boolean not null default false,  -- shown as "Content coming soon"
  needs_review    boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (course_id, slug)
);
create index units_course_order_idx on public.units (course_id, order_index);

-- ── Topics ──
create table public.topics (
  id            uuid primary key default gen_random_uuid(),
  unit_id       uuid not null references public.units (id) on delete cascade,
  slug          public.slug not null,
  title         text not null check (char_length(title) between 1 and 200),
  description   text not null default '' check (char_length(description) <= 2000),
  order_index   integer not null default 0,
  is_published  boolean not null default false,
  needs_review  boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (unit_id, slug)
);
create index topics_unit_order_idx on public.topics (unit_id, order_index);

-- ── Lessons (body content arrives in Phase 3) ──
create table public.lessons (
  id                 uuid primary key default gen_random_uuid(),
  topic_id           uuid not null references public.topics (id) on delete cascade,
  slug               public.slug not null,
  title              text not null check (char_length(title) between 1 and 200),
  summary            text not null default '' check (char_length(summary) <= 2000),
  order_index        integer not null default 0,
  estimated_minutes  integer check (estimated_minutes between 1 and 600),
  is_published       boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (topic_id, slug)
);
create index lessons_topic_order_idx on public.lessons (topic_id, order_index);

create trigger courses_touch before update on public.courses for each row execute function public.touch_updated_at();
create trigger units_touch   before update on public.units   for each row execute function public.touch_updated_at();
create trigger topics_touch  before update on public.topics  for each row execute function public.touch_updated_at();
create trigger lessons_touch before update on public.lessons for each row execute function public.touch_updated_at();

-- ── Row Level Security ──
alter table public.courses enable row level security;
alter table public.units   enable row level security;
alter table public.topics  enable row level security;
alter table public.lessons enable row level security;

-- Read: staff see all; active members see published rows with visible parents.
create policy "Read courses" on public.courses for select to authenticated
  using (public.is_staff() or (is_published and public.is_active_member()));

create policy "Read units" on public.units for select to authenticated
  using (
    public.is_staff()
    or (is_published and exists (select 1 from public.courses c where c.id = units.course_id))
  );

create policy "Read topics" on public.topics for select to authenticated
  using (
    public.is_staff()
    or (is_published and exists (select 1 from public.units u where u.id = topics.unit_id))
  );

create policy "Read lessons" on public.lessons for select to authenticated
  using (
    public.is_staff()
    or (is_published and exists (select 1 from public.topics t where t.id = lessons.topic_id))
  );

-- Write: staff only.
create policy "Staff write courses" on public.courses for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy "Staff write units" on public.units for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy "Staff write topics" on public.topics for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy "Staff write lessons" on public.lessons for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
