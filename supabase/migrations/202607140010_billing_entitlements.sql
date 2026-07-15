create table if not exists public.billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscription_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'premium')),
  status text not null default 'free' check (status in (
    'free', 'trialing', 'active', 'past_due', 'canceled', 'unpaid',
    'incomplete', 'incomplete_expired', 'paused'
  )),
  billing_interval text check (billing_interval in ('month', 'year')),
  stripe_customer_id text,
  stripe_subscription_id text unique,
  stripe_price_id text,
  current_period_end timestamptz,
  trial_end timestamptz,
  trial_used boolean not null default false,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

create index if not exists subscription_entitlements_customer_idx
  on public.subscription_entitlements (stripe_customer_id);
create index if not exists subscription_entitlements_status_idx
  on public.subscription_entitlements (status, current_period_end);

alter table public.billing_customers enable row level security;
alter table public.subscription_entitlements enable row level security;
alter table public.stripe_webhook_events enable row level security;

drop policy if exists "billing_customers_owner_read" on public.billing_customers;
create policy "billing_customers_owner_read" on public.billing_customers
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "subscription_entitlements_owner_read" on public.subscription_entitlements;
create policy "subscription_entitlements_owner_read" on public.subscription_entitlements
  for select to authenticated using ((select auth.uid()) = user_id);

comment on table public.subscription_entitlements is
  'Server-owned premium access projection. Only verified Stripe webhooks may grant or revoke Premium.';
comment on column public.subscription_entitlements.trial_used is
  'Irreversible one-time trial marker. It is reserved when the first trial Checkout session is created.';
