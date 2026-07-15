create table if not exists public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weight_kg numeric not null check (weight_kg between 20 and 500),
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists weight_entries_user_recorded_idx on public.weight_entries (user_id, recorded_at desc);
alter table public.weight_entries enable row level security;
drop policy if exists "weight_entries_owner_all" on public.weight_entries;
create policy "weight_entries_owner_all" on public.weight_entries for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
