alter table public.subscription_entitlements
  add column if not exists source text not null default 'none'
    check (source in ('none', 'stripe', 'apple')),
  add column if not exists apple_original_transaction_id text,
  add column if not exists apple_transaction_id text,
  add column if not exists apple_product_id text,
  add column if not exists apple_environment text;

create table if not exists public.apple_purchase_accounts (
  original_transaction_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  environment text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.apple_webhook_events (
  notification_uuid text primary key,
  notification_type text not null,
  processed_at timestamptz not null default now()
);

create unique index if not exists subscription_entitlements_apple_original_idx
  on public.subscription_entitlements (apple_original_transaction_id)
  where apple_original_transaction_id is not null;
create index if not exists apple_purchase_accounts_user_idx
  on public.apple_purchase_accounts (user_id);

alter table public.apple_purchase_accounts enable row level security;
alter table public.apple_webhook_events enable row level security;

drop policy if exists "apple_purchase_accounts_owner_read" on public.apple_purchase_accounts;
create policy "apple_purchase_accounts_owner_read" on public.apple_purchase_accounts
  for select to authenticated using ((select auth.uid()) = user_id);

comment on table public.subscription_entitlements is
  'Server-owned Premium projection. Only verified Stripe events or cryptographically verified App Store transactions may grant access.';
