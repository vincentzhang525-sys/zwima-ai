-- 20260707113100_subscriptions_payments_policies.sql
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;

drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own on public.subscriptions
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists subscriptions_insert_own on public.subscriptions;
create policy subscriptions_insert_own on public.subscriptions
  for insert with check (auth.uid() = user_id or public.is_admin());

drop policy if exists subscriptions_update_own on public.subscriptions;
create policy subscriptions_update_own on public.subscriptions
  for update using (auth.uid() = user_id or public.is_admin());

drop policy if exists payments_select_own on public.payments;
create policy payments_select_own on public.payments
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists payments_insert_own on public.payments;
create policy payments_insert_own on public.payments
  for insert with check (auth.uid() = user_id or public.is_admin());
