create table if not exists public.voice_credit_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cycle_start date not null default date_trunc('month', now() at time zone 'utc')::date,
  cycle_end date not null default (date_trunc('month', now() at time zone 'utc') + interval '1 month')::date,
  monthly_allowance_seconds integer not null default 1800 check (monthly_allowance_seconds >= 0),
  monthly_used_seconds integer not null default 0 check (monthly_used_seconds >= 0),
  extra_balance_seconds integer not null default 0 check (extra_balance_seconds >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.voice_credit_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('stripe', 'apple', 'admin')),
  provider_reference text not null,
  package_id text not null check (package_id in ('voice_5', 'voice_10', 'voice_30', 'voice_60')),
  seconds integer not null check (seconds > 0),
  amount_minor integer not null check (amount_minor >= 0),
  currency text not null default 'mxn',
  created_at timestamptz not null default now(),
  unique (provider, provider_reference)
);

create table if not exists public.voice_call_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'reserved' check (status in ('reserved', 'active', 'completed', 'canceled')),
  reserved_seconds integer not null check (reserved_seconds > 0),
  consumed_seconds integer not null default 0 check (consumed_seconds >= 0),
  monthly_consumed_seconds integer not null default 0 check (monthly_consumed_seconds >= 0),
  extra_consumed_seconds integer not null default 0 check (extra_consumed_seconds >= 0),
  started_at timestamptz,
  last_heartbeat_at timestamptz,
  ended_at timestamptz,
  expires_at timestamptz not null default now() + interval '10 minutes',
  created_at timestamptz not null default now()
);

create unique index if not exists voice_call_sessions_one_open_idx
  on public.voice_call_sessions (user_id)
  where status in ('reserved', 'active');
create index if not exists voice_call_sessions_user_created_idx
  on public.voice_call_sessions (user_id, created_at desc);
create index if not exists voice_credit_purchases_user_created_idx
  on public.voice_credit_purchases (user_id, created_at desc);

alter table public.voice_credit_accounts enable row level security;
alter table public.voice_credit_purchases enable row level security;
alter table public.voice_call_sessions enable row level security;

