alter table public.workout_session_exercises
  add column if not exists prescribed_load_kg numeric,
  add column if not exists set_results jsonb not null default '[]'::jsonb;

create table if not exists public.health_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  mime_type text not null,
  summary text not null,
  uploaded_at timestamptz not null default now()
);

alter table public.health_documents enable row level security;

drop policy if exists "health_documents_owner_all" on public.health_documents;
create policy "health_documents_owner_all" on public.health_documents
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index if not exists health_documents_user_uploaded_idx
  on public.health_documents(user_id, uploaded_at desc);

comment on table public.health_documents is
  'Stores an AI-generated summary for coach context. Raw health files remain transient and are not persisted by this table.';
