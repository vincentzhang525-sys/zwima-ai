-- 20260706120700_rls_policies.sql
alter table public.profiles enable row level security;
alter table public.credit_wallets enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.usage_records enable row level security;
alter table public.api_keys enable row level security;
alter table public.playground_conversations enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id or public.is_admin());

drop policy if exists credit_wallets_select_own on public.credit_wallets;
create policy credit_wallets_select_own on public.credit_wallets
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists credit_wallets_update_own on public.credit_wallets;
create policy credit_wallets_update_own on public.credit_wallets
  for update using (auth.uid() = user_id or public.is_admin());

drop policy if exists credit_wallets_insert_own on public.credit_wallets;
create policy credit_wallets_insert_own on public.credit_wallets
  for insert with check (auth.uid() = user_id or public.is_admin());

drop policy if exists credit_transactions_select_own on public.credit_transactions;
create policy credit_transactions_select_own on public.credit_transactions
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists credit_transactions_insert_own on public.credit_transactions;
create policy credit_transactions_insert_own on public.credit_transactions
  for insert with check (auth.uid() = user_id or public.is_admin());

drop policy if exists usage_records_select_own on public.usage_records;
create policy usage_records_select_own on public.usage_records
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists usage_records_insert_own on public.usage_records;
create policy usage_records_insert_own on public.usage_records
  for insert with check (auth.uid() = user_id or public.is_admin());

drop policy if exists api_keys_select_own on public.api_keys;
create policy api_keys_select_own on public.api_keys
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists api_keys_insert_own on public.api_keys;
create policy api_keys_insert_own on public.api_keys
  for insert with check (auth.uid() = user_id or public.is_admin());

drop policy if exists api_keys_update_own on public.api_keys;
create policy api_keys_update_own on public.api_keys
  for update using (auth.uid() = user_id or public.is_admin());

drop policy if exists api_keys_delete_own on public.api_keys;
create policy api_keys_delete_own on public.api_keys
  for delete using (auth.uid() = user_id or public.is_admin());

drop policy if exists playground_conversations_select_own on public.playground_conversations;
create policy playground_conversations_select_own on public.playground_conversations
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists playground_conversations_insert_own on public.playground_conversations;
create policy playground_conversations_insert_own on public.playground_conversations
  for insert with check (auth.uid() = user_id or public.is_admin());

drop policy if exists playground_conversations_update_own on public.playground_conversations;
create policy playground_conversations_update_own on public.playground_conversations
  for update using (auth.uid() = user_id or public.is_admin());

drop policy if exists playground_conversations_delete_own on public.playground_conversations;
create policy playground_conversations_delete_own on public.playground_conversations
  for delete using (auth.uid() = user_id or public.is_admin());

