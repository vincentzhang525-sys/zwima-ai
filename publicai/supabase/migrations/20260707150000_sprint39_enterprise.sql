-- 20260707150000_sprint39_enterprise.sql
-- Sprint 39: Enterprise workspace — organizations, teams, roles, members

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  vat_number text,
  country text default 'DE',
  industry text,
  owner_id uuid not null references public.profiles (id) on delete restrict,
  subscription_plan text not null default 'free',
  credits bigint not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  slug text not null,
  credits_allocated bigint not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  role text not null default 'viewer',
  status text not null default 'active',
  invited_email text,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'developer',
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);

create table if not exists public.workspace_role_permissions (
  role text primary key,
  permissions jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.member_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  role text not null default 'developer',
  invited_by uuid not null references public.profiles (id) on delete cascade,
  token text not null unique,
  status text not null default 'pending',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.member_activity (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);

create table if not exists public.shared_prompts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  team_id uuid references public.teams (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  title text not null,
  prompt text not null,
  created_at timestamptz not null default now()
);

alter table public.audit_logs add column if not exists organization_id uuid references public.organizations (id) on delete set null;
alter table public.audit_logs add column if not exists team_id uuid references public.teams (id) on delete set null;

create index if not exists idx_organizations_owner on public.organizations (owner_id);
create index if not exists idx_teams_org on public.teams (organization_id);
create index if not exists idx_org_members_org on public.organization_members (organization_id);
create index if not exists idx_org_members_user on public.organization_members (user_id);
create index if not exists idx_team_members_team on public.team_members (team_id);
create index if not exists idx_member_activity_org on public.member_activity (organization_id, created_at desc);
create index if not exists idx_shared_prompts_org on public.shared_prompts (organization_id);
create index if not exists idx_audit_logs_org on public.audit_logs (organization_id, created_at desc);

-- Seed configurable workspace role permissions
insert into public.workspace_role_permissions (role, permissions)
values
  ('owner', '["apikeys","billing","credits","models","gateway","playground","usage","logs","members","teams","settings","admin"]'::jsonb),
  ('admin', '["apikeys","billing","credits","models","gateway","playground","usage","logs","members","teams","settings"]'::jsonb),
  ('manager', '["apikeys","credits","models","gateway","playground","usage","logs","teams","members"]'::jsonb),
  ('developer', '["apikeys","credits","models","gateway","playground","usage","logs"]'::jsonb),
  ('viewer', '["models","usage","logs","playground"]'::jsonb)
on conflict (role) do update set permissions = excluded.permissions, updated_at = now();
