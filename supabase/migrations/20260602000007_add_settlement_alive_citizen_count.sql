-- Migration: add_settlement_alive_citizen_count
-- Extracts the alive-NPC count query into a reusable SQL helper so the
-- simulation RPC (apply_turn_transition) and any future caller share one
-- implementation instead of inlining the same select count(*) pattern.
-- Refactors manual_deconstruct_settlement_building to call this helper.
-- ---------------------------------------------------------------------------
-- Function: settlement_alive_citizen_count
-- Returns: count of citizens with status = 'alive' in the given settlement.
-- STABLE SECURITY DEFINER: reads public tables without exposing write paths.
-- search_path = '' prevents search_path-injection attacks.
-- ---------------------------------------------------------------------------
create or replace function public.settlement_alive_citizen_count (p_settlement_id uuid) returns integer language sql stable security definer
set
  search_path = '' as $$
  select count(*)::integer
  from public.citizens
  where settlement_id = p_settlement_id
    and status = 'alive';
$$;

revoke all on function public.settlement_alive_citizen_count (uuid)
from
  public;

grant
execute on function public.settlement_alive_citizen_count (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Refactor manual_deconstruct_settlement_building to delegate to the helper.
-- ---------------------------------------------------------------------------
create or replace function public.manual_deconstruct_settlement_building (p_settlement_building_id uuid) returns table (settlement_building_id uuid) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_settlement_id uuid;
  v_world_id      uuid;
  v_state         text;
  v_new_cap       numeric;
  v_citizen_count integer;
begin
  -- Null guard
  if p_settlement_building_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Fetch building, resolve world via settlement → nation chain
  select sb.settlement_id, sb.state, n.world_id
  into v_settlement_id, v_state, v_world_id
  from public.settlement_buildings sb
  join public.settlements s on s.id = sb.settlement_id
  join public.nations n on n.id = s.nation_id
  where sb.id = p_settlement_building_id;

  if v_settlement_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Auth: super admin or world admin only — managers cannot deconstruct
  if not (public.is_super_admin() or public.is_world_admin(v_world_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Reject already-terminal states
  if v_state not in ('active', 'suspended') then
    raise exception 'building state is % and cannot be deconstructed', v_state
      using errcode = 'P0001';
  end if;

  -- Deconstruct
  update public.settlement_buildings
  set state = 'manually_deconstructed'
  where id = p_settlement_building_id;

  -- Compute new population cap (settlement_population_cap only counts 'active'
  -- rows, so the just-deconstructed building is already excluded)
  v_new_cap := public.settlement_population_cap(v_settlement_id);

  -- Count alive citizens via shared helper
  v_citizen_count := public.settlement_alive_citizen_count(v_settlement_id);

  -- Log overshoot so Epic 6's homelessness pass can remediate
  if v_citizen_count > v_new_cap then
    insert into public.turn_log_entries (
      turn_transition_id,
      world_id,
      settlement_id,
      log_category,
      payload_jsonb
    ) values (
      null,
      v_world_id,
      v_settlement_id,
      'manual_deconstruct_overshoot',
      jsonb_build_object(
        'settlement_building_id', p_settlement_building_id,
        'current_citizens', v_citizen_count,
        'new_cap', v_new_cap
      )
    );
  end if;

  return query select p_settlement_building_id;
end;
$$;
