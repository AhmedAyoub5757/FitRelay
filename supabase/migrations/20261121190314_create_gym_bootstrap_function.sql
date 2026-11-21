create or replace function public.create_gym_and_owner(
  gym_name text,
  gym_timezone text default 'Asia/Karachi',
  owner_full_name text default null
)
returns public.gyms
language plpgsql
security definer
set search_path = public
as $$
declare
  new_gym public.gyms;
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'Must be authenticated to create a gym';
  end if;

  if exists (select 1 from public.app_users where id = caller_id) then
    raise exception 'This user already belongs to a gym';
  end if;

  insert into public.gyms (name, timezone)
  values (gym_name, gym_timezone)
  returning * into new_gym;

  insert into public.app_users (id, gym_id, role, full_name)
  values (caller_id, new_gym.id, 'owner', owner_full_name);

  return new_gym;
end;
$$;

revoke all on function public.create_gym_and_owner(text, text, text) from public;
grant execute on function public.create_gym_and_owner(text, text, text) to authenticated;