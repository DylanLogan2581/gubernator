-- Migration: seed_world_resources_security_definer
-- Recreate public.seed_world_system_resources as SECURITY DEFINER so the
-- AFTER INSERT trigger on public.worlds seeds system resources regardless of
-- which role inserts the world row. With SECURITY INVOKER the trigger relied
-- on the inserting role passing resources_insert_world_admin, which works for
-- owner-driven creation but silently fails for service-role or alternate-auth
-- creation paths.
create or replace function public.seed_world_system_resources () returns trigger language plpgsql security definer
set
  search_path = '' as $$
begin
  insert into
    public.resources (world_id, name, slug, is_system_resource)
  values
    (new.id, 'Food', 'food', true),
    (new.id, 'Fresh Water', 'fresh-water', true)
  on conflict (world_id, slug) do nothing;

  return new;
end;
$$;
