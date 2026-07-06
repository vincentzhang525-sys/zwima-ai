-- 20260706120300_usage.sql
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
