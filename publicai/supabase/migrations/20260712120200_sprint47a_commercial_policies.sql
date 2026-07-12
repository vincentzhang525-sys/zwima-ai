-- 20260712120200_sprint47a_commercial_policies.sql

alter table public.commercial_providers enable row level security;
alter table public.commercial_models enable row level security;
alter table public.commercial_pricing_rules enable row level security;
alter table public.commercial_routing_policies enable row level security;
alter table public.commercial_api_audits enable row level security;

-- Registry tables: readable by authenticated users, writable by admin
drop policy if exists commercial_providers_select on public.commercial_providers;
create policy commercial_providers_select on public.commercial_providers for select using (true);

drop policy if exists commercial_providers_admin on public.commercial_providers;
create policy commercial_providers_admin on public.commercial_providers
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists commercial_models_select on public.commercial_models;
create policy commercial_models_select on public.commercial_models for select using (true);

drop policy if exists commercial_models_admin on public.commercial_models;
create policy commercial_models_admin on public.commercial_models
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists commercial_pricing_select on public.commercial_pricing_rules;
create policy commercial_pricing_select on public.commercial_pricing_rules
  for select using (status = 'active' or public.is_admin());

drop policy if exists commercial_pricing_admin on public.commercial_pricing_rules;
create policy commercial_pricing_admin on public.commercial_pricing_rules
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists commercial_routing_select on public.commercial_routing_policies;
create policy commercial_routing_select on public.commercial_routing_policies
  for select using (status = 'active' or public.is_admin());

drop policy if exists commercial_routing_admin on public.commercial_routing_policies;
create policy commercial_routing_admin on public.commercial_routing_policies
  for all using (public.is_admin()) with check (public.is_admin());

-- Audit: users see own rows; admin sees all
drop policy if exists commercial_audits_select_own on public.commercial_api_audits;
create policy commercial_audits_select_own on public.commercial_api_audits
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists commercial_audits_insert on public.commercial_api_audits;
create policy commercial_audits_insert on public.commercial_api_audits
  for insert with check (true);

drop policy if exists commercial_audits_admin on public.commercial_api_audits;
create policy commercial_audits_admin on public.commercial_api_audits
  for all using (public.is_admin()) with check (public.is_admin());
