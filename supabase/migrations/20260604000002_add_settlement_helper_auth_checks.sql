-- Migration: add_settlement_helper_auth_checks
-- Closes security finding H2: settlement_effective_storage_cap and
-- settlement_alive_citizen_count were SECURITY DEFINER with no caller-auth
-- check, letting any authenticated user probe arbitrary settlements.
--
-- Pattern applied:
--   *_internal variants  — same logic as the originals, no auth guard, revoked
--                          from the authenticated role so PostgREST clients
--                          cannot reach them.  Trusted SECURITY DEFINER callers
--                          (manual_deconstruct_settlement_building, etc.) use
--                          these directly; they run as the function owner
--                          (postgres) so PostgreSQL grants them access.
--   public wrappers       — enforce world access for authenticated PostgREST
--                          callers (auth.uid() is non-null).  Callers with a
--                          null auth.uid() (postgres superuser, service-role,
--                          pgTAP tests) bypass the check and hit the internal
--                          variant directly.
-- ---------------------------------------------------------------------------
-- ===========================================================================
-- INTERNAL VARIANTS (no auth check, private)
-- ===========================================================================
create or replace function public.settlement_effective_storage_cap_internal (p_settlement_id uuid, p_resource_id uuid) returns numeric language sql stable security definer
set
  search_path = '' as $$
  select coalesce(
    (select base_stockpile_cap from public.resources where id = p_resource_id),
    0
  ) + coalesce(
    (
      select sum((e.entry ->> 'amount')::numeric)
      from public.settlement_buildings sb
      join public.building_blueprint_tiers t on t.id = sb.current_tier_id
      cross join lateral jsonb_array_elements(t.effects_json) as e (entry)
      where sb.settlement_id = p_settlement_id
        and sb.state = 'active'
        and (e.entry ->> 'type') = 'resource_storage_increase'
        and (e.entry ->> 'resource_id')::uuid = p_resource_id
    ),
    0
  );
$$;

revoke all on function public.settlement_effective_storage_cap_internal (uuid, uuid)
from
  public;

-- intentionally no grant to authenticated — internal use only
-- ---------------------------------------------------------------------------
create or replace function public.settlement_alive_citizen_count_internal (p_settlement_id uuid) returns integer language sql stable security definer
set
  search_path = '' as $$
  select count(*)::integer
  from public.citizens
  where settlement_id = p_settlement_id
    and status = 'alive';
$$;

revoke all on function public.settlement_alive_citizen_count_internal (uuid)
from
  public;

-- intentionally no grant to authenticated — internal use only
-- ===========================================================================
-- PUBLIC WRAPPERS (auth-checked)
-- ===========================================================================
-- settlement_effective_storage_cap
-- Resolve the settlement's world and require world access before delegating to
-- the internal variant.  This covers anon callers (null auth.uid()), foreign-
-- world authenticated users, and any caller without a valid session.
-- Trusted SECURITY DEFINER callers (apply_turn_transition, etc.) that already
-- perform their own auth checks should call _internal directly to avoid the
-- redundant lookup.
create or replace function public.settlement_effective_storage_cap (p_settlement_id uuid, p_resource_id uuid) returns numeric language plpgsql stable security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
begin
  select n.world_id
  into   v_world_id
  from   public.settlements s
  join   public.nations     n on n.id = s.nation_id
  where  s.id = p_settlement_id;

  if not public.current_user_has_world_access (v_world_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return public.settlement_effective_storage_cap_internal (p_settlement_id, p_resource_id);
end;
$$;

revoke all on function public.settlement_effective_storage_cap (uuid, uuid)
from
  public;

grant
execute on function public.settlement_effective_storage_cap (uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- settlement_alive_citizen_count
-- Same guard pattern as settlement_effective_storage_cap.
create or replace function public.settlement_alive_citizen_count (p_settlement_id uuid) returns integer language plpgsql stable security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
begin
  select n.world_id
  into   v_world_id
  from   public.settlements s
  join   public.nations     n on n.id = s.nation_id
  where  s.id = p_settlement_id;

  if not public.current_user_has_world_access (v_world_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return public.settlement_alive_citizen_count_internal (p_settlement_id);
end;
$$;

revoke all on function public.settlement_alive_citizen_count (uuid)
from
  public;

grant
execute on function public.settlement_alive_citizen_count (uuid) to authenticated;

-- ===========================================================================
-- UPDATE TRUSTED CALLERS
-- ===========================================================================
-- manual_deconstruct_settlement_building: switch the alive-citizen lookup from
-- the public wrapper (which would do a redundant auth check) to the internal
-- variant.  The function already validates super admin or world admin before
-- reaching this call.
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
  into   v_settlement_id, v_state, v_world_id
  from   public.settlement_buildings sb
  join   public.settlements           s on s.id = sb.settlement_id
  join   public.nations               n on n.id = s.nation_id
  where  sb.id = p_settlement_building_id;

  if v_settlement_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Auth: super admin or world admin only — managers cannot deconstruct
  if not (public.is_super_admin () or public.is_world_admin (v_world_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Reject already-terminal states
  if v_state not in ('active', 'suspended') then
    raise exception 'building state is % and cannot be deconstructed', v_state
      using errcode = 'P0001';
  end if;

  -- Deconstruct
  update public.settlement_buildings
  set    state = 'manually_deconstructed'
  where  id = p_settlement_building_id;

  -- Compute new population cap (settlement_population_cap only counts 'active'
  -- rows, so the just-deconstructed building is already excluded)
  v_new_cap := public.settlement_population_cap (v_settlement_id);

  -- Count alive citizens via internal helper (auth already verified above)
  v_citizen_count := public.settlement_alive_citizen_count_internal (v_settlement_id);

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
      jsonb_build_object (
        'settlement_building_id', p_settlement_building_id,
        'current_citizens',       v_citizen_count,
        'new_cap',                v_new_cap
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