create policy "voice_credit_accounts_owner_read" on public.voice_credit_accounts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "voice_credit_purchases_owner_read" on public.voice_credit_purchases
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "voice_call_sessions_owner_read" on public.voice_call_sessions
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.voice_rollover_account(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_month_start date := date_trunc('month', now() at time zone 'utc')::date;
begin
  insert into public.voice_credit_accounts (user_id, cycle_start, cycle_end)
  values (p_user_id, v_month_start, (v_month_start + interval '1 month')::date)
  on conflict (user_id) do nothing;
  update public.voice_credit_accounts
  set cycle_start = v_month_start,
      cycle_end = (v_month_start + interval '1 month')::date,
      monthly_used_seconds = 0,
      updated_at = now()
  where user_id = p_user_id and cycle_start < v_month_start;
end;
$$;

create or replace function public.voice_consume_seconds(p_user_id uuid, p_seconds integer)
returns table(monthly_seconds integer, extra_seconds integer)
language plpgsql security definer set search_path = public as $$
declare v_monthly_left integer; v_monthly integer; v_extra integer;
begin
  perform public.voice_rollover_account(p_user_id);
  select greatest(monthly_allowance_seconds - monthly_used_seconds, 0)
    into v_monthly_left from public.voice_credit_accounts where user_id = p_user_id for update;
  v_monthly := least(greatest(p_seconds, 0), v_monthly_left);
  v_extra := least(greatest(p_seconds - v_monthly, 0),
    (select extra_balance_seconds from public.voice_credit_accounts where user_id = p_user_id));
  update public.voice_credit_accounts
  set monthly_used_seconds = monthly_used_seconds + v_monthly,
      extra_balance_seconds = extra_balance_seconds - v_extra,
      updated_at = now()
  where user_id = p_user_id;
  return query select v_monthly, v_extra;
end;
$$;

create or replace function public.voice_finalize_stale(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_call public.voice_call_sessions%rowtype; v_used integer; v_monthly integer; v_extra integer;
begin
  select * into v_call from public.voice_call_sessions
  where user_id = p_user_id and status in ('reserved', 'active') for update;
  if not found then return; end if;
  if v_call.status = 'reserved' and v_call.expires_at <= now() then
    update public.voice_call_sessions set status = 'canceled', ended_at = now() where id = v_call.id;
  elsif v_call.status = 'active' and coalesce(v_call.last_heartbeat_at, v_call.started_at) < now() - interval '90 seconds' then
    v_used := least(v_call.reserved_seconds, greatest(0, extract(epoch from (coalesce(v_call.last_heartbeat_at, now()) - v_call.started_at))::integer));
    select monthly_seconds, extra_seconds into v_monthly, v_extra from public.voice_consume_seconds(p_user_id, v_used);
    update public.voice_call_sessions set status = 'completed', consumed_seconds = v_monthly + v_extra,
      monthly_consumed_seconds = v_monthly, extra_consumed_seconds = v_extra,
      ended_at = coalesce(v_call.last_heartbeat_at, now()) where id = v_call.id;
  end if;
end;
$$;

create or replace function public.get_voice_credit_balance(p_user_id uuid)
returns table(cycle_start date, cycle_end date, monthly_allowance_seconds integer,
  monthly_used_seconds integer, monthly_remaining_seconds integer, extra_balance_seconds integer, total_remaining_seconds integer)
language plpgsql security definer set search_path = public as $$
begin
  perform public.voice_rollover_account(p_user_id);
  perform public.voice_finalize_stale(p_user_id);
  return query select a.cycle_start, a.cycle_end, a.monthly_allowance_seconds, a.monthly_used_seconds,
    greatest(a.monthly_allowance_seconds - a.monthly_used_seconds, 0), a.extra_balance_seconds,
    greatest(a.monthly_allowance_seconds - a.monthly_used_seconds, 0) + a.extra_balance_seconds
  from public.voice_credit_accounts a where a.user_id = p_user_id;
end;
$$;

create or replace function public.reserve_voice_call(p_user_id uuid)
returns table(call_session_id uuid, max_duration_seconds integer)
language plpgsql security definer set search_path = public as $$
declare v_available integer; v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 7341));
  perform public.voice_rollover_account(p_user_id);
  perform public.voice_finalize_stale(p_user_id);
  if exists (select 1 from public.voice_call_sessions where user_id = p_user_id and status in ('reserved', 'active')) then
    raise exception using errcode = 'P0001', message = 'VOICE_CALL_ALREADY_OPEN';
  end if;
  select greatest(monthly_allowance_seconds - monthly_used_seconds, 0) + extra_balance_seconds
    into v_available from public.voice_credit_accounts where user_id = p_user_id for update;
  if coalesce(v_available, 0) <= 0 then
    raise exception using errcode = 'P0001', message = 'VOICE_CREDITS_EXHAUSTED';
  end if;
  insert into public.voice_call_sessions (user_id, reserved_seconds)
  values (p_user_id, v_available) returning id into v_id;
  return query select v_id, v_available;
end;
$$;

