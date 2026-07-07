-- 20260707140000_sprint38_commerce.sql
-- Sprint 38: Commercial subscription & commerce system

create table if not exists public.subscription_plans (
  id text primary key,
  name text not null,
  monthly_credits bigint not null default 0,
  max_api_keys integer not null default 1,
  max_team_members integer not null default 1,
  available_models jsonb not null default '["all"]'::jsonb,
  priority_routing boolean not null default false,
  rate_limit integer not null default 60,
  monthly_price numeric(14,2) not null default 0,
  annual_price numeric(14,2) not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.credit_packages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  credits bigint not null,
  price numeric(14,2) not null,
  currency text not null default 'EUR',
  tax_rate numeric(5,4) not null default 0.19,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  order_number text not null unique,
  order_type text not null,
  plan_id text references public.subscription_plans (id),
  package_id uuid references public.credit_packages (id),
  subtotal numeric(14,2) not null default 0,
  tax numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  currency text not null default 'EUR',
  status text not null default 'pending',
  provider text not null default 'stripe',
  coupon_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.commerce_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  provider text not null,
  provider_ref text,
  amount numeric(14,2) not null,
  currency text not null default 'EUR',
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  invoice_number text not null unique,
  company text,
  vat text,
  country text default 'DE',
  currency text not null default 'EUR',
  subtotal numeric(14,2) not null default 0,
  tax numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  status text not null default 'issued',
  download_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null,
  method_type text not null default 'card',
  label text not null,
  is_default boolean not null default false,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null,
  discount_value numeric(14,2) not null,
  expires_at timestamptz,
  usage_limit integer,
  per_user_limit integer not null default 1,
  per_company_limit integer,
  usage_count integer not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.referral_codes (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  code text not null unique,
  total_invites integer not null default 0,
  credits_earned bigint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references public.profiles (id) on delete cascade,
  referred_user_id uuid references public.profiles (id) on delete set null,
  referral_code text not null,
  reward_credits bigint not null default 500,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists idx_orders_user_id on public.orders (user_id);
create index if not exists idx_orders_status on public.orders (status);
create index if not exists idx_commerce_transactions_user_id on public.commerce_transactions (user_id);
create index if not exists idx_invoices_user_id on public.invoices (user_id);
create index if not exists idx_payment_methods_user_id on public.payment_methods (user_id);
create index if not exists idx_coupon_redemptions_user_id on public.coupon_redemptions (user_id);
create index if not exists idx_referrals_referrer on public.referrals (referrer_user_id);

alter table public.orders drop constraint if exists orders_coupon_fk;
alter table public.orders
  add constraint orders_coupon_fk foreign key (coupon_id) references public.coupons (id) on delete set null;

-- Seed subscription plans
insert into public.subscription_plans (id, name, monthly_credits, max_api_keys, max_team_members, available_models, priority_routing, rate_limit, monthly_price, annual_price, status)
values
  ('free', 'Free', 500, 1, 1, '["gpt-4o","gemini-2-flash"]', false, 60, 0, 0, 'active'),
  ('starter', 'Starter', 20000, 3, 3, '["gpt-4o","gpt-4.1","gemini-2-flash","gemini-2-pro"]', false, 120, 29, 290, 'active'),
  ('professional', 'Professional', 50000, 10, 10, '["gpt-4o","gpt-4.1","o1-mini","gemini-2-flash","gemini-2-pro"]', true, 300, 79, 790, 'active'),
  ('business', 'Business', 100000, 25, 25, '["all"]', true, 600, 99, 990, 'active'),
  ('enterprise', 'Enterprise', 500000, 100, 100, '["all"]', true, 2000, 499, 4990, 'active')
on conflict (id) do update set
  name = excluded.name,
  monthly_credits = excluded.monthly_credits,
  max_api_keys = excluded.max_api_keys,
  max_team_members = excluded.max_team_members,
  available_models = excluded.available_models,
  priority_routing = excluded.priority_routing,
  rate_limit = excluded.rate_limit,
  monthly_price = excluded.monthly_price,
  annual_price = excluded.annual_price,
  status = excluded.status;

-- Seed credit packages
insert into public.credit_packages (slug, name, credits, price, currency, tax_rate, status)
values
  ('credits-1000', '1000 Credits', 1000, 10, 'EUR', 0.19, 'active'),
  ('credits-5000', '5000 Credits', 5000, 45, 'EUR', 0.19, 'active'),
  ('credits-10000', '10000 Credits', 10000, 85, 'EUR', 0.19, 'active'),
  ('credits-50000', '50000 Credits', 50000, 400, 'EUR', 0.19, 'active')
on conflict (slug) do update set
  name = excluded.name,
  credits = excluded.credits,
  price = excluded.price,
  currency = excluded.currency,
  tax_rate = excluded.tax_rate,
  status = excluded.status;

-- Seed welcome coupon
insert into public.coupons (code, discount_type, discount_value, usage_limit, per_user_limit, status)
values ('WELCOME10', 'percentage', 10, 1000, 1, 'active')
on conflict (code) do nothing;
