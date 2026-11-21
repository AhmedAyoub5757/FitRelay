create table public.charges (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null,
  member_id uuid not null,
  membership_id uuid,  -- nullable: future non-membership charge types; always set in v1

  charge_type text not null default 'membership_renewal'
    check (charge_type in ('membership_renewal')),

  gross_amount numeric(12,2) not null check (gross_amount >= 0),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  net_amount numeric(12,2) generated always as (gross_amount - discount_amount) stored,

  created_by uuid references public.app_users (id),
  created_at timestamptz not null default now(),

  constraint charges_id_gym_id_unique unique (id, gym_id),
  constraint charges_id_member_id_unique unique (id, member_id),

  constraint charges_discount_not_more_than_gross
    check (discount_amount <= gross_amount),

  constraint charges_member_same_gym
    foreign key (member_id, gym_id) references public.members (id, gym_id),

  constraint charges_membership_same_gym
    foreign key (membership_id, gym_id) references public.memberships (id, gym_id),

  constraint charges_membership_same_member
    foreign key (membership_id, member_id) references public.memberships (id, member_id),

  constraint charges_created_by_same_gym
    foreign key (created_by, gym_id) references public.app_users (id, gym_id)
);

create index charges_member_id_idx on public.charges (member_id);
create index charges_membership_id_idx on public.charges (membership_id);
create index charges_gym_id_idx on public.charges (gym_id);

alter table public.charges enable row level security;

create policy charges_select on public.charges
  for select using (gym_id = public.current_gym_id());

-- No insert/update/delete policy: charges are created only by the
-- registration/renewal functions (next steps), and never modified
-- afterward — net_amount is a generated column, not writable at all.