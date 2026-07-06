-- 20260706120500_conversations.sql
create table if not exists public.playground_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  provider text,
  model text,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_playground_conversations_user_id on public.playground_conversations (user_id);
create index if not exists idx_playground_conversations_updated_at on public.playground_conversations (updated_at desc);
