-- Phase 3A: Commercial activation foundation
-- Additive migration — safe for production

-- Extend credit ledger
alter table public.credit_transactions
  add column if not exists reference_type text,
  add column if not exists reference_id text,
  add column if not exists idempotency_key text,
  add column if not exists actor_id uuid references public.profiles (id) on delete set null,
  add column if not exists actor_type text;

alter table public.credit_transactions drop constraint if exists credit_transactions_type_check;
alter table public.credit_transactions add constraint credit_transactions_type_check
  check (type in ('topup', 'usage', 'adjustment', 'refund'));

create unique index if not exists idx_credit_transactions_idempotency
  on public.credit_transactions (idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_credit_transactions_reference
  on public.credit_transactions (reference_type, reference_id);

-- Stripe webhook idempotency
create table if not exists public.stripe_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  order_id uuid references public.orders (id) on delete set null,
  payment_status text not null default 'processed',
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now()
);

create index if not exists idx_stripe_webhook_events_type on public.stripe_webhook_events (event_type);

-- Payment provider reference on orders (stripe session id etc.)
alter table public.orders
  add column if not exists provider_ref text;

create index if not exists idx_orders_provider_ref on public.orders (provider_ref);

-- Link usage records to credit transactions
alter table public.usage_records
  add column if not exists credit_transaction_id uuid;

-- Atomic credit deduction
create or replace function public.deduct_credits_atomic(
  p_user_id uuid,
  p_amount bigint,
  p_description text,
  p_reference_type text default 'usage',
  p_reference_id text default null,
  p_idempotency_key text default null
)
returns table (new_balance bigint, txn_id uuid, already_applied boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance bigint;
  v_txn_id uuid;
  v_existing uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'deduct amount must be positive';
  end if;

  if p_idempotency_key is not null then
    select id into v_existing
    from public.credit_transactions
    where idempotency_key = p_idempotency_key
    limit 1;
    if v_existing is not null then
      select balance into v_balance from public.credit_wallets where user_id = p_user_id;
      return query select coalesce(v_balance, 0::bigint), v_existing, true;
      return;
    end if;
  end if;

  insert into public.credit_wallets (user_id, balance, currency)
  values (p_user_id, 0, 'EUR')
  on conflict (user_id) do nothing;

  select balance into v_balance
  from public.credit_wallets
  where user_id = p_user_id
  for update;

  if coalesce(v_balance, 0) < p_amount then
    raise exception 'insufficient credits';
  end if;

  v_balance := v_balance - p_amount;

  update public.credit_wallets
  set balance = v_balance, updated_at = now()
  where user_id = p_user_id;

  insert into public.credit_transactions (
    user_id, type, amount, description, txn_date, status,
    reference_type, reference_id, idempotency_key
  ) values (
    p_user_id, 'usage', -p_amount, p_description, current_date, 'completed',
    p_reference_type, p_reference_id, p_idempotency_key
  )
  returning id into v_txn_id;

  return query select v_balance, v_txn_id, false;
end;
$$;

-- Atomic credit credit (topup/refund) with idempotency
create or replace function public.credit_credits_atomic(
  p_user_id uuid,
  p_amount bigint,
  p_type text,
  p_description text,
  p_reference_type text default null,
  p_reference_id text default null,
  p_idempotency_key text default null,
  p_actor_id uuid default null,
  p_actor_type text default null
)
returns table (new_balance bigint, txn_id uuid, already_applied boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance bigint;
  v_txn_id uuid;
  v_existing uuid;
begin
  if p_amount is null or p_amount = 0 then
    raise exception 'credit amount must be non-zero';
  end if;
  if p_type not in ('topup', 'adjustment', 'refund') then
    raise exception 'invalid credit type';
  end if;

  if p_idempotency_key is not null then
    select id into v_existing
    from public.credit_transactions
    where idempotency_key = p_idempotency_key
    limit 1;
    if v_existing is not null then
      select balance into v_balance from public.credit_wallets where user_id = p_user_id;
      return query select coalesce(v_balance, 0::bigint), v_existing, true;
      return;
    end if;
  end if;

  insert into public.credit_wallets (user_id, balance, currency)
  values (p_user_id, 0, 'EUR')
  on conflict (user_id) do nothing;

  select balance into v_balance
  from public.credit_wallets
  where user_id = p_user_id
  for update;

  v_balance := coalesce(v_balance, 0) + p_amount;
  if v_balance < 0 then
    raise exception 'credit balance cannot go negative';
  end if;

  update public.credit_wallets
  set balance = v_balance, updated_at = now()
  where user_id = p_user_id;

  insert into public.credit_transactions (
    user_id, type, amount, description, txn_date, status,
    reference_type, reference_id, idempotency_key, actor_id, actor_type
  ) values (
    p_user_id, p_type, p_amount, p_description, current_date, 'completed',
    p_reference_type, p_reference_id, p_idempotency_key, p_actor_id, p_actor_type
  )
  returning id into v_txn_id;

  return query select v_balance, v_txn_id, false;
end;
$$;
