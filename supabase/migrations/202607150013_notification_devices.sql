create table if not exists public.notification_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('ios', 'web')),
  environment text not null default 'production' check (environment in ('sandbox', 'production')),
  device_token text not null,
  locale text,
  timezone text,
  active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, device_token)
);

create index if not exists notification_devices_user_active_idx
  on public.notification_devices (user_id, active);
create index if not exists notification_devices_last_seen_idx
  on public.notification_devices (last_seen_at desc);

alter table public.notification_devices enable row level security;

drop policy if exists "notification_devices_owner_read" on public.notification_devices;
create policy "notification_devices_owner_read" on public.notification_devices
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "notification_devices_owner_delete" on public.notification_devices;
create policy "notification_devices_owner_delete" on public.notification_devices
  for delete to authenticated using ((select auth.uid()) = user_id);

comment on table public.notification_devices is
  'APNs and web-push destinations. Tokens are registered by an authenticated client and sent only by the VITAMATE backend.';

