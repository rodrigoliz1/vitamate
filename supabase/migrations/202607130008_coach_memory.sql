create table if not exists public.coach_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  title text not null default 'VITACOACH',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz
);

alter table public.coach_messages
  add column if not exists thread_id uuid references public.coach_threads(id) on delete cascade;

alter table public.coach_messages
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists coach_messages_thread_created_idx
  on public.coach_messages (thread_id, created_at desc);

create table if not exists public.coach_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  memory_key text not null check (char_length(memory_key) between 3 and 120),
  category text not null check (category in (
    'identity', 'preference', 'goal', 'routine', 'motivation',
    'constraint', 'relationship', 'health_context'
  )),
  content text not null check (char_length(content) between 1 and 500),
  importance smallint not null default 3 check (importance between 1 and 5),
  confidence numeric(4,3) not null default 1 check (confidence between 0 and 1),
  sensitivity text not null default 'standard' check (sensitivity in ('standard', 'health')),
  source_message_id uuid references public.coach_messages(id) on delete set null,
  active boolean not null default true,
  first_observed_at timestamptz not null default now(),
  last_confirmed_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (user_id, memory_key)
);

create index if not exists coach_memories_user_active_idx
  on public.coach_memories (user_id, active, importance desc, last_confirmed_at desc);

alter table public.coach_threads enable row level security;
alter table public.coach_memories enable row level security;

drop policy if exists "coach_threads_owner_all" on public.coach_threads;
create policy "coach_threads_owner_all" on public.coach_threads
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "coach_memories_owner_all" on public.coach_memories;
create policy "coach_memories_owner_all" on public.coach_memories
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

comment on table public.coach_threads is
  'Durable VITACOACH relationship thread. The current product uses one continuous thread per user.';

comment on table public.coach_memories is
  'Compact, user-controllable long-term memory. Full chat history remains in coach_messages; only relevant facts enter model context.';
