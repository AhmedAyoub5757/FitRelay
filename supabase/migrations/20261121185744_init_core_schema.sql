-- Needed later for the memberships date-range exclusion constraint.
create extension if not exists btree_gist;

-- ============================================================
-- gyms — tenant root
-- ============================================================
create table public.gyms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Asia/Karachi',
  created_at timestamptz not null default now()
);

-- ============================================================
-- app_users — one row per auth.users row, scoped to a gym
-- ============================================================
create table public.app_users (
  id uuid primary key references auth.users (id) on delete cascade,
  gym_id uuid not null references public.gyms (id) on delete restrict,
  role text not null default 'owner' check (role = 'owner'),
  full_name text,
  created_at timestamptz not null default now(),

  constraint app_users_id_gym_id_unique unique (id, gym_id)
);

-- One owner per gym, v1.
create unique index app_users_one_owner_per_gym
  on public.app_users (gym_id)
  where role = 'owner';

-- ============================================================
-- members
-- ============================================================
create table public.members (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete restrict,

  full_name text not null,
  phone text not null,
  phone_normalized text not null,

  emergency_contact_name text,
  emergency_contact_phone text,

  joining_date date not null,

  is_deleted boolean not null default false,
  deleted_at timestamptz,

  created_by uuid references public.app_users (id),
  updated_by uuid references public.app_users (id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint members_id_gym_id_unique unique (id, gym_id),

  constraint members_soft_delete_consistency check (
    (is_deleted = false and deleted_at is null)
    or
    (is_deleted = true and deleted_at is not null)
  ),

  constraint members_created_by_same_gym
    foreign key (created_by, gym_id) references public.app_users (id, gym_id),
  constraint members_updated_by_same_gym
    foreign key (updated_by, gym_id) references public.app_users (id, gym_id)
);

create index members_gym_phone_idx
  on public.members (gym_id, phone_normalized)
  where is_deleted = false;

-- ============================================================
-- RLS
-- ============================================================
create or replace function public.current_gym_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select gym_id from public.app_users where id = auth.uid();
$$;

alter table public.gyms enable row level security;
alter table public.app_users enable row level security;
alter table public.members enable row level security;

create policy gyms_select on public.gyms
  for select using (id = public.current_gym_id());

create policy app_users_select on public.app_users
  for select using (gym_id = public.current_gym_id());

create policy members_select on public.members
  for select using (gym_id = public.current_gym_id());

create policy members_insert on public.members
  for insert with check (gym_id = public.current_gym_id());

create policy members_update on public.members
  for update using (gym_id = public.current_gym_id())
  with check (gym_id = public.current_gym_id());

-- Deliberately no delete policy: members are soft-deleted via UPDATE.
-- No policy means RLS blocks DELETE outright.