-- Migration: add_fail_stuck_turn_transition_rpc
-- Issue #679: Add recovery path for turn_transition wedged in running state.
--
-- This RPC allows service_role (invoked by end-turn-simulation edge function
-- after auth check for super-admin / world-admin) to forcibly mark a stuck
-- running transition as failed without advancing the world turn.
--
-- Preconditions:
-- - Transition exists and is in 'running' status
-- - World is locked during operation (prevents concurrent turn advance)
-- - World current_turn_number must not have advanced past the transition's from_turn_number
--   (safety check: if turn already advanced, the wedged transition is stale)
--
-- This enables admins to clear the block when underlying drift is permanent
-- (e.g., genuine cross-world id, persisted divergence) so a fresh End Turn
-- can be attempted.
-- ---------------------------------------------------------------------------
create or replace function public.fail_stuck_turn_transition (p_world_id uuid, p_transition_id uuid) returns jsonb language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_status text;
  v_world_turn integer;
  v_transition public.turn_transitions%rowtype;
  v_result jsonb;
begin
  -- Non-null param validation
  if p_world_id is null then
    raise exception 'p_world_id must not be null' using errcode = 'P0001';
  end if;

  if p_transition_id is null then
    raise exception 'p_transition_id must not be null' using errcode = 'P0001';
  end if;

  -- Lock the world row so concurrent callers queue behind this transaction
  select
    w.status,
    w.current_turn_number into v_world_status,
    v_world_turn
  from
    public.worlds w
  where
    w.id = p_world_id
  for update;

  if v_world_status = 'archived' then
    raise exception 'world is archived and cannot be modified' using errcode = 'P0001';
  end if;

  -- Look up the transition
  select
    tt.* into v_transition
  from
    public.turn_transitions tt
  where
    tt.id = p_transition_id;

  if not found or v_transition.world_id <> p_world_id then
    raise exception 'transition % not found for world %', p_transition_id, p_world_id
      using errcode = 'P0001';
  end if;

  if v_transition.status <> 'running' then
    raise exception 'transition % is not in running status (current: %)', p_transition_id, v_transition.status
      using errcode = 'P0001';
  end if;

  -- Safety check: world turn must not have advanced past the transition's from_turn_number.
  -- If it has, the transition is stale and should not be marked failed.
  if v_world_turn is not null and v_world_turn > v_transition.from_turn_number then
    raise exception 'world turn has advanced past transition from_turn_number; transition is stale'
      using errcode = 'P0001';
  end if;

  -- Mark the transition as failed
  update public.turn_transitions
  set
    status = 'failed',
    finished_at = now ()
  where
    public.turn_transitions.id = v_transition.id
  returning
    * into v_transition;

  v_result := jsonb_build_object (
    'transitionId', v_transition.id,
    'fromTurnNumber', v_transition.from_turn_number,
    'toTurnNumber', v_transition.to_turn_number,
    'status', v_transition.status,
    'markedFailedAt', v_transition.finished_at,
    'worldId', v_transition.world_id
  );

  return v_result;
end;
$$;

revoke all on function public.fail_stuck_turn_transition (uuid, uuid)
from
  public;

revoke
execute on function public.fail_stuck_turn_transition (uuid, uuid)
from
  anon,
  authenticated;

grant
execute on function public.fail_stuck_turn_transition (uuid, uuid) to service_role;
