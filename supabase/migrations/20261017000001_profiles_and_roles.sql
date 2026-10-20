-- ─────────────────────────────────────────────────────────────
-- Phase 2a: user profiles, roles, and account status
--
-- Security model
--   • Every auth.users row gets exactly one profiles row (trigger).
--   • New accounts are ALWAYS created as 'student'. Sign-up metadata
--     cannot choose a role — only an admin (service role / SQL) can.
--   • Users may edit only their own full_name. role, status, email
--     are protected by a trigger, so a student cannot self-promote
--     even with a hand-crafted API request.
--   • Teachers/admins can read every profile and change status.
-- ─────────────────────────────────────────────────────────────

create type public.user_role as enum ('student', 'teacher', 'admin');
create type public.account_status as enum ('active', 'suspended');

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text not null check (char_length(full_name) between 1 and 120),
  role        public.user_role not null default 'student',
  status      public.account_status not null default 'active',
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);

-- ── Helper: is the current user staff? ──
-- SECURITY DEFINER so it can read profiles without recursing through RLS.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('teacher', 'admin')
      and status = 'active'
  );
$$;

revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to authenticated;

-- ── Create profile on sign-up ──
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    'student'  -- never trust client-supplied metadata for the role
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Guard privileged columns ──
-- Requests made with the service role (auth.uid() is null) or by
-- direct SQL are trusted; everyone else is restricted.
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

  return new;
end;
$$;

create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ── Row Level Security ──
alter table public.profiles enable row level security;

create policy "Users read own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "Staff read all profiles"
  on public.profiles for select
  to authenticated
  using (public.is_staff());

create policy "Users update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Staff update student profiles"
  on public.profiles for update
  to authenticated
  using (public.is_staff() and role = 'student')
  with check (public.is_staff() and role = 'student');

-- No insert/delete policies: rows are created by the trigger and
-- removed by the auth.users cascade only.
