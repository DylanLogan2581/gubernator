-- Migration: write_basic_turn_advancement_log
-- Writes the basic end-turn storage log entry in the same transaction as the
-- world turn advance and transition row.
-- ---------------------------------------------------------------------------
drop function if exists public.advance_world_turn_if_current (uuid, integer);

create or replace function public.advance_world_turn_if_current (
  p_world_id uuid,
  p_expected_turn_number integer,
  p_log_payload_jsonb jsonb default null
) returns table (
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
  v_transition public.turn_transitions%rowtype;
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

  update public.settlements s
  set
    is_ready_current_turn = s.auto_ready_enabled,
    ready_set_at = null
  where
    exists (
      select
        1
      from
        public.nations n
      where
        n.id = s.nation_id
        and n.world_id = p_world_id
    );

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
        v_to_turn_number,
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

  if v_transition.id is null then
    return;
  end if;

  if p_log_payload_jsonb is not null then
    insert into
      public.turn_log_entries (
        turn_transition_id,
        world_id,
        log_category,
        payload_jsonb
      )
    select
      v_transition.id,
      v_transition.world_id,
      'basic_turn_advancement',
      p_log_payload_jsonb
    where
      not exists (
        select
          1
        from
          public.turn_log_entries tle
        where
          tle.turn_transition_id = v_transition.id
          and tle.log_category = 'basic_turn_advancement'
      );
  end if;

  return query
  select
    v_transition.id,
    v_transition.world_id,
    v_transition.from_turn_number,
    v_transition.to_turn_number,
    v_transition.initiated_by_user_id,
    v_transition.started_at,
    v_transition.status;
end;
$$;
