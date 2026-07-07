-- 20260707150100_sprint39_enterprise_policies.sql

create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_id
      and user_id = auth.uid()
      and status = 'active'
  ) or exists (
    select 1 from public.organizations
    where id = org_id and owner_id = auth.uid()
  ) or public.is_admin();
$$;

create or replace function public.is_org_admin(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_id
      and user_id = auth.uid()
      and status = 'active'
      and role in ('owner', 'admin')
  ) or exists (
    select 1 from public.organizations
    where id = org_id and owner_id = auth.uid()
  ) or public.is_admin();
$$;

alter table public.organizations enable row level security;
alter table public.teams enable row level security;
alter table public.organization_members enable row level security;
alter table public.team_members enable row level security;
alter table public.workspace_role_permissions enable row level security;
alter table public.member_invitations enable row level security;
alter table public.member_activity enable row level security;
alter table public.shared_prompts enable row level security;

drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations for select using (public.is_org_member(id) or owner_id = auth.uid() or public.is_admin());

drop policy if exists organizations_insert on public.organizations;
create policy organizations_insert on public.organizations for insert with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists organizations_update on public.organizations;
create policy organizations_update on public.organizations for update using (public.is_org_admin(id) or public.is_admin());

drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams for select using (public.is_org_member(organization_id));

drop policy if exists teams_insert on public.teams;
create policy teams_insert on public.teams for insert with check (public.is_org_admin(organization_id));

drop policy if exists teams_update on public.teams;
create policy teams_update on public.teams for update using (public.is_org_admin(organization_id));

drop policy if exists org_members_select on public.organization_members;
create policy org_members_select on public.organization_members for select using (public.is_org_member(organization_id));

drop policy if exists org_members_insert on public.organization_members;
create policy org_members_insert on public.organization_members for insert with check (public.is_org_admin(organization_id) or user_id = auth.uid());

drop policy if exists org_members_update on public.organization_members;
create policy org_members_update on public.organization_members for update using (public.is_org_admin(organization_id));

drop policy if exists team_members_select on public.team_members;
create policy team_members_select on public.team_members for select using (
  exists (select 1 from public.teams t where t.id = team_id and public.is_org_member(t.organization_id))
);

drop policy if exists team_members_insert on public.team_members;
create policy team_members_insert on public.team_members for insert with check (
  exists (select 1 from public.teams t where t.id = team_id and public.is_org_admin(t.organization_id))
);

drop policy if exists workspace_role_permissions_select on public.workspace_role_permissions;
create policy workspace_role_permissions_select on public.workspace_role_permissions for select using (true);

drop policy if exists workspace_role_permissions_admin on public.workspace_role_permissions;
create policy workspace_role_permissions_admin on public.workspace_role_permissions for all using (public.is_admin());

drop policy if exists member_invitations_select on public.member_invitations;
create policy member_invitations_select on public.member_invitations for select using (public.is_org_member(organization_id));

drop policy if exists member_invitations_insert on public.member_invitations;
create policy member_invitations_insert on public.member_invitations for insert with check (public.is_org_admin(organization_id));

drop policy if exists member_activity_select on public.member_activity;
create policy member_activity_select on public.member_activity for select using (public.is_org_member(organization_id));

drop policy if exists member_activity_insert on public.member_activity;
create policy member_activity_insert on public.member_activity for insert with check (public.is_org_member(organization_id));

drop policy if exists shared_prompts_select on public.shared_prompts;
create policy shared_prompts_select on public.shared_prompts for select using (public.is_org_member(organization_id));

drop policy if exists shared_prompts_insert on public.shared_prompts;
create policy shared_prompts_insert on public.shared_prompts for insert with check (public.is_org_member(organization_id));

drop policy if exists shared_prompts_update on public.shared_prompts;
create policy shared_prompts_update on public.shared_prompts for update using (public.is_org_member(organization_id));
