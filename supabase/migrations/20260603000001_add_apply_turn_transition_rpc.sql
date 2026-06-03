-- Migration: add_apply_turn_transition_rpc
-- Scaffolds the apply_turn_transition SECURITY DEFINER RPC — the single
-- mutation boundary for the simulation engine (Epic 6 §2.3 / §C27). This
-- skeleton wires up auth, world lock, transition insert/finalize, and the
-- failure-capture block so that later patch phases (#C28–#C35) can land
-- incrementally without touching the outer structure.
-- ---------------------------------------------------------------------------
create or replace function public.apply_turn_transition (
  p_world_id uuid,
  p_expected_turn_number integer,
  p_payload jsonb
) returns jsonb language plpgsql security definer
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

  if p_expected_turn_number is null then
    raise exception 'p_expected_turn_number must not be null' using errcode = 'P0001';
  end if;

  if p_payload is null then
    raise exception 'p_payload must not be null' using errcode = 'P0001';
  end if;

  -- Auth: only super admins and world admins may drive the simulation
  if not (public.is_super_admin () or public.is_world_admin (p_world_id)) then
    raise exception 'insufficient privilege' using errcode = 'insufficient_privilege';
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
    raise exception 'world is archived and cannot be advanced' using errcode = 'P0001';
  end if;

  if v_world_turn is null or v_world_turn <> p_expected_turn_number then
    raise exception 'stale expected turn number' using errcode = 'P0001';
  end if;

  -- Insert running transition; on concurrent duplicate reuse the existing row
  begin
    insert into
      public.turn_transitions (
        world_id,
        from_turn_number,
        to_turn_number,
        initiated_by_user_id,
        status
      )
    values
      (
        p_world_id,
        p_expected_turn_number,
        p_expected_turn_number + 1,
        auth.uid (),
        'running'
      )
    returning
      * into v_transition;
  exception
    when unique_violation then
      select
        tt.* into v_transition
      from
        public.turn_transitions tt
      where
        tt.world_id = p_world_id
        and tt.from_turn_number = p_expected_turn_number
        and tt.status = 'running'
      order by
        tt.started_at desc
      limit
        1;
  end;

  -- Outer failure-capture block: later phases add patch work between this
  -- BEGIN and the completion UPDATE; any unhandled exception marks the
  -- transition failed so callers can distinguish a partial run from success.
  begin
    -- (future patch phases land here: #C28–#C35)

    update public.turn_transitions
    set
      status = 'completed',
      finished_at = now ()
    where
      public.turn_transitions.id = v_transition.id
    returning
      * into v_transition;

    v_result := jsonb_build_object (
      'transitionId',
      v_transition.id,
      'fromTurnNumber',
      v_transition.from_turn_number,
      'toTurnNumber',
      v_transition.to_turn_number,
      'patchCounts',
      '{}'::jsonb
    );
  exception
    when others then
      update public.turn_transitions
      set
        status = 'failed'
      where
        public.turn_transitions.id = v_transition.id
        and public.turn_transitions.status = 'running';

      raise;
  end;

  return v_result;
end;
$$;

revoke
execute on function public.apply_turn_transition (uuid, integer, jsonb)
from
  public;

grant
execute on function public.apply_turn_transition (uuid, integer, jsonb) to authenticated;
