create table if not exists public.sleep_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  source text not null check (source in ('manual', 'apple_health', 'vitacoach')),
  quality smallint check (quality between 1 and 5),
  note text check (note is null or char_length(note) <= 500),
  external_id text,
  stages jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint sleep_entries_valid_range check (ended_at > started_at)
);

create unique index if not exists sleep_entries_user_external_idx
  on public.sleep_entries (user_id, external_id)
  where external_id is not null;

create index if not exists sleep_entries_user_ended_idx
  on public.sleep_entries (user_id, ended_at desc);

alter table public.sleep_entries enable row level security;

drop policy if exists "sleep_entries_owner_all" on public.sleep_entries;
create policy "sleep_entries_owner_all" on public.sleep_entries
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

comment on table public.sleep_entries is
  'User-owned sleep periods captured manually, by Apple Health, or through VITACOACH.';
