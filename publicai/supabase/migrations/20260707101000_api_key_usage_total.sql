-- 20260707101000_api_key_usage_total.sql
alter table public.api_keys
  add column if not exists total_usage bigint not null default 0;
