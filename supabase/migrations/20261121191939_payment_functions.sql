-- Reusable: a charge's live outstanding balance.
create or replace function public.charge_outstanding(p_charge_id uuid)
returns numeric
language sql
stable
as $$
  select c.net_amount
       - coalesce((select sum(pa.amount) from public.payment_allocations pa where pa.charge_id = p_charge_id), 0)
       + coalesce((
           select sum(r.amount) from public.payment_allocation_reversals r
           join public.payment_allocations pa2 on pa2.id = r.original_allocation_id
           where pa2.charge_id = p_charge_id
         ), 0)
  from public.charges c
  where c.id = p_charge_id;
$$;

-- A member's available credit: unallocated amount from their 'payment' rows.
-- Deliberately not adjusted by reversals (see earlier reasoning: reversed
-- money left as a refund, it doesn't come back as usable credit).
create or replace function public.member_credit_balance(p_member_id uuid)
returns numeric
language sql
stable
as $$
  select
    coalesce((select sum(amount) from public.payments
              where member_id = p_member_id and entry_type = 'payment'), 0)
    -
    coalesce((select sum(pa.amount) from public.payment_allocations pa
              join public.payments p on p.id = pa.payment_id
              where p.member_id = p_member_id and p.entry_type = 'payment'), 0);
$$;

revoke all on function public.charge_outstanding(uuid) from public;
grant execute on function public.charge_outstanding(uuid) to authenticated;
revoke all on function public.member_credit_balance(uuid) from public;
grant execute on function public.member_credit_balance(uuid) to authenticated;

-- ============================================================
-- create_payment
-- ============================================================
create or replace function public.create_payment(
  p_member_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_allocations jsonb default null  -- [{"charge_id": "...", "amount": 123.45}, ...]
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
    -- Anything left in v_remaining is unallocated credit — no action needed,
    -- member_credit_balance() picks it up automatically.
  end if;

  return v_payment;
end;
$$;

revoke all on function public.create_payment(uuid, numeric, text, jsonb) from public;
grant execute on function public.create_payment(uuid, numeric, text, jsonb) to authenticated;

-- ============================================================
-- create_refund
-- ============================================================
create or replace function public.create_refund(
  p_member_id uuid,
  p_payment_method text,
  p_reversals jsonb  -- required: [{"original_allocation_id": "...", "amount": ...}, ...]
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
  v_total numeric;
  v_item jsonb;
begin
  if v_gym_id is null then
    raise exception 'Must be authenticated';
  end if;

  if not exists (select 1 from public.members where id = p_member_id and gym_id = v_gym_id) then
    raise exception 'Member not found';
  end if;

  if p_reversals is null or jsonb_array_length(p_reversals) = 0 then
    raise exception 'At least one reversal must be specified';
  end if;

  select sum((item->>'amount')::numeric) into v_total
  from jsonb_array_elements(p_reversals) as item;

  insert into public.gym_counters (gym_id, counter_name, current_value)
  values (v_gym_id, 'receipt', 1)
  on conflict (gym_id, counter_name)
    do update set current_value = gym_counters.current_value + 1
  returning current_value into v_receipt_number;

  insert into public.payments (gym_id, member_id, entry_type, amount, payment_method, receipt_number, created_by)
  values (v_gym_id, p_member_id, 'refund', v_total, p_payment_method, v_receipt_number, auth.uid())
  returning * into v_payment;

  for v_item in select * from jsonb_array_elements(p_reversals)
  loop
    insert into public.payment_allocation_reversals
      (gym_id, member_id, original_allocation_id, refund_payment_id, amount)
    values
      (v_gym_id, p_member_id, (v_item->>'original_allocation_id')::uuid, v_payment.id, (v_item->>'amount')::numeric);
  end loop;

  return v_payment;
end;
$$;

revoke all on function public.create_refund(uuid, text, jsonb) from public;
grant execute on function public.create_refund(uuid, text, jsonb) to authenticated;