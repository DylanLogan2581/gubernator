-- Migration: update_cancel_rpc_add_resume_hard_delete_rpcs
-- Updates cancel_construction_project to set cancelled_at
-- Adds resume_construction_project and hard_delete_construction_project RPCs
-- ---------------------------------------------------------------------------
-- Update cancel_construction_project to set cancelled_at when cancelling
create or replace function public.cancel_construction_project (p_project_id uuid) returns table (project_id uuid, unassigned_citizen_count integer) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_settlement_id uuid;
  v_status        text;
  v_unassigned    integer;
begin
  -- Null guard
  if p_project_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Fetch project
  select cp.settlement_id, cp.status
  into v_settlement_id, v_status
  from public.construction_projects cp
  where cp.id = p_project_id;

  if v_settlement_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Auth: settlement manager, nation manager, world admin, or super admin
  if not public.current_user_manages_settlement(v_settlement_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Reject terminal statuses
  if v_status in ('complete', 'cancelled') then
    raise exception 'project is already %', v_status using errcode = 'P0001';
  end if;

  -- Cascade-unassign: remove citizen_assignments pointing at this project
  delete from public.citizen_assignments ca
  where ca.construction_project_id = p_project_id;

  get diagnostics v_unassigned = row_count;

  -- Cancel the project and set cancelled_at
  update public.construction_projects cp
  set status = 'cancelled', cancelled_at = now()
  where cp.id = p_project_id;

  return query select p_project_id, v_unassigned;
end;
$$;

-- ---------------------------------------------------------------------------
-- resume_construction_project RPC
-- Resumes a cancelled construction project by setting status back to 'queued'.
-- Progress and other fields are preserved.
-- Authorized callers: settlement_manager, nation_manager, world_admin, super_admin
-- Error contract:
--   P0002 (no_data_found)          – null param or project not found
--   42501 (insufficient_privilege) – caller lacks manage-settlement permission
--   P0001 (raise_exception)        – project is not in 'cancelled' status
-- ---------------------------------------------------------------------------
create or replace function public.resume_construction_project (p_project_id uuid) returns table (project_id uuid, success boolean) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_settlement_id uuid;
  v_status        text;
begin
  -- Null guard
  if p_project_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Fetch project
  select cp.settlement_id, cp.status
  into v_settlement_id, v_status
  from public.construction_projects cp
  where cp.id = p_project_id;

  if v_settlement_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Auth: settlement manager, nation manager, world admin, or super admin
  if not public.current_user_manages_settlement(v_settlement_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Reject if not cancelled
  if v_status != 'cancelled' then
    raise exception 'project is not cancelled' using errcode = 'P0001';
  end if;

  -- Resume the project (set back to queued)
  update public.construction_projects cp
  set status = 'queued', cancelled_at = null
  where cp.id = p_project_id;

  return query select p_project_id, true;
end;
$$;

revoke all on function public.resume_construction_project (uuid)
from
  public;

grant
execute on function public.resume_construction_project (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- hard_delete_construction_project RPC
-- Permanently deletes a cancelled construction project.
-- No resource refund is performed.
-- Authorized callers: settlement_manager, nation_manager, world_admin, super_admin
-- Error contract:
--   P0002 (no_data_found)          – null param or project not found
--   42501 (insufficient_privilege) – caller lacks manage-settlement permission
--   P0001 (raise_exception)        – project is not in 'cancelled' status
-- ---------------------------------------------------------------------------
create or replace function public.hard_delete_construction_project (p_project_id uuid) returns table (project_id uuid, success boolean) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_settlement_id uuid;
  v_status        text;
begin
  -- Null guard
  if p_project_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Fetch project
  select cp.settlement_id, cp.status
  into v_settlement_id, v_status
  from public.construction_projects cp
  where cp.id = p_project_id;

  if v_settlement_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Auth: settlement manager, nation manager, world admin, or super admin
  if not public.current_user_manages_settlement(v_settlement_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Reject if not cancelled
  if v_status != 'cancelled' then
    raise exception 'project is not cancelled' using errcode = 'P0001';
  end if;

  -- Delete the project (cascades to citizen_assignments via FK)
  delete from public.construction_projects cp
  where cp.id = p_project_id;

  return query select p_project_id, true;
end;
$$;

revoke all on function public.hard_delete_construction_project (uuid)
from
  public;

grant
execute on function public.hard_delete_construction_project (uuid) to authenticated;
