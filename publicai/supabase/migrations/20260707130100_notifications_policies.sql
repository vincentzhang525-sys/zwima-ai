-- 20260707130100_notifications_policies.sql
alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists notifications_insert_own on public.notifications;
create policy notifications_insert_own on public.notifications
  for insert with check (auth.uid() = user_id or public.is_admin());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update using (auth.uid() = user_id or public.is_admin());
