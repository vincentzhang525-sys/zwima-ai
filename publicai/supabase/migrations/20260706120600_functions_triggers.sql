-- 20260706120600_functions_triggers.sql
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists playground_conversations_updated_at on public.playground_conversations;
create trigger playground_conversations_updated_at
  before update on public.playground_conversations
  for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  initial_credits bigint := 1000;
  user_role text := coalesce(new.raw_user_meta_data->>'role', 'customer');
  user_plan text := coalesce(new.raw_user_meta_data->>'plan', 'Starter');
begin
  if user_role = 'admin' then
    initial_credits := 50000;
    user_plan := coalesce(new.raw_user_meta_data->>'plan', 'Enterprise');
  end if;

  insert into public.profiles (id, email, company, country, role, status, plan)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data->>'company', 'Company'),
    coalesce(new.raw_user_meta_data->>'country', 'Germany'),
    user_role,
    coalesce(new.raw_user_meta_data->>'status', 'active'),
    user_plan
  );

  insert into public.credit_wallets (user_id, balance)
  values (new.id, initial_credits);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
