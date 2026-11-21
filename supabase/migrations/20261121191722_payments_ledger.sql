-- ============================================================
-- gym_counters — backs receipt numbering. Fully locked down:
-- no client access at all, only touched inside security-definer
-- functions (which bypass RLS via the function owner's privileges).
-- ============================================================
create table public.gym_counters (
  gym_id uuid not null references public.gyms (id) on delete restrict,
  counter_name text not null,
  current_value bigint not null default 0,
  primary key (gym_id, counter_name)
);

alter table public.gym_counters enable row level security;
-- No policies at all — default-deny for every client role.

-- ============================================================
-- payments
-- ============================================================
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null,
  member_id uuid not null,

  entry_type text not null check (entry_type in ('payment', 'refund')),
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('cash', 'bank_transfer', 'card', 'other')),

  receipt_number bigint not null,

  created_by uuid references public.app_users (id),
  created_at timestamptz not null default now(),

  constraint payments_id_gym_id_unique unique (id, gym_id),
  constraint payments_id_member_id_unique unique (id, member_id),
  constraint payments_gym_receipt_unique unique (gym_id, receipt_number),

  constraint payments_member_same_gym
    foreign key (member_id, gym_id) references public.members (id, gym_id),

  constraint payments_created_by_same_gym
    foreign key (created_by, gym_id) references public.app_users (id, gym_id)
);

create index payments_member_id_idx on public.payments (member_id);

alter table public.payments enable row level security;

create policy payments_select on public.payments
  for select using (gym_id = public.current_gym_id());

-- No insert policy — payments are only created via the create_payment()/
-- create_refund() functions (next step), which generate the receipt
-- number under lock and, for a payment, perform its allocations atomically.

-- ============================================================
-- payment_allocations
-- ============================================================
create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null,
  member_id uuid not null,
  payment_id uuid not null,
  charge_id uuid not null,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now(),

  constraint payment_allocations_id_gym_id_unique unique (id, gym_id),
  constraint payment_allocations_id_member_id_unique unique (id, member_id),

  constraint payment_allocations_payment_same_gym
    foreign key (payment_id, gym_id) references public.payments (id, gym_id),
  constraint payment_allocations_payment_same_member
    foreign key (payment_id, member_id) references public.payments (id, member_id),

  constraint payment_allocations_charge_same_gym
    foreign key (charge_id, gym_id) references public.charges (id, gym_id),
  constraint payment_allocations_charge_same_member
    foreign key (charge_id, member_id) references public.charges (id, member_id)
);

create index payment_allocations_payment_id_idx on public.payment_allocations (payment_id);
create index payment_allocations_charge_id_idx on public.payment_allocations (charge_id);

alter table public.payment_allocations enable row level security;

create policy payment_allocations_select on public.payment_allocations
  for select using (gym_id = public.current_gym_id());

-- ============================================================
-- payment_allocation_reversals
-- ============================================================
create table public.payment_allocation_reversals (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null,
  member_id uuid not null,

  original_allocation_id uuid not null,
  refund_payment_id uuid not null,

  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now(),

  constraint par_allocation_same_gym
    foreign key (original_allocation_id, gym_id) references public.payment_allocations (id, gym_id),
  constraint par_allocation_same_member
    foreign key (original_allocation_id, member_id) references public.payment_allocations (id, member_id),

  constraint par_refund_payment_same_gym
    foreign key (refund_payment_id, gym_id) references public.payments (id, gym_id),
  constraint par_refund_payment_same_member
    foreign key (refund_payment_id, member_id) references public.payments (id, member_id)
);

create index par_original_allocation_id_idx on public.payment_allocation_reversals (original_allocation_id);
create index par_refund_payment_id_idx on public.payment_allocation_reversals (refund_payment_id);

alter table public.payment_allocation_reversals enable row level security;

create policy payment_allocation_reversals_select on public.payment_allocation_reversals
  for select using (gym_id = public.current_gym_id());

