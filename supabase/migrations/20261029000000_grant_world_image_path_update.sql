-- Migration: grant_world_image_path_update
-- Fixes #1156: uploading a world thumbnail/hero fails with "permission denied
-- for table worlds" for every caller, including superadmins and world
-- admins. RLS is already correct (worlds_update_world_admin and
-- worlds_update_super_admin both permit it), but hero_path/thumbnail_path
-- only ever received column-level SELECT/REFERENCES grants when added in
-- 20260821000000_add_world_images.sql -- the column-level UPDATE grant was
-- omitted, so Postgres rejects the update before RLS is even evaluated.
-- ---------------------------------------------------------------------------
grant
update (hero_path, thumbnail_path) on public.worlds to authenticated;
