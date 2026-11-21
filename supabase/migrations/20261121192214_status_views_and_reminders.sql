-- ============================================================
-- Per-membership derived status.
-- security_invoker = true is important here: without it, a view
-- runs with the *view owner's* privileges (typically a role that
-- bypasses RLS), which would silently leak cross-gym data through
-- the view even though every underlying table has RLS enabled.
-- With security_invoker, the view respects the querying user's
-- own RLS exactly as if they'd queried the tables directly.
-- ============================================================
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
        and (f.end_date is null or f.end_date >= current_date)
    ) then 'frozen'
    when m.start_date > current_date then 'upcoming'
    when m.end_date < current_date then 'expired'
    else 'active'
  end as status
from public.memberships m;

-- ============================================================
-- Per-member overall status: prefer the membership covering
-- today; otherwise fall back to the most recent one (correctly
-- surfaces 'upcoming' if that's all there is, or 'expired' for
-- lapsed history); 'no_membership' if there's never been one.
-- ============================================================
create or replace view public.member_status
with (security_invoker = true)
as
select
  mem.id as member_id,
  mem.gym_id,
  coalesce(
    (
      select ms.status from public.membership_status ms
      where ms.member_id = mem.id
        and ms.start_date <= current_date
        and ms.end_date >= current_date
      limit 1
    ),
    (
      select ms.status from public.membership_status ms
      where ms.member_id = mem.id
      order by ms.start_date desc
      limit 1
    ),
    'no_membership'
  ) as status
from public.members mem
where mem.is_deleted = false;

-- ============================================================
-- reminders
-- ============================================================
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null,
  member_id uuid not null,
  membership_id uuid,  -- set for expiry_due, null for payment_due (aggregated)

  category text not null check (category in ('payment_due', 'expiry_due')),
  reminder_stage text,

  scheduled_for date not null,
  status text not null default 'pending'
    check (status in ('pending', 'owner_confirmed_sent', 'resolved', 'superseded')),

  amount_snapshot numeric(12,2),
  message_snapshot text,

  resolved_at timestamptz,
  owner_marked_sent_at timestamptz,
  owner_marked_sent_by uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reminders_stage_matches_category check (
    (category = 'expiry_due' and reminder_stage in ('7_days_before', '3_days_before', 'expiry_day', '1_day_after'))
    or
    (category = 'payment_due' and reminder_stage is null)
  ),

  constraint reminders_member_same_gym
    foreign key (member_id, gym_id) references public.members (id, gym_id),

  constraint reminders_membership_same_gym
    foreign key (membership_id, gym_id) references public.memberships (id, gym_id),
  constraint reminders_membership_same_member
    foreign key (membership_id, member_id) references public.memberships (id, member_id),

  constraint reminders_owner_marked_sent_by_same_gym
    foreign key (owner_marked_sent_by, gym_id) references public.app_users (id, gym_id)
);

-- One active payment-due reminder per member.
create unique index reminders_payment_due_dedup
  on public.reminders (member_id)
  where category = 'payment_due' and status in ('pending', 'owner_confirmed_sent');

-- One active reminder per membership per expiry stage.
create unique index reminders_expiry_due_dedup
  on public.reminders (membership_id, reminder_stage)
  where category = 'expiry_due' and status in ('pending', 'owner_confirmed_sent');

create index reminders_gym_status_idx on public.reminders (gym_id, status);

alter table public.reminders enable row level security;

create policy reminders_select on public.reminders
  for select using (gym_id = public.current_gym_id());

-- No direct insert/update policy — reminders are created/resolved only by
-- the scheduled job (service role, next phase of the project) and the
-- one controlled transition below.

create or replace function public.mark_reminder_sent(p_reminder_id uuid)
returns public.reminders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gym_id uuid := public.current_gym_id();
  v_reminder public.reminders;
begin
  if v_gym_id is null then
    raise exception 'Must be authenticated';
  end if;

  select * into v_reminder from public.reminders
  where id = p_reminder_id and gym_id = v_gym_id;

  if not found then
    raise exception 'Reminder not found';
  end if;

  if v_reminder.status <> 'pending' then
    raise exception 'Only a pending reminder can be marked as sent';
  end if;

  update public.reminders
  set status = 'owner_confirmed_sent',
      owner_marked_sent_at = now(),
      owner_marked_sent_by = auth.uid(),
      updated_at = now()
  where id = p_reminder_id
  returning * into v_reminder;

  return v_reminder;
end;
$$;

revoke all on function public.mark_reminder_sent(uuid) from public;
grant execute on function public.mark_reminder_sent(uuid) to authenticated;