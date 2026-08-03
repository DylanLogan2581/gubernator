-- Migration: seed_world_resources_icons
-- Assigns real icons to the Food / Fresh Water system resources auto-created
-- by the AFTER INSERT trigger on public.worlds, so newly created worlds don't
-- render the "?" placeholder for them (see issue #1213).
create or replace function public.seed_world_system_resources () returns trigger language plpgsql security definer
set
  search_path = '' as $$
begin
  insert into
    public.resources (world_id, name, slug, is_system_resource, icon)
  values
    (new.id, 'Food', 'food', true, 'game:meal'),
    (new.id, 'Fresh Water', 'fresh-water', true, 'game:water-drop')
  on conflict (world_id, slug) do nothing;

  return new;
end;
$$;
