-- 20260706120400_api_keys.sql
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
