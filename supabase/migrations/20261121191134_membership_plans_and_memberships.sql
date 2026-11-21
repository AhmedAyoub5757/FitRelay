-- ============================================================
-- membership_plans
-- ============================================================
create table public.membership_plans (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete restrict,

  name text not null,
  duration_days integer,                 -- null = "custom duration" plan; set per-membership instead
  default_price numeric(12,2) not null check (default_price >= 0),

  is_active boolean not null default true,  -- soft-disable only; never delete, historical memberships reference it

  created_at timestamptz not null default now(),

  constraint membership_plans_id_gym_id_unique unique (id, gym_id)
);

alter table public.membership_plans enable row level security;

create policy membership_plans_select on public.membership_plans
  for select using (gym_id = public.current_gym_id());

create policy membership_plans_insert on public.membership_plans
  for insert with check (gym_id = public.current_gym_id());

create policy membership_plans_update on public.membership_plans
  for update using (gym_id = public.current_gym_id())
  with check (gym_id = public.current_gym_id());

-- ============================================================
-- memberships
-- ============================================================
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete restrict,
  member_id uuid not null,

  plan_id uuid,                               -- nullable: fully ad-hoc memberships with no plan reference
  plan_name_snapshot text not null,
  duration_days_snapshot integer not null check (duration_days_snapshot > 0),

  start_date date not null,
  end_date date not null,

  previous_membership_id uuid,                -- renewal chain, self-referencing

  created_by uuid references public.app_users (id),
  created_at timestamptz not null default now(),

  constraint memberships_id_gym_id_unique unique (id, gym_id),
  constraint memberships_id_member_id_unique unique (id, member_id),

  constraint memberships_end_after_start check (end_date >= start_date),

  constraint memberships_member_same_gym
    foreign key (member_id, gym_id) references public.members (id, gym_id),

  constraint memberships_plan_same_gym
    foreign key (plan_id, gym_id) references public.membership_plans (id, gym_id),

  constraint memberships_previous_same_member
    foreign key (previous_membership_id, member_id) references public.memberships (id, member_id),
  constraint memberships_previous_same_gym
    foreign key (previous_membership_id, gym_id) references public.memberships (id, gym_id),

  constraint memberships_created_by_same_gym
    foreign key (created_by, gym_id) references public.app_users (id, gym_id),

  -- The core invariant: no two memberships for the same member may overlap in time.
  exclude using gist (
    member_id with =,
    daterange(start_date, end_date, '[]') with &&
  )
);

create index memberships_gym_end_date_idx
  on public.memberships (gym_id, end_date);

alter table public.memberships enable row level security;

create policy memberships_select on public.memberships
  for select using (gym_id = public.current_gym_id());

create policy memberships_insert on public.memberships
  for insert with check (gym_id = public.current_gym_id());

-- Deliberately no UPDATE policy here. A membership's end_date only ever changes
-- as a side effect of unfreezing (extending it), which must go through a
-- security-definer function, not a direct client-side UPDATE. We'll add that
-- function in the next migration, alongside membership_freezes.