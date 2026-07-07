-- Migration: interpolate_entity_names_in_all_notifications
-- Issue #1027: 20260808000000_interpolate_citizen_names_in_notifications.sql
-- interpolated names for partnership.formed and citizen.born only; every other
-- generated notification type still emitted generic text ("A building was
-- suspended...", "A partnership was widowed.") even when the underlying
-- turn_log_entries row (or its payload_jsonb) carried the referenced entity's
-- id. This migration replaces internal_apply_turn_transition_log_entries_and_notifications
-- again to give every remaining message_text branch a name, sourced from the
-- data already present on the log entry at generation time (never a
-- read-time join), so a dead citizen's or removed building's name still
-- renders correctly.
--
-- Per-branch sourcing:
--   building.suspended / building.recovered / building.auto_deconstructed —
--     payload_jsonb carries blueprintId (settlement_buildings.building_blueprint_id
--     at push time); joined to building_blueprints for the display name.
--   construction.completed / construction.paused — payload_jsonb carries
--     projectId only; joined to construction_projects.building_blueprint_id
--     then building_blueprints for the name.
--   deposit.depleted — payload_jsonb already carries depositName denormalized
--     by the emitting phase; used directly, no join needed.
--   managed_population.extinct / managed_population.declining —
--     payload_jsonb already carries name denormalized; used directly.
--   settlement.starvation_occurred / settlement.homelessness_occurred —
--     payload_jsonb is empty (deaths are logged as separate citizen.* rows
--     not exposed to this payload); only the settlement name is available
--     and is interpolated.
--   partnership.widowed — payload_jsonb carries partnershipId and
--     survivingCitizenId only (not the deceased partner's id). The deceased
--     partner is resolved by joining public.partnerships on partnershipId and
--     taking whichever of citizen_a_id/citizen_b_id is not the survivor.
--     citizen_id is now set on the notification (the survivor), matching the
--     citizen_id-set precedent from citizen.died/citizen.born/partnership.formed.
--   trade_route.paused / trade_route.resumed — payload_jsonb carries
--     tradeRouteId and destinationSettlementId; trade_route_id (previously
--     never populated despite existing on the table) is now set, and both
--     the origin (log entry settlement_id) and destination settlement names
--     are interpolated.
--   event.activated / event.expired — already interpolated the event name;
--     now also interpolates the settlement name when scope_type = 'settlement'.
--   citizen.died — the citizens row was already joined for recipient scoping;
--     now also used for the citizen's name.
--
-- Grain changes: building.auto_deconstructed, building.recovered,
-- construction.completed, construction.paused, deposit.depleted, and
-- managed_population.extinct move from a "distinct settlement/nation" scan
-- (one aggregated row regardless of how many events happened) to one row per
-- log entry, matching the existing partnership.formed/citizen.born pattern —
-- otherwise the aggregate would arbitrarily discard all but one entity's name
-- per settlement per transition. The three state-entry-guarded types
-- (building.suspended, managed_population.declining,
-- settlement.starvation_occurred) keep their settlement-level "not exists
-- prev" guard and aggregate grain untouched (spam suppression is
-- settlement-scoped by design — see state_condition_notification_spam_test.sql)
-- and pick one representative row per settlement (arbitrary but
-- deterministic via `order by ..., id`) to source a name; if several
-- buildings/populations are affected in the same settlement in the same
-- transition, only the representative's name is shown. This is not a new
-- limitation — the prior aggregate already collapsed multiple events into
-- one notification silently; only the "which one" question is now visible in
-- the text.
--
-- All new joins are LEFT JOINs with coalesce(...) fallbacks to the prior
-- generic text: production payloads always carry these fields (per the
-- emitting phase code), but several pgTAP fixtures across
-- missing_notification_generators_test.sql and
-- state_condition_notification_spam_test.sql push minimal log entries with no
-- payload at all — those must keep producing a notification (with generic
-- text) rather than being silently dropped by a failed inner join.
--
-- Known follow-ups (out of scope here, flagged for separate issues):
--   - building.recovered has no typed payload parser in notificationPayloads.ts
--     (unlike suspended/auto_deconstructed) even though the phase emits one.
--   - trade_route.paused/resumed's notificationPayloads.ts types resourceId/
--     quantityPerTransition fields the phase never actually sets (moved to
--     trade_route_legs in 20260604000011); the parser types are stale.
--   - TS-side `messageText` built in simulation phases (e.g.
--     phasePartnerships/formation.ts) is dead weight: this SQL function never
--     reads p_payload's `notifications` array, only `logEntries`.
-- ---------------------------------------------------------------------------
comment on column public.notifications.citizen_id is 'FK to citizens; set for citizen.died (per-citizen), citizen.born (per-newborn), partnership.formed (citizen A of the pair), and partnership.widowed (surviving citizen) notifications.';

comment on column public.notifications.trade_route_id is 'FK-less reference to trade_routes (not enforced by a foreign key); set for trade_route.paused and trade_route.resumed notifications.';

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

end;
$$;

revoke all on function public.internal_apply_turn_transition_log_entries_and_notifications (uuid, uuid, jsonb)
from
  public;
