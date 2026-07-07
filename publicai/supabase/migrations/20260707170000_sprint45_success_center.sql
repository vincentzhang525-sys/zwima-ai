-- 20260707170000_sprint45_success_center.sql
-- Sprint 45: Customer Success Center

create table if not exists public.support_ticket_counters (
  year integer primary key,
  last_number integer not null default 0
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  user_id uuid not null references public.profiles (id) on delete cascade,
  record_type text not null check (record_type in ('ticket', 'bug', 'feature')),
  category text,
  title text not null,
  description text not null default '',
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (
    status in ('open', 'assigned', 'waiting_customer', 'resolved', 'closed', 'pending', 'approved', 'rejected', 'planned', 'in_progress', 'released')
  ),
  steps_to_reproduce text,
  browser text,
  operating_system text,
  screenshot_url text,
  severity text check (severity is null or severity in ('low', 'medium', 'high', 'critical')),
  roadmap_status text check (roadmap_status is null or roadmap_status in ('pending', 'approved', 'rejected', 'planned', 'in_progress', 'released')),
  admin_notes text,
  assigned_to uuid references public.profiles (id) on delete set null,
  satisfaction_rating smallint check (satisfaction_rating is null or (satisfaction_rating >= 1 and satisfaction_rating <= 5)),
  vote_count integer not null default 0,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_support_tickets_user on public.support_tickets (user_id, created_at desc);
create index if not exists idx_support_tickets_type_status on public.support_tickets (record_type, status);
create index if not exists idx_support_tickets_number on public.support_tickets (ticket_number);

create table if not exists public.feature_votes (
  id uuid primary key default gen_random_uuid(),
  feature_id uuid not null references public.support_tickets (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (feature_id, user_id)
);

create index if not exists idx_feature_votes_feature on public.feature_votes (feature_id);

create table if not exists public.status_incidents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  component text not null,
  impact text not null default 'degraded' check (impact in ('operational', 'degraded', 'maintenance', 'offline')),
  incident_status text not null default 'investigating' check (
    incident_status in ('investigating', 'identified', 'monitoring', 'resolved', 'scheduled')
  ),
  published boolean not null default false,
  starts_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_status_incidents_published on public.status_incidents (published, starts_at desc);

create table if not exists public.knowledge_base_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  category text not null,
  title text not null,
  summary text not null default '',
  body text not null default '',
  sort_order integer not null default 0,
  status text not null default 'published' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_kb_category on public.knowledge_base_articles (category, sort_order);

drop trigger if exists support_tickets_touch on public.support_tickets;
create trigger support_tickets_touch before update on public.support_tickets
  for each row execute function public.touch_updated_at();

drop trigger if exists status_incidents_touch on public.status_incidents;
create trigger status_incidents_touch before update on public.status_incidents
  for each row execute function public.touch_updated_at();

drop trigger if exists knowledge_base_touch on public.knowledge_base_articles;
create trigger knowledge_base_touch before update on public.knowledge_base_articles
  for each row execute function public.touch_updated_at();

insert into public.knowledge_base_articles (slug, category, title, summary, body, sort_order) values
  ('getting-started', 'Getting Started', 'Getting Started with ZWIMA AI', 'Create an account, verify email, and explore the dashboard.', 'Sign up at zwima-group.info, verify your email, then open the Dashboard to create your first API key and try the Playground.', 1),
  ('api-keys', 'API Keys', 'API Keys', 'Generate, copy, and secure your API keys.', 'Go to API Keys in the dashboard. Create a key, copy it once, and store it securely. Never commit keys to source control.', 2),
  ('credits', 'Credits', 'Credits & Usage', 'Understand credit wallets and consumption.', 'Credits are deducted per API request based on model and token usage. Top up via Billing or subscription plans.', 3),
  ('billing', 'Billing', 'Billing & Invoices', 'Plans, packages, and invoices.', 'View your plan on the Billing page. Upgrade plans or purchase credit packages. Invoices appear in your billing history.', 4),
  ('playground', 'Playground', 'Playground', 'Test models without writing code.', 'Open Playground from the dashboard. Select a model, enter a prompt, and send. Usage counts toward your credits.', 5),
  ('authentication', 'Authentication', 'Authentication', 'Login, sessions, and password reset.', 'Use email and password to sign in. Password reset emails are sent via the app email provider.', 6),
  ('enterprise', 'Enterprise', 'Enterprise Workspace', 'Organizations, teams, and roles.', 'Enterprise customers can manage organizations and teams from the Workspace page with role-based permissions.', 7),
  ('security', 'Security', 'Security Best Practices', 'Protect API keys and accounts.', 'Rotate keys regularly, enable strong passwords, and report security issues via Support.', 8),
  ('gdpr', 'GDPR', 'GDPR & Data Rights', 'Export and deletion requests.', 'Contact support for GDPR export or account deletion. See gdpr-export.html and delete-account.html for details.', 9)
on conflict (slug) do nothing;