create or replace function public.start_voice_call(p_user_id uuid, p_call_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.voice_call_sessions set status = 'active', started_at = coalesce(started_at, now()),
    last_heartbeat_at = now(), expires_at = now() + interval '24 hours'
  where id = p_call_id and user_id = p_user_id and status in ('reserved', 'active');
  return found;
end;
$$;

create or replace function public.heartbeat_voice_call(p_user_id uuid, p_call_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.voice_call_sessions set last_heartbeat_at = now()
  where id = p_call_id and user_id = p_user_id and status = 'active'
    and extract(epoch from (now() - started_at)) < reserved_seconds + 5;
  return found;
end;
$$;

create or replace function public.complete_voice_call(p_user_id uuid, p_call_id uuid)
returns table(consumed_seconds integer, monthly_consumed_seconds integer, extra_consumed_seconds integer)
language plpgsql security definer set search_path = public as $$
declare v_call public.voice_call_sessions%rowtype; v_used integer; v_monthly integer := 0; v_extra integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 7341));
  select * into v_call from public.voice_call_sessions where id = p_call_id and user_id = p_user_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'VOICE_CALL_NOT_FOUND'; end if;
  if v_call.status = 'completed' then
    return query select v_call.consumed_seconds, v_call.monthly_consumed_seconds, v_call.extra_consumed_seconds; return;
  end if;
  if v_call.status = 'active' then
    v_used := least(v_call.reserved_seconds, greatest(0, extract(epoch from (now() - v_call.started_at))::integer));
    select monthly_seconds, extra_seconds into v_monthly, v_extra from public.voice_consume_seconds(p_user_id, v_used);
  end if;
  update public.voice_call_sessions set status = case when v_call.status = 'active' then 'completed' else 'canceled' end,
    consumed_seconds = v_monthly + v_extra, monthly_consumed_seconds = v_monthly,
    extra_consumed_seconds = v_extra, ended_at = now(), last_heartbeat_at = coalesce(last_heartbeat_at, now())
  where id = p_call_id;
  return query select v_monthly + v_extra, v_monthly, v_extra;
end;
$$;

create or replace function public.cancel_voice_call(p_user_id uuid, p_call_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.voice_call_sessions set status = 'canceled', ended_at = now()
  where id = p_call_id and user_id = p_user_id and status = 'reserved';
$$;

create or replace function public.grant_voice_credit(p_user_id uuid, p_provider text, p_reference text,
  p_package_id text, p_seconds integer, p_amount_minor integer, p_currency text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  perform public.voice_rollover_account(p_user_id);
  insert into public.voice_credit_purchases (user_id, provider, provider_reference, package_id, seconds, amount_minor, currency)
  values (p_user_id, p_provider, p_reference, p_package_id, p_seconds, p_amount_minor, lower(p_currency))
  on conflict (provider, provider_reference) do nothing;
  if not found then return false; end if;
  update public.voice_credit_accounts set extra_balance_seconds = extra_balance_seconds + p_seconds, updated_at = now()
  where user_id = p_user_id;
  return true;
end;
$$;

revoke all on function public.voice_rollover_account(uuid) from public, anon, authenticated;
revoke all on function public.voice_consume_seconds(uuid, integer) from public, anon, authenticated;
revoke all on function public.voice_finalize_stale(uuid) from public, anon, authenticated;
revoke all on function public.get_voice_credit_balance(uuid) from public, anon, authenticated;
revoke all on function public.reserve_voice_call(uuid) from public, anon, authenticated;
revoke all on function public.start_voice_call(uuid, uuid) from public, anon, authenticated;
revoke all on function public.heartbeat_voice_call(uuid, uuid) from public, anon, authenticated;
revoke all on function public.complete_voice_call(uuid, uuid) from public, anon, authenticated;
revoke all on function public.cancel_voice_call(uuid, uuid) from public, anon, authenticated;
revoke all on function public.grant_voice_credit(uuid, text, text, text, integer, integer, text) from public, anon, authenticated;
grant execute on function public.voice_rollover_account(uuid) to service_role;
grant execute on function public.voice_consume_seconds(uuid, integer) to service_role;
grant execute on function public.voice_finalize_stale(uuid) to service_role;
grant execute on function public.get_voice_credit_balance(uuid) to service_role;
grant execute on function public.reserve_voice_call(uuid) to service_role;
grant execute on function public.start_voice_call(uuid, uuid) to service_role;
grant execute on function public.heartbeat_voice_call(uuid, uuid) to service_role;
grant execute on function public.complete_voice_call(uuid, uuid) to service_role;
grant execute on function public.cancel_voice_call(uuid, uuid) to service_role;
grant execute on function public.grant_voice_credit(uuid, text, text, text, integer, integer, text) to service_role;

comment on table public.voice_credit_accounts is 'Monthly VITACOACH allowance plus non-expiring purchased voice seconds.';