-- ============================================================
-- Invariant 1: an allocation can't exceed its payment's amount,
-- and can only draw from entry_type = 'payment' rows (never a refund).
-- Invariant 2: an allocation can't exceed a charge's outstanding
-- balance — where "outstanding" nets out any reversals already
-- made against that charge's allocations, so a reversed allocation
-- correctly reopens room for a fresh one.
-- ============================================================
create or replace function public.enforce_payment_allocation_limits()
returns trigger
language plpgsql
as $$
declare
  v_payment public.payments;
  v_charge public.charges;
  v_already_allocated_payment numeric;
  v_already_allocated_charge numeric;
begin
  select * into v_payment from public.payments where id = new.payment_id;
  if v_payment.entry_type <> 'payment' then
    raise exception 'Allocations can only be made from payment rows, not refunds';
  end if;

  select coalesce(sum(amount), 0) into v_already_allocated_payment
  from public.payment_allocations
  where payment_id = new.payment_id;

  if v_already_allocated_payment + new.amount > v_payment.amount then
    raise exception 'Allocation exceeds this payment''s amount';
  end if;

  select * into v_charge from public.charges where id = new.charge_id;

  select coalesce(sum(pa.amount), 0)
       - coalesce((
           select sum(r.amount) from public.payment_allocation_reversals r
           join public.payment_allocations pa2 on pa2.id = r.original_allocation_id
           where pa2.charge_id = new.charge_id
         ), 0)
    into v_already_allocated_charge
  from public.payment_allocations pa
  where pa.charge_id = new.charge_id;

  if v_already_allocated_charge + new.amount > v_charge.net_amount then
    raise exception 'Allocation exceeds this charge''s outstanding amount';
  end if;

  return new;
end;
$$;

create trigger payment_allocations_enforce_limits
  before insert on public.payment_allocations
  for each row
  execute function public.enforce_payment_allocation_limits();

-- ============================================================
-- Invariant 3: can't reverse more than an allocation's own amount.
-- Invariant 4: a refund payment's total amount must exactly equal
-- the sum of the reversal rows that reference it — checked at
-- transaction commit (deferred), since the reversal rows for one
-- refund may be inserted one at a time within the same transaction.
-- ============================================================
create or replace function public.enforce_reversal_limits()
returns trigger
language plpgsql
as $$
declare
  v_allocation public.payment_allocations;
  v_already_reversed numeric;
begin
  select * into v_allocation from public.payment_allocations where id = new.original_allocation_id;

  select coalesce(sum(amount), 0) into v_already_reversed
  from public.payment_allocation_reversals
  where original_allocation_id = new.original_allocation_id;

  if v_already_reversed + new.amount > v_allocation.amount then
    raise exception 'Cannot reverse more than the remaining unreversed portion of this allocation';
  end if;

  return new;
end;
$$;

create trigger payment_allocation_reversals_enforce_limits
  before insert on public.payment_allocation_reversals
  for each row
  execute function public.enforce_reversal_limits();

create or replace function public.enforce_refund_total_matches_reversals()
returns trigger
language plpgsql
as $$
declare
  v_payment public.payments;
  v_total_reversed numeric;
begin
  select * into v_payment from public.payments where id = new.refund_payment_id;

  if v_payment.entry_type <> 'refund' then
    raise exception 'refund_payment_id must reference a payment with entry_type = refund';
  end if;

  select coalesce(sum(amount), 0) into v_total_reversed
  from public.payment_allocation_reversals
  where refund_payment_id = new.refund_payment_id;

  if v_total_reversed <> v_payment.amount then
    raise exception 'Refund amount (%) must exactly match the sum of its reversal rows (%)',
      v_payment.amount, v_total_reversed;
  end if;

  return null;
end;
$$;

create constraint trigger payment_allocation_reversals_match_refund
  after insert on public.payment_allocation_reversals
  deferrable initially deferred
  for each row
  execute function public.enforce_refund_total_matches_reversals();