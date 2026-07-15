create table if not exists public.api_rate_limit_windows (
  bucket_key text not null,
  window_start timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  expires_at timestamptz not null,
  primary key (bucket_key, window_start)
);

create index if not exists api_rate_limit_windows_expires_idx
  on public.api_rate_limit_windows (expires_at);

alter table public.api_rate_limit_windows enable row level security;

create or replace function public.consume_api_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_count integer;
begin
  if length(p_bucket_key) < 1 or length(p_bucket_key) > 240
     or p_limit < 1 or p_limit > 10000
     or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid rate limit input';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );

  insert into public.api_rate_limit_windows (
    bucket_key, window_start, request_count, expires_at
  ) values (
    p_bucket_key, v_window_start, 1, v_window_start + make_interval(secs => p_window_seconds * 2)
  )
  on conflict (bucket_key, window_start) do update
    set request_count = public.api_rate_limit_windows.request_count + 1
  returning request_count into v_count;

  -- Limpieza oportunista y acotada; no bloquea el consumo actual.
  if random() < 0.01 then
    delete from public.api_rate_limit_windows where expires_at < v_now;
  end if;

  return v_count <= p_limit;
end;
$$;

revoke all on table public.api_rate_limit_windows from anon, authenticated;
revoke all on function public.consume_api_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer) to service_role;
