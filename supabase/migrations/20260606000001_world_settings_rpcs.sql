-- Migration: world_settings_rpcs
-- Adds two super-admin-only RPCs for direct world metadata management:
--   rename_world(p_world_id, p_name)                       → updates worlds.name
--   set_world_current_turn_number(p_world_id, p_turn_number) → updates worlds.current_turn_number
--
-- Design notes:
--   - Both RPCs are SECURITY DEFINER, is_super_admin() only.
--   - set_world_current_turn_number does NOT invoke apply_turn_transition;
--     it is a direct override for recovery / testing only.
--   - set_world_current_turn_number rejects overrides that would leave
--     settlement_turn_snapshots or settlement_turn_resource_snapshots rows
--     at a turn_number greater than the requested value.
-- ===========================================================================
-- 1. rename_world
-- ===========================================================================
create or replace function public.rename_world (p_world_id uuid, p_name text) returns setof public.worlds language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world public.worlds%rowtype;
begin
  if p_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not public.is_super_admin () then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  if p_name is null or char_length (trim (p_name)) = 0 then
    raise exception 'World name is required.' using errcode = '22000';
  end if;

  if char_length (trim (p_name)) > 64 then
    raise exception 'World name is too long.' using errcode = '22000';
  end if;

  select *
  into v_world
  from public.worlds w
  where w.id = p_world_id
  for update;

  if v_world.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  return query
  update public.worlds w
  set
    name = trim (p_name),
    updated_at = now ()
  where w.id = p_world_id
  returning *;
end;
$$;

-- ===========================================================================
-- 2. set_world_current_turn_number
-- ===========================================================================
create or replace function public.set_world_current_turn_number (p_world_id uuid, p_turn_number integer) returns setof public.worlds language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world public.worlds%rowtype;
  v_max_snapshot_turn integer;
begin
  if p_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not public.is_super_admin () then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  if p_turn_number is null or p_turn_number < 0 then
    raise exception 'Turn number must be a non-negative integer.' using errcode = '22000';
  end if;

  select *
  into v_world
  from public.worlds w
  where w.id = p_world_id
  for update;

  if v_world.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Reject if any snapshot row exists at a turn greater than the requested value.
  select greatest (
    (
      select max (sts.turn_number)
      from public.settlement_turn_snapshots sts
      where sts.world_id = p_world_id
    ),
    (
      select max (strs.turn_number)
      from public.settlement_turn_resource_snapshots strs
      where strs.world_id = p_world_id
    )
  )
  into v_max_snapshot_turn;

  if v_max_snapshot_turn is not null and v_max_snapshot_turn > p_turn_number then
    raise exception 'snapshots exist for later turns; trash them first'
      using errcode = '23514',
            hint = format (
              'The highest snapshot turn is %s. Setting current_turn_number to %s would leave those rows orphaned. Remove or move the conflicting snapshots first.',
              v_max_snapshot_turn,
              p_turn_number
            );
  end if;

  return query
  update public.worlds w
  set
    current_turn_number = p_turn_number,
    updated_at = now ()
  where w.id = p_world_id
  returning *;
end;
$$;

-- ===========================================================================
-- 3. Permissions
-- ===========================================================================
revoke all on function public.rename_world (uuid, text)
from
  public;

revoke all on function public.set_world_current_turn_number (uuid, integer)
from
  public;

grant
execute on function public.rename_world (uuid, text) to authenticated;

grant
execute on function public.set_world_current_turn_number (uuid, integer) to authenticated;
