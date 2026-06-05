-- Migration: set_construction_project_workers_rpc
-- Adds set_construction_project_workers(p_project_id, p_target_count) as a
-- named surface for the per-project bulk worker-assignment UI introduced in
-- the construction queue panel (issue #554). Delegates to the existing
-- set_bulk_construction_assignment function for consistency.
--
-- Error contract (mirrors set_bulk_construction_assignment):
--   P0002 (no_data_found)          – null param, project not found
--   42501 (insufficient_privilege) – caller lacks authority
--   P0001 (raise_exception)        – negative target, terminal project,
--                                    insufficient unassigned NPCs when raising
-- ---------------------------------------------------------------------------
create or replace function public.set_construction_project_workers (p_project_id uuid, p_target_count integer) returns table (
  before integer,
  after integer,
  added_citizen_ids uuid[],
  removed_citizen_ids uuid[]
) language sql security definer
set
  search_path = '' as $$
  select *
    from public.set_bulk_construction_assignment (p_project_id, p_target_count)
$$;

revoke all on function public.set_construction_project_workers (uuid, integer)
from
  public;

grant
execute on function public.set_construction_project_workers (uuid, integer) to authenticated;
