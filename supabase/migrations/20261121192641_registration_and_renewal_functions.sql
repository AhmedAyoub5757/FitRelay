-- ============================================================
-- register_member_with_membership
-- ============================================================
create or replace function public.register_member_with_membership(
  p_full_name text,
  p_phone text,
  p_phone_normalized text,
  p_emergency_contact_name text,
  p_emergency_contact_phone text,
  p_joining_date date,
  p_plan_id uuid,
  p_plan_name_snapshot text,
  p_duration_days integer,
  p_start_date date,
  p_gross_amount numeric,
  p_discount_amount numeric default 0,
  p_initial_payment_amount numeric default null,
  p_initial_payment_method text default null
)
returns public.members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gym_id uuid := public.current_gym_id();
  v_member public.members;
  v_membership public.memberships;
  v_charge public.charges;
  v_end_date date;
begin
  if v_gym_id is null then
    raise exception 'Must be authenticated';
  end if;

  if p_plan_id is not null and not exists (
    select 1 from public.membership_plans where id = p_plan_id and gym_id = v_gym_id
  ) then
    raise exception 'Plan not found';
  end if;

  if p_duration_days <= 0 then
    raise exception 'Duration must be a positive number of days';
  end if;

  v_end_date := p_start_date + (p_duration_days - 1);

  insert into public.members (
    gym_id, full_name, phone, phone_normalized,
    emergency_contact_name, emergency_contact_phone,
    joining_date, created_by, updated_by
  ) values (
    v_gym_id, p_full_name, p_phone, p_phone_normalized,
    p_emergency_contact_name, p_emergency_contact_phone,
    p_joining_date, auth.uid(), auth.uid()
  )
  returning * into v_member;

  insert into public.memberships (
    gym_id, member_id, plan_id, plan_name_snapshot, duration_days_snapshot,
    start_date, end_date, previous_membership_id, created_by
  ) values (
    v_gym_id, v_member.id, p_plan_id, p_plan_name_snapshot, p_duration_days,
    p_start_date, v_end_date, null, auth.uid()
  )
  returning * into v_membership;

  insert into public.charges (
    gym_id, member_id, membership_id, charge_type, gross_amount, discount_amount, created_by
  ) values (
    v_gym_id, v_member.id, v_membership.id, 'membership_renewal', p_gross_amount, p_discount_amount, auth.uid()
  )
  returning * into v_charge;

  if p_initial_payment_amount is not null then
    if p_initial_payment_method is null then
      raise exception 'Payment method is required when an initial payment is provided';
    end if;
    perform public.create_payment(v_member.id, p_initial_payment_amount, p_initial_payment_method);
  end if;

  return v_member;
end;
$$;

revoke all on function public.register_member_with_membership(
  text, text, text, text, text, date, uuid, text, integer, date, numeric, numeric, numeric, text
) from public;
grant execute on function public.register_member_with_membership(
  text, text, text, text, text, date, uuid, text, integer, date, numeric, numeric, numeric, text
) to authenticated;

-- ============================================================
-- renew_membership
-- ============================================================
create or replace function public.renew_membership(
  p_membership_id uuid,
  p_plan_id uuid,
  p_plan_name_snapshot text,
  p_duration_days integer,
  p_gross_amount numeric,
  p_discount_amount numeric default 0
)
returns public.memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gym_id uuid := public.current_gym_id();
  v_old public.memberships;
  v_old_status text;
  v_member_id uuid;
  v_new_start date;
  v_new_end date;
  v_new public.memberships;
  v_charge public.charges;
  v_charge_outstanding numeric;
  v_payment record;
  v_alloc_amount numeric;
begin
  if v_gym_id is null then
    raise exception 'Must be authenticated';
  end if;

  select * into v_old from public.memberships
  where id = p_membership_id and gym_id = v_gym_id;

  if not found then
    raise exception 'Membership not found';
  end if;

  v_member_id := v_old.member_id;

  if v_old.start_date > current_date then
    raise exception 'Cannot renew a membership that has not started yet';
  end if;

  select status into v_old_status from public.membership_status where membership_id = v_old.id;

  if v_old_status = 'frozen' then
    raise exception 'Unfreeze this membership before renewing it';
  end if;

  if exists (
    select 1 from public.memberships
    where member_id = v_member_id and start_date > current_date and id <> v_old.id
  ) then
    raise exception 'An upcoming renewal is already scheduled for this member';
  end if;

  if p_duration_days <= 0 then
    raise exception 'Duration must be a positive number of days';
  end if;

  if p_plan_id is not null and not exists (
    select 1 from public.membership_plans where id = p_plan_id and gym_id = v_gym_id
  ) then
    raise exception 'Plan not found';
  end if;

  if current_date <= v_old.end_date then
    v_new_start := v_old.end_date + 1;
  else
    v_new_start := current_date;
  end if;

  v_new_end := v_new_start + (p_duration_days - 1);

  insert into public.memberships (
    gym_id, member_id, plan_id, plan_name_snapshot, duration_days_snapshot,
    start_date, end_date, previous_membership_id, created_by
  ) values (
    v_gym_id, v_member_id, p_plan_id, p_plan_name_snapshot, p_duration_days,
    v_new_start, v_new_end, v_old.id, auth.uid()
  )
  returning * into v_new;

  insert into public.charges (
    gym_id, member_id, membership_id, charge_type, gross_amount, discount_amount, created_by
  ) values (
    v_gym_id, v_member_id, v_new.id, 'membership_renewal', p_gross_amount, p_discount_amount, auth.uid()
  )
  returning * into v_charge;

  v_charge_outstanding := public.charge_outstanding(v_charge.id);

  for v_payment in
    select p.id, p.amount,
           p.amount - coalesce((select sum(pa.amount) from public.payment_allocations pa where pa.payment_id = p.id), 0) as available
    from public.payments p
    where p.member_id = v_member_id and p.entry_type = 'payment'
    order by p.created_at asc
  loop
    exit when v_charge_outstanding <= 0;
    if v_payment.available <= 0 then
      continue;
    end if;

    v_alloc_amount := least(v_payment.available, v_charge_outstanding);

    insert into public.payment_allocations (gym_id, member_id, payment_id, charge_id, amount)
    values (v_gym_id, v_member_id, v_payment.id, v_charge.id, v_alloc_amount);

    v_charge_outstanding := v_charge_outstanding - v_alloc_amount;
  end loop;

  return v_new;
end;
$$;

revoke all on function public.renew_membership(uuid, uuid, text, integer, numeric, numeric) from public;
grant execute on function public.renew_membership(uuid, uuid, text, integer, numeric, numeric) to authenticated;