-- Migration: add_settlement_last_ready_at
-- Tracks historical readiness separately from current-turn readiness state.
-- ---------------------------------------------------------------------------
alter table public.settlements
add column last_ready_at timestamptz;

comment on column public.settlements.last_ready_at is 'Most recent time the settlement was marked or treated as ready, preserved when current-turn readiness is cleared.';

update public.settlements
set
  last_ready_at = ready_set_at
where
  ready_set_at is not null;

create or replace function public.advance_world_turn_if_current (
  p_world_id uuid,
  p_expected_turn_number integer,
  p_log_payload_jsonb jsonb default null,
  p_notification_payload_jsonb jsonb default null
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
  v_current_turn_number integer;
  v_notification_message_text text;
  v_notification_type text;
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

  select
    w.current_turn_number into v_current_turn_number
  from
    public.worlds w
  where
    w.id = p_world_id
    and w.status = 'active'
  for update;

  if (
    v_current_turn_number is null
    or v_current_turn_number <> p_expected_turn_number
  ) then
    return;
  end if;

  v_to_turn_number := p_expected_turn_number + 1;

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

  begin
    update public.worlds
    set
      current_turn_number = v_to_turn_number
    where
      public.worlds.id = p_world_id;

    update public.settlements s
    set
      is_ready_current_turn = s.auto_ready_enabled,
      last_ready_at = case
        when s.auto_ready_enabled then coalesce(s.last_ready_at, now())
        else s.last_ready_at
      end,
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

    if p_notification_payload_jsonb is not null then
      v_notification_type := nullif(
        btrim(p_notification_payload_jsonb ->> 'notificationType'),
        ''
      );
      v_notification_message_text := nullif(
        btrim(p_notification_payload_jsonb ->> 'messageText'),
        ''
      );

      if v_notification_type is null or v_notification_message_text is null then
        raise exception 'turn completion notification payload must include notificationType and messageText'
          using errcode = 'check_violation';
      end if;

      insert into
        public.notifications (
          recipient_user_id,
          world_id,
          notification_type,
          message_text,
          generated_in_transition_id
        )
      select
        recipient_rows.user_id,
        v_transition.world_id,
        v_notification_type,
        v_notification_message_text,
        v_transition.id
      from
        (
          select
            w.owner_id as user_id
          from
            public.worlds w
            inner join public.users owner_user on owner_user.id = w.owner_id
          where
            w.id = v_transition.world_id
            and owner_user.status = 'active'
          union
          select
            wa.user_id
          from
            public.world_admins wa
            inner join public.users admin_user on admin_user.id = wa.user_id
          where
            wa.world_id = v_transition.world_id
            and admin_user.status = 'active'
          union
          select
            u.id
          from
            public.users u
          where
            u.is_super_admin = true
            and u.status = 'active'
        ) recipient_rows
      where
        not exists (
          select
            1
          from
            public.notifications n
          where
            n.recipient_user_id = recipient_rows.user_id
            and n.world_id = v_transition.world_id
            and n.generated_in_transition_id = v_transition.id
            and n.notification_type = v_notification_type
        );
    end if;

    update public.turn_transitions
    set
      finished_at = now(),
      status = 'completed'
    where
      public.turn_transitions.id = v_transition.id
    returning
      * into v_transition;
  exception
    when others then
      update public.turn_transitions
      set
        status = 'failed'
      where
        public.turn_transitions.id = v_transition.id
        and public.turn_transitions.status = 'running'
      returning
        * into v_transition;
  end;

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
