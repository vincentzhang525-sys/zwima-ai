-- 20260707170100_sprint45_success_policies.sql

alter table public.support_tickets enable row level security;
alter table public.feature_votes enable row level security;
alter table public.status_incidents enable row level security;
alter table public.knowledge_base_articles enable row level security;
alter table public.support_ticket_counters enable row level security;

drop policy if exists support_tickets_select_own on public.support_tickets;
create policy support_tickets_select_own on public.support_tickets
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists support_tickets_insert_own on public.support_tickets;
create policy support_tickets_insert_own on public.support_tickets
  for insert with check (auth.uid() = user_id or public.is_admin());

drop policy if exists support_tickets_update_own on public.support_tickets;
create policy support_tickets_update_own on public.support_tickets
  for update using (auth.uid() = user_id or public.is_admin());

drop policy if exists feature_votes_select on public.feature_votes;
create policy feature_votes_select on public.feature_votes
  for select using (true);

drop policy if exists feature_votes_insert_own on public.feature_votes;
create policy feature_votes_insert_own on public.feature_votes
  for insert with check (auth.uid() = user_id);

drop policy if exists feature_votes_delete_own on public.feature_votes;
create policy feature_votes_delete_own on public.feature_votes
  for delete using (auth.uid() = user_id);

drop policy if exists status_incidents_select_published on public.status_incidents;
create policy status_incidents_select_published on public.status_incidents
  for select using (published = true or public.is_admin());

drop policy if exists status_incidents_admin_write on public.status_incidents;
create policy status_incidents_admin_write on public.status_incidents
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists knowledge_base_select on public.knowledge_base_articles;
create policy knowledge_base_select on public.knowledge_base_articles
  for select using (status = 'published' or public.is_admin());

drop policy if exists knowledge_base_admin_write on public.knowledge_base_articles;
create policy knowledge_base_admin_write on public.knowledge_base_articles
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists support_counters_admin on public.support_ticket_counters;
create policy support_counters_admin on public.support_ticket_counters
  for all using (public.is_admin()) with check (public.is_admin());
