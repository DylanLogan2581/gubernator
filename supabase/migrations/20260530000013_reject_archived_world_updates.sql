-- Migration: reject_archived_world_updates
-- The worlds_update_owner policy previously only checked active-user state and
-- ownership. After population-rule and naming-config column UPDATE grants
-- were added, owners could keep editing game rules on archived (frozen) worlds.
-- Tighten the policy so updates are rejected when the world is archived.
-- ---------------------------------------------------------------------------
drop policy "worlds_update_owner" on public.worlds;

create policy "worlds_update_owner" on public.worlds
for update
  to authenticated using (
    public.is_active_app_user ()
    and owner_id = auth.uid ()
    and archived_at is null
  )
with
  check (
    public.is_active_app_user ()
    and owner_id = auth.uid ()
    and archived_at is null
  );
