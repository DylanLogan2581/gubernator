-- Per-user, per-function, per-minute rate limiting for privileged edge functions.
-- Writes go through service_role (bypasses RLS); no client-facing access.
--
-- Documented limits enforced in supabase/functions/_shared/http/rateLimit.ts:
--   admin-create-user:   10 requests per minute per user
--   end-turn-simulation: 10 requests per minute per user
--
-- Cleanup: run periodically to prune expired buckets:
--   DELETE FROM public.edge_rate_limit_buckets
--   WHERE window_minute < now() - interval '1 hour';
create table public.edge_rate_limit_buckets (
  user_id uuid not null,
  function_name text not null,
  window_minute timestamptz not null,
  request_count integer not null default 1,
  constraint edge_rate_limit_buckets_pkey primary key (user_id, function_name, window_minute)
);

alter table public.edge_rate_limit_buckets enable row level security;

-- Index for periodic cleanup query on window_minute.
create index edge_rate_limit_buckets_window_minute_idx on public.edge_rate_limit_buckets (window_minute);

-- Atomically increment the request count for a user/function/minute bucket and
-- return the new count. Callers compare the returned count against their limit.
create or replace function public.increment_rate_limit_bucket (
  p_user_id uuid,
  p_function_name text,
  p_window_minute timestamptz
) returns integer language plpgsql security definer
set
  search_path = public as $$
declare
  v_count integer;
begin
  insert into public.edge_rate_limit_buckets (user_id, function_name, window_minute, request_count)
  values (p_user_id, p_function_name, p_window_minute, 1)
  on conflict (user_id, function_name, window_minute)
  do update
    set request_count = edge_rate_limit_buckets.request_count + 1
  returning request_count into v_count;
  return v_count;
end;
$$;

-- Restrict to service_role only. Edge functions call this with service_role key.
revoke
execute on function public.increment_rate_limit_bucket (uuid, text, timestamptz)
from
  public;

grant
execute on function public.increment_rate_limit_bucket (uuid, text, timestamptz) to service_role;
