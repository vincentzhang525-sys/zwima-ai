-- 20260707113000_subscriptions_payments.sql
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan text not null,
  status text not null default 'active',
  credits bigint not null default 0,
  renew_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(14,2) not null,
  currency text not null default 'EUR',
  status text not null default 'completed',
  provider text not null default 'stripe',
  invoice_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_user_id on public.subscriptions (user_id);
create index if not exists idx_payments_user_id on public.payments (user_id);
