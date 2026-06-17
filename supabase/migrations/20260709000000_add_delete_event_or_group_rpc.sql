-- ============================================================================
-- RPC: delete_event_or_group
-- ============================================================================
-- Permanently deletes a cancelled event or all events in a cancelled group.
-- Only world admins and super admins may delete events.
-- Only events with status = 'cancelled' may be deleted.
-- When the last event in a group is deleted, the group is also deleted.
-- event_effects rows cascade automatically (has ON DELETE CASCADE).
--
-- Parameters:
--   p_event_id: UUID of event to delete (if provided, deletes only that event)
--   p_group_id: UUID of group to delete (if provided, deletes all events in group)
--   Either p_event_id or p_group_id must be provided (not both null)
--
-- Returns: JSON with count of deleted events
create or replace function public.delete_event_or_group (p_event_id uuid, p_group_id uuid) returns jsonb language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
  v_deleted_count integer := 0;
  v_group_id uuid;
  v_status text;
begin
  -- Validation: one must be provided
  if p_event_id is null and p_group_id is null then
    raise exception 'Either event_id or group_id must be provided'
    using errcode = '23502';
  end if;

  if p_event_id is not null and p_group_id is not null then
    raise exception 'Only one of event_id or group_id may be provided'
    using errcode = '23514';
  end if;

  -- Get world_id and check permissions + status
  if p_event_id is not null then
    select world_id, event_group_id, status
    into v_world_id, v_group_id, v_status
    from public.events
    where id = p_event_id;

    if v_world_id is null then
      raise exception 'Event not found'
      using errcode = 'P0002';
    end if;

    -- Check status is cancelled
    if v_status != 'cancelled' then
      raise exception 'Only cancelled events may be deleted'
      using errcode = '23514';
    end if;
  else
    select world_id
    into v_world_id
    from public.event_groups
    where id = p_group_id;

    if v_world_id is null then
      raise exception 'Event group not found'
      using errcode = 'P0002';
    end if;

    -- Check all events in group are cancelled
    if exists (select 1 from public.events where event_group_id = p_group_id and status != 'cancelled') then
      raise exception 'Only cancelled events may be deleted'
      using errcode = '23514';
    end if;

    v_group_id := p_group_id;
  end if;

  -- Permission check
  if not (public.is_world_admin(v_world_id) or public.is_super_admin()) then
    raise exception 'Not authorized to delete events in this world'
    using errcode = 'P0001';
  end if;

  -- Delete events (event_effects cascade automatically)
  if p_event_id is not null then
    delete from public.events
    where id = p_event_id;

    v_deleted_count := 1;
  else
    delete from public.events
    where event_group_id = p_group_id;

    v_deleted_count := found::integer;
  end if;

  -- Delete group if it has no more events
  if v_group_id is not null then
    if not exists (select 1 from public.events where event_group_id = v_group_id) then
      delete from public.event_groups
      where id = v_group_id;
    end if;
  end if;

  return jsonb_build_object(
    'deleted_count', v_deleted_count
  );
end;
$$;
