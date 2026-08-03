-- Migration: set-based cross-world guards and drift validation for the turn write path
--
-- Phase 2 of the DB scaling roadmap (issue #1272).
--
-- public.apply_turn_transition previously validated its payload row-by-row:
--   (a) it materialised ~18 arrays of ALL valid ids in the world (including every
--       citizen id) and then ran ~25 `FOR ... IN jsonb_array_elements(...)` loops,
--       each element testing `= any(<array>)` — O(payload entries x valid ids);
--   (b) it re-validated drift (§H9 stockpiles, §H10a deposit resources,
--       §H10b managed populations) with one SELECT per payload element, plus a
--       nested loop over deposit resourceDeltas.
--
-- Both are replaced by set-based statements in a new helper,
-- public.internal_apply_turn_transition_validate_payload, called by the
-- orchestrator at exactly the same point (before the failure-capture block, so a
-- validation failure still leaves the transition in 'running' status for retry).
--
-- Behaviour is preserved exactly:
--   * identical SQLSTATE (P0001), message text and hint for every cross-world and
--     drift failure,
--   * identical check ordering — sections are checked in the previous order, and
--     within a section the offending element with the lowest payload index (and,
--     for multi-field sections, the field checked first by the old loop body) is
--     the one reported,
--   * null ids are still skipped, and drift checks still only fire when a matching
--     row exists (and, for §H10a/§H10b, only when the payload carries the
--     before-value key),
--   * before-values are still coerced to numeric(18,4) before comparison, matching
--     the old assignment into numeric(18,4) locals.
--
-- Migration: yes. RLS: none (security definer helper, not granted to clients).
-- DB test: yes. Typegen: none (no signature change to any client-callable RPC).
-- Deterministic, no RNG.
-- ---------------------------------------------------------------------------
create or replace function public.internal_apply_turn_transition_validate_payload (p_world_id uuid, p_payload jsonb) returns void language plpgsql security definer
set
  search_path = '' as $$
declare
  v_check_id uuid;
  v_settlement_id uuid;
  v_resource_id uuid;
  v_quantity_before numeric(18, 4);
  v_actual_quantity numeric(18, 4);
  v_deposit_instance_id uuid;
  v_remaining_quantity_before numeric(18, 4);
  v_actual_remaining_quantity numeric(18, 4);
  v_managed_pop_instance_id uuid;
  v_current_count_before numeric(18, 4);
  v_actual_current_count numeric(18, 4);
begin
  -- §C36: cross-world payload guards. Each section resolves the first offending
  -- id set-wise; `not exists` is an index probe per payload element, so total work
  -- is O(payload entries) instead of O(payload entries x world entity count).

  -- stockpileDeltas
  select q.bad_id into v_check_id
  from (
    select e.ord, 1 as rk, (e.value ->> 'settlementId')::uuid as bad_id
    from jsonb_array_elements(coalesce(p_payload -> 'stockpileDeltas', '[]'::jsonb))
      with ordinality e (value, ord)
    where e.value ->> 'settlementId' is not null
      and not exists (
        select 1 from public.settlements s
        join public.nations n on n.id = s.nation_id
        where s.id = (e.value ->> 'settlementId')::uuid and n.world_id = p_world_id
      )
    union all
    select e.ord, 2, (e.value ->> 'resourceId')::uuid
    from jsonb_array_elements(coalesce(p_payload -> 'stockpileDeltas', '[]'::jsonb))
      with ordinality e (value, ord)
    where e.value ->> 'resourceId' is not null
      and not exists (
        select 1 from public.resources r
        where r.id = (e.value ->> 'resourceId')::uuid and r.world_id = p_world_id
      )
  ) q
  order by q.ord, q.rk
  limit 1;

  if v_check_id is not null then
    raise exception 'cross-world id % in stockpileDeltas', v_check_id using errcode = 'P0001';
  end if;

  -- constructionUpdates
  select (e.value ->> 'projectId')::uuid into v_check_id
  from jsonb_array_elements(coalesce(p_payload -> 'constructionUpdates', '[]'::jsonb))
    with ordinality e (value, ord)
  where e.value ->> 'projectId' is not null
    and not exists (
      select 1 from public.construction_projects cp
      join public.settlements s on s.id = cp.settlement_id
      join public.nations n on n.id = s.nation_id
      where cp.id = (e.value ->> 'projectId')::uuid and n.world_id = p_world_id
    )
  order by e.ord
  limit 1;

  if v_check_id is not null then
    raise exception 'cross-world id % in constructionUpdates', v_check_id using errcode = 'P0001';
  end if;

  -- buildingsCreated
  select q.bad_id into v_check_id
  from (
    select e.ord, 1 as rk, (e.value ->> 'settlementId')::uuid as bad_id
    from jsonb_array_elements(coalesce(p_payload -> 'buildingsCreated', '[]'::jsonb))
      with ordinality e (value, ord)
    where e.value ->> 'settlementId' is not null
      and not exists (
        select 1 from public.settlements s
        join public.nations n on n.id = s.nation_id
        where s.id = (e.value ->> 'settlementId')::uuid and n.world_id = p_world_id
      )
    union all
    select e.ord, 2, (e.value ->> 'buildingBlueprintId')::uuid
    from jsonb_array_elements(coalesce(p_payload -> 'buildingsCreated', '[]'::jsonb))
      with ordinality e (value, ord)
    where e.value ->> 'buildingBlueprintId' is not null
      and not exists (
        select 1 from public.building_blueprints bb
        where bb.id = (e.value ->> 'buildingBlueprintId')::uuid and bb.world_id = p_world_id
      )
    union all
    select e.ord, 3, (e.value ->> 'currentTierId')::uuid
    from jsonb_array_elements(coalesce(p_payload -> 'buildingsCreated', '[]'::jsonb))
      with ordinality e (value, ord)
    where e.value ->> 'currentTierId' is not null
      and not exists (
        select 1 from public.building_blueprint_tiers t
        join public.building_blueprints b on b.id = t.building_blueprint_id
        where t.id = (e.value ->> 'currentTierId')::uuid and b.world_id = p_world_id
      )
  ) q
  order by q.ord, q.rk
  limit 1;

  if v_check_id is not null then
    raise exception 'cross-world id % in buildingsCreated', v_check_id using errcode = 'P0001';
  end if;

  -- buildingStateChanges
  select (e.value ->> 'buildingId')::uuid into v_check_id
  from jsonb_array_elements(coalesce(p_payload -> 'buildingStateChanges', '[]'::jsonb))
    with ordinality e (value, ord)
  where e.value ->> 'buildingId' is not null
    and not exists (
      select 1 from public.settlement_buildings sb
      join public.settlements s on s.id = sb.settlement_id
      join public.nations n on n.id = s.nation_id
      where sb.id = (e.value ->> 'buildingId')::uuid and n.world_id = p_world_id
    )
  order by e.ord
  limit 1;

  if v_check_id is not null then
    raise exception 'cross-world id % in buildingStateChanges', v_check_id using errcode = 'P0001';
  end if;

  -- depositUpdates
  select (e.value ->> 'depositInstanceId')::uuid into v_check_id
  from jsonb_array_elements(coalesce(p_payload -> 'depositUpdates', '[]'::jsonb))
    with ordinality e (value, ord)
  where e.value ->> 'depositInstanceId' is not null
    and not exists (
      select 1 from public.deposit_instances di
      join public.settlements s on s.id = di.settlement_id
      join public.nations n on n.id = s.nation_id
      where di.id = (e.value ->> 'depositInstanceId')::uuid and n.world_id = p_world_id
    )
  order by e.ord
  limit 1;

  if v_check_id is not null then
    raise exception 'cross-world id % in depositUpdates', v_check_id using errcode = 'P0001';
  end if;

  -- managedPopulationUpdates
  select (e.value ->> 'managedPopulationInstanceId')::uuid into v_check_id
  from jsonb_array_elements(coalesce(p_payload -> 'managedPopulationUpdates', '[]'::jsonb))
    with ordinality e (value, ord)
  where e.value ->> 'managedPopulationInstanceId' is not null
    and not exists (
      select 1 from public.managed_population_instances mpi
      join public.settlements s on s.id = mpi.settlement_id
      join public.nations n on n.id = s.nation_id
      where mpi.id = (e.value ->> 'managedPopulationInstanceId')::uuid and n.world_id = p_world_id
    )
  order by e.ord
  limit 1;

  if v_check_id is not null then
    raise exception 'cross-world id % in managedPopulationUpdates', v_check_id
      using errcode = 'P0001';
  end if;

  -- tradeRouteOutcomes
  select (e.value ->> 'tradeRouteId')::uuid into v_check_id
  from jsonb_array_elements(coalesce(p_payload -> 'tradeRouteOutcomes', '[]'::jsonb))
    with ordinality e (value, ord)
  where e.value ->> 'tradeRouteId' is not null
    and not exists (
      select 1 from public.trade_routes tr
      join public.settlements os on os.id = tr.origin_settlement_id
      join public.nations onat on onat.id = os.nation_id
      join public.settlements ds on ds.id = tr.destination_settlement_id
      join public.nations dnat on dnat.id = ds.nation_id
      where tr.id = (e.value ->> 'tradeRouteId')::uuid
        and onat.world_id = p_world_id
        and dnat.world_id = p_world_id
    )
  order by e.ord
  limit 1;

  if v_check_id is not null then
    raise exception 'cross-world id % in tradeRouteOutcomes', v_check_id using errcode = 'P0001';
  end if;

  -- bornOnTurnBackfill
  select (e.value ->> 'citizenId')::uuid into v_check_id
  from jsonb_array_elements(coalesce(p_payload -> 'bornOnTurnBackfill', '[]'::jsonb))
    with ordinality e (value, ord)
  where e.value ->> 'citizenId' is not null
    and not exists (
      select 1 from public.citizens c
      where c.id = (e.value ->> 'citizenId')::uuid and c.world_id = p_world_id
    )
  order by e.ord
  limit 1;

  if v_check_id is not null then
    raise exception 'cross-world id % in bornOnTurnBackfill', v_check_id using errcode = 'P0001';
  end if;

  -- citizenBirths
  select q.bad_id into v_check_id
  from (
    select e.ord, 1 as rk, (e.value ->> 'settlementId')::uuid as bad_id
    from jsonb_array_elements(coalesce(p_payload -> 'citizenBirths', '[]'::jsonb))
      with ordinality e (value, ord)
    where e.value ->> 'settlementId' is not null
      and not exists (
        select 1 from public.settlements s
        join public.nations n on n.id = s.nation_id
        where s.id = (e.value ->> 'settlementId')::uuid and n.world_id = p_world_id
      )
    union all
    select e.ord, 2, (e.value ->> 'parentACitizenId')::uuid
    from jsonb_array_elements(coalesce(p_payload -> 'citizenBirths', '[]'::jsonb))
      with ordinality e (value, ord)
    where e.value ->> 'parentACitizenId' is not null
      and not exists (
        select 1 from public.citizens c
        where c.id = (e.value ->> 'parentACitizenId')::uuid and c.world_id = p_world_id
      )
    union all
    select e.ord, 3, (e.value ->> 'parentBCitizenId')::uuid
    from jsonb_array_elements(coalesce(p_payload -> 'citizenBirths', '[]'::jsonb))
      with ordinality e (value, ord)
    where e.value ->> 'parentBCitizenId' is not null
      and not exists (
        select 1 from public.citizens c
        where c.id = (e.value ->> 'parentBCitizenId')::uuid and c.world_id = p_world_id
      )
  ) q
  order by q.ord, q.rk
  limit 1;

  if v_check_id is not null then
    raise exception 'cross-world id % in citizenBirths', v_check_id using errcode = 'P0001';
  end if;

  -- citizenDeaths
  select (e.value ->> 'citizenId')::uuid into v_check_id
  from jsonb_array_elements(coalesce(p_payload -> 'citizenDeaths', '[]'::jsonb))
    with ordinality e (value, ord)
  where e.value ->> 'citizenId' is not null
    and not exists (
      select 1 from public.citizens c
      where c.id = (e.value ->> 'citizenId')::uuid and c.world_id = p_world_id
    )
  order by e.ord
  limit 1;

  if v_check_id is not null then
    raise exception 'cross-world id % in citizenDeaths', v_check_id using errcode = 'P0001';
  end if;

  -- partnershipChanges
  select q.bad_id into v_check_id
  from (
    select e.ord, 1 as rk, (e.value ->> 'citizenAId')::uuid as bad_id
    from jsonb_array_elements(coalesce(p_payload -> 'partnershipChanges', '[]'::jsonb))
      with ordinality e (value, ord)
    where e.value ->> 'citizenAId' is not null
      and not exists (
        select 1 from public.citizens c
        where c.id = (e.value ->> 'citizenAId')::uuid and c.world_id = p_world_id
      )
    union all
    select e.ord, 2, (e.value ->> 'citizenBId')::uuid
    from jsonb_array_elements(coalesce(p_payload -> 'partnershipChanges', '[]'::jsonb))
      with ordinality e (value, ord)
    where e.value ->> 'citizenBId' is not null
      and not exists (
        select 1 from public.citizens c
        where c.id = (e.value ->> 'citizenBId')::uuid and c.world_id = p_world_id
      )
  ) q
  order by q.ord, q.rk
  limit 1;

  if v_check_id is not null then
    raise exception 'cross-world id % in partnershipChanges', v_check_id using errcode = 'P0001';
  end if;

  -- assignmentClears
  select (e.value ->> 'citizenId')::uuid into v_check_id
  from jsonb_array_elements(coalesce(p_payload -> 'assignmentClears', '[]'::jsonb))
    with ordinality e (value, ord)
  where e.value ->> 'citizenId' is not null
    and not exists (
      select 1 from public.citizens c
      where c.id = (e.value ->> 'citizenId')::uuid and c.world_id = p_world_id
    )
  order by e.ord
  limit 1;

  if v_check_id is not null then
    raise exception 'cross-world id % in assignmentClears', v_check_id using errcode = 'P0001';
  end if;

  -- §1083: nationStockpileDeltas / nationTurnSnapshots.
  select q.bad_id into v_check_id
  from (
    select e.ord, 1 as rk, (e.value ->> 'nationId')::uuid as bad_id
    from jsonb_array_elements(coalesce(p_payload -> 'nationStockpileDeltas', '[]'::jsonb))
      with ordinality e (value, ord)
    where e.value ->> 'nationId' is not null
      and not exists (
        select 1 from public.nations n
        where n.id = (e.value ->> 'nationId')::uuid and n.world_id = p_world_id
      )
    union all
    select e.ord, 2, (e.value ->> 'resourceId')::uuid
    from jsonb_array_elements(coalesce(p_payload -> 'nationStockpileDeltas', '[]'::jsonb))
      with ordinality e (value, ord)
    where e.value ->> 'resourceId' is not null
      and not exists (
        select 1 from public.resources r
        where r.id = (e.value ->> 'resourceId')::uuid and r.world_id = p_world_id
      )
  ) q
  order by q.ord, q.rk
  limit 1;

  if v_check_id is not null then
    raise exception 'cross-world id % in nationStockpileDeltas', v_check_id using errcode = 'P0001';
  end if;

  select (e.value ->> 'nationId')::uuid into v_check_id
  from jsonb_array_elements(coalesce(p_payload -> 'nationTurnSnapshots', '[]'::jsonb))
    with ordinality e (value, ord)
  where e.value ->> 'nationId' is not null
    and not exists (
      select 1 from public.nations n
      where n.id = (e.value ->> 'nationId')::uuid and n.world_id = p_world_id
    )
  order by e.ord
  limit 1;

  if v_check_id is not null then
    raise exception 'cross-world id % in nationTurnSnapshots', v_check_id using errcode = 'P0001';
  end if;

  -- §1090: treatyStatusChanges.
  select (e.value ->> 'treatyId')::uuid into v_check_id
  from jsonb_array_elements(coalesce(p_payload -> 'treatyStatusChanges', '[]'::jsonb))
    with ordinality e (value, ord)
  where e.value ->> 'treatyId' is not null
    and not exists (
      select 1 from public.nation_treaties nt
      where nt.id = (e.value ->> 'treatyId')::uuid and nt.world_id = p_world_id
    )
  order by e.ord
  limit 1;

  if v_check_id is not null then
    raise exception 'cross-world id % in treatyStatusChanges', v_check_id using errcode = 'P0001';
  end if;

  -- §1094: nationCurrencySnapshots / nationCurrencyUpdates.
  select q.bad_id into v_check_id
  from (
    select e.ord, 1 as rk, (e.value ->> 'nationId')::uuid as bad_id
    from jsonb_array_elements(coalesce(p_payload -> 'nationCurrencySnapshots', '[]'::jsonb))
      with ordinality e (value, ord)
    where e.value ->> 'nationId' is not null
      and not exists (
        select 1 from public.nations n
        where n.id = (e.value ->> 'nationId')::uuid and n.world_id = p_world_id
      )
    union all
    select e.ord, 2, (e.value ->> 'currencyId')::uuid
    from jsonb_array_elements(coalesce(p_payload -> 'nationCurrencySnapshots', '[]'::jsonb))
      with ordinality e (value, ord)
    where e.value ->> 'currencyId' is not null
      and not exists (
        select 1 from public.nation_currencies nc
        where nc.id = (e.value ->> 'currencyId')::uuid and nc.world_id = p_world_id
      )
  ) q
  order by q.ord, q.rk
  limit 1;

  if v_check_id is not null then
    raise exception 'cross-world id % in nationCurrencySnapshots', v_check_id
      using errcode = 'P0001';
  end if;

  select (e.value ->> 'currencyId')::uuid into v_check_id
  from jsonb_array_elements(coalesce(p_payload -> 'nationCurrencyUpdates', '[]'::jsonb))
    with ordinality e (value, ord)
  where e.value ->> 'currencyId' is not null
    and not exists (
      select 1 from public.nation_currencies nc
      where nc.id = (e.value ->> 'currencyId')::uuid and nc.world_id = p_world_id
    )
  order by e.ord
  limit 1;

  if v_check_id is not null then
    raise exception 'cross-world id % in nationCurrencyUpdates', v_check_id using errcode = 'P0001';
  end if;

  -- #1104: citizenEducationPatches / enrollmentProgressUpdates / enrollmentGraduations.
  select q.bad_id into v_check_id
  from (
    select e.ord, 1 as rk, (e.value ->> 'citizenId')::uuid as bad_id
    from jsonb_array_elements(coalesce(p_payload -> 'citizenEducationPatches', '[]'::jsonb))
      with ordinality e (value, ord)
    where e.value ->> 'citizenId' is not null
      and not exists (
        select 1 from public.citizens c
        where c.id = (e.value ->> 'citizenId')::uuid and c.world_id = p_world_id
      )
    union all
    select e.ord, 2, (e.value ->> 'educationLevelId')::uuid
    from jsonb_array_elements(coalesce(p_payload -> 'citizenEducationPatches', '[]'::jsonb))
      with ordinality e (value, ord)
    where e.value ->> 'educationLevelId' is not null
      and not exists (
        select 1 from public.education_levels el
        where el.id = (e.value ->> 'educationLevelId')::uuid and el.world_id = p_world_id
      )
  ) q
  order by q.ord, q.rk
  limit 1;

  if v_check_id is not null then
    raise exception 'cross-world id % in citizenEducationPatches', v_check_id
      using errcode = 'P0001';
  end if;

  select q.bad_id into v_check_id
  from (
    select e.ord, 1 as rk, (e.value ->> 'enrollmentId')::uuid as bad_id
    from jsonb_array_elements(coalesce(p_payload -> 'enrollmentProgressUpdates', '[]'::jsonb))
      with ordinality e (value, ord)
    where e.value ->> 'enrollmentId' is not null
      and not exists (
        select 1 from public.education_enrollments ee
        where ee.id = (e.value ->> 'enrollmentId')::uuid and ee.world_id = p_world_id
      )
    union all
    select e.ord, 2, (e.value ->> 'targetLevelId')::uuid
    from jsonb_array_elements(coalesce(p_payload -> 'enrollmentProgressUpdates', '[]'::jsonb))
      with ordinality e (value, ord)
    where e.value ->> 'targetLevelId' is not null
      and not exists (
        select 1 from public.education_levels el
        where el.id = (e.value ->> 'targetLevelId')::uuid and el.world_id = p_world_id
      )
  ) q
  order by q.ord, q.rk
  limit 1;

  if v_check_id is not null then
    raise exception 'cross-world id % in enrollmentProgressUpdates', v_check_id
      using errcode = 'P0001';
  end if;

  select (e.value ->> 'enrollmentId')::uuid into v_check_id
  from jsonb_array_elements(coalesce(p_payload -> 'enrollmentGraduations', '[]'::jsonb))
    with ordinality e (value, ord)
  where e.value ->> 'enrollmentId' is not null
    and not exists (
      select 1 from public.education_enrollments ee
      where ee.id = (e.value ->> 'enrollmentId')::uuid and ee.world_id = p_world_id
    )
  order by e.ord
  limit 1;

  if v_check_id is not null then
    raise exception 'cross-world id % in enrollmentGraduations', v_check_id using errcode = 'P0001';
  end if;

  -- #1110: armyTurnSnapshots / desertedSoldiers / disbandedUnits.
  select (e.value ->> 'armyId')::uuid into v_check_id
  from jsonb_array_elements(coalesce(p_payload -> 'armyTurnSnapshots', '[]'::jsonb))
    with ordinality e (value, ord)
  where e.value ->> 'armyId' is not null
    and not exists (
      select 1 from public.armies a
      where a.id = (e.value ->> 'armyId')::uuid and a.world_id = p_world_id
    )
  order by e.ord
  limit 1;

  if v_check_id is not null then
    raise exception 'cross-world id % in armyTurnSnapshots', v_check_id using errcode = 'P0001';
  end if;

  select q.bad_id into v_check_id
  from (
    select e.ord, 1 as rk, (e.value ->> 'citizenId')::uuid as bad_id
    from jsonb_array_elements(coalesce(p_payload -> 'desertedSoldiers', '[]'::jsonb))
      with ordinality e (value, ord)
    where e.value ->> 'citizenId' is not null
      and not exists (
        select 1 from public.citizens c
        where c.id = (e.value ->> 'citizenId')::uuid and c.world_id = p_world_id
      )
    union all
    select e.ord, 2, (e.value ->> 'newSettlementId')::uuid
    from jsonb_array_elements(coalesce(p_payload -> 'desertedSoldiers', '[]'::jsonb))
      with ordinality e (value, ord)
    where e.value ->> 'newSettlementId' is not null
      and not exists (
        select 1 from public.settlements s
        join public.nations n on n.id = s.nation_id
        where s.id = (e.value ->> 'newSettlementId')::uuid and n.world_id = p_world_id
      )
    union all
    select e.ord, 3, (e.value ->> 'soldierId')::uuid
    from jsonb_array_elements(coalesce(p_payload -> 'desertedSoldiers', '[]'::jsonb))
      with ordinality e (value, ord)
    where e.value ->> 'soldierId' is not null
      and not exists (
        select 1 from public.unit_soldiers us
        where us.id = (e.value ->> 'soldierId')::uuid and us.world_id = p_world_id
      )
    union all
    select e.ord, 4, (e.value ->> 'unitId')::uuid
    from jsonb_array_elements(coalesce(p_payload -> 'desertedSoldiers', '[]'::jsonb))
      with ordinality e (value, ord)
    where e.value ->> 'unitId' is not null
      and not exists (
        select 1 from public.army_units au
        join public.armies a on a.id = au.army_id
        where au.id = (e.value ->> 'unitId')::uuid and a.world_id = p_world_id
      )
  ) q
  order by q.ord, q.rk
  limit 1;

  if v_check_id is not null then
    raise exception 'cross-world id % in desertedSoldiers', v_check_id using errcode = 'P0001';
  end if;

  select q.bad_id into v_check_id
  from (
    select e.ord, 1 as rk, (e.value ->> 'armyId')::uuid as bad_id
    from jsonb_array_elements(coalesce(p_payload -> 'disbandedUnits', '[]'::jsonb))
      with ordinality e (value, ord)
    where e.value ->> 'armyId' is not null
      and not exists (
        select 1 from public.armies a
        where a.id = (e.value ->> 'armyId')::uuid and a.world_id = p_world_id
      )
    union all
    select e.ord, 2, (e.value ->> 'unitId')::uuid
    from jsonb_array_elements(coalesce(p_payload -> 'disbandedUnits', '[]'::jsonb))
      with ordinality e (value, ord)
    where e.value ->> 'unitId' is not null
      and not exists (
        select 1 from public.army_units au
        join public.armies a on a.id = au.army_id
        where au.id = (e.value ->> 'unitId')::uuid and a.world_id = p_world_id
      )
  ) q
  order by q.ord, q.rk
  limit 1;

  if v_check_id is not null then
    raise exception 'cross-world id % in disbandedUnits', v_check_id using errcode = 'P0001';
  end if;

  -- #1111: deceasedSoldierIds (a plain array of ids). Null entries are skipped,
  -- matching the old `not (null = any(...))` null-valued condition.
  select e.value::uuid into v_check_id
  from jsonb_array_elements_text(coalesce(p_payload -> 'deceasedSoldierIds', '[]'::jsonb))
    with ordinality e (value, ord)
  where e.value is not null
    and not exists (
      select 1 from public.unit_soldiers us
      where us.id = e.value::uuid and us.world_id = p_world_id
    )
  order by e.ord
  limit 1;

  if v_check_id is not null then
    raise exception 'cross-world id % in deceasedSoldierIds', v_check_id using errcode = 'P0001';
  end if;

  -- §H9: stockpile quantityBefore re-validation (issue #506).
  select
    d.settlement_id,
    d.resource_id,
    srs.quantity,
    d.quantity_before
  into
    v_settlement_id,
    v_resource_id,
    v_actual_quantity,
    v_quantity_before
  from (
    select
      (e.value ->> 'settlementId')::uuid as settlement_id,
      (e.value ->> 'resourceId')::uuid as resource_id,
      coalesce((e.value ->> 'quantityBefore')::numeric, 0)::numeric(18, 4) as quantity_before,
      e.ord
    from jsonb_array_elements(coalesce(p_payload -> 'stockpileDeltas', '[]'::jsonb))
      with ordinality e (value, ord)
  ) d
  join public.settlement_resource_stockpiles srs
    on srs.settlement_id = d.settlement_id
    and srs.resource_id = d.resource_id
  where srs.quantity <> d.quantity_before
  order by d.ord
  limit 1;

  if found then
    raise exception 'state diverged: stockpile (%,%) was % but payload claimed %',
      v_settlement_id, v_resource_id, v_actual_quantity, v_quantity_before
      using errcode = 'P0001', hint = 'state_drifted';
  end if;

  -- §H10a: deposit resource remainingQuantityBefore re-validation (issue #670).
  -- Only deltas that explicitly carry the before-value opt in to drift detection.
  select
    d.deposit_instance_id,
    d.resource_id,
    dir.remaining_quantity,
    d.remaining_quantity_before
  into
    v_deposit_instance_id,
    v_resource_id,
    v_actual_remaining_quantity,
    v_remaining_quantity_before
  from (
    select
      (u.value ->> 'depositInstanceId')::uuid as deposit_instance_id,
      (rd.value ->> 'resourceId')::uuid as resource_id,
      (rd.value ->> 'remainingQuantityBefore')::numeric(18, 4) as remaining_quantity_before,
      u.ord as outer_ord,
      rd.ord as inner_ord
    from jsonb_array_elements(coalesce(p_payload -> 'depositUpdates', '[]'::jsonb))
      with ordinality u (value, ord)
    cross join lateral jsonb_array_elements(coalesce(u.value -> 'resourceDeltas', '[]'::jsonb))
      with ordinality rd (value, ord)
    where rd.value ? 'remainingQuantityBefore'
  ) d
  join public.deposit_instance_resources dir
    on dir.deposit_instance_id = d.deposit_instance_id
    and dir.resource_id = d.resource_id
  where dir.remaining_quantity <> d.remaining_quantity_before
  order by d.outer_ord, d.inner_ord
  limit 1;

  if found then
    raise exception 'state diverged: deposit resource (%,%) was % but payload claimed %',
      v_deposit_instance_id, v_resource_id, v_actual_remaining_quantity,
      v_remaining_quantity_before
      using errcode = 'P0001', hint = 'state_drifted';
  end if;

  -- §H10b: managed-population currentCountBefore re-validation (issue #670).
  select
    u.managed_population_instance_id,
    mpi.current_count,
    u.current_count_before
  into
    v_managed_pop_instance_id,
    v_actual_current_count,
    v_current_count_before
  from (
    select
      (e.value ->> 'managedPopulationInstanceId')::uuid as managed_population_instance_id,
      (e.value ->> 'currentCountBefore')::numeric(18, 4) as current_count_before,
      e.ord
    from jsonb_array_elements(coalesce(p_payload -> 'managedPopulationUpdates', '[]'::jsonb))
      with ordinality e (value, ord)
    where e.value ? 'currentCountBefore'
  ) u
  join public.managed_population_instances mpi on mpi.id = u.managed_population_instance_id
  where mpi.current_count <> u.current_count_before
  order by u.ord
  limit 1;

  if found then
    raise exception 'state diverged: managed-population % was % but payload claimed %',
      v_managed_pop_instance_id, v_actual_current_count, v_current_count_before
      using errcode = 'P0001', hint = 'state_drifted';
  end if;
end;
$$;

revoke all on function public.internal_apply_turn_transition_validate_payload (uuid, jsonb)
from
  public;

revoke
execute on function public.internal_apply_turn_transition_validate_payload (uuid, jsonb)
from
  anon,
  authenticated;

grant
execute on function public.internal_apply_turn_transition_validate_payload (uuid, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Orchestrator: identical to the previous definition except that the inline
-- cross-world guard loops, the v_valid_* id arrays they scanned, and the §H9/
-- §H10a/§H10b drift loops are replaced by one call to the set-based helper above.
-- ---------------------------------------------------------------------------
create or replace function public.apply_turn_transition (
  p_world_id uuid,
  p_expected_turn_number integer,
  p_payload jsonb,
  p_transition_id uuid,
  p_forecast_snapshot_jsonb jsonb default null
) returns jsonb language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_status text;
  v_world_turn integer;
  v_transition public.turn_transitions%rowtype;
  v_result jsonb;
  -- phase result counts (populated by internal helpers)
  v_stockpile_delta_count integer := 0;
  v_construction_update_count integer := 0;
  v_buildings_created_count integer := 0;
  v_building_state_change_count integer := 0;
  v_deposit_update_count integer := 0;
  v_managed_pop_update_count integer := 0;
  v_trade_route_outcome_count integer := 0;
  v_backfill_count integer := 0;
  v_citizen_birth_count integer := 0;
  v_citizen_death_count integer := 0;
  v_partnership_change_count integer := 0;
  v_assignment_clear_count integer := 0;
  v_overshoot_stamp_count integer := 0;
  v_event_status_update_count integer := 0;
  v_citizen_memory_count integer := 0;
  v_log_entry_count integer := 0;
  v_notification_count integer := 0;
  v_settlement_snapshot_count integer := 0;
  v_readiness_reset_count integer := 0;
  v_nation_readiness_reset_count integer := 0;
  v_nation_readiness_votes_cleared_count integer := 0;
  v_nation_stockpile_delta_count integer := 0;
  v_nation_turn_snapshot_count integer := 0;
  v_treaty_status_change_count integer := 0;
  v_nation_currency_snapshot_count integer := 0;
  v_nation_currency_update_count integer := 0;
  v_nation_currency_notification_count integer := 0;
  v_citizen_education_patch_count integer := 0;
  v_enrollment_progress_update_count integer := 0;
  v_enrollment_graduation_count integer := 0;
  v_army_turn_snapshot_count integer := 0;
  v_deserted_soldier_count integer := 0;
  v_disbanded_unit_count integer := 0;
  v_deceased_soldier_count integer := 0;
  v_amendment_expired_count integer := 0;
  v_amendment_expiry_notification_count integer := 0;
  v_office_term_expired_count integer := 0;
  v_office_term_expiry_notification_count integer := 0;
begin
  -- Non-null param validation
  if p_world_id is null then
    raise exception 'p_world_id must not be null' using errcode = 'P0001';
  end if;

  if p_expected_turn_number is null then
    raise exception 'p_expected_turn_number must not be null' using errcode = 'P0001';
  end if;

  if p_payload is null then
    raise exception 'p_payload must not be null' using errcode = 'P0001';
  end if;

  if p_transition_id is null then
    raise exception 'p_transition_id must not be null' using errcode = 'P0001';
  end if;

  -- Lock the world row so concurrent callers queue behind this transaction
  select
    w.status,
    w.current_turn_number into v_world_status,
    v_world_turn
  from
    public.worlds w
  where
    w.id = p_world_id
  for update;

  if v_world_status = 'archived' then
    raise exception 'world is archived and cannot be advanced'
      using errcode = 'P0001', hint = 'world_archived';
  end if;

  if v_world_turn is null or v_world_turn <> p_expected_turn_number then
    raise exception 'stale expected turn number'
      using errcode = 'P0001', hint = 'stale_expected_turn';
  end if;

  -- Look up the pre-created running transition by id.
  select
    tt.* into v_transition
  from
    public.turn_transitions tt
  where
    tt.id = p_transition_id;

  if not found or v_transition.world_id <> p_world_id then
    raise exception 'transition % not found for world %', p_transition_id, p_world_id
      using errcode = 'P0001';
  end if;

  if v_transition.status <> 'running' then
    raise exception 'transition % is not in running status (current: %)', p_transition_id, v_transition.status
      using errcode = 'P0001';
  end if;

  -- §C36/§H9/§H10: cross-world payload guards and drift re-validation, applied
  -- set-wise (issue #1272). Runs before the failure-capture block so validation
  -- failures leave the transition in 'running' status for retry.
  perform public.internal_apply_turn_transition_validate_payload (p_world_id, p_payload);

  -- Outer failure-capture block: any unhandled exception inside marks the transition
  -- failed so callers can distinguish a partial run from success.
  begin
    -- §C28
    v_stockpile_delta_count := public.internal_apply_turn_transition_stockpile_deltas (
      v_transition.id, p_world_id, p_expected_turn_number, p_payload
    );

    -- §C29
    select
      construction_update_count,
      buildings_created_count,
      building_state_change_count
    into
      v_construction_update_count,
      v_buildings_created_count,
      v_building_state_change_count
    from public.internal_apply_turn_transition_construction_patches (
      v_transition.id, v_transition.to_turn_number, p_payload
    );

    -- §C30
    select
      deposit_update_count,
      managed_pop_update_count
    into
      v_deposit_update_count,
      v_managed_pop_update_count
    from public.internal_apply_turn_transition_deposit_managed_pop_patches (p_payload);

    -- §C31
    v_trade_route_outcome_count := public.internal_apply_turn_transition_trade_route_patches (p_payload);

    -- §C32
    select
      backfill_count,
      citizen_birth_count,
      citizen_death_count,
      partnership_change_count,
      assignment_clear_count,
      overshoot_stamp_count
    into
      v_backfill_count,
      v_citizen_birth_count,
      v_citizen_death_count,
      v_partnership_change_count,
      v_assignment_clear_count,
      v_overshoot_stamp_count
    from public.internal_apply_turn_transition_citizen_partnership_patches (
      p_world_id, v_transition.id, p_payload
    );

    -- §C32.5 event status patches + citizen memories
    select event_status_update_count, citizen_memory_count
    into v_event_status_update_count, v_citizen_memory_count
    from public.internal_apply_turn_transition_event_patches(
      p_world_id, v_transition.id, v_transition.to_turn_number, p_payload
    );

    -- §C33
    select
      log_entry_count,
      notification_count
    into
      v_log_entry_count,
      v_notification_count
    from public.internal_apply_turn_transition_log_entries_and_notifications (
      v_transition.id, p_world_id, p_payload
    );

    -- §C34
    v_settlement_snapshot_count := public.internal_apply_turn_transition_settlement_snapshots (
      v_transition.id, p_world_id, p_payload
    );

    -- §C37: nation economy — credit/debit nation_resource_stockpiles (tax
    -- collection and treaty tribute alike), persist nation_turn_snapshots
    -- (issues #1083, #1090).
    select
      nation_stockpile_delta_count,
      nation_turn_snapshot_count
    into
      v_nation_stockpile_delta_count,
      v_nation_turn_snapshot_count
    from public.internal_apply_turn_transition_nation_economy (
      v_transition.id, p_world_id, p_expected_turn_number, p_payload
    );

    -- §C38: nation currency — persist nation_currency_snapshots, update
    -- nation_currencies.confidence, and insert currency.default /
    -- currency.confidence_collapsing notifications (issue #1094).
    select
      nation_currency_snapshot_count,
      nation_currency_update_count,
      nation_currency_notification_count
    into
      v_nation_currency_snapshot_count,
      v_nation_currency_update_count,
      v_nation_currency_notification_count
    from public.internal_apply_turn_transition_nation_currency (
      v_transition.id, p_world_id, p_expected_turn_number, p_payload
    );

    -- §1090: treaty status changes — flip expired treaties.
    v_treaty_status_change_count := public.internal_apply_turn_transition_treaty_patches (p_payload);

    -- #1104: education — citizen education-level patches, enrollment
    -- progress updates, and enrollment graduations.
    select
      citizen_education_patch_count,
      enrollment_progress_update_count,
      enrollment_graduation_count
    into
      v_citizen_education_patch_count,
      v_enrollment_progress_update_count,
      v_enrollment_graduation_count
    from public.internal_apply_turn_transition_education_patches (p_payload);

    -- #1110/#1111: military upkeep — army_turn_snapshots, deserted-soldier
    -- civilian-return + unit_soldiers cleanup, deceased-soldier cleanup, and
    -- unit disband.
    select
      army_turn_snapshot_count,
      deserted_soldier_count,
      disbanded_unit_count,
      deceased_soldier_count
    into
      v_army_turn_snapshot_count,
      v_deserted_soldier_count,
      v_disbanded_unit_count,
      v_deceased_soldier_count
    from public.internal_apply_turn_transition_military_upkeep (
      p_world_id, v_transition.to_turn_number, p_payload
    );

    -- #1119: law amendments — expire any 'proposed' amendment whose deadline
    -- has been reached by the new turn.
    select
      amendment_expired_count,
      amendment_notification_count
    into
      v_amendment_expired_count,
      v_amendment_expiry_notification_count
    from public.internal_apply_turn_transition_law_amendment_expiry (
      v_transition.id, p_world_id, v_transition.to_turn_number
    );

    -- #1123: office terms — archive any active office whose fixed term has
    -- expired by the new turn.
    select
      office_term_expired_count,
      office_term_expiry_notification_count
    into
      v_office_term_expired_count,
      v_office_term_expiry_notification_count
    from public.internal_apply_turn_transition_office_term_expiry (
      v_transition.id, p_world_id, v_transition.to_turn_number
    );

    -- §C35 / §1076: advance world turn, reset settlement readiness, clear
    -- nation readiness votes and computed readiness for the departing turn.
    select
      settlement_readiness_reset_count,
      nation_readiness_reset_count,
      nation_readiness_votes_cleared_count
    into
      v_readiness_reset_count,
      v_nation_readiness_reset_count,
      v_nation_readiness_votes_cleared_count
    from public.internal_apply_turn_transition_advance_world_turn (
      p_world_id, p_expected_turn_number
    );

    update public.turn_transitions
    set
      status                  = 'completed',
      finished_at             = now (),
      readiness_summary_jsonb = p_payload -> 'readinessSummary',
      forecast_snapshot_jsonb = p_forecast_snapshot_jsonb
    where
      public.turn_transitions.id = v_transition.id
    returning
      * into v_transition;

    v_result := jsonb_build_object (
      'transitionId',      v_transition.id,
      'fromTurnNumber',    v_transition.from_turn_number,
      'toTurnNumber',      v_transition.to_turn_number,
      'currentTurnNumber', p_expected_turn_number + 1,
      'patchCounts',
      jsonb_build_object (
        'stockpileDeltas',            v_stockpile_delta_count,
        'constructionUpdates',        v_construction_update_count,
        'buildingsCreated',           v_buildings_created_count,
        'buildingStateChanges',       v_building_state_change_count,
        'depositUpdates',             v_deposit_update_count,
        'managedPopulationUpdates',   v_managed_pop_update_count,
        'tradeRouteOutcomes',         v_trade_route_outcome_count,
        'bornOnTurnBackfill',         v_backfill_count,
        'citizenBirths',              v_citizen_birth_count,
        'citizenDeaths',              v_citizen_death_count,
        'partnershipChanges',         v_partnership_change_count,
        'assignmentClears',           v_assignment_clear_count,
        'overshootStamped',           v_overshoot_stamp_count,
        'eventStatusUpdates',         v_event_status_update_count,
        'citizenMemories',            v_citizen_memory_count,
        'logEntries',                 v_log_entry_count,
        'notifications',              v_notification_count,
        'settlementSnapshots',        v_settlement_snapshot_count,
        'readinessReset',             v_readiness_reset_count,
        'nationReadinessReset',       v_nation_readiness_reset_count,
        'nationReadinessVotesCleared', v_nation_readiness_votes_cleared_count,
        'nationStockpileDeltas',      v_nation_stockpile_delta_count,
        'nationTurnSnapshots',        v_nation_turn_snapshot_count,
        'treatyStatusChanges',        v_treaty_status_change_count,
        'nationCurrencySnapshots',    v_nation_currency_snapshot_count,
        'nationCurrencyUpdates',      v_nation_currency_update_count,
        'nationCurrencyNotifications', v_nation_currency_notification_count,
        'citizenEducationPatches',    v_citizen_education_patch_count,
        'enrollmentProgressUpdates',  v_enrollment_progress_update_count,
        'enrollmentGraduations',      v_enrollment_graduation_count,
        'armyTurnSnapshots',          v_army_turn_snapshot_count,
        'desertedSoldiers',           v_deserted_soldier_count,
        'disbandedUnits',             v_disbanded_unit_count,
        'deceasedSoldierIds',         v_deceased_soldier_count,
        'lawAmendmentsExpired',       v_amendment_expired_count,
        'lawAmendmentExpiryNotifications', v_amendment_expiry_notification_count,
        'officeTermsExpired',         v_office_term_expired_count,
        'officeTermExpiryNotifications', v_office_term_expiry_notification_count
      )
    );
  exception
    when others then
      update public.turn_transitions
      set
        status = 'failed'
      where
        public.turn_transitions.id = v_transition.id
        and public.turn_transitions.status = 'running';

      raise;
  end;

  return v_result;
end;
$$;

revoke all on function public.apply_turn_transition (uuid, integer, jsonb, uuid, jsonb)
from
  public;

revoke
execute on function public.apply_turn_transition (uuid, integer, jsonb, uuid, jsonb)
from
  anon,
  authenticated;

grant
execute on function public.apply_turn_transition (uuid, integer, jsonb, uuid, jsonb) to service_role;
