-- 20260706120100_profiles.sql
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique not null,
  company text not null default 'Company',
  country text not null default 'Germany',
  role text not null default 'customer' check (role in ('customer', 'admin')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  plan text not null default 'Starter',
  language text default 'English',
  timezone text default 'Europe/Berlin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
