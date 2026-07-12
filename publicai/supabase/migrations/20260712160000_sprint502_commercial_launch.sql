-- Sprint 50.2 — auth codes, gateway audit, commercial launch

create table if not exists public.auth_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  code_hash text not null,
  purpose text not null check (purpose in ('email_verify', 'password_reset')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists auth_codes_email_purpose_idx
  on public.auth_codes (email, purpose)
  where used_at is null;

alter table public.profiles
  add column if not exists email_verified_at timestamptz;

create table if not exists public.gateway_request_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  api_key_id uuid,
  provider text,
  model text,
  status text not null default 'success',
  input_tokens int default 0,
  output_tokens int default 0,
  credits_deducted int default 0,
  estimated_cost numeric(12, 6) default 0,
  latency_ms int default 0,
  error_message text,
  region_policy text,
  created_at timestamptz not null default now()
);

create index if not exists gateway_request_logs_user_created_idx
  on public.gateway_request_logs (user_id, created_at desc);
