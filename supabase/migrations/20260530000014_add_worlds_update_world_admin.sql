-- Migration: add_worlds_update_world_admin
-- Epic 4 child entities (jobs, buildings, deposit types, managed population
-- types) grant writes to delegated world admins via is_world_admin, but
-- world-level rules (population rules + naming_config_json) only flowed
-- through worlds_update_owner, which is restricted to the world owner.
-- Add a parallel worlds_update_world_admin policy so a non-owner world admin
-- can update the worlds row through the column grants they already have.
-- Mirrors the archived-rejection guard from worlds_update_owner so admins
-- also cannot write to archived (frozen) worlds.
-- ---------------------------------------------------------------------------
create policy "worlds_update_world_admin" on public.worlds
for update
  to authenticated using (
    public.is_active_app_user ()
    and public.is_world_admin (id)
    and archived_at is null
  )
with
  check (
    public.is_active_app_user ()
    and public.is_world_admin (id)
    and archived_at is null
  );
