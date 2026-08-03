-- Migration: succession_role_clear_and_notification
-- Issue #1078: succession events when a ruler dies.
--
-- 1. internal_apply_turn_transition_citizen_partnership_patches: a dead
--    citizen keeps role_type/role_nation_id/role_settlement_id forever today
--    (nothing clears them on death), so a dead nation_manager or
--    settlement_manager silently keeps "holding" their role. The death loop
--    now also clears the role back to 'none' so the nation/settlement is
--    correctly manager-vacant after the transition (feeds
--    nation_readiness_eligible_voter_ids, which already queries citizens
--    live, so ruler_only readiness naturally shows zero eligible voters —
--    no separate readiness-table update needed). Body copied verbatim from
--    the latest definition (20260627000000_npc_nameset_heredity.sql) except
--    for the added role-clear columns.
-- 2. internal_apply_turn_transition_log_entries_and_notifications: adds a
--    government.succession notification generator, reading the
--    government.succession log entries the simulation's phaseSuccession now
--    emits (citizen_id = dead ruler, nation_id = now-vacant nation, payload
--    carries governmentType/successionMode/candidateCitizenIds). Recipients:
--    settlement managers of the nation's settlements + nation manager
--    (vacant, so none match) + world admins + super admins. Unlike every
--    other generator in this function, severity is set explicitly to
--    'critical' (issue #1078 requires a "high-severity" notification) —
--    every other type here still relies on the notifications.severity
--    column default ('info') set once by a historical backfill migration
--    (20260725000000_add_notification_severity.sql) that never re-runs for
--    newly generated rows; that's a pre-existing gap, out of scope here.
--    Body copied verbatim from the latest definition
--    (20260825000000_interpolate_entity_names_in_all_notifications.sql) with
--    the new block appended before the closing `end;`.
-- ---------------------------------------------------------------------------
create or replace function public.internal_apply_turn_transition_citizen_partnership_patches (
  p_world_id uuid,
  p_transition_id uuid,
  p_payload jsonb,
  out backfill_count integer,
  out citizen_birth_count integer,
  out citizen_death_count integer,
  out partnership_change_count integer,
  out assignment_clear_count integer,
  out overshoot_stamp_count integer
) returns record language plpgsql security definer
set
  search_path = '' as $$
declare
  v_backfill jsonb;
  v_backfill_citizen_id uuid;
  v_backfill_born_on_turn_number integer;
  v_birth jsonb;
  v_birth_settlement_id uuid;
  v_birth_given_name text;
  v_birth_surname text;
  v_birth_sex text;
  v_birth_born_on_turn_number integer;
  v_birth_nameset_id uuid;
  v_parent_a_citizen_id uuid;
  v_parent_b_citizen_id uuid;
  v_npc_trait_1 text;
  v_npc_trait_2 text;
  v_npc_secret_contradiction text;
  v_npc_goal text;
  v_npc_flaw text;
  v_death jsonb;
  v_citizen_id uuid;
  v_citizen_type text;
  v_citizen_status text;
  v_death_cause_category public.death_cause_category;
  v_death_cause text;
  v_partnership_change jsonb;
  v_partner_a_id uuid;
  v_partner_b_id uuid;
  v_partnership_id uuid;
  v_partnership_to_status text;
  v_formed_on_turn_number integer;
  v_ended_on_turn_number integer;
  v_assignment_clear jsonb;
begin
  backfill_count           := 0;
  citizen_birth_count      := 0;
  citizen_death_count      := 0;
  partnership_change_count := 0;
  assignment_clear_count   := 0;
  overshoot_stamp_count    := 0;

  for v_backfill in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'bornOnTurnBackfill', '[]'::jsonb))
  loop
    v_backfill_citizen_id          := (v_backfill ->> 'citizenId')::uuid;
    v_backfill_born_on_turn_number := (v_backfill ->> 'bornOnTurnNumber')::integer;

    update public.citizens
    set
      born_on_turn_number = v_backfill_born_on_turn_number
    where
      id = v_backfill_citizen_id;

    backfill_count := backfill_count + 1;
  end loop;

  -- Birth payloads now carry givenName/surname. Keep name as a compatibility
  -- fallback for older focused pgTAP fixtures.
  for v_birth in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'citizenBirths', '[]'::jsonb))
  loop
    v_birth_settlement_id       := (v_birth ->> 'settlementId')::uuid;
    v_birth_given_name          := coalesce(v_birth ->> 'givenName', v_birth ->> 'name');
    v_birth_surname             := v_birth ->> 'surname';
    v_birth_sex                 := v_birth ->> 'sex';
    v_birth_born_on_turn_number := (v_birth ->> 'bornOnTurnNumber')::integer;
    v_parent_a_citizen_id       := (v_birth ->> 'parentACitizenId')::uuid;
    v_parent_b_citizen_id       := (v_birth ->> 'parentBCitizenId')::uuid;
    v_npc_trait_1               := v_birth ->> 'npcTrait1';
    v_npc_trait_2               := v_birth ->> 'npcTrait2';
    v_npc_secret_contradiction  := v_birth ->> 'npcSecretContradiction';
    v_npc_goal                  := v_birth ->> 'npcGoal';
    v_npc_flaw                  := v_birth ->> 'npcFlaw';
    v_birth_nameset_id          := (v_birth ->> 'namesetId')::uuid;

    perform public.create_citizen_internal (
      p_world_id,
      v_birth_settlement_id,
      'npc',
      v_birth_given_name,
      v_birth_surname,
      v_birth_sex,
      null,
      v_birth_born_on_turn_number,
      v_parent_a_citizen_id,
      v_parent_b_citizen_id,
      null,
      null,
      null,
      v_npc_trait_1,
      v_npc_trait_2,
      v_npc_secret_contradiction,
      v_npc_goal,
      v_npc_flaw,
      v_birth_nameset_id
    );

    citizen_birth_count := citizen_birth_count + 1;
  end loop;

  for v_death in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'citizenDeaths', '[]'::jsonb))
  loop
    v_citizen_id           := (v_death ->> 'citizenId')::uuid;
    v_death_cause_category := (v_death ->> 'deathCauseCategory')::public.death_cause_category;
    v_death_cause          := v_death ->> 'deathCause';

    select c.citizen_type
    into v_citizen_type
    from public.citizens c
    where c.id = v_citizen_id;

    if not found then
      raise exception 'citizen % not found', v_citizen_id using errcode = 'P0001';
    end if;

    if v_citizen_type = 'player_character' then
      raise exception 'simulation engine may not kill a player character (citizen %)', v_citizen_id
        using errcode = 'P0001';
    end if;

    -- Issue #1078: a dead citizen can no longer hold a manager role. Clearing
    -- it here (rather than leaving it to be resolved out-of-band) makes the
    -- nation/settlement manager-vacant the instant the transition applies,
    -- which is what nation_readiness_eligible_voter_ids and every recipient
    -- query in this module already assume ("status = 'alive'" is checked
    -- everywhere a role is used for authority or notification fan-out — the
    -- role itself lingering past death was the actual gap, not those checks).
    update public.citizens
    set
      status               = 'dead',
      death_cause_category = v_death_cause_category,
      death_cause          = v_death_cause,
      role_type            = 'none',
      role_nation_id       = null,
      role_settlement_id   = null
    where
      id = v_citizen_id;

    citizen_death_count := citizen_death_count + 1;
  end loop;

  for v_partnership_change in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'partnershipChanges', '[]'::jsonb))
  loop
    v_partner_a_id          := (v_partnership_change ->> 'citizenAId')::uuid;
    v_partner_b_id          := (v_partnership_change ->> 'citizenBId')::uuid;
    v_partnership_to_status := v_partnership_change ->> 'toStatus';
    v_formed_on_turn_number := (v_partnership_change ->> 'formedOnTurnNumber')::integer;
    v_ended_on_turn_number  := (v_partnership_change ->> 'endedOnTurnNumber')::integer;

    if v_partnership_to_status = 'active' then
      select c.status into v_citizen_status
      from public.citizens c
      where c.id = v_partner_a_id;

      if not found then
        raise exception 'citizen % not found', v_partner_a_id using errcode = 'P0001';
      end if;

      if v_citizen_status = 'dead' then
        raise exception 'simulation engine may not form a partnership with a dead citizen (citizen %)', v_partner_a_id
          using errcode = 'P0001';
      end if;

      select c.status into v_citizen_status
      from public.citizens c
      where c.id = v_partner_b_id;

      if not found then
        raise exception 'citizen % not found', v_partner_b_id using errcode = 'P0001';
      end if;

      if v_citizen_status = 'dead' then
        raise exception 'simulation engine may not form a partnership with a dead citizen (citizen %)', v_partner_b_id
          using errcode = 'P0001';
      end if;

      insert into public.partnerships (
        citizen_a_id,
        citizen_b_id,
        status,
        formed_on_turn_number
      )
      values (
        v_partner_a_id,
        v_partner_b_id,
        'active',
        v_formed_on_turn_number
      );
    else
      select p.id
      into v_partnership_id
      from public.partnerships p
      where (
        (p.citizen_a_id = v_partner_a_id and p.citizen_b_id = v_partner_b_id)
        or (p.citizen_a_id = v_partner_b_id and p.citizen_b_id = v_partner_a_id)
      )
      and p.status = 'active';

      if not found then
        raise exception 'active partnership between % and % not found', v_partner_a_id, v_partner_b_id
          using errcode = 'P0001';
      end if;

      update public.partnerships
      set
        status               = v_partnership_to_status,
        ended_on_turn_number = v_ended_on_turn_number
      where
        id = v_partnership_id;
    end if;

    partnership_change_count := partnership_change_count + 1;
  end loop;

  for v_assignment_clear in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'assignmentClears', '[]'::jsonb))
  loop
    v_citizen_id := (v_assignment_clear ->> 'citizenId')::uuid;

    delete from public.citizen_assignments
    where
      citizen_id = v_citizen_id;

    assignment_clear_count := assignment_clear_count + 1;
  end loop;

  update public.turn_log_entries
  set
    turn_transition_id = p_transition_id
  where
    world_id = p_world_id
    and log_category = 'manual_deconstruct_overshoot'
    and turn_transition_id is null;

  get diagnostics overshoot_stamp_count = row_count;
