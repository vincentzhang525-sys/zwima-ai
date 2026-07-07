-- 20260707160000_sprint40_onboarding.sql
create table if not exists public.onboarding_progress (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  registered boolean not null default false,
  email_verified boolean not null default false,
  api_key_created boolean not null default false,
  credits_received boolean not null default false,
  playground_opened boolean not null default false,
  first_api_call boolean not null default false,
  plan_upgraded boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_onboarding_updated on public.onboarding_progress (updated_at desc);

alter table public.onboarding_progress enable row level security;

drop policy if exists onboarding_select_own on public.onboarding_progress;
create policy onboarding_select_own on public.onboarding_progress for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists onboarding_insert_own on public.onboarding_progress;
create policy onboarding_insert_own on public.onboarding_progress for insert with check (auth.uid() = user_id or public.is_admin());

drop policy if exists onboarding_update_own on public.onboarding_progress;
create policy onboarding_update_own on public.onboarding_progress for update using (auth.uid() = user_id or public.is_admin());
