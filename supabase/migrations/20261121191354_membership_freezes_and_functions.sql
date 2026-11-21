-- ============================================================
-- Correction: drop direct insert capability on memberships.
-- Until the registration/renewal functions exist (a later step),
-- there is deliberately no way to create a membership via the
-- client at all. That's expected right now, not a bug.
-- ============================================================
drop policy if exists memberships_insert on public.memberships;

-- ============================================================
-- membership_freezes
-- ============================================================
create table public.membership_freezes (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null,
  membership_id uuid not null,

  start_date date not null,
  end_date date,  -- null while the freeze is active

  created_by uuid references public.app_users (id),
  created_at timestamptz not null default now(),

  constraint membership_freezes_end_after_start
    check (end_date is null or end_date >= start_date),

  constraint membership_freezes_membership_same_gym
    foreign key (membership_id, gym_id) references public.memberships (id, gym_id),

  constraint membership_freezes_created_by_same_gym
    foreign key (created_by, gym_id) references public.app_users (id, gym_id),

  -- No two freeze intervals for the same membership may overlap. An open
  -- freeze (end_date null) is treated as extending to infinity, which also
  -- automatically blocks a second freeze being opened while one is active
  -- — no separate partial-unique index needed on top of this.
  exclude using gist (
    membership_id with =,
    daterange(start_date, coalesce(end_date, 'infinity'::date), '[]') with &&
  )
);

alter table public.membership_freezes enable row level security;

create policy membership_freezes_select on public.membership_freezes
  for select using (gym_id = public.current_gym_id());

-- No insert/update policy for ordinary users — only create_freeze()/unfreeze() below.

-- ============================================================
-- create_freeze: the only sanctioned way to start a freeze.
-- ============================================================
create or replace function public.create_freeze(
  p_membership_id uuid,
  p_start_date date
)
returns public.membership_freezes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership public.memberships;
  v_freeze public.membership_freezes;
  v_gym_id uuid := public.current_gym_id();
begin
  if v_gym_id is null then
    raise exception 'Must be authenticated';
  end if;

  select * into v_membership
  from public.memberships
  where id = p_membership_id and gym_id = v_gym_id;

  if not found then
    raise exception 'Membership not found';
  end if;

  if p_start_date < current_date then
    raise exception 'Freeze start date cannot be in the past';
  end if;

  if p_start_date < v_membership.start_date or p_start_date > v_membership.end_date then
    raise exception 'Freeze start date must fall within the membership''s current date range';
  end if;

  if exists (
    select 1 from public.memberships
    where member_id = v_membership.member_id
      and start_date > current_date
  ) then
    raise exception 'Cannot freeze: an upcoming renewal is already scheduled for this member';
  end if;

  insert into public.membership_freezes (gym_id, membership_id, start_date, created_by)
  values (v_gym_id, p_membership_id, p_start_date, auth.uid())
  returning * into v_freeze;

  return v_freeze;
end;
$$;

revoke all on function public.create_freeze(uuid, date) from public;
grant execute on function public.create_freeze(uuid, date) to authenticated;

-- ============================================================
-- unfreeze: closes the freeze, extends end_date by the actual
-- frozen duration (inclusive on both ends).
-- ============================================================
create or replace function public.unfreeze(
  p_freeze_id uuid,
  p_end_date date default current_date
)
returns public.membership_freezes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_freeze public.membership_freezes;
  v_gym_id uuid := public.current_gym_id();
  v_frozen_days integer;
begin
  if v_gym_id is null then
    raise exception 'Must be authenticated';
  end if;

  select * into v_freeze
  from public.membership_freezes
  where id = p_freeze_id and gym_id = v_gym_id;

  if not found then
    raise exception 'Freeze not found';
  end if;

  if v_freeze.end_date is not null then
    raise exception 'This freeze is already closed';
  end if;

  if p_end_date < v_freeze.start_date then
    raise exception 'Freeze end date cannot be before its start date';
  end if;

  v_frozen_days := (p_end_date - v_freeze.start_date) + 1;

  update public.membership_freezes
  set end_date = p_end_date
  where id = p_freeze_id;

  update public.memberships
  set end_date = end_date + v_frozen_days
  where id = v_freeze.membership_id;

  select * into v_freeze from public.membership_freezes where id = p_freeze_id;
  return v_freeze;
end;
$$;

revoke all on function public.unfreeze(uuid, date) from public;
grant execute on function public.unfreeze(uuid, date) to authenticated;