-- Migration: advance_world_turn_if_current
-- Atomically advances a world exactly one turn when the caller's expected
-- turn matches the stored world turn, then records the running transition.
-- ---------------------------------------------------------------------------
create or replace function public.advance_world_turn_if_current (p_world_id uuid, p_expected_turn_number integer) returns table (
  id uuid,
  world_id uuid,
  from_turn_number integer,
  to_turn_number integer,
  initiated_by_user_id uuid,
  started_at timestamptz,
  status text
) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_advanced_turn_number integer;
  v_to_turn_number integer;
begin
  if p_expected_turn_number is null or p_expected_turn_number < 0 then
    return;
  end if;

  if not (
    public.is_world_admin (p_world_id)
    or public.is_super_admin ()
  ) then
    return;
  end if;

  v_to_turn_number := p_expected_turn_number + 1;

  update public.worlds
  set
    current_turn_number = v_to_turn_number
  where
    public.worlds.id = p_world_id
    and public.worlds.current_turn_number = p_expected_turn_number
    and public.worlds.status = 'active'
  returning
    public.worlds.current_turn_number into v_advanced_turn_number;

  if v_advanced_turn_number is null then
    return;
  end if;

  begin
    return query
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
        v_to_turn_number,
        auth.uid (),
        'running'
      )
    returning
      public.turn_transitions.id,
      public.turn_transitions.world_id,
      public.turn_transitions.from_turn_number,
      public.turn_transitions.to_turn_number,
      public.turn_transitions.initiated_by_user_id,
      public.turn_transitions.started_at,
      public.turn_transitions.status;
  exception
    when unique_violation then
      return query
      select
        tt.id,
        tt.world_id,
        tt.from_turn_number,
        tt.to_turn_number,
        tt.initiated_by_user_id,
        tt.started_at,
        tt.status
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
end;
$$;
