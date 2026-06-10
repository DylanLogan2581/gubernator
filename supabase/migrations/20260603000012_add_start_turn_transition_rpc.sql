-- Migration: add_start_turn_transition_rpc
-- Creates public.start_turn_transition(p_world_id uuid, p_expected_turn_number integer) returns uuid.
--
-- First step of the two-step turn-transition protocol (issue #497 / review finding C2).
-- The edge function calls start_turn_transition to reserve a turn_transitions row before running
-- the simulation engine, then passes the returned UUID as the p_transition_id argument of
-- apply_turn_transition. Determinism is keyed on (worldId, turnNumber) only:
--   identical results for a given (worldId, turnNumber)
-- ---------------------------------------------------------------------------
create or replace function public.start_turn_transition (p_world_id uuid, p_expected_turn_number integer) returns uuid language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_status text;
  v_world_turn integer;
  v_transition_id uuid;
begin
  -- Non-null param validation
  if p_world_id is null then
    raise exception 'p_world_id must not be null' using errcode = 'P0001';
  end if;

  if p_expected_turn_number is null then
    raise exception 'p_expected_turn_number must not be null' using errcode = 'P0001';
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
      id into v_transition_id;
  exception
    when unique_violation then
      select
        tt.id into v_transition_id
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

  return v_transition_id;
end;
$$;

revoke
execute on function public.start_turn_transition (uuid, integer)
from
  public;

grant
execute on function public.start_turn_transition (uuid, integer) to authenticated;
