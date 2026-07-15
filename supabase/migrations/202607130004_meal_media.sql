create table if not exists public.meal_media (
  id uuid primary key default gen_random_uuid(),
  recipe_key text not null,
  recipe_name text not null,
  prompt_version text not null default 'food-editorial-v1',
  storage_path text not null unique,
  public_url text,
  provider text not null,
  provider_request_id text,
  prompt text not null,
  status text not null default 'ready' check (status in ('ready', 'rejected')),
  created_at timestamptz not null default now(),
  unique (recipe_key, prompt_version)
);

alter table public.meal_media enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meal-images', 'meal-images', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
