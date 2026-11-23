create or replace function public.gym_outstanding_total()
returns numeric
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(sum(public.charge_outstanding(c.id)), 0)
  from public.charges c;
$$;

grant execute on function public.gym_outstanding_total() to authenticated;