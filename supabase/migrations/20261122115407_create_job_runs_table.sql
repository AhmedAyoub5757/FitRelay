create table public.job_runs (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete restrict,
  job_name text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running', 'success', 'failed')),
  processed_count integer,
  error_message text
);

alter table public.job_runs enable row level security;
-- No policies for the client — internal only, touched by security-definer functions.

grant select on public.job_runs to service_role;
grant select on public.reminders to service_role;