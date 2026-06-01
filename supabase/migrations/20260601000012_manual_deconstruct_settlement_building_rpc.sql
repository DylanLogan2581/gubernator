-- Migration: manual_deconstruct_settlement_building_rpc
-- Makes turn_log_entries.turn_transition_id nullable to support out-of-band
-- admin operations (e.g. manual deconstruct overshoot logging) that happen
-- outside a turn transition.
-- Adds SECURITY DEFINER RPC public.manual_deconstruct_settlement_building.
--
-- Authorization: super admin OR is_world_admin only — managers are excluded
--   per spec §1.
-- Rejected states: anything other than 'active' or 'suspended' (P0001).
-- Side-effect: if deconstructing the building would reduce the population cap
--   below the current alive-citizen count, insert a turn_log_entries row with
--   log_category = 'manual_deconstruct_overshoot' for Epic 6's homelessness
--   pass to pick up.
--
-- Error contract:
--   P0002 (no_data_found)          – null param or building not found
--   42501 (insufficient_privilege) – caller is not super admin or world admin
--   P0001 (raise_exception)        – building state is not active or suspended
-- ---------------------------------------------------------------------------
-- 1. Allow turn_log_entries.turn_transition_id to be NULL.
--    The composite FK (turn_transition_id, world_id) uses MATCH SIMPLE, so
--    a NULL component skips the FK check — safe for out-of-band entries.
-- ---------------------------------------------------------------------------
alter table public.turn_log_entries
alter column turn_transition_id
drop not null;

-- ---------------------------------------------------------------------------
-- 2. Create the RPC.
-- ---------------------------------------------------------------------------
create or replace function public.manual_deconstruct_settlement_building (p_settlement_building_id uuid) returns table (settlement_building_id uuid) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_settlement_id uuid;
  v_world_id      uuid;
  v_state         text;
  v_new_cap       numeric;
  v_citizen_count bigint;
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

  -- Count alive citizens in the settlement
  select count(*)
  into v_citizen_count
  from public.citizens c
  where c.settlement_id = v_settlement_id
    and c.status = 'alive';

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

revoke all on function public.manual_deconstruct_settlement_building (uuid)
from
  public;

grant
execute on function public.manual_deconstruct_settlement_building (uuid) to authenticated;
