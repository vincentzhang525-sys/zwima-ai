-- 20260707130000_sprint35_portal.sql
alter table public.api_keys
  add column if not exists expires_at timestamptz,
  add column if not exists total_requests bigint not null default 0;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null default 'system',
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_created on public.notifications (user_id, created_at desc);
