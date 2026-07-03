-- Fix a gap left by 20260807000000_add_edge_rate_limit_buckets.sql:
--   1. edge_rate_limit_buckets had RLS enabled but no policy (rls_meta_test.sql
--      T2: "every table in schema public must have at least one RLS policy").
--      The table comment already documents "Writes go through service_role
--      (bypasses RLS); no client-facing access" — add the restrictive
--      service_role-only policy that intent implies.
--   2. increment_rate_limit_bucket used `set search_path = public` instead of
--      the repo standard `set search_path = ''` for SECURITY DEFINER functions
--      (security_definer_search_path_test.sql), which is a search_path
--      injection risk. Re-create with the correct setting and fully-qualified
--      references.
create policy "edge_rate_limit_buckets_service_role_all" on public.edge_rate_limit_buckets for all to service_role using (true)
with
  check (true);

create or replace function public.increment_rate_limit_bucket (
  p_user_id uuid,
  p_function_name text,
  p_window_minute timestamptz
) returns integer language plpgsql security definer
set
  search_path = '' as $$
declare
  v_count integer;
begin
  insert into public.edge_rate_limit_buckets (user_id, function_name, window_minute, request_count)
  values (p_user_id, p_function_name, p_window_minute, 1)
  on conflict (user_id, function_name, window_minute)
  do update
    set request_count = public.edge_rate_limit_buckets.request_count + 1
  returning request_count into v_count;
  return v_count;
end;
$$;

revoke
execute on function public.increment_rate_limit_bucket (uuid, text, timestamptz)
from
  public;

grant
execute on function public.increment_rate_limit_bucket (uuid, text, timestamptz) to service_role;
