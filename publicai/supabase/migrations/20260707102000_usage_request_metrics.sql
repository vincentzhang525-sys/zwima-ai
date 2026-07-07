-- 20260707102000_usage_request_metrics.sql
alter table public.usage_records
  add column if not exists credits_deducted bigint not null default 0,
  add column if not exists request_time_ms integer not null default 0;
