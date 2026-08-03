-- Reject gameplay writes while a world has a running turn transition.
--
-- Why a trigger and not RLS: all gameplay RPCs are `security definer` and
-- therefore bypass RLS entirely, so an RLS-policy guard would protect nothing
-- on the paths that matter. Triggers fire regardless of security definer, RLS,
-- or which client issued the statement.
--
-- The turn itself writes these same tables, so apply_turn_transition and the
-- superadmin recovery path fail_stuck_turn_transition carry a function-local
-- escape hatch that this trigger honours.
-- Index the running-transition lookup so the per-row check is an index probe.
create index if not exists turn_transitions_running_world_idx on public.turn_transitions (world_id)
where
  status = 'running';

create or replace function public.internal_reject_write_during_transition () returns trigger language plpgsql security definer
set
  search_path = '' as $$
declare
  v_affected record;
  v_key uuid;
  v_world_id uuid;
begin
  v_affected := case when tg_op = 'DELETE' then old else new end;

  -- The turn's own writes, and the superadmin recovery path.
  if coalesce(current_setting('app.applying_turn', true), '') = 'on' then
    return v_affected;
  end if;

  -- tg_argv[0] is the column holding the id to resolve from; tg_argv[1] is a
  -- one-parameter query returning that row's world id. Both come from
  -- internal_turn_guard_classification().
  v_key := (to_jsonb(v_affected) ->> tg_argv[0])::uuid;

  -- A null key cannot be attributed to a world. Let it through rather than
  -- guessing: every guarded table's key column is non-null in practice, and a
  -- false rejection here would be a much worse failure than a rare miss.
  if v_key is null then
    return v_affected;
  end if;

  execute tg_argv[1] into v_world_id using v_key;

  if v_world_id is null then
    return v_affected;
  end if;

  if exists (
    select 1
    from public.turn_transitions tt
    where tt.world_id = v_world_id
      and tt.status = 'running'
  ) then
    raise exception 'world turn in progress'
      using errcode = 'P0001', hint = 'world_turn_in_progress';
  end if;

  return v_affected;
end;
$$;

comment on function public.internal_reject_write_during_transition () is 'Trigger guard: rejects writes to world-scoped gameplay tables while that world has a running turn transition. Honours the transaction-local app.applying_turn escape hatch. Attached from internal_turn_guard_classification().';

-- Called only by the engine when a trigger fires; never over PostgREST.
revoke all on function public.internal_reject_write_during_transition ()
from
  public,
  anon,
  authenticated;

-- Attach the trigger to every guarded table.
do $$
declare
  v_row record;
begin
  for v_row in
    select table_name, key_column, resolver_sql
    from public.internal_turn_guard_classification()
    where bucket = 'guarded'
    order by table_name
  loop
    execute format(
      'drop trigger if exists reject_write_during_transition on public.%I',
      v_row.table_name
    );
    execute format(
      'create trigger reject_write_during_transition
         before insert or update or delete on public.%I
         for each row execute function public.internal_reject_write_during_transition(%L, %L)',
      v_row.table_name, v_row.key_column, v_row.resolver_sql
    );
  end loop;
end;
$$;

-- Escape hatch for the turn's own write path and the superadmin recovery path.
--
-- Both functions are redefined verbatim from their current definitions with a
-- single added first statement. The third argument to set_config makes the flag
-- transaction-local; a session-local flag would leak across a pooled connection.
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
  -- Transaction-local: the turn writes the same tables the guard protects.
  perform set_config ('app.applying_turn', 'on', true);

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

create or replace function public.fail_stuck_turn_transition (
  p_world_id uuid,
  p_transition_id uuid,
  p_reason text default null
) returns jsonb language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_status  text;
  v_world_turn    integer;
  v_transition    public.turn_transitions%rowtype;
  v_result        jsonb;
begin
  -- Transaction-local: the turn writes the same tables the guard protects.
  perform set_config ('app.applying_turn', 'on', true);

  -- Non-null param validation
  if p_world_id is null then
    raise exception 'p_world_id must not be null' using errcode = 'P0001';
  end if;

  if p_transition_id is null then
    raise exception 'p_transition_id must not be null' using errcode = 'P0001';
  end if;

  -- Auth: only superadmins may recover stuck transitions through the UI path.
  -- The service_role path (edge function) bypasses this check.
  if current_setting ('request.jwt.claims', true) is not null
     and current_setting ('request.jwt.claims', true) <> ''
  then
    if not public.is_super_admin () then
      raise exception 'insufficient privilege' using errcode = '42501';
    end if;
  end if;

  -- Lock the world row so concurrent callers queue behind this transaction
  select w.status, w.current_turn_number
  into v_world_status, v_world_turn
  from public.worlds w
  where w.id = p_world_id
  for update;

  if v_world_status = 'archived' then
    raise exception 'world is archived and cannot be modified' using errcode = 'P0001';
  end if;

  -- Look up the transition
  select tt.*
  into v_transition
  from public.turn_transitions tt
  where tt.id = p_transition_id;

  if not found or v_transition.world_id <> p_world_id then
    raise exception 'transition % not found for world %', p_transition_id, p_world_id
      using errcode = 'P0001';
  end if;

  if v_transition.status <> 'running' then
    raise exception 'transition % is not in running status (current: %)', p_transition_id, v_transition.status
      using errcode = 'P0001';
  end if;

  -- Safety check: world turn must not have advanced past the transition's from_turn_number.
  if v_world_turn is not null and v_world_turn > v_transition.from_turn_number then
    raise exception 'world turn has advanced past transition from_turn_number; transition is stale'
      using errcode = 'P0001';
  end if;

  -- Mark the transition as failed; record recovery reason if provided.
  update public.turn_transitions
  set
    status    = 'failed',
    finished_at = now (),
    readiness_summary_jsonb = coalesce (readiness_summary_jsonb, '{}'::jsonb)
      || jsonb_strip_nulls (jsonb_build_object (
           'recovery_reason', p_reason,
           'recovered_at',    now ()
         ))
  where public.turn_transitions.id = v_transition.id
  returning * into v_transition;

  v_result := jsonb_build_object (
    'transitionId',    v_transition.id,
    'fromTurnNumber',  v_transition.from_turn_number,
    'toTurnNumber',    v_transition.to_turn_number,
    'status',          v_transition.status,
    'markedFailedAt',  v_transition.finished_at,
    'worldId',         v_transition.world_id
  );

  return v_result;
end;
$$;
