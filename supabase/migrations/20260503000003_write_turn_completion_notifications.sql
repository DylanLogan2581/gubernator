-- Migration: write_turn_completion_notifications
-- Writes one turn-completion notification per active world admin recipient in
-- the same transaction as the basic turn-advance RPC.
-- ---------------------------------------------------------------------------
drop function if exists public.advance_world_turn_if_current (uuid, integer, jsonb);

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
  v_advanced_turn_number integer;
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
