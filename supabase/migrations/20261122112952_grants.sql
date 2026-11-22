-- Read-only for the client (RLS already scopes these to the caller's gym).
grant select on public.gyms to authenticated;
grant select on public.app_users to authenticated;
grant select on public.memberships to authenticated;
grant select on public.membership_freezes to authenticated;
grant select on public.charges to authenticated;
grant select on public.payments to authenticated;
grant select on public.payment_allocations to authenticated;
grant select on public.payment_allocation_reversals to authenticated;
grant select on public.reminders to authenticated;
grant select on public.membership_status to authenticated;
grant select on public.member_status to authenticated;

-- Direct client writes are intentionally allowed here (we gave these
-- tables insert/update RLS policies earlier, unlike memberships/charges
-- which are function-only).
grant select, insert, update on public.members to authenticated;
grant select, insert, update on public.membership_plans to authenticated;

-- job_runs and gym_counters deliberately receive no grants at all —
-- fully internal, touched only by security-definer functions.