-- ============================================================
-- Amend create_payment: resolve the payment-due reminder
-- immediately if this payment brings the member's balance to zero.
-- ============================================================
create or replace function public.create_payment(
  p_member_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_allocations jsonb default null
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gym_id uuid := public.current_gym_id();
  v_payment public.payments;
  v_receipt_number bigint;
  v_remaining numeric := p_amount;
  v_charge record;
  v_alloc jsonb;
  v_alloc_amount numeric;
  v_total_outstanding numeric;
begin
  if v_gym_id is null then
    raise exception 'Must be authenticated';
  end if;

  if not exists (select 1 from public.members where id = p_member_id and gym_id = v_gym_id) then
    raise exception 'Member not found';
  end if;

  insert into public.gym_counters (gym_id, counter_name, current_value)
  values (v_gym_id, 'receipt', 1)
  on conflict (gym_id, counter_name)
    do update set current_value = gym_counters.current_value + 1
  returning current_value into v_receipt_number;

  insert into public.payments (gym_id, member_id, entry_type, amount, payment_method, receipt_number, created_by)
  values (v_gym_id, p_member_id, 'payment', p_amount, p_payment_method, v_receipt_number, auth.uid())
  returning * into v_payment;

  if p_allocations is not null then
    for v_alloc in select * from jsonb_array_elements(p_allocations)
    loop
      v_alloc_amount := (v_alloc->>'amount')::numeric;
      insert into public.payment_allocations (gym_id, member_id, payment_id, charge_id, amount)
      values (v_gym_id, p_member_id, v_payment.id, (v_alloc->>'charge_id')::uuid, v_alloc_amount);
    end loop;
  else
    for v_charge in
      select c.id, public.charge_outstanding(c.id) as outstanding
      from public.charges c
      where c.member_id = p_member_id
      order by c.created_at asc
    loop
      exit when v_remaining <= 0;
      if v_charge.outstanding <= 0 then
        continue;
      end if;

      v_alloc_amount := least(v_remaining, v_charge.outstanding);

      insert into public.payment_allocations (gym_id, member_id, payment_id, charge_id, amount)
      values (v_gym_id, p_member_id, v_payment.id, v_charge.id, v_alloc_amount);

      v_remaining := v_remaining - v_alloc_amount;
    end loop;
  end if;

  select coalesce(sum(public.charge_outstanding(c.id)), 0) into v_total_outstanding
  from public.charges c
  where c.member_id = p_member_id;

  if v_total_outstanding <= 0 then
    update public.reminders
    set status = 'resolved', resolved_at = now(), updated_at = now()
    where member_id = p_member_id
      and category = 'payment_due'
      and status in ('pending', 'owner_confirmed_sent');
  end if;

  return v_payment;
end;
$$;

-- ============================================================
-- generate_reminders_for_gym: the per-gym reminder maintenance pass.
-- Never granted to authenticated/anon — only called by the cron job below.
-- ============================================================
create or replace function public.generate_reminders_for_gym(p_gym_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member record;
  v_total_outstanding numeric;
  v_existing_reminder public.reminders;
  v_membership record;
  v_stage record;
  v_processed integer := 0;
begin
  -- Payment-due: one aggregated reminder per member.
  for v_member in
    select m.id as member_id
    from public.members m
    where m.gym_id = p_gym_id and m.is_deleted = false
  loop
    select coalesce(sum(public.charge_outstanding(c.id)), 0) into v_total_outstanding
    from public.charges c
    where c.member_id = v_member.member_id;

    select * into v_existing_reminder
    from public.reminders
    where member_id = v_member.member_id
      and category = 'payment_due'
      and status in ('pending', 'owner_confirmed_sent');

    if v_total_outstanding > 0 then
      if not found then
        insert into public.reminders (
          gym_id, member_id, category, reminder_stage, scheduled_for,
          status, amount_snapshot, message_snapshot
        ) values (
          p_gym_id, v_member.member_id, 'payment_due', null, current_date,
          'pending', v_total_outstanding,
          format('Outstanding balance of %s is due.', v_total_outstanding)
        );
      elsif v_existing_reminder.amount_snapshot is distinct from v_total_outstanding then
        update public.reminders
        set amount_snapshot = v_total_outstanding,
            message_snapshot = format('Outstanding balance of %s is due.', v_total_outstanding),
            updated_at = now()
        where id = v_existing_reminder.id;
      end if;
    elsif found then
      update public.reminders
      set status = 'resolved', resolved_at = now(), updated_at = now()
      where id = v_existing_reminder.id;
    end if;

    v_processed := v_processed + 1;
  end loop;

  -- Supersede expiry reminders for memberships that are currently frozen.
  update public.reminders r
  set status = 'superseded', updated_at = now()
  where r.category = 'expiry_due'
    and r.status in ('pending', 'owner_confirmed_sent')
    and r.membership_id in (
      select ms.membership_id from public.membership_status ms
      where ms.gym_id = p_gym_id and ms.status = 'frozen'
    );

  -- Resolve expiry reminders for memberships that have since been renewed.
  update public.reminders r
  set status = 'resolved', resolved_at = now(), updated_at = now()
  where r.category = 'expiry_due'
    and r.status in ('pending', 'owner_confirmed_sent')
    and exists (
      select 1 from public.memberships m2
      where m2.previous_membership_id = r.membership_id
    );

  -- Expiry-due: staged, per currently-active membership.
  for v_membership in
    select ms.membership_id, ms.member_id, m.end_date
    from public.membership_status ms
    join public.memberships m on m.id = ms.membership_id
    where ms.gym_id = p_gym_id and ms.status = 'active'
  loop
    for v_stage in
      select * from (values
        ('7_days_before', v_membership.end_date - 7),
        ('3_days_before', v_membership.end_date - 3),
        ('expiry_day', v_membership.end_date),
        ('1_day_after', v_membership.end_date + 1)
      ) as s(stage_name, due_date)
    loop
      if v_stage.due_date <= current_date then
        if not exists (
          select 1 from public.reminders
          where membership_id = v_membership.membership_id
            and reminder_stage = v_stage.stage_name
            and status in ('pending', 'owner_confirmed_sent', 'resolved')
        ) then
          insert into public.reminders (
            gym_id, member_id, membership_id, category, reminder_stage,
            scheduled_for, status, message_snapshot
          ) values (
            p_gym_id, v_membership.member_id, v_membership.membership_id,
            'expiry_due', v_stage.stage_name, v_stage.due_date, 'pending',
            format('Membership %s reminder (end date %s).', v_stage.stage_name, v_membership.end_date)
          );
        end if;
      end if;
    end loop;
  end loop;

  return v_processed;
end;
$$;

revoke all on function public.generate_reminders_for_gym(uuid) from public;

-- ============================================================
-- run_reminder_generation: entry point, one job_runs row per gym,
-- isolates failures so one gym's error doesn't abort the rest.
-- ============================================================
create or replace function public.run_reminder_generation()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gym record;
  v_job_id uuid;
  v_processed integer;
begin
  for v_gym in select id from public.gyms loop
    insert into public.job_runs (gym_id, job_name, started_at, status)
    values (v_gym.id, 'reminder_generation', now(), 'running')
    returning id into v_job_id;

    begin
      v_processed := public.generate_reminders_for_gym(v_gym.id);

      update public.job_runs
      set status = 'success', finished_at = now(), processed_count = v_processed
      where id = v_job_id;
    exception when others then
      update public.job_runs
      set status = 'failed', finished_at = now(), error_message = sqlerrm
      where id = v_job_id;
    end;
  end loop;
end;
$$;

revoke all on function public.run_reminder_generation() from public;

-- ============================================================
-- Schedule it. pg_cron isn't available on every Supabase plan —
-- if this extension step fails, tell me and we'll use a Supabase
-- scheduled Edge Function hitting this via RPC under service role instead.
-- ============================================================
create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'daily-reminder-generation',
  '0 4 * * *',
  $$select public.run_reminder_generation();$$
);