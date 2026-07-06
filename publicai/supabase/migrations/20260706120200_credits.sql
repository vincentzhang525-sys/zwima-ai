-- 20260706120200_credits.sql
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
