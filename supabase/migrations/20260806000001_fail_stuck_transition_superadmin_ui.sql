-- Migration: fail_stuck_transition_superadmin_ui
-- Issue #799: Update fail_stuck_turn_transition so superadmin can call it
-- directly from the UI without an edge-function hop.
--
-- Changes:
--   1. Add optional p_reason text parameter; stored in readiness_summary_jsonb
--      so the recovery reason is recorded on the transition row for audit.
--   2. Add is_super_admin() check so authenticated superadmins can call it
--      (service_role path used by the edge function continues to work).
--   3. Grant execute to authenticated (in addition to existing service_role).
-- ---------------------------------------------------------------------------
create or replace function public.fail_stuck_turn_transition (
  p_world_id uuid,
  p_transition_id uuid,
  p_reason text default null
) returns jsonb language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_status  text;
  v_world_turn    integer;
  v_transition    public.turn_transitions%rowtype;
  v_result        jsonb;
begin
  -- Non-null param validation
  if p_world_id is null then
    raise exception 'p_world_id must not be null' using errcode = 'P0001';
  end if;

  if p_transition_id is null then
    raise exception 'p_transition_id must not be null' using errcode = 'P0001';
  end if;

  -- Auth: only superadmins may recover stuck transitions through the UI path.
  -- The service_role path (edge function) bypasses this check.
  if current_setting ('request.jwt.claims', true) is not null
     and current_setting ('request.jwt.claims', true) <> ''
  then
    if not public.is_super_admin () then
      raise exception 'insufficient privilege' using errcode = '42501';
    end if;
  end if;

  -- Lock the world row so concurrent callers queue behind this transaction
  select w.status, w.current_turn_number
  into v_world_status, v_world_turn
  from public.worlds w
  where w.id = p_world_id
  for update;

  if v_world_status = 'archived' then
    raise exception 'world is archived and cannot be modified' using errcode = 'P0001';
  end if;

  -- Look up the transition
  select tt.*
  into v_transition
  from public.turn_transitions tt
  where tt.id = p_transition_id;

  if not found or v_transition.world_id <> p_world_id then
    raise exception 'transition % not found for world %', p_transition_id, p_world_id
      using errcode = 'P0001';
  end if;

  if v_transition.status <> 'running' then
    raise exception 'transition % is not in running status (current: %)', p_transition_id, v_transition.status
      using errcode = 'P0001';
  end if;

  -- Safety check: world turn must not have advanced past the transition's from_turn_number.
  if v_world_turn is not null and v_world_turn > v_transition.from_turn_number then
    raise exception 'world turn has advanced past transition from_turn_number; transition is stale'
      using errcode = 'P0001';
  end if;

  -- Mark the transition as failed; record recovery reason if provided.
  update public.turn_transitions
  set
    status    = 'failed',
    finished_at = now (),
    readiness_summary_jsonb = coalesce (readiness_summary_jsonb, '{}'::jsonb)
      || jsonb_strip_nulls (jsonb_build_object (
           'recovery_reason', p_reason,
           'recovered_at',    now ()
         ))
  where public.turn_transitions.id = v_transition.id
  returning * into v_transition;

  v_result := jsonb_build_object (
    'transitionId',    v_transition.id,
    'fromTurnNumber',  v_transition.from_turn_number,
    'toTurnNumber',    v_transition.to_turn_number,
    'status',          v_transition.status,
    'markedFailedAt',  v_transition.finished_at,
    'worldId',         v_transition.world_id
  );

  return v_result;
end;
$$;

revoke all on function public.fail_stuck_turn_transition (uuid, uuid, text)
from
  public;

revoke
execute on function public.fail_stuck_turn_transition (uuid, uuid, text)
from
  anon;

grant
execute on function public.fail_stuck_turn_transition (uuid, uuid, text) to authenticated,
service_role;

-- Drop the old 2-param signature to avoid overload ambiguity.
-- The new 3-param signature with p_reason default null is fully backward-compatible:
-- existing callers passing 2 args will resolve to this new overload.
drop function if exists public.fail_stuck_turn_transition (uuid, uuid);