end;
$$;

revoke all on function public.internal_apply_turn_transition_citizen_partnership_patches (uuid, uuid, jsonb)
from
  public,
  anon,
  authenticated,
  service_role;

create or replace function public.internal_apply_turn_transition_log_entries_and_notifications (
  p_transition_id uuid,
  p_world_id uuid,
  p_payload jsonb,
  out log_entry_count integer,
  out notification_count integer
) returns record language plpgsql security definer
set
  search_path = '' as $$
declare
  v_rows                integer;
  v_current_from_turn   integer;
  v_prev_transition_id  uuid;
begin
  log_entry_count    := 0;
  notification_count := 0;

  -- §C33a: Bulk-insert simulation log entries.
  insert into public.turn_log_entries (
    turn_transition_id,
    world_id,
    settlement_id,
    nation_id,
    citizen_id,
    resource_id,
    log_category,
    payload_jsonb
  )
  select
    p_transition_id,
    p_world_id,
    (entry.value ->> 'settlementId')::uuid,
    (entry.value ->> 'nationId')::uuid,
    (entry.value ->> 'citizenId')::uuid,
    (entry.value ->> 'resourceId')::uuid,
    entry.value ->> 'category',
    coalesce(entry.value -> 'payload', '{}'::jsonb)
  from jsonb_array_elements(coalesce(p_payload -> 'logEntries', '[]'::jsonb)) as entry
  where entry.value ->> 'category' is not null;

  get diagnostics log_entry_count = row_count;

  -- §C33b: Generate notifications from log entries, per-type with optimized recipients.
  -- Settlement-scoped types: settlement managers + nation managers + world admins + super admins
  -- Nation-scoped types: nation managers + world admins + super admins

  -- §C33d: State-entry guard — find the immediately preceding turn's transition
  -- for this world so state conditions (building.suspended,
  -- managed_population.declining, settlement.starvation_occurred) only notify on
  -- entry into the state, not every turn it persists.
  --
  -- "Preceding transition" = the transition that advanced the world TO the turn
  -- we are now advancing FROM (to_turn_number = current from_turn_number).
  -- Using to_turn_number avoids a dependency on status, which the internal
  -- function never updates (status is updated by the outer apply_turn_transition).
  -- When v_prev_transition_id IS NULL (first-ever turn for this world), the NOT
  -- EXISTS subqueries find no rows → the guard passes → notification fires.
  select from_turn_number
  into v_current_from_turn
  from public.turn_transitions
  where id = p_transition_id;

  select id
  into v_prev_transition_id
  from public.turn_transitions
  where world_id = p_world_id
    and to_turn_number = v_current_from_turn
    and id <> p_transition_id
  limit 1;

  -- building.suspended (state condition — state-entry guard applied; one
  -- representative row per settlement sources the blueprint name — see
  -- migration header).
  insert into public.notifications (
    recipient_user_id,
    world_id,
    settlement_id,
    nation_id,
    notification_type,
    message_text,
    generated_in_transition_id
  )
  select
    recipients.user_id,
    p_world_id,
    logs.settlement_id,
    s.nation_id,
    'building.suspended'::public.notification_type,
    coalesce(bp.name, 'A building') || ' was suspended in ' || s.name || ' due to insufficient upkeep resources.',
    p_transition_id
  from (
    select distinct on (cur.settlement_id)
      cur.settlement_id,
      cur.payload_jsonb
    from public.turn_log_entries cur
    where cur.turn_transition_id = p_transition_id
      and cur.world_id = p_world_id
      and cur.log_category = 'building.suspended'
      and cur.settlement_id is not null
      and not exists (
          select 1
          from public.turn_log_entries prev
          where prev.turn_transition_id = v_prev_transition_id
            and prev.log_category = 'building.suspended'
            and prev.settlement_id = cur.settlement_id
      )
    order by cur.settlement_id, cur.id
  ) logs (settlement_id, payload_jsonb)
  inner join public.settlements s on s.id = logs.settlement_id
  left join public.building_blueprints bp on bp.id = (logs.payload_jsonb ->> 'blueprintId')::uuid
  cross join lateral (
    select c.user_id
    from public.citizens c
    inner join public.users u on u.id = c.user_id
    where c.role_type = 'settlement_manager'
      and c.role_settlement_id = logs.settlement_id
      and c.status = 'alive'
      and c.citizen_type = 'player_character'
      and c.user_id is not null
      and u.status = 'active'
    union all
    select c.user_id
    from public.citizens c
    inner join public.users u on u.id = c.user_id
    where c.role_type = 'nation_manager'
      and c.role_nation_id = s.nation_id
      and c.status = 'alive'
      and c.citizen_type = 'player_character'
      and c.user_id is not null
      and u.status = 'active'
    union all
    select wa.user_id
    from public.world_admins wa
    inner join public.users u on u.id = wa.user_id
    where wa.world_id = p_world_id
      and u.status = 'active'
    union all
    select u.id
    from public.users u
    where u.is_super_admin = true
      and u.status = 'active'
  ) as recipients (user_id)
  on conflict do nothing;

  get diagnostics v_rows = row_count;
  notification_count := notification_count + v_rows;

  -- building.auto_deconstructed (same recipients as building.suspended; no
  -- state guard — per-event grain, see migration header).
  insert into public.notifications (
    recipient_user_id,
    world_id,
    settlement_id,
    nation_id,
    notification_type,
    message_text,
    generated_in_transition_id
  )
  select
    recipients.user_id,
    p_world_id,
    logs.settlement_id,
    s.nation_id,
    'building.auto_deconstructed'::public.notification_type,
    coalesce(bp.name, 'A building') || ' was auto-deconstructed in ' || s.name || ' after missing upkeep for too long.',
    p_transition_id
  from (
    select settlement_id, payload_jsonb
    from public.turn_log_entries
    where turn_transition_id = p_transition_id
      and world_id = p_world_id
      and log_category = 'building.auto_deconstructed'
      and settlement_id is not null
  ) logs
  inner join public.settlements s on s.id = logs.settlement_id
  left join public.building_blueprints bp on bp.id = (logs.payload_jsonb ->> 'blueprintId')::uuid
  cross join lateral (
    select c.user_id
    from public.citizens c
    inner join public.users u on u.id = c.user_id
    where c.role_type = 'settlement_manager'
      and c.role_settlement_id = logs.settlement_id
      and c.status = 'alive'
      and c.citizen_type = 'player_character'
      and c.user_id is not null
      and u.status = 'active'
    union all
    select c.user_id
    from public.citizens c
    inner join public.users u on u.id = c.user_id
    where c.role_type = 'nation_manager'
      and c.role_nation_id = s.nation_id
      and c.status = 'alive'
      and c.citizen_type = 'player_character'
      and c.user_id is not null
      and u.status = 'active'
    union all
    select wa.user_id
    from public.world_admins wa
    inner join public.users u on u.id = wa.user_id
    where wa.world_id = p_world_id
      and u.status = 'active'
    union all
    select u.id
    from public.users u
    where u.is_super_admin = true
      and u.status = 'active'
  ) as recipients (user_id)
  on conflict do nothing;

  get diagnostics v_rows = row_count;
  notification_count := notification_count + v_rows;

  -- building.recovered (same recipients as building.suspended; no state
  -- guard — per-event grain, see migration header).
  insert into public.notifications (
    recipient_user_id,
    world_id,
    settlement_id,
    nation_id,
    notification_type,
    message_text,
    generated_in_transition_id
  )
  select
    recipients.user_id,
    p_world_id,
    logs.settlement_id,
    s.nation_id,
    'building.recovered'::public.notification_type,
    coalesce(bp.name, 'A building') || ' resumed operation in ' || s.name || ' after upkeep costs were met.',
    p_transition_id
  from (
    select settlement_id, payload_jsonb
    from public.turn_log_entries
    where turn_transition_id = p_transition_id
      and world_id = p_world_id
      and log_category = 'building.recovered'
      and settlement_id is not null
  ) logs
  inner join public.settlements s on s.id = logs.settlement_id
  left join public.building_blueprints bp on bp.id = (logs.payload_jsonb ->> 'blueprintId')::uuid
  cross join lateral (
    select c.user_id
    from public.citizens c
    inner join public.users u on u.id = c.user_id
    where c.role_type = 'settlement_manager'
      and c.role_settlement_id = logs.settlement_id
      and c.status = 'alive'
      and c.citizen_type = 'player_character'
      and c.user_id is not null
      and u.status = 'active'
    union all
    select c.user_id
    from public.citizens c
    inner join public.users u on u.id = c.user_id
    where c.role_type = 'nation_manager'
      and c.role_nation_id = s.nation_id
      and c.status = 'alive'
      and c.citizen_type = 'player_character'
      and c.user_id is not null
      and u.status = 'active'
    union all
    select wa.user_id
    from public.world_admins wa
    inner join public.users u on u.id = wa.user_id
    where wa.world_id = p_world_id
      and u.status = 'active'
    union all
    select u.id
    from public.users u
    where u.is_super_admin = true
      and u.status = 'active'
  ) as recipients (user_id)
  on conflict do nothing;

  get diagnostics v_rows = row_count;
  notification_count := notification_count + v_rows;

  -- construction.completed (same recipients as building.suspended; no state
  -- guard — per-event grain, see migration header). payload only carries
  -- projectId, so the blueprint name is resolved via construction_projects.
  insert into public.notifications (
    recipient_user_id,
    world_id,
    settlement_id,
    nation_id,
    notification_type,
    message_text,
    generated_in_transition_id
  )
  select
    recipients.user_id,
    p_world_id,
    logs.settlement_id,
    s.nation_id,
    'construction.completed'::public.notification_type,
    'Construction of ' || coalesce(bp.name, 'a building') || ' completed in ' || s.name || '.',
    p_transition_id
  from (
    select settlement_id, payload_jsonb
    from public.turn_log_entries
    where turn_transition_id = p_transition_id
      and world_id = p_world_id
      and log_category = 'construction.completed'
      and settlement_id is not null
  ) logs
  inner join public.settlements s on s.id = logs.settlement_id
  left join public.construction_projects cp on cp.id = (logs.payload_jsonb ->> 'projectId')::uuid
  left join public.building_blueprints bp on bp.id = cp.building_blueprint_id
  cross join lateral (
    select c.user_id
    from public.citizens c
    inner join public.users u on u.id = c.user_id
    where c.role_type = 'settlement_manager'
      and c.role_settlement_id = logs.settlement_id
      and c.status = 'alive'
      and c.citizen_type = 'player_character'
      and c.user_id is not null
      and u.status = 'active'
    union all
    select c.user_id
    from public.citizens c
    inner join public.users u on u.id = c.user_id
    where c.role_type = 'nation_manager'
      and c.role_nation_id = s.nation_id
      and c.status = 'alive'
      and c.citizen_type = 'player_character'
      and c.user_id is not null
      and u.status = 'active'
    union all
    select wa.user_id
    from public.world_admins wa
    inner join public.users u on u.id = wa.user_id
    where wa.world_id = p_world_id
      and u.status = 'active'
    union all
    select u.id
    from public.users u
    where u.is_super_admin = true
      and u.status = 'active'
  ) as recipients (user_id)
  on conflict do nothing;

  get diagnostics v_rows = row_count;
  notification_count := notification_count + v_rows;

  -- deposit.depleted (nation-scoped: nation managers + world admins + super
  -- admins). payload already carries depositName denormalized by the
  -- emitting phase — no join needed. No state guard — per-event grain.
  insert into public.notifications (
    recipient_user_id,
    world_id,
    nation_id,
    notification_type,
    message_text,
    generated_in_transition_id
  )
  select
    recipients.user_id,
    p_world_id,
    logs.nation_id,
    'deposit.depleted'::public.notification_type,
    coalesce(logs.payload_jsonb ->> 'depositName', 'A deposit') || ' was depleted.',
    p_transition_id
  from (
    select nation_id, payload_jsonb
    from public.turn_log_entries
    where turn_transition_id = p_transition_id
      and world_id = p_world_id
      and log_category = 'deposit.depleted'
      and nation_id is not null
  ) logs
  cross join lateral (
    select c.user_id
    from public.citizens c
    inner join public.users u on u.id = c.user_id
    where c.role_type = 'nation_manager'
      and c.role_nation_id = logs.nation_id
      and c.status = 'alive'
      and c.citizen_type = 'player_character'
      and c.user_id is not null
      and u.status = 'active'
    union all
    select wa.user_id
    from public.world_admins wa
    inner join public.users u on u.id = wa.user_id
    where wa.world_id = p_world_id
      and u.status = 'active'
    union all
    select u.id
    from public.users u
    where u.is_super_admin = true
      and u.status = 'active'
  ) as recipients (user_id)
  on conflict do nothing;

  get diagnostics v_rows = row_count;
  notification_count := notification_count + v_rows;

  -- managed_population.extinct (same recipients as building.suspended). payload
  -- already carries name denormalized — no join needed. No state guard —
  -- per-event grain.
  insert into public.notifications (
    recipient_user_id,
    world_id,
    settlement_id,
    nation_id,
    notification_type,
    message_text,
    generated_in_transition_id
  )
  select
    recipients.user_id,
    p_world_id,
    logs.settlement_id,
    s.nation_id,
    'managed_population.extinct'::public.notification_type,
    coalesce(logs.payload_jsonb ->> 'name', 'A managed population') || ' in ' || s.name || ' has gone extinct.',
    p_transition_id
  from (
    select settlement_id, payload_jsonb
    from public.turn_log_entries
    where turn_transition_id = p_transition_id
      and world_id = p_world_id
      and log_category = 'managed_population.extinct'
      and settlement_id is not null
  ) logs
  inner join public.settlements s on s.id = logs.settlement_id
  cross join lateral (
    select c.user_id
    from public.citizens c
    inner join public.users u on u.id = c.user_id
    where c.role_type = 'settlement_manager'
      and c.role_settlement_id = logs.settlement_id
      and c.status = 'alive'
      and c.citizen_type = 'player_character'
      and c.user_id is not null
      and u.status = 'active'
    union all
    select c.user_id
    from public.citizens c
    inner join public.users u on u.id = c.user_id
    where c.role_type = 'nation_manager'
      and c.role_nation_id = s.nation_id
      and c.status = 'alive'
      and c.citizen_type = 'player_character'
      and c.user_id is not null
      and u.status = 'active'
    union all
    select wa.user_id
    from public.world_admins wa
    inner join public.users u on u.id = wa.user_id
    where wa.world_id = p_world_id
      and u.status = 'active'
    union all
    select u.id
    from public.users u
    where u.is_super_admin = true
      and u.status = 'active'
  ) as recipients (user_id)
  on conflict do nothing;

  get diagnostics v_rows = row_count;
  notification_count := notification_count + v_rows;

  -- managed_population.declining (state condition — state-entry guard applied;
  -- one representative row per settlement sources the population name — see
  -- migration header).
  insert into public.notifications (
    recipient_user_id,
    world_id,
    settlement_id,
    nation_id,
    notification_type,
    message_text,
    generated_in_transition_id
  )
  select
    recipients.user_id,
    p_world_id,
    logs.settlement_id,
    s.nation_id,
    'managed_population.declining'::public.notification_type,
    coalesce(logs.payload_jsonb ->> 'name', 'A managed population') || ' in ' || s.name || ' is declining due to insufficient maintenance or husbandry.',
    p_transition_id
  from (
    select distinct on (cur.settlement_id)
      cur.settlement_id,
      cur.payload_jsonb
    from public.turn_log_entries cur
    where cur.turn_transition_id = p_transition_id
      and cur.world_id = p_world_id
      and cur.log_category = 'managed_population.declining'
      and cur.settlement_id is not null
      and not exists (
          select 1
          from public.turn_log_entries prev
          where prev.turn_transition_id = v_prev_transition_id
            and prev.log_category = 'managed_population.declining'
            and prev.settlement_id = cur.settlement_id
      )
    order by cur.settlement_id, cur.id
  ) logs (settlement_id, payload_jsonb)
  inner join public.settlements s on s.id = logs.settlement_id
  cross join lateral (
    select c.user_id
    from public.citizens c
    inner join public.users u on u.id = c.user_id
    where c.role_type = 'settlement_manager'
      and c.role_settlement_id = logs.settlement_id
      and c.status = 'alive'
      and c.citizen_type = 'player_character'
      and c.user_id is not null
      and u.status = 'active'
    union all
    select c.user_id
    from public.citizens c
    inner join public.users u on u.id = c.user_id
    where c.role_type = 'nation_manager'
      and c.role_nation_id = s.nation_id
      and c.status = 'alive'
      and c.citizen_type = 'player_character'
      and c.user_id is not null
      and u.status = 'active'
    union all
    select wa.user_id
    from public.world_admins wa
    inner join public.users u on u.id = wa.user_id
    where wa.world_id = p_world_id
      and u.status = 'active'
    union all
    select u.id
    from public.users u
    where u.is_super_admin = true
      and u.status = 'active'
  ) as recipients (user_id)
  on conflict do nothing;

  get diagnostics v_rows = row_count;
  notification_count := notification_count + v_rows;

  -- settlement.starvation_occurred (state condition — state-entry guard
  -- applied). payload is always empty (deaths are logged as separate
  -- citizen.* rows) — only the settlement name is interpolable.
  insert into public.notifications (
    recipient_user_id,
    world_id,
    settlement_id,
    nation_id,
    notification_type,
    message_text,
    generated_in_transition_id
  )
  select
    recipients.user_id,
    p_world_id,
    logs.settlement_id,
    s.nation_id,
    'settlement.starvation_occurred'::public.notification_type,
    'Citizen(s) starved in ' || s.name || '.',
    p_transition_id
  from (
    select distinct cur.settlement_id
    from public.turn_log_entries cur
    where cur.turn_transition_id = p_transition_id
      and cur.world_id = p_world_id
      and cur.log_category = 'settlement.starvation_occurred'
      and cur.settlement_id is not null
      and not exists (
          select 1
          from public.turn_log_entries prev
          where prev.turn_transition_id = v_prev_transition_id
            and prev.log_category = 'settlement.starvation_occurred'
            and prev.settlement_id = cur.settlement_id
      )
  ) logs (settlement_id)
  inner join public.settlements s on s.id = logs.settlement_id
  cross join lateral (
    select c.user_id
    from public.citizens c
    inner join public.users u on u.id = c.user_id
    where c.role_type = 'settlement_manager'
      and c.role_settlement_id = logs.settlement_id
      and c.status = 'alive'
      and c.citizen_type = 'player_character'
      and c.user_id is not null
      and u.status = 'active'
    union all
    select c.user_id
    from public.citizens c
    inner join public.users u on u.id = c.user_id
    where c.role_type = 'nation_manager'
      and c.role_nation_id = s.nation_id
      and c.status = 'alive'
      and c.citizen_type = 'player_character'
      and c.user_id is not null
      and u.status = 'active'
    union all
    select wa.user_id
    from public.world_admins wa
    inner join public.users u on u.id = wa.user_id
    where wa.world_id = p_world_id
      and u.status = 'active'
    union all
    select u.id
    from public.users u
    where u.is_super_admin = true
      and u.status = 'active'
  ) as recipients (user_id)
  on conflict do nothing;

  get diagnostics v_rows = row_count;
  notification_count := notification_count + v_rows;

  -- settlement.homelessness_occurred (same recipients as building.suspended;
  -- no state guard). payload is always empty — only the settlement name is
  -- interpolable.
  insert into public.notifications (
    recipient_user_id,
    world_id,
    settlement_id,
    nation_id,
    notification_type,
    message_text,
    generated_in_transition_id
  )
  select
    recipients.user_id,
    p_world_id,
    logs.settlement_id,
    s.nation_id,
    'settlement.homelessness_occurred'::public.notification_type,
    'Citizen(s) died from homelessness in ' || s.name || '.',
    p_transition_id
  from (
    select distinct settlement_id
    from public.turn_log_entries
    where turn_transition_id = p_transition_id
      and world_id = p_world_id
      and log_category = 'settlement.homelessness_occurred'
      and settlement_id is not null
  ) logs (settlement_id)
  inner join public.settlements s on s.id = logs.settlement_id
  cross join lateral (
    select c.user_id
    from public.citizens c
    inner join public.users u on u.id = c.user_id
    where c.role_type = 'settlement_manager'
      and c.role_settlement_id = logs.settlement_id
      and c.status = 'alive'
      and c.citizen_type = 'player_character'
      and c.user_id is not null
      and u.status = 'active'
    union all
    select c.user_id
    from public.citizens c
    inner join public.users u on u.id = c.user_id
    where c.role_type = 'nation_manager'
      and c.role_nation_id = s.nation_id
      and c.status = 'alive'
      and c.citizen_type = 'player_character'
      and c.user_id is not null
      and u.status = 'active'
    union all
    select wa.user_id
    from public.world_admins wa
    inner join public.users u on u.id = wa.user_id
    where wa.world_id = p_world_id
      and u.status = 'active'
    union all
    select u.id
    from public.users u
    where u.is_super_admin = true
      and u.status = 'active'
  ) as recipients (user_id)
  on conflict do nothing;

  get diagnostics v_rows = row_count;
  notification_count := notification_count + v_rows;

  -- construction.paused (settlement-scoped: same recipients as
  -- building.suspended; no state guard — per-event grain). payload only
  -- carries projectId, so the blueprint name is resolved via
  -- construction_projects.
  insert into public.notifications (
    recipient_user_id,
    world_id,
    settlement_id,
    nation_id,
    notification_type,
    message_text,
    generated_in_transition_id
  )
  select
    recipients.user_id,
    p_world_id,
    logs.settlement_id,
    s.nation_id,
    'construction.paused'::public.notification_type,
    'Construction of ' || coalesce(bp.name, 'a building') || ' paused in ' || s.name || ' due to insufficient resources.',
    p_transition_id
  from (
    select settlement_id, payload_jsonb
    from public.turn_log_entries
    where turn_transition_id = p_transition_id
      and world_id = p_world_id
      and log_category = 'construction.paused'
      and settlement_id is not null
  ) logs
  inner join public.settlements s on s.id = logs.settlement_id
  left join public.construction_projects cp on cp.id = (logs.payload_jsonb ->> 'projectId')::uuid
  left join public.building_blueprints bp on bp.id = cp.building_blueprint_id
  cross join lateral (
    select c.user_id
    from public.citizens c
    inner join public.users u on u.id = c.user_id
    where c.role_type = 'settlement_manager'
      and c.role_settlement_id = logs.settlement_id
      and c.status = 'alive'
      and c.citizen_type = 'player_character'
      and c.user_id is not null
      and u.status = 'active'
    union all
    select c.user_id
    from public.citizens c
    inner join public.users u on u.id = c.user_id
    where c.role_type = 'nation_manager'
      and c.role_nation_id = s.nation_id
      and c.status = 'alive'
      and c.citizen_type = 'player_character'
      and c.user_id is not null
      and u.status = 'active'
    union all
    select wa.user_id
    from public.world_admins wa
    inner join public.users u on u.id = wa.user_id
    where wa.world_id = p_world_id
      and u.status = 'active'
    union all
    select u.id
    from public.users u
    where u.is_super_admin = true
      and u.status = 'active'
  ) as recipients (user_id)
  on conflict do nothing;

  get diagnostics v_rows = row_count;
  notification_count := notification_count + v_rows;

  -- partnership.formed (per formation event; interpolates both citizens' names —
  -- issue #938). See migration header for the full rationale. Unchanged by
  -- issue #1027.
  insert into public.notifications (
    recipient_user_id,
    world_id,
    settlement_id,
    nation_id,
    citizen_id,
    notification_type,
    message_text,
    generated_in_transition_id
  )
  select
    recipients.user_id,
    p_world_id,
    ca.settlement_id,
    s.nation_id,
    ca.id,
    'partnership.formed'::public.notification_type,
    trim(both ' ' from ca.given_name || ' ' || coalesce(ca.surname, '')) ||
      ' and ' ||
      trim(both ' ' from cb.given_name || ' ' || coalesce(cb.surname, '')) ||
      ' formed a partnership.',
    p_transition_id
  from (
    select distinct
      (change ->> 'citizenAId')::uuid as citizen_a_id,
      (change ->> 'citizenBId')::uuid as citizen_b_id
    from jsonb_array_elements(coalesce(p_payload -> 'partnershipChanges', '[]'::jsonb)) as change
    where (change ->> 'toStatus') = 'active'
  ) formed
  inner join public.citizens ca on ca.id = formed.citizen_a_id
  inner join public.citizens cb on cb.id = formed.citizen_b_id
  inner join public.settlements s on s.id = ca.settlement_id
  cross join lateral (
    select c.user_id
    from public.citizens c
    inner join public.users u on u.id = c.user_id
    where c.role_type = 'settlement_manager'
      and c.role_settlement_id = ca.settlement_id
      and c.status = 'alive'
      and c.citizen_type = 'player_character'
      and c.user_id is not null
      and u.status = 'active'
    union all
    select c.user_id
    from public.citizens c
    inner join public.users u on u.id = c.user_id
    where c.role_type = 'nation_manager'
      and c.role_nation_id = s.nation_id
      and c.status = 'alive'
      and c.citizen_type = 'player_character'
      and c.user_id is not null
      and u.status = 'active'
    union all
    select wa.user_id
    from public.world_admins wa
    inner join public.users u on u.id = wa.user_id
    where wa.world_id = p_world_id
      and u.status = 'active'
    union all
    select u.id
    from public.users u
    where u.is_super_admin = true
      and u.status = 'active'
  ) as recipients (user_id)
  on conflict do nothing;

  get diagnostics v_rows = row_count;
  notification_count := notification_count + v_rows;

  -- partnership.widowed (settlement-scoped: same recipients as
  -- building.suspended; no state guard — per-event grain, issue #1027).
  -- payload carries partnershipId + survivingCitizenId; the deceased partner
  -- is resolved as "whichever side of the partnership isn't the survivor".
  -- citizen_id is now set to the survivor, matching the citizen_id-set
  -- precedent used by citizen.died/citizen.born/partnership.formed.
  insert into public.notifications (
    recipient_user_id,
    world_id,
    settlement_id,
    nation_id,
    citizen_id,
    notification_type,
    message_text,
    generated_in_transition_id
  )
  select
    recipients.user_id,
    p_world_id,
    logs.settlement_id,
    s.nation_id,
    (logs.payload_jsonb ->> 'survivingCitizenId')::uuid,
    'partnership.widowed'::public.notification_type,
    case
      when survivor.id is not null and deceased.id is not null then
        trim(both ' ' from survivor.given_name || ' ' || coalesce(survivor.surname, '')) ||
          ' lost ' ||
          trim(both ' ' from deceased.given_name || ' ' || coalesce(deceased.surname, '')) ||
          ' this turn.'
      else 'A citizen lost their partner this turn.'
    end,
    p_transition_id
  from (
    select settlement_id, payload_jsonb
    from public.turn_log_entries
    where turn_transition_id = p_transition_id
      and world_id = p_world_id
      and log_category = 'partnership.widowed'
      and settlement_id is not null
  ) logs
  inner join public.settlements s on s.id = logs.settlement_id
  left join public.partnerships p on p.id = (logs.payload_jsonb ->> 'partnershipId')::uuid
  left join public.citizens survivor on survivor.id = (logs.payload_jsonb ->> 'survivingCitizenId')::uuid
  left join public.citizens deceased on deceased.id = case
    when p.citizen_a_id = (logs.payload_jsonb ->> 'survivingCitizenId')::uuid then p.citizen_b_id
    when p.citizen_b_id = (logs.payload_jsonb ->> 'survivingCitizenId')::uuid then p.citizen_a_id
    else null
  end
  cross join lateral (
    select c.user_id
    from public.citizens c
    inner join public.users u on u.id = c.user_id
    where c.role_type = 'settlement_manager'
      and c.role_settlement_id = logs.settlement_id
      and c.status = 'alive'
      and c.citizen_type = 'player_character'
      and c.user_id is not null
      and u.status = 'active'
    union all
    select c.user_id
    from public.citizens c
    inner join public.users u on u.id = c.user_id
    where c.role_type = 'nation_manager'
      and c.role_nation_id = s.nation_id
      and c.status = 'alive'
      and c.citizen_type = 'player_character'
      and c.user_id is not null
      and u.status = 'active'
    union all
    select wa.user_id
    from public.world_admins wa
    inner join public.users u on u.id = wa.user_id
    where wa.world_id = p_world_id
      and u.status = 'active'
    union all
    select u.id
    from public.users u
    where u.is_super_admin = true
      and u.status = 'active'
  ) as recipients (user_id)
  on conflict do nothing;

  get diagnostics v_rows = row_count;
  notification_count := notification_count + v_rows;

  -- trade_route.paused (settlement-scoped: same recipients as
  -- building.suspended; no state guard — per-event grain, issue #1027).
  -- log entry carries settlement_id = origin settlement id; payload carries
  -- tradeRouteId (now set on the notification row) and destinationSettlementId.
  insert into public.notifications (
    recipient_user_id,
    world_id,
    settlement_id,
    nation_id,
    trade_route_id,
    notification_type,
    message_text,
    generated_in_transition_id
  )
  select
    recipients.user_id,
    p_world_id,
    logs.settlement_id,
    s.nation_id,
    (logs.payload_jsonb ->> 'tradeRouteId')::uuid,
    'trade_route.paused'::public.notification_type,
    'Trade route from ' || s.name || ' to ' || coalesce(dest.name, 'another settlement') || ' was paused.',
    p_transition_id
  from (
    select settlement_id, payload_jsonb
    from public.turn_log_entries
    where turn_transition_id = p_transition_id
      and world_id = p_world_id
      and log_category = 'trade_route.paused'
      and settlement_id is not null
  ) logs
  inner join public.settlements s on s.id = logs.settlement_id
  left join public.settlements dest on dest.id = (logs.payload_jsonb ->> 'destinationSettlementId')::uuid
  cross join lateral (
    select c.user_id
    from public.citizens c
    inner join public.users u on u.id = c.user_id
    where c.role_type = 'settlement_manager'
      and c.role_settlement_id = logs.settlement_id
      and c.status = 'alive'
      and c.citizen_type = 'player_character'
      and c.user_id is not null
      and u.status = 'active'
    union all
    select c.user_id
    from public.citizens c
    inner join public.users u on u.id = c.user_id
    where c.role_type = 'nation_manager'
      and c.role_nation_id = s.nation_id
      and c.status = 'alive'
      and c.citizen_type = 'player_character'
      and c.user_id is not null
      and u.status = 'active'
    union all
    select wa.user_id
    from public.world_admins wa
    inner join public.users u on u.id = wa.user_id
    where wa.world_id = p_world_id
      and u.status = 'active'
    union all
    select u.id
    from public.users u
    where u.is_super_admin = true
      and u.status = 'active'
  ) as recipients (user_id)
  on conflict do nothing;

  get diagnostics v_rows = row_count;
  notification_count := notification_count + v_rows;

  -- trade_route.resumed (settlement-scoped: same recipients as
  -- building.suspended; no state guard — per-event grain, issue #1027).
  -- log entry carries settlement_id = origin settlement id; payload carries
  -- tradeRouteId (now set on the notification row) and destinationSettlementId.
  insert into public.notifications (
    recipient_user_id,
    world_id,
    settlement_id,
    nation_id,
    trade_route_id,
    notification_type,
    message_text,
    generated_in_transition_id
  )
  select
    recipients.user_id,
    p_world_id,
    logs.settlement_id,
    s.nation_id,
    (logs.payload_jsonb ->> 'tradeRouteId')::uuid,
    'trade_route.resumed'::public.notification_type,
    'Trade route from ' || s.name || ' to ' || coalesce(dest.name, 'another settlement') || ' has resumed.',
    p_transition_id
  from (
    select settlement_id, payload_jsonb
    from public.turn_log_entries
    where turn_transition_id = p_transition_id
      and world_id = p_world_id
      and log_category = 'trade_route.resumed'
      and settlement_id is not null
  ) logs
  inner join public.settlements s on s.id = logs.settlement_id
  left join public.settlements dest on dest.id = (logs.payload_jsonb ->> 'destinationSettlementId')::uuid
  cross join lateral (
    select c.user_id
    from public.citizens c
    inner join public.users u on u.id = c.user_id
    where c.role_type = 'settlement_manager'
      and c.role_settlement_id = logs.settlement_id
      and c.status = 'alive'
      and c.citizen_type = 'player_character'
      and c.user_id is not null
      and u.status = 'active'
    union all
    select c.user_id
    from public.citizens c
    inner join public.users u on u.id = c.user_id
    where c.role_type = 'nation_manager'
      and c.role_nation_id = s.nation_id
      and c.status = 'alive'
      and c.citizen_type = 'player_character'
      and c.user_id is not null
      and u.status = 'active'
    union all
    select wa.user_id
    from public.world_admins wa
    inner join public.users u on u.id = wa.user_id
    where wa.world_id = p_world_id
      and u.status = 'active'
    union all
    select u.id
    from public.users u
    where u.is_super_admin = true
      and u.status = 'active'
  ) as recipients (user_id)
  on conflict do nothing;

  get diagnostics v_rows = row_count;
  notification_count := notification_count + v_rows;

  -- §C33c: turn.completed (world-scoped: world admins + super admins).
  -- Emitted unconditionally on every successful transition — not derived from
  -- a log entry.  settlement_id and nation_id are null (world scope).
  -- The partial unique index (notifications_transition_dedup_idx) prevents
  -- duplicates if this function is called more than once per transition.
  insert into public.notifications (
    recipient_user_id,
    world_id,
    notification_type,
    message_text,
    generated_in_transition_id
  )
  select
    recipients.user_id,
    p_world_id,
    'turn.completed'::public.notification_type,
    'The world turn has advanced.',
    p_transition_id
  from (
    select wa.user_id
    from public.world_admins wa
    inner join public.users u on u.id = wa.user_id
    where wa.world_id = p_world_id
      and u.status = 'active'
    union all
    select u.id
    from public.users u
    where u.is_super_admin = true
      and u.status = 'active'
  ) as recipients (user_id)
  on conflict do nothing;

  get diagnostics v_rows = row_count;
  notification_count := notification_count + v_rows;

  -- §C33e: event.activated — fires when a patch transitions fromStatus = 'pending'.
  -- Includes both sustained events (pending → active) and instant events
  -- (pending → expired, which also emit event.activated since they did activate).
  -- Recipients are scoped to the event's scope_type:
  --   settlement: settlement manager + nation manager + world admins + super admins
  --   nation:     nation manager + world admins + super admins
  --   world:      world admins + super admins
  -- event_id is set so the deep link navigates to the event detail page.
  -- Issue #1027: now also interpolates the settlement name when
  -- scope_type = 'settlement'.
  insert into public.notifications (
    recipient_user_id,
    world_id,
    settlement_id,
    nation_id,
    event_id,
    notification_type,
    message_text,
    generated_in_transition_id
  )
  select
    recipients.user_id,
    p_world_id,
    case when e.scope_type = 'settlement' then e.scope_settlement_id else null end,
    case
      when e.scope_type = 'settlement' then s.nation_id
      when e.scope_type = 'nation'     then e.scope_nation_id
      else null
    end,
    e.id,
    'event.activated'::public.notification_type,
    'Event "' || e.name || '" has been activated' ||
      case when e.scope_type = 'settlement' then ' in ' || s.name else '' end ||
      '.',
    p_transition_id
  from jsonb_array_elements(coalesce(p_payload -> 'eventStatusPatches', '[]'::jsonb)) as patch
  inner join public.events e
    on  e.id       = (patch ->> 'eventId')::uuid
    and e.world_id = p_world_id
    and (patch ->> 'fromStatus') = 'pending'
  left join public.settlements s on s.id = e.scope_settlement_id
  cross join lateral (
    select c.user_id
    from public.citizens c
    inner join public.users u on u.id = c.user_id
    where e.scope_type = 'settlement'
      and c.role_type = 'settlement_manager'
      and c.role_settlement_id = e.scope_settlement_id
      and c.status = 'alive'
      and c.citizen_type = 'player_character'
      and c.user_id is not null
      and u.status = 'active'
    union all
    select c.user_id
    from public.citizens c
    inner join public.users u on u.id = c.user_id
    where e.scope_type in ('settlement', 'nation')
      and c.role_type = 'nation_manager'
      and c.role_nation_id = case
        when e.scope_type = 'settlement' then s.nation_id
        when e.scope_type = 'nation'     then e.scope_nation_id
        else null
      end
      and c.role_nation_id is not null
      and c.status = 'alive'
      and c.citizen_type = 'player_character'
      and c.user_id is not null
      and u.status = 'active'
    union all
    select wa.user_id
    from public.world_admins wa
    inner join public.users u on u.id = wa.user_id
    where wa.world_id = p_world_id
      and u.status = 'active'
    union all
    select u.id
    from public.users u
    where u.is_super_admin = true
      and u.status = 'active'
  ) as recipients (user_id)
  on conflict do nothing;

  get diagnostics v_rows = row_count;
  notification_count := notification_count + v_rows;

  -- §C33f: event.expired — fires when a patch transitions toStatus = 'expired'.
  -- Covers both sustained events counting down to zero and instant events
  -- (pending → expired in a single transition).  Same scope-aware recipients
  -- and event_id deep-link as event.activated. Issue #1027: now also
  -- interpolates the settlement name when scope_type = 'settlement'.
  insert into public.notifications (
    recipient_user_id,
    world_id,
    settlement_id,
    nation_id,
    event_id,
    notification_type,
    message_text,
    generated_in_transition_id
  )
  select
    recipients.user_id,
    p_world_id,
    case when e.scope_type = 'settlement' then e.scope_settlement_id else null end,
    case
      when e.scope_type = 'settlement' then s.nation_id
      when e.scope_type = 'nation'     then e.scope_nation_id
      else null
    end,
    e.id,
    'event.expired'::public.notification_type,
    'Event "' || e.name || '" has expired' ||
      case when e.scope_type = 'settlement' then ' in ' || s.name else '' end ||
      '.',
    p_transition_id
  from jsonb_array_elements(coalesce(p_payload -> 'eventStatusPatches', '[]'::jsonb)) as patch
  inner join public.events e
    on  e.id       = (patch ->> 'eventId')::uuid
    and e.world_id = p_world_id
    and (patch ->> 'toStatus') = 'expired'
  left join public.settlements s on s.id = e.scope_settlement_id
  cross join lateral (
    select c.user_id
    from public.citizens c
    inner join public.users u on u.id = c.user_id
    where e.scope_type = 'settlement'
      and c.role_type = 'settlement_manager'
      and c.role_settlement_id = e.scope_settlement_id
      and c.status = 'alive'
      and c.citizen_type = 'player_character'
      and c.user_id is not null
      and u.status = 'active'
    union all
    select c.user_id
    from public.citizens c
    inner join public.users u on u.id = c.user_id
    where e.scope_type in ('settlement', 'nation')
      and c.role_type = 'nation_manager'
      and c.role_nation_id = case
        when e.scope_type = 'settlement' then s.nation_id
        when e.scope_type = 'nation'     then e.scope_nation_id
        else null
      end
      and c.role_nation_id is not null
      and c.status = 'alive'
      and c.citizen_type = 'player_character'
      and c.user_id is not null
      and u.status = 'active'
    union all
    select wa.user_id
    from public.world_admins wa
    inner join public.users u on u.id = wa.user_id
    where wa.world_id = p_world_id
      and u.status = 'active'
    union all
    select u.id
    from public.users u
    where u.is_super_admin = true
      and u.status = 'active'
  ) as recipients (user_id)
  on conflict do nothing;

  get diagnostics v_rows = row_count;
  notification_count := notification_count + v_rows;

  -- §C33g: citizen.born — per newborn (interpolates the newborn's name and links
  -- to the citizen record — issue #938). See migration header for the full
  -- rationale on the settlement/parents/turn/name match. Unchanged by
  -- issue #1027.
  insert into public.notifications (
    recipient_user_id,
    world_id,
    settlement_id,
    nation_id,
    citizen_id,
    notification_type,
    message_text,
    generated_in_transition_id
  )
  select
    recipients.user_id,
    p_world_id,
    nc.settlement_id,
    s.nation_id,
    nc.id,
    'citizen.born'::public.notification_type,
    trim(both ' ' from nc.given_name || ' ' || coalesce(nc.surname, '')) ||
      ' was born in this settlement.',
    p_transition_id
  from jsonb_array_elements(coalesce(p_payload -> 'citizenBirths', '[]'::jsonb)) as birth
  inner join public.citizens nc
    on  nc.world_id             = p_world_id
    and nc.citizen_type         = 'npc'
    and nc.settlement_id        = (birth ->> 'settlementId')::uuid
    and nc.given_name           = (birth ->> 'givenName')
    and nc.surname              is not distinct from (birth ->> 'surname')
    and nc.parent_a_citizen_id  is not distinct from (birth ->> 'parentACitizenId')::uuid
    and nc.parent_b_citizen_id  is not distinct from (birth ->> 'parentBCitizenId')::uuid
    and nc.born_on_turn_number  = (birth ->> 'bornOnTurnNumber')::integer
  inner join public.settlements s on s.id = nc.settlement_id
  cross join lateral (
    select c.user_id
    from public.citizens c
    inner join public.users u on u.id = c.user_id
    where c.role_type = 'settlement_manager'
      and c.role_settlement_id = nc.settlement_id
      and c.status = 'alive'
      and c.citizen_type = 'player_character'
      and c.user_id is not null
      and u.status = 'active'
    union all
    select c.user_id
    from public.citizens c
    inner join public.users u on u.id = c.user_id
    where c.role_type = 'nation_manager'
      and c.role_nation_id = s.nation_id
      and c.status = 'alive'
      and c.citizen_type = 'player_character'
      and c.user_id is not null
      and u.status = 'active'
    union all
    select wa.user_id
    from public.world_admins wa
    inner join public.users u on u.id = wa.user_id
    where wa.world_id = p_world_id
      and u.status = 'active'
    union all
    select u.id
    from public.users u
    where u.is_super_admin = true
      and u.status = 'active'
  ) as recipients (user_id)
  on conflict do nothing;

  get diagnostics v_rows = row_count;
  notification_count := notification_count + v_rows;

  -- §C33h: citizen.died — per-citizen notification with citizen_id set.
  -- Reads citizenId entries from the citizenDeaths payload (includes deaths from
  -- starvation, homelessness, and event population_loss effects).
  -- JOINs the citizens table (still present with status='dead' and unchanged
  -- settlement_id after internal_apply_turn_transition_citizen_partnership_patches)
  -- to resolve the settlement scope for recipients, and, per issue #1027,
  -- the citizen's name for the message text.
  -- Recipients: settlement manager + nation manager + world admins + super admins.
  insert into public.notifications (
    recipient_user_id,
    world_id,
    settlement_id,
    nation_id,
    citizen_id,
    notification_type,
    message_text,
    generated_in_transition_id
  )
  select
    recipients.user_id,
    p_world_id,
    c.settlement_id,
    s.nation_id,
    deaths.citizen_id,
    'citizen.died'::public.notification_type,
    trim(both ' ' from c.given_name || ' ' || coalesce(c.surname, '')) || ' has died.',
    p_transition_id
  from (
    select distinct (death_val ->> 'citizenId')::uuid as citizen_id
    from jsonb_array_elements(coalesce(p_payload -> 'citizenDeaths', '[]'::jsonb)) as death_val
    where (death_val ->> 'citizenId') is not null
  ) as deaths
  inner join public.citizens c  on c.id  = deaths.citizen_id
  inner join public.settlements s on s.id = c.settlement_id
  cross join lateral (
    select cz.user_id
    from public.citizens cz
    inner join public.users u on u.id = cz.user_id
    where cz.role_type = 'settlement_manager'
      and cz.role_settlement_id = c.settlement_id
      and cz.status = 'alive'
      and cz.citizen_type = 'player_character'
      and cz.user_id is not null
      and u.status = 'active'
    union all
    select cz.user_id
    from public.citizens cz
    inner join public.users u on u.id = cz.user_id
    where cz.role_type = 'nation_manager'
      and cz.role_nation_id = s.nation_id
      and cz.status = 'alive'
      and cz.citizen_type = 'player_character'
      and cz.user_id is not null
      and u.status = 'active'
    union all
    select wa.user_id
    from public.world_admins wa
    inner join public.users u on u.id = wa.user_id
    where wa.world_id = p_world_id
      and u.status = 'active'
    union all
    select u.id
    from public.users u
    where u.is_super_admin = true
      and u.status = 'active'
  ) as recipients (user_id)
  on conflict do nothing;

  get diagnostics v_rows = row_count;
  notification_count := notification_count + v_rows;

  -- §C33i: government.succession — ruler death triggers a nation-scoped,
  -- high-severity notification naming the dead ruler and candidate successors
  -- (issue #1078). The log entry carries citizen_id = the dead ruler and
  -- nation_id = the now-vacant nation; payload_jsonb carries governmentType,
  -- successionMode, and candidateCitizenIds (already ordered deterministically
  -- — age then id — by phaseSuccession). Unlike every other block in this
  -- function, severity is set explicitly to 'critical' rather than relying on
  -- the notifications.severity column default.
  -- Recipients: settlement managers of the nation's settlements + the nation
  -- manager (vacant at this point, so none match) + world admins + super
  -- admins.
  insert into public.notifications (
    recipient_user_id,
    world_id,
    nation_id,
    citizen_id,
    notification_type,
    message_text,
    severity,
    generated_in_transition_id
  )
  select
    recipients.user_id,
    p_world_id,
    logs.nation_id,
    logs.citizen_id,
    'nation.succession'::public.notification_type,
    'Ruler ' || trim(both ' ' from ruler.given_name || ' ' || coalesce(ruler.surname, '')) ||
      ' of ' || n.name || ' has died. Succession: ' || (logs.payload_jsonb ->> 'successionMode') ||
      '. Candidates: ' || coalesce(cand.names, 'none') || '.',
    'critical'::public.notification_severity,
    p_transition_id
  from (
    select nation_id, citizen_id, payload_jsonb
    from public.turn_log_entries
    where turn_transition_id = p_transition_id
      and world_id = p_world_id
      and log_category = 'government.succession'
      and nation_id is not null
      and citizen_id is not null
  ) logs
  inner join public.nations n on n.id = logs.nation_id
  inner join public.citizens ruler on ruler.id = logs.citizen_id
  left join lateral (
    select string_agg(
      trim(both ' ' from cand_c.given_name || ' ' || coalesce(cand_c.surname, '')),
      ', '
      order by cand_c.born_on_turn_number nulls first, cand_c.id
    ) as names
    from public.citizens cand_c
    where cand_c.id in (
      select elem::uuid
      from jsonb_array_elements_text(coalesce(logs.payload_jsonb -> 'candidateCitizenIds', '[]'::jsonb)) as elem
    )
  ) cand on true
  cross join lateral (
    select c.user_id
    from public.citizens c
    inner join public.users u on u.id = c.user_id
    where c.role_type = 'nation_manager'
      and c.role_nation_id = logs.nation_id
      and c.status = 'alive'
      and c.citizen_type = 'player_character'
      and c.user_id is not null
      and u.status = 'active'
    union all
    select c.user_id
    from public.citizens c
    inner join public.users u on u.id = c.user_id
    inner join public.settlements s2 on s2.id = c.role_settlement_id
    where c.role_type = 'settlement_manager'
      and s2.nation_id = logs.nation_id
      and c.status = 'alive'
      and c.citizen_type = 'player_character'
      and c.user_id is not null
      and u.status = 'active'
    union all
    select wa.user_id
    from public.world_admins wa
    inner join public.users u on u.id = wa.user_id
    where wa.world_id = p_world_id
      and u.status = 'active'
    union all
    select u.id
    from public.users u
    where u.is_super_admin = true
      and u.status = 'active'
  ) as recipients (user_id)
  on conflict do nothing;

  get diagnostics v_rows = row_count;
  notification_count := notification_count + v_rows;

end;
$$;

revoke all on function public.internal_apply_turn_transition_log_entries_and_notifications (uuid, uuid, jsonb)
from
  public;
