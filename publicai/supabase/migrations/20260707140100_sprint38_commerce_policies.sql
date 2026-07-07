-- 20260707140100_sprint38_commerce_policies.sql
alter table public.subscription_plans enable row level security;
alter table public.credit_packages enable row level security;
alter table public.orders enable row level security;
alter table public.commerce_transactions enable row level security;
alter table public.invoices enable row level security;
alter table public.payment_methods enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;

-- Catalog tables: readable by all authenticated users
drop policy if exists subscription_plans_select on public.subscription_plans;
create policy subscription_plans_select on public.subscription_plans for select using (true);

drop policy if exists credit_packages_select on public.credit_packages;
create policy credit_packages_select on public.credit_packages for select using (true);

drop policy if exists coupons_select on public.coupons;
create policy coupons_select on public.coupons for select using (status = 'active');

-- Orders
drop policy if exists orders_select_own on public.orders;
create policy orders_select_own on public.orders for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists orders_insert_own on public.orders;
create policy orders_insert_own on public.orders for insert with check (auth.uid() = user_id or public.is_admin());

drop policy if exists orders_update_admin on public.orders;
create policy orders_update_admin on public.orders for update using (public.is_admin());

-- Commerce transactions
drop policy if exists commerce_transactions_select_own on public.commerce_transactions;
create policy commerce_transactions_select_own on public.commerce_transactions for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists commerce_transactions_insert_own on public.commerce_transactions;
create policy commerce_transactions_insert_own on public.commerce_transactions for insert with check (auth.uid() = user_id or public.is_admin());

-- Invoices
drop policy if exists invoices_select_own on public.invoices;
create policy invoices_select_own on public.invoices for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists invoices_insert_own on public.invoices;
create policy invoices_insert_own on public.invoices for insert with check (auth.uid() = user_id or public.is_admin());

-- Payment methods
drop policy if exists payment_methods_select_own on public.payment_methods;
create policy payment_methods_select_own on public.payment_methods for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists payment_methods_insert_own on public.payment_methods;
create policy payment_methods_insert_own on public.payment_methods for insert with check (auth.uid() = user_id or public.is_admin());

drop policy if exists payment_methods_update_own on public.payment_methods;
create policy payment_methods_update_own on public.payment_methods for update using (auth.uid() = user_id or public.is_admin());

-- Coupon redemptions
drop policy if exists coupon_redemptions_select_own on public.coupon_redemptions;
create policy coupon_redemptions_select_own on public.coupon_redemptions for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists coupon_redemptions_insert_own on public.coupon_redemptions;
create policy coupon_redemptions_insert_own on public.coupon_redemptions for insert with check (auth.uid() = user_id or public.is_admin());

-- Referrals
drop policy if exists referral_codes_select on public.referral_codes;
create policy referral_codes_select on public.referral_codes for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists referral_codes_insert_own on public.referral_codes;
create policy referral_codes_insert_own on public.referral_codes for insert with check (auth.uid() = user_id or public.is_admin());

drop policy if exists referral_codes_update_own on public.referral_codes;
create policy referral_codes_update_own on public.referral_codes for update using (auth.uid() = user_id or public.is_admin());

drop policy if exists referrals_select_own on public.referrals;
create policy referrals_select_own on public.referrals for select using (auth.uid() = referrer_user_id or auth.uid() = referred_user_id or public.is_admin());

drop policy if exists referrals_insert_own on public.referrals;
create policy referrals_insert_own on public.referrals for insert with check (auth.uid() = referrer_user_id or public.is_admin());

-- Admin manage catalog
drop policy if exists subscription_plans_admin on public.subscription_plans;
create policy subscription_plans_admin on public.subscription_plans for all using (public.is_admin());

drop policy if exists credit_packages_admin on public.credit_packages;
create policy credit_packages_admin on public.credit_packages for all using (public.is_admin());

drop policy if exists coupons_admin on public.coupons;
create policy coupons_admin on public.coupons for all using (public.is_admin());
