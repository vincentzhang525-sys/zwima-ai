-- 20260707120100_security_policies.sql
alter table public.audit_logs enable row level security;
alter table public.security_events enable row level security;
alter table public.user_sessions enable row level security;
alter table public.rate_limits enable row level security;

drop policy if exists audit_logs_select_own on public.audit_logs;
create policy audit_logs_select_own on public.audit_logs
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists audit_logs_insert_admin on public.audit_logs;
create policy audit_logs_insert_admin on public.audit_logs
  for insert with check (auth.uid() = user_id or public.is_admin());

drop policy if exists security_events_select_admin on public.security_events;
create policy security_events_select_admin on public.security_events
  for select using (public.is_admin());

drop policy if exists security_events_insert_admin on public.security_events;
create policy security_events_insert_admin on public.security_events
  for insert with check (public.is_admin());

drop policy if exists user_sessions_select_own on public.user_sessions;
create policy user_sessions_select_own on public.user_sessions
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists user_sessions_insert_own on public.user_sessions;
create policy user_sessions_insert_own on public.user_sessions
  for insert with check (auth.uid() = user_id or public.is_admin());

drop policy if exists user_sessions_update_own on public.user_sessions;
create policy user_sessions_update_own on public.user_sessions
  for update using (auth.uid() = user_id or public.is_admin());
