-- 20260707120000_security_hardening.sql
create table if not exists public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  route text not null,
  count integer not null default 0,
  window_start timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  event_type text not null,
  action text not null,
  target text,
  detail text,
  ip text,
  created_at timestamptz not null default now()
);

create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  user_id uuid references public.profiles (id) on delete set null,
  ip text,
  detail text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  session_token_hash text not null,
  remember_me boolean not null default false,
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_rate_limits_key_route on public.rate_limits (key, route);
create index if not exists idx_audit_logs_user_created on public.audit_logs (user_id, created_at desc);
create index if not exists idx_security_events_created on public.security_events (created_at desc);
create index if not exists idx_user_sessions_user_created on public.user_sessions (user_id, created_at desc);
