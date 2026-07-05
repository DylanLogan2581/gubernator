-- Migration: add_deposit_destroyed_type_targeting
-- Purpose: Support an "all deposits of a type in scope" targeting mode for the
-- deposit_destroyed effect, alongside the existing specific-instance mode.
--
-- No new column is needed: the type reference travels in extra_data_jsonb
-- (deposit_destroyed_mode: 'type', deposit_type_id: uuid), mirroring the
-- building_blueprint_mode/building_blueprint_ids convention already used by
-- upkeep_multiplier. extra_data_jsonb is already inserted verbatim by both
-- create_event_group_with_events and update_event_group_with_events, so those
-- RPCs need no changes. The engine resolves the type to matching deposit
-- instances within the event's scope at application time (see phaseEvents.ts),
-- so deposits created after event creation but before activation are included.
--
-- Changes:
--   1. Relax event_effects_deposit_required_for_deposit_destroyed to allow a
--      null deposit_instance_id when extra_data_jsonb carries a valid type-mode
--      selection.
--   2. Update validate_event_effect_fields to accept the type-mode selection.
--   3. Update validate_event_effect_world_membership to verify a referenced
--      deposit_type_id belongs to the event's world.
-- ============================================================================
alter table public.event_effects
drop constraint event_effects_deposit_required_for_deposit_destroyed;

alter table public.event_effects
add constraint event_effects_deposit_required_for_deposit_destroyed check (
  effect_type != 'deposit_destroyed'
  or deposit_instance_id is not null
  or (
    extra_data_jsonb ->> 'deposit_destroyed_mode' = 'type'
    and extra_data_jsonb ->> 'deposit_type_id' is not null
  )
);

-- ============================================================================
-- Helper: per-effect required-field validation (deposit_destroyed relaxed)
-- ============================================================================
create or replace function public.validate_event_effect_fields (p_effect jsonb) returns void language plpgsql
set
  search_path = '' as $$
declare
  v_effect_type text;
begin
  v_effect_type := p_effect->>'effect_type';

  -- Amount-based types: require a non-zero amount_value
  if v_effect_type = any(array[
    'population_boost', 'population_loss', 'managed_population_change',
    'resource_grant', 'resource_drain'
  ]) then
    if (p_effect->>'amount_value') is null
       or (p_effect->>'amount_value')::numeric = 0 then
      raise exception 'Effect type % requires a non-zero amount', v_effect_type
        using errcode = '22023';
    end if;
  end if;

  -- Multiplier types: require a non-zero multiplier_value
  if v_effect_type = any(array[
    'consumption_multiplier', 'production_multiplier', 'upkeep_multiplier'
  ]) then
    if (p_effect->>'multiplier_value') is null
       or (p_effect->>'multiplier_value')::numeric = 0 then
      raise exception 'Effect type % requires a non-zero multiplier', v_effect_type
        using errcode = '22023';
    end if;
  end if;

  -- Resource effects: require resource_id
  if v_effect_type = any(array['resource_grant', 'resource_drain']) then
    if (p_effect->>'resource_id') is null then
      raise exception 'Effect type % requires a resource selection', v_effect_type
        using errcode = '22023';
    end if;
  end if;

  -- deposit_destroyed: require either a specific deposit_instance_id, or a
  -- type-mode selection (deposit_destroyed_mode = 'type' + deposit_type_id)
  if v_effect_type = 'deposit_destroyed' then
    if (p_effect->>'deposit_instance_id') is null
       and not (
         p_effect->'extra_data_jsonb'->>'deposit_destroyed_mode' = 'type'
         and (p_effect->'extra_data_jsonb'->>'deposit_type_id') is not null
       ) then
      raise exception 'Effect type deposit_destroyed requires a deposit selection'
        using errcode = '22023';
    end if;
  end if;

  -- building_destroyed: require settlement_building_id
  if v_effect_type = 'building_destroyed' then
    if (p_effect->>'settlement_building_id') is null then
      raise exception 'Effect type building_destroyed requires a building selection'
        using errcode = '22023';
    end if;
  end if;
end;
$$;

-- ============================================================================
-- Helper: per-effect same-world reference validation (deposit_type_id added)
-- ============================================================================
create or replace function public.validate_event_effect_world_membership (p_world_id uuid, p_effect jsonb) returns void language plpgsql
set
  search_path = '' as $$
declare
  v_resource_id uuid;
  v_job_id uuid;
  v_deposit_instance_id uuid;
  v_deposit_type_id uuid;
  v_managed_population_instance_id uuid;
begin
  v_resource_id := (p_effect->>'resource_id')::uuid;

  if v_resource_id is not null then
    if not exists (
      select 1 from public.resources
      where id = v_resource_id and world_id = p_world_id
    ) then
      raise exception 'resource_id % does not belong to this world', v_resource_id
        using errcode = 'foreign_key_violation';
    end if;
  end if;

  v_job_id := (p_effect->>'job_id')::uuid;

  if v_job_id is not null then
    if not exists (
      select 1 from public.job_definitions
      where id = v_job_id and world_id = p_world_id
    ) then
      raise exception 'job_id % does not belong to this world', v_job_id
        using errcode = 'foreign_key_violation';
    end if;
  end if;

  v_deposit_instance_id := (p_effect->>'deposit_instance_id')::uuid;

  if v_deposit_instance_id is not null then
    if not exists (
      select 1
      from public.deposit_instances di
      join public.settlements s on s.id = di.settlement_id
      join public.nations n on n.id = s.nation_id
      where di.id = v_deposit_instance_id and n.world_id = p_world_id
    ) then
      raise exception 'deposit_instance_id % does not belong to this world', v_deposit_instance_id
        using errcode = 'foreign_key_violation';
    end if;
  end if;

  v_deposit_type_id := (p_effect->'extra_data_jsonb'->>'deposit_type_id')::uuid;

  if v_deposit_type_id is not null then
    if not exists (
      select 1 from public.deposit_types
      where id = v_deposit_type_id and world_id = p_world_id
    ) then
      raise exception 'deposit_type_id % does not belong to this world', v_deposit_type_id
        using errcode = 'foreign_key_violation';
    end if;
  end if;

  v_managed_population_instance_id := (p_effect->>'managed_population_instance_id')::uuid;

  if v_managed_population_instance_id is not null then
    if not exists (
      select 1
      from public.managed_population_instances mpi
      join public.settlements s on s.id = mpi.settlement_id
      join public.nations n on n.id = s.nation_id
      where mpi.id = v_managed_population_instance_id and n.world_id = p_world_id
    ) then
      raise exception 'managed_population_instance_id % does not belong to this world', v_managed_population_instance_id
        using errcode = 'foreign_key_violation';
    end if;
  end if;
end;
$$;

revoke all on function public.validate_event_effect_world_membership (uuid, jsonb)
from
  public;
