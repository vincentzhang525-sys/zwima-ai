-- 20260712120000_sprint47a_commercial_core.sql
-- Sprint 47A: Commercial Core Architecture (Provider/Model Registry, Pricing, Routing, Audit)

-- ─── Part 1: Unified Provider Registry ───────────────────────────────────────

create table if not exists public.commercial_providers (
  id text primary key,
  name text not null,
  provider_type text not null default 'llm' check (provider_type in ('llm', 'aggregator', 'inference', 'embedding', 'multimodal')),
  status text not null default 'inactive' check (status in ('active', 'inactive', 'disabled', 'maintenance', 'waiting_api', 'waiting_balance', 'coming_soon')),
  priority integer not null default 100,
  region text not null default 'global' check (region in ('global', 'eu', 'us', 'apac')),
  base_url text not null,
  auth_method text not null default 'api_key' check (auth_method in ('api_key', 'oauth', 'azure_ad', 'bearer', 'custom')),
  api_key_env text,
  organization_id uuid references public.organizations (id) on delete set null,
  currency text not null default 'USD',
  health_status text not null default 'unknown' check (health_status in ('online', 'degraded', 'offline', 'unknown', 'not_configured')),
  health_score numeric(5, 2) not null default 0 check (health_score >= 0 and health_score <= 100),
  avg_latency_ms integer not null default 0,
  avg_cost_per_1m_tokens numeric(14, 6) not null default 0,
  profit_margin_pct numeric(6, 2) not null default 25,
  rate_limit_rpm integer,
  daily_limit integer,
  monthly_limit integer,
  adapter_id text not null,
  supports_vision boolean not null default false,
  supports_image boolean not null default false,
  supports_audio boolean not null default false,
  supports_embedding boolean not null default false,
  supports_function_calling boolean not null default false,
  supports_json_mode boolean not null default false,
  supports_streaming boolean not null default false,
  supports_reasoning boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_commercial_providers_status on public.commercial_providers (status, priority);
create index if not exists idx_commercial_providers_region on public.commercial_providers (region);

-- ─── Part 2: Model Registry ──────────────────────────────────────────────────

create table if not exists public.commercial_models (
  id text primary key,
  provider_id text not null references public.commercial_providers (id) on delete cascade,
  name text not null,
  alias text,
  version text,
  api_model_id text not null,
  input_price_per_1m numeric(14, 6) not null default 0,
  output_price_per_1m numeric(14, 6) not null default 0,
  cached_input_price_per_1m numeric(14, 6) not null default 0,
  context_length integer not null default 128000,
  max_output_tokens integer not null default 4096,
  supports_vision boolean not null default false,
  supports_streaming boolean not null default false,
  supports_json boolean not null default false,
  supports_batch boolean not null default false,
  supports_function_calling boolean not null default false,
  supports_reasoning boolean not null default false,
  avg_latency_ms integer not null default 0,
  availability text not null default 'inactive' check (availability in ('active', 'inactive', 'deprecated', 'preview', 'maintenance')),
  eu_available boolean not null default true,
  gdpr_compatible boolean not null default true,
  deprecated boolean not null default false,
  released_at date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_commercial_models_provider on public.commercial_models (provider_id, availability);
create index if not exists idx_commercial_models_eu on public.commercial_models (eu_available, gdpr_compatible) where availability = 'active';

-- ─── Part 3: Pricing Engine ──────────────────────────────────────────────────

create table if not exists public.commercial_pricing_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rule_type text not null check (rule_type in ('fixed_margin', 'percentage_margin', 'custom_margin', 'enterprise_margin')),
  margin_value numeric(14, 6) not null default 25,
  margin_unit text not null default 'percent' check (margin_unit in ('percent', 'eur', 'usd', 'credits')),
  tax_rate_pct numeric(6, 4) not null default 0,
  currency text not null default 'EUR',
  applies_to text not null default 'all' check (applies_to in ('all', 'provider', 'model', 'plan', 'organization')),
  target_id text,
  organization_id uuid references public.organizations (id) on delete cascade,
  plan_id text,
  priority integer not null default 100,
  status text not null default 'active' check (status in ('active', 'inactive')),
  effective_from timestamptz not null default now(),
  effective_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_commercial_pricing_rules_lookup
  on public.commercial_pricing_rules (applies_to, target_id, status, priority);

-- ─── Part 4: Routing Engine V2 ───────────────────────────────────────────────

create table if not exists public.commercial_routing_policies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  policy_type text not null default 'default' check (policy_type in ('default', 'enterprise', 'customer', 'fallback')),
  organization_id uuid references public.organizations (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  weights jsonb not null default '{"health":0.30,"cost":0.25,"latency":0.20,"region":0.10,"gdpr":0.15}'::jsonb,
  require_eu boolean not null default false,
  require_gdpr boolean not null default false,
  preferred_region text,
  preferred_providers text[] not null default '{}',
  blocked_providers text[] not null default '{}',
  fallback_chain text[] not null default '{}',
  max_latency_ms integer,
  max_cost_per_1m numeric(14, 6),
  status text not null default 'active' check (status in ('active', 'inactive')),
  priority integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_commercial_routing_org on public.commercial_routing_policies (organization_id, status);
create index if not exists idx_commercial_routing_user on public.commercial_routing_policies (user_id, status);

-- ─── Part 5: API Request Audit ───────────────────────────────────────────────

create table if not exists public.commercial_api_audits (
  id uuid primary key default gen_random_uuid(),
  trace_id text not null,
  user_id uuid references public.profiles (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete set null,
  workspace_id uuid,
  api_key_id uuid references public.api_keys (id) on delete set null,
  provider_id text references public.commercial_providers (id) on delete set null,
  model_id text references public.commercial_models (id) on delete set null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  total_tokens integer not null default 0,
  provider_cost numeric(14, 6) not null default 0,
  customer_charge numeric(14, 6) not null default 0,
  gross_margin numeric(14, 6) not null default 0,
  margin_pct numeric(8, 4) not null default 0,
  tax_amount numeric(14, 6) not null default 0,
  final_price numeric(14, 6) not null default 0,
  currency text not null default 'EUR',
  latency_ms integer not null default 0,
  country text,
  region text,
  routing_reason text,
  fallback_used boolean not null default false,
  status text not null default 'success' check (status in ('success', 'error', 'timeout', 'rate_limited', 'fallback')),
  error_message text,
  request_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_commercial_api_audits_trace on public.commercial_api_audits (trace_id);
create index if not exists idx_commercial_api_audits_user on public.commercial_api_audits (user_id, created_at desc);
create index if not exists idx_commercial_api_audits_org on public.commercial_api_audits (organization_id, created_at desc);
create index if not exists idx_commercial_api_audits_provider on public.commercial_api_audits (provider_id, created_at desc);
create index if not exists idx_commercial_api_audits_created on public.commercial_api_audits (created_at desc);

-- Triggers
drop trigger if exists commercial_providers_touch on public.commercial_providers;
create trigger commercial_providers_touch before update on public.commercial_providers
  for each row execute function public.touch_updated_at();

drop trigger if exists commercial_models_touch on public.commercial_models;
create trigger commercial_models_touch before update on public.commercial_models
  for each row execute function public.touch_updated_at();

drop trigger if exists commercial_pricing_rules_touch on public.commercial_pricing_rules;
create trigger commercial_pricing_rules_touch before update on public.commercial_pricing_rules
  for each row execute function public.touch_updated_at();

drop trigger if exists commercial_routing_policies_touch on public.commercial_routing_policies;
create trigger commercial_routing_policies_touch before update on public.commercial_routing_policies
  for each row execute function public.touch_updated_at();
