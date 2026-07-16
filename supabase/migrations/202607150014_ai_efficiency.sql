alter table public.coach_threads
  add column if not exists conversation_summary text not null default '',
  add column if not exists summarized_message_count integer not null default 0 check (summarized_message_count >= 0),
  add column if not exists summary_updated_at timestamptz;

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  task text not null check (char_length(task) between 2 and 80),
  model text not null check (char_length(model) between 2 and 120),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  cached_input_tokens integer not null default 0 check (cached_input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  total_tokens integer not null default 0 check (total_tokens >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_user_created_idx
  on public.ai_usage_events (user_id, created_at desc);

alter table public.ai_usage_events enable row level security;

drop policy if exists "ai_usage_owner_read" on public.ai_usage_events;
create policy "ai_usage_owner_read" on public.ai_usage_events
  for select to authenticated
  using ((select auth.uid()) = user_id);

comment on column public.coach_threads.conversation_summary is
  'Compact durable conversation context; recent messages remain in coach_messages.';

comment on table public.ai_usage_events is
  'Token telemetry for measuring prompt-cache effectiveness and per-feature AI consumption.';
