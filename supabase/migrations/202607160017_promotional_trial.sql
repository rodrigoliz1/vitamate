alter table public.subscription_entitlements
  add column if not exists promo_trial_status text not null default 'unclaimed'
    check (promo_trial_status in ('unclaimed', 'active', 'expired')),
  add column if not exists promo_trial_claimed_at timestamptz,
  add column if not exists promo_trial_ends_at timestamptz;

create or replace function public.claim_promotional_trial(p_user_id uuid, p_days integer default 5)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  entitlement public.subscription_entitlements%rowtype;
  trial_ends timestamptz;
begin
  if p_user_id is null or p_days < 1 or p_days > 30 then
    return false;
  end if;

  insert into public.subscription_entitlements (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into entitlement
  from public.subscription_entitlements
  where user_id = p_user_id
  for update;

  if entitlement.trial_used
     or entitlement.promo_trial_status <> 'unclaimed'
     or (entitlement.plan = 'premium'
         and entitlement.status in ('trialing', 'active')
         and (entitlement.current_period_end is null or entitlement.current_period_end > now())) then
    return false;
  end if;

  trial_ends := now() + make_interval(days => p_days);
  update public.subscription_entitlements
  set plan = 'premium',
      status = 'trialing',
      billing_interval = null,
      current_period_end = trial_ends,
      trial_end = trial_ends,
      trial_used = true,
      cancel_at_period_end = false,
      source = 'none',
      promo_trial_status = 'active',
      promo_trial_claimed_at = now(),
      promo_trial_ends_at = trial_ends,
      updated_at = now()
  where user_id = p_user_id;

  return true;
end;
$$;

create or replace function public.expire_promotional_trial(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.subscription_entitlements
  set promo_trial_status = 'expired',
      plan = case when source = 'none' and status = 'trialing' then 'free' else plan end,
      status = case when source = 'none' and status = 'trialing' then 'free' else status end,
      billing_interval = case when source = 'none' and status = 'trialing' then null else billing_interval end,
      current_period_end = case when source = 'none' and status = 'trialing' then null else current_period_end end,
      cancel_at_period_end = case when source = 'none' and status = 'trialing' then false else cancel_at_period_end end,
      updated_at = now()
  where user_id = p_user_id
    and promo_trial_status = 'active'
    and promo_trial_ends_at <= now();
end;
$$;

revoke all on function public.claim_promotional_trial(uuid, integer) from public, anon, authenticated;
revoke all on function public.expire_promotional_trial(uuid) from public, anon, authenticated;
grant execute on function public.claim_promotional_trial(uuid, integer) to service_role;
grant execute on function public.expire_promotional_trial(uuid) to service_role;

comment on column public.subscription_entitlements.promo_trial_status is
  'Server-owned state for the optional no-card promotional Premium trial.';
comment on function public.claim_promotional_trial(uuid, integer) is
  'Atomically claims the one-time promotional trial. Callable only by the API service role.';
