-- ZWIMA AI — User System V1 (Supabase PostgreSQL)
-- Sprint 27: Database Migration V1
-- Run in Supabase SQL Editor or via supabase db push

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Profiles (extends auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique not null,
  company text not null default 'Company',
  country text not null default 'Germany',
  role text not null default 'customer' check (role in ('customer', 'admin')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  plan text not null default 'Starter',
  language text default 'English',
  timezone text default 'Europe/Berlin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Credits
-- ---------------------------------------------------------------------------
create table if not exists public.credit_wallets (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  currency text not null default 'EUR',
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('topup', 'usage', 'adjustment')),
  amount bigint not null,
  description text,
  txn_date date not null default current_date,
  status text not null default 'completed',
  created_at timestamptz not null default now()
);

create index if not exists idx_credit_transactions_user_id on public.credit_transactions (user_id);
create index if not exists idx_credit_transactions_txn_date on public.credit_transactions (txn_date desc);

-- ---------------------------------------------------------------------------
-- Usage history
-- ---------------------------------------------------------------------------
create table if not exists public.usage_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  date_time timestamptz not null default now(),
  provider text,
  model text,
  prompt text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  total_tokens integer not null default 0,
  estimated_cost numeric(14, 6) not null default 0,
  remaining_credits bigint not null default 0,
  status text not null default 'Success',
  created_at timestamptz not null default now()
);

create index if not exists idx_usage_records_user_id on public.usage_records (user_id);
create index if not exists idx_usage_records_date_time on public.usage_records (date_time desc);

-- ---------------------------------------------------------------------------
-- API Keys
-- ---------------------------------------------------------------------------
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null,
  status text not null default 'Active' check (status in ('Active', 'Disabled')),
  last_used timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_api_keys_user_id on public.api_keys (user_id);

-- ---------------------------------------------------------------------------
-- Playground conversation history
-- ---------------------------------------------------------------------------
create table if not exists public.playground_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  provider text,
  model text,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_playground_conversations_user_id on public.playground_conversations (user_id);
create index if not exists idx_playground_conversations_updated_at on public.playground_conversations (updated_at desc);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- New user bootstrap (profile + wallet)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.credit_wallets enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.usage_records enable row level security;
alter table public.api_keys enable row level security;
alter table public.playground_conversations enable row level security;

-- Profiles
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id or public.is_admin());

-- Credit wallets
drop policy if exists credit_wallets_select_own on public.credit_wallets;
create policy credit_wallets_select_own on public.credit_wallets
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists credit_wallets_update_own on public.credit_wallets;
create policy credit_wallets_update_own on public.credit_wallets
  for update using (auth.uid() = user_id or public.is_admin());

drop policy if exists credit_wallets_insert_own on public.credit_wallets;
create policy credit_wallets_insert_own on public.credit_wallets
  for insert with check (auth.uid() = user_id or public.is_admin());

-- Credit transactions
drop policy if exists credit_transactions_select_own on public.credit_transactions;
create policy credit_transactions_select_own on public.credit_transactions
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists credit_transactions_insert_own on public.credit_transactions;
create policy credit_transactions_insert_own on public.credit_transactions
  for insert with check (auth.uid() = user_id or public.is_admin());

-- Usage records
drop policy if exists usage_records_select_own on public.usage_records;
create policy usage_records_select_own on public.usage_records
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists usage_records_insert_own on public.usage_records;
create policy usage_records_insert_own on public.usage_records
  for insert with check (auth.uid() = user_id or public.is_admin());

-- API keys
drop policy if exists api_keys_select_own on public.api_keys;
create policy api_keys_select_own on public.api_keys
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists api_keys_insert_own on public.api_keys;
create policy api_keys_insert_own on public.api_keys
  for insert with check (auth.uid() = user_id or public.is_admin());

drop policy if exists api_keys_update_own on public.api_keys;
create policy api_keys_update_own on public.api_keys
  for update using (auth.uid() = user_id or public.is_admin());

drop policy if exists api_keys_delete_own on public.api_keys;
create policy api_keys_delete_own on public.api_keys
  for delete using (auth.uid() = user_id or public.is_admin());

-- Playground conversations
drop policy if exists playground_conversations_select_own on public.playground_conversations;
create policy playground_conversations_select_own on public.playground_conversations
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists playground_conversations_insert_own on public.playground_conversations;
create policy playground_conversations_insert_own on public.playground_conversations
  for insert with check (auth.uid() = user_id or public.is_admin());

drop policy if exists playground_conversations_update_own on public.playground_conversations;
create policy playground_conversations_update_own on public.playground_conversations
  for update using (auth.uid() = user_id or public.is_admin());

drop policy if exists playground_conversations_delete_own on public.playground_conversations;
create policy playground_conversations_delete_own on public.playground_conversations
  for delete using (auth.uid() = user_id or public.is_admin());
