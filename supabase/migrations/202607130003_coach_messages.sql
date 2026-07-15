create table if not exists public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 6000),
  created_at timestamptz not null default now()
);

create index if not exists coach_messages_user_created_idx on public.coach_messages (user_id, created_at desc);

alter table public.coach_messages enable row level security;
drop policy if exists "coach_messages_owner_all" on public.coach_messages;
create policy "coach_messages_owner_all" on public.coach_messages
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
