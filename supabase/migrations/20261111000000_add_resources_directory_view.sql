-- Migration: add_resources_directory_view
-- Issue #1242: sorting the resources config table by category needs the
-- parent (resources) rows ordered by a related table's column
-- (resource_categories.name). PostgREST's order(referencedTable: ...) only
-- reorders an embedded resource's own nested payload, never the parent
-- rows, so the previous approach in resourcesQueries.ts was a no-op.
--
-- Mirrors the citizen_directory_view pattern (20260818000000): a
-- security-invoker view that flattens the joined column onto the row so it
-- can be ordered like any other top-level column. category_id is nullable,
-- so a left join keeps uncategorized resources in the view.
-- ---------------------------------------------------------------------------
create view public.resources_directory_view
with
  (security_invoker = true) as
select
  r.id,
  r.world_id,
  r.name,
  r.slug,
  r.icon,
  r.base_stockpile_cap,
  r.change_mode,
  r.change_amount,
  r.is_system_resource,
  r.is_trashed,
  r.last_cleanup_summary_json,
  r.created_at,
  r.updated_at,
  r.category_id,
  rc.name as category_name,
  rc.icon as category_icon,
  rc.color as category_color
from
  public.resources r
  left join public.resource_categories rc on rc.id = r.category_id;

grant
select
  on public.resources_directory_view to authenticated;
