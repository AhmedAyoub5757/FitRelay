-- Replace the exclusion constraint: end_date is now exclusive (resumption day),
-- not inclusive (last frozen day). Find its auto-generated name dynamically
-- rather than guessing it.
do $$
declare
  v_constraint_name text;
begin
  select conname into v_constraint_name
  from pg_constraint
  where conrelid = 'public.membership_freezes'::regclass
    and contype = 'x';

  execute format('alter table public.membership_freezes drop constraint %I', v_constraint_name);
end $$;

alter table public.membership_freezes
  add constraint membership_freezes_no_overlap
  exclude using gist (
    membership_id with =,
    daterange(start_date, coalesce(end_date, 'infinity'::date), '[)') with &&
  );

-- Frozen only while today is in [start_date, end_date) — end_date itself is active again.
create or replace view public.membership_status
with (security_invoker = true)
as
select
  m.id as membership_id,
  m.gym_id,
  m.member_id,
  m.start_date,
  m.end_date,
  case
    when exists (
      select 1 from public.membership_freezes f
      where f.membership_id = m.id
        and f.start_date <= current_date
        and (f.end_date is null or f.end_date > current_date)
    ) then 'frozen'
    when m.start_date > current_date then 'upcoming'
    when m.end_date < current_date then 'expired'
    else 'active'
  end as status
from public.memberships m;

-- frozen_days is now end_date - start_date (no +1): the count of days
-- actually spent frozen in a half-open interval.
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

  v_frozen_days := p_end_date - v_freeze.start_date;

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