-- Migration: denormalize_turn_log_entry_turn_numbers
--
-- Fixes issue #1283: the turn-log browser query ordered the partitioned
-- turn_log_entries by an embedded turn_transitions(to_turn_number) column
-- (`?order=turn_transitions(to_turn_number).desc,id.desc`, count: "exact").
-- Postgres cannot use an index to satisfy ORDER BY a joined column, so the
-- planner materializes and sorts every matching row before applying LIMIT —
-- on a many-turn partitioned world this exceeds the statement timeout
-- (57014).
--
-- Fix: copy from_turn_number/to_turn_number from turn_transitions onto
-- turn_log_entries at insert time, and add a btree index on
-- (world_id, to_turn_number desc, id desc). The turn-log browser then orders
-- and counts on the row's own indexed columns instead of joining
-- turn_transitions.
--
-- The columns are nullable: public.manual_deconstruct_settlement_building
-- intentionally inserts turn_transition_id = null for manual (outside any
-- transition) deconstruct-overshoot log rows, so there is no transition to
-- derive turn numbers from. The turn-log browser already excludes those rows
-- (it embedded turn_transitions with `!inner`); it now does so with an
-- explicit `turn_transition_id is not null` filter instead, so behavior for
-- those rows is unchanged.
-- ===========================================================================
-- ---------------------------------------------------------------------------
-- Step 1: add the columns and backfill from turn_transitions.
-- ---------------------------------------------------------------------------
alter table public.turn_log_entries
add column from_turn_number integer,
add column to_turn_number integer;

update public.turn_log_entries te
set
  from_turn_number = tt.from_turn_number,
  to_turn_number = tt.to_turn_number
from
  public.turn_transitions tt
where
  tt.id = te.turn_transition_id;

-- ---------------------------------------------------------------------------
-- Step 2: index for the turn-log browser's default sort (world_id partition
-- pruning + to_turn_number desc, id desc tiebreaker matches the query in
-- src/features/turns/queries/turnLogBrowserQueries.ts).
-- ---------------------------------------------------------------------------
create index turn_log_entries_world_to_turn_idx on public.turn_log_entries (world_id, to_turn_number desc, id desc);

-- ---------------------------------------------------------------------------
-- Step 3: redefine every function that inserts into turn_log_entries so it
-- also populates from_turn_number/to_turn_number. Bodies copied verbatim from
-- their latest prior definitions except where noted.
-- ---------------------------------------------------------------------------
-- internal_apply_turn_transition_log_entries_and_notifications: latest body
-- from 20261126000000_partition_turn_log_entries.sql. Only change: the
-- from_turn_number/to_turn_number lookup (previously done later, only for
-- v_current_from_turn, to find the preceding transition) now happens before
-- the bulk insert and also captures to_turn_number, so both can be written
-- onto every row in the same insert. Everything else is byte-for-byte
-- unchanged.
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
  v_current_to_turn     integer;
  v_prev_transition_id  uuid;
begin
  log_entry_count    := 0;
  notification_count := 0;

  -- Task 1.6b: ensure this world's LIST partition exists before the bulk insert.
  perform public.ensure_turn_log_partition(p_world_id);

  -- Issue #1283: fetch the transition's turn numbers once, before the bulk
  -- insert, so every log entry row can carry its own denormalized
  -- from_turn_number/to_turn_number (avoids the turn-log browser having to
  -- join+sort on turn_transitions).
  select from_turn_number, to_turn_number
  into v_current_from_turn, v_current_to_turn
  from public.turn_transitions
  where id = p_transition_id;

  -- §C33a: Bulk-insert simulation log entries.
  insert into public.turn_log_entries (
    turn_transition_id,
    world_id,
    from_turn_number,
    to_turn_number,
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
    v_current_from_turn,
    v_current_to_turn,
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

  -- §1090: nation.tribute_missed — payer stockpile couldn't cover terms.quantity_per_turn
  -- in full (whatever existed was still transferred — see nation.tribute_transferred
  -- log entries, which have no notification). Unlike every block above, this event
  -- affects TWO nations (payer and payee), so recipients are computed per affected
  -- nation id read from the payload rather than the log row's own nation_id column.
  -- Severity: warning.
  insert into public.notifications (
    recipient_user_id,
    world_id,
    nation_id,
    notification_type,
    message_text,
    severity,
    generated_in_transition_id
  )
  select
    recipients.user_id,
    p_world_id,
    aff.nation_id,
    'nation.tribute_missed'::public.notification_type,
    'Tribute of ' || coalesce(r.name, 'a resource') ||
      ' was only partially paid this turn (' ||
      (logs.payload_jsonb ->> 'quantityTransferred') || '/' ||
      (logs.payload_jsonb ->> 'quantityRequested') || ').',
    'warning'::public.notification_severity,
    p_transition_id
  from (
    select payload_jsonb
    from public.turn_log_entries
    where turn_transition_id = p_transition_id
      and world_id = p_world_id
      and log_category = 'nation.tribute_missed'
  ) logs
  left join public.resources r on r.id = (logs.payload_jsonb ->> 'resourceId')::uuid
  cross join lateral (
    values
      ((logs.payload_jsonb ->> 'payerNationId')::uuid),
      ((logs.payload_jsonb ->> 'payeeNationId')::uuid)
  ) as aff (nation_id)
  cross join lateral (
    select c.user_id
    from public.citizens c
    inner join public.users u on u.id = c.user_id
    where c.role_type = 'nation_manager'
      and c.role_nation_id = aff.nation_id
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

  -- §1090: nation.treaty_expired — ends_turn_number reached; the treaty flips
  -- to 'expired' (internal_apply_turn_transition_treaty_patches, above). Same
  -- two-affected-nations recipient pattern as nation.tribute_missed. Severity:
  -- info (column default, set explicitly here for clarity).
  insert into public.notifications (
    recipient_user_id,
    world_id,
    nation_id,
    notification_type,
    message_text,
    severity,
    generated_in_transition_id
  )
  select
    recipients.user_id,
    p_world_id,
    aff.nation_id,
    'nation.treaty_expired'::public.notification_type,
    'A ' || replace(coalesce(logs.payload_jsonb ->> 'treatyType', 'nation'), '_', ' ') ||
      ' treaty has expired.',
    'info'::public.notification_severity,
    p_transition_id
  from (
    select payload_jsonb
    from public.turn_log_entries
    where turn_transition_id = p_transition_id
      and world_id = p_world_id
      and log_category = 'nation.treaty_expired'
  ) logs
  cross join lateral (
    values
      ((logs.payload_jsonb ->> 'proposerNationId')::uuid),
      ((logs.payload_jsonb ->> 'responderNationId')::uuid)
  ) as aff (nation_id)
  cross join lateral (
    select c.user_id
    from public.citizens c
    inner join public.users u on u.id = c.user_id
    where c.role_type = 'nation_manager'
      and c.role_nation_id = aff.nation_id
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

comment on function public.internal_apply_turn_transition_log_entries_and_notifications (uuid, uuid, jsonb) is 'Internal: bulk-inserts turn_log_entries (denormalizing from_turn_number/to_turn_number from the transition — issue #1283) and generates notifications from them for a completed turn transition.';

-- ---------------------------------------------------------------------------
-- create_partnership: latest body from
-- 20260607000003_rpc_error_contract_citizen_settlement_partnership.sql.
-- Change: the existing turn_transitions existence check now also captures
-- from_turn_number/to_turn_number for the turn_log_entries insert.
-- ---------------------------------------------------------------------------
create or replace function public.create_partnership (
  p_citizen_a_id uuid,
  p_citizen_b_id uuid,
  p_formed_on_turn_number integer,
  p_change_reason text,
  p_turn_transition_id uuid,
  p_status text default 'active',
  p_ended_on_turn_number integer default null
) returns setof public.partnerships language plpgsql security definer
set
  search_path = '' as $$
declare
  v_citizen_a public.citizens%rowtype;
  v_citizen_b public.citizens%rowtype;
  v_world_status text;
  v_world_archived_at timestamptz;
  v_actor_id uuid;
  v_partnership public.partnerships%rowtype;
  v_status text;
  v_from_turn_number integer;
  v_to_turn_number integer;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  if p_citizen_a_id is null or p_citizen_b_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if p_citizen_a_id = p_citizen_b_id then
    raise exception 'citizen_a and citizen_b must be different citizens' using errcode = 'P0001';
  end if;

  if p_formed_on_turn_number is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if p_formed_on_turn_number < 0 then
    raise exception 'formed_on_turn_number cannot be negative' using errcode = 'P0001';
  end if;

  if p_change_reason is null or btrim(p_change_reason) = '' then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if p_turn_transition_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  v_status := coalesce(p_status, 'active');
  if v_status not in ('active', 'widowed') then
    raise exception 'invalid status value' using errcode = 'P0001';
  end if;

  if v_status = 'active' and p_ended_on_turn_number is not null then
    raise exception 'active partnership must not have ended_on_turn_number' using errcode = 'P0001';
  end if;

  if v_status = 'widowed' and p_ended_on_turn_number is null then
    raise exception 'widowed partnership requires ended_on_turn_number' using errcode = 'P0001';
  end if;

  select * into v_citizen_a from public.citizens where id = p_citizen_a_id;
  select * into v_citizen_b from public.citizens where id = p_citizen_b_id;

  if v_citizen_a.id is null or v_citizen_b.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_citizen_a.world_id <> v_citizen_b.world_id then
    raise exception 'citizens must be in the same world' using errcode = 'P0001';
  end if;

  if not (
    public.is_super_admin ()
    or public.is_world_admin (v_citizen_a.world_id)
  ) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  select w.status, w.archived_at
  into v_world_status, v_world_archived_at
  from public.worlds w
  where w.id = v_citizen_a.world_id;

  if v_world_status = 'archived' or v_world_archived_at is not null then
    raise exception 'world is archived' using errcode = 'P0001';
  end if;

  if v_status = 'active'
    and (v_citizen_a.status <> 'alive' or v_citizen_b.status <> 'alive')
  then
    raise exception 'both citizens must be alive to form an active partnership' using errcode = 'P0001';
  end if;

  select tt.from_turn_number, tt.to_turn_number
  into v_from_turn_number, v_to_turn_number
  from public.turn_transitions tt
  where tt.id = p_turn_transition_id
    and tt.world_id = v_citizen_a.world_id;

  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  insert into public.partnerships (
    citizen_a_id,
    citizen_b_id,
    status,
    formed_on_turn_number,
    ended_on_turn_number,
    changed_by_user_id,
    change_reason
  ) values (
    p_citizen_a_id,
    p_citizen_b_id,
    v_status,
    p_formed_on_turn_number,
    p_ended_on_turn_number,
    v_actor_id,
    p_change_reason
  ) returning * into v_partnership;

  insert into public.turn_log_entries (
    turn_transition_id,
    world_id,
    from_turn_number,
    to_turn_number,
    citizen_id,
    log_category,
    payload_jsonb
  ) values (
    p_turn_transition_id,
    v_citizen_a.world_id,
    v_from_turn_number,
    v_to_turn_number,
    p_citizen_a_id,
    'partnership_created',
    jsonb_build_object(
      'partnership_id', v_partnership.id,
      'citizen_a_id', v_partnership.citizen_a_id,
      'citizen_b_id', v_partnership.citizen_b_id,
      'status', v_partnership.status,
      'formed_on_turn_number', v_partnership.formed_on_turn_number,
      'ended_on_turn_number', v_partnership.ended_on_turn_number,
      'change_reason', p_change_reason,
      'changed_by_user_id', v_actor_id
    )
  );

  return next v_partnership;
end;
$$;

-- ---------------------------------------------------------------------------
-- reassign_partner: latest body from
-- 20260607000003_rpc_error_contract_citizen_settlement_partnership.sql.
-- Same change as create_partnership.
-- ---------------------------------------------------------------------------
create or replace function public.reassign_partner (
  p_old_partnership_id uuid,
  p_retained_citizen_id uuid,
  p_new_partner_citizen_id uuid,
  p_ended_on_turn_number integer,
  p_formed_on_turn_number integer,
  p_change_reason text,
  p_turn_transition_id uuid
) returns setof public.partnerships language plpgsql security definer
set
  search_path = '' as $$
declare
  v_existing public.partnerships%rowtype;
  v_world_id uuid;
  v_world_status text;
  v_world_archived_at timestamptz;
  v_actor_id uuid;
  v_new_partner public.citizens%rowtype;
  v_retained public.citizens%rowtype;
  v_dissolved public.partnerships%rowtype;
  v_created public.partnerships%rowtype;
  v_from_turn_number integer;
  v_to_turn_number integer;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  if p_old_partnership_id is null
    or p_retained_citizen_id is null
    or p_new_partner_citizen_id is null
    or p_turn_transition_id is null
  then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if p_retained_citizen_id = p_new_partner_citizen_id then
    raise exception 'retained and new partner must be different citizens' using errcode = 'P0001';
  end if;

  if p_ended_on_turn_number is null or p_formed_on_turn_number is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if p_ended_on_turn_number < 0 or p_formed_on_turn_number < 0 then
    raise exception 'turn numbers cannot be negative' using errcode = 'P0001';
  end if;

  if p_change_reason is null or btrim(p_change_reason) = '' then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select * into v_existing from public.partnerships where id = p_old_partnership_id;
  if v_existing.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_existing.status <> 'active' then
    raise exception 'partnership is not active' using errcode = 'P0001';
  end if;

  if p_ended_on_turn_number < v_existing.formed_on_turn_number then
    raise exception 'ended_on_turn_number cannot precede the old partnership formed_on_turn_number' using errcode = 'P0001';
  end if;

  if p_retained_citizen_id <> v_existing.citizen_a_id
    and p_retained_citizen_id <> v_existing.citizen_b_id
  then
    raise exception 'retained citizen is not a participant in the old partnership' using errcode = 'P0001';
  end if;

  select * into v_retained from public.citizens where id = p_retained_citizen_id;
  select * into v_new_partner from public.citizens where id = p_new_partner_citizen_id;
  if v_retained.id is null or v_new_partner.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_retained.world_id <> v_new_partner.world_id then
    raise exception 'citizens must be in the same world' using errcode = 'P0001';
  end if;

  v_world_id := v_retained.world_id;

  if not (
    public.is_super_admin ()
    or public.is_world_admin (v_world_id)
  ) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  select w.status, w.archived_at
  into v_world_status, v_world_archived_at
  from public.worlds w
  where w.id = v_world_id;

  if v_world_status = 'archived' or v_world_archived_at is not null then
    raise exception 'world is archived' using errcode = 'P0001';
  end if;

  if v_retained.status <> 'alive' or v_new_partner.status <> 'alive' then
    raise exception 'both citizens must be alive to form a new partnership' using errcode = 'P0001';
  end if;

  select tt.from_turn_number, tt.to_turn_number
  into v_from_turn_number, v_to_turn_number
  from public.turn_transitions tt
  where tt.id = p_turn_transition_id
    and tt.world_id = v_world_id;

  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  update public.partnerships p
  set
    status = 'dissolved',
    ended_on_turn_number = p_ended_on_turn_number,
    changed_by_user_id = v_actor_id,
    change_reason = p_change_reason
  where p.id = p_old_partnership_id
  returning * into v_dissolved;

  insert into public.partnerships (
    citizen_a_id,
    citizen_b_id,
    status,
    formed_on_turn_number,
    changed_by_user_id,
    change_reason
  ) values (
    p_retained_citizen_id,
    p_new_partner_citizen_id,
    'active',
    p_formed_on_turn_number,
    v_actor_id,
    p_change_reason
  ) returning * into v_created;

  insert into public.turn_log_entries (
    turn_transition_id,
    world_id,
    from_turn_number,
    to_turn_number,
    citizen_id,
    log_category,
    payload_jsonb
  ) values (
    p_turn_transition_id,
    v_world_id,
    v_from_turn_number,
    v_to_turn_number,
    p_retained_citizen_id,
    'partnership_reassigned',
    jsonb_build_object(
      'dissolved_partnership_id', v_dissolved.id,
      'created_partnership_id', v_created.id,
      'retained_citizen_id', p_retained_citizen_id,
      'new_partner_citizen_id', p_new_partner_citizen_id,
      'previous_partner_citizen_id', case
        when v_existing.citizen_a_id = p_retained_citizen_id then v_existing.citizen_b_id
        else v_existing.citizen_a_id
      end,
      'ended_on_turn_number', p_ended_on_turn_number,
      'formed_on_turn_number', p_formed_on_turn_number,
      'change_reason', p_change_reason,
      'changed_by_user_id', v_actor_id
    )
  );

  return next v_created;
end;
$$;

-- ---------------------------------------------------------------------------
-- end_partnership_internal: latest body from
-- 20260607000003_rpc_error_contract_citizen_settlement_partnership.sql.
-- Same change as create_partnership.
-- ---------------------------------------------------------------------------
create or replace function public.end_partnership_internal (
  p_partnership_id uuid,
  p_terminal_status text,
  p_ended_on_turn_number integer,
  p_change_reason text,
  p_turn_transition_id uuid,
  p_log_category text
) returns setof public.partnerships language plpgsql security definer
set
  search_path = '' as $$
declare
  v_existing public.partnerships%rowtype;
  v_world_id uuid;
  v_world_status text;
  v_world_archived_at timestamptz;
  v_actor_id uuid;
  v_updated public.partnerships%rowtype;
  v_from_turn_number integer;
  v_to_turn_number integer;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  if p_partnership_id is null or p_turn_transition_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if p_terminal_status not in ('dissolved', 'widowed') then
    raise exception 'invalid terminal status' using errcode = 'P0001';
  end if;

  if p_ended_on_turn_number is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if p_ended_on_turn_number < 0 then
    raise exception 'ended_on_turn_number cannot be negative' using errcode = 'P0001';
  end if;

  if p_change_reason is null or btrim(p_change_reason) = '' then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select * into v_existing from public.partnerships where id = p_partnership_id;
  if v_existing.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_existing.status <> 'active' then
    raise exception 'partnership is not active' using errcode = 'P0001';
  end if;

  if p_ended_on_turn_number < v_existing.formed_on_turn_number then
    raise exception 'ended_on_turn_number cannot precede formed_on_turn_number' using errcode = 'P0001';
  end if;

  select c.world_id into v_world_id
  from public.citizens c
  where c.id = v_existing.citizen_a_id;

  if v_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not (
    public.is_super_admin ()
    or public.is_world_admin (v_world_id)
  ) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  select w.status, w.archived_at
  into v_world_status, v_world_archived_at
  from public.worlds w
  where w.id = v_world_id;

  if v_world_status = 'archived' or v_world_archived_at is not null then
    raise exception 'world is archived' using errcode = 'P0001';
  end if;

  select tt.from_turn_number, tt.to_turn_number
  into v_from_turn_number, v_to_turn_number
  from public.turn_transitions tt
  where tt.id = p_turn_transition_id
    and tt.world_id = v_world_id;

  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  update public.partnerships p
  set
    status = p_terminal_status,
    ended_on_turn_number = p_ended_on_turn_number,
    changed_by_user_id = v_actor_id,
    change_reason = p_change_reason
  where p.id = p_partnership_id
  returning * into v_updated;

  insert into public.turn_log_entries (
    turn_transition_id,
    world_id,
    from_turn_number,
    to_turn_number,
    citizen_id,
    log_category,
    payload_jsonb
  ) values (
    p_turn_transition_id,
    v_world_id,
    v_from_turn_number,
    v_to_turn_number,
    v_existing.citizen_a_id,
    p_log_category,
    jsonb_build_object(
      'partnership_id', v_updated.id,
      'citizen_a_id', v_updated.citizen_a_id,
      'citizen_b_id', v_updated.citizen_b_id,
      'status', v_updated.status,
      'formed_on_turn_number', v_updated.formed_on_turn_number,
      'ended_on_turn_number', v_updated.ended_on_turn_number,
      'change_reason', p_change_reason,
      'changed_by_user_id', v_actor_id
    )
  );

  return next v_updated;
end;
$$;

-- ---------------------------------------------------------------------------
-- manual_deconstruct_settlement_building: latest body from
-- 20260604000002_add_settlement_helper_auth_checks.sql. Unchanged — this path
-- inserts turn_transition_id = null (a manual action outside any turn
-- transition), so from_turn_number/to_turn_number stay null too, matching the
-- existing turn-log browser's exclusion of null-transition rows.
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

-- ---------------------------------------------------------------------------
-- internal_apply_turn_transition_event_patches: latest body from
-- 20260824000000_event_memories_per_turn.sql. Change: looks up
-- from_turn_number once (to_turn_number is already the p_to_turn_number
-- parameter) and populates both columns on the event_memories log insert.
-- ---------------------------------------------------------------------------
create or replace function public.internal_apply_turn_transition_event_patches (
  p_world_id uuid,
  p_transition_id uuid,
  p_to_turn_number integer,
  p_payload jsonb,
  out event_status_update_count integer,
  out citizen_memory_count integer
) returns record language plpgsql security definer
set
  search_path = '' as $$
declare
  v_patch jsonb;
  v_event_id uuid;
  v_to_status text;
  v_from_status text;
  v_remaining_transitions integer;
  v_duration_type text;
  v_duration_transitions integer;
  v_turn_offset integer;
  v_scope_type text;
  v_scope_nation_id uuid;
  v_scope_settlement_id uuid;
  v_memory_id uuid;
  v_memory_text text;
  v_inserted_count integer;
  v_from_turn_number integer;
begin
  event_status_update_count := 0;
  citizen_memory_count      := 0;

  select from_turn_number
  into v_from_turn_number
  from public.turn_transitions
  where id = p_transition_id;

  for v_patch in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'eventStatusPatches', '[]'::jsonb))
  loop
    v_event_id             := (v_patch ->> 'eventId')::uuid;
    v_to_status            := v_patch ->> 'toStatus';
    v_from_status          := v_patch ->> 'fromStatus';
    v_remaining_transitions := (v_patch ->> 'remainingTransitions')::integer;

    -- Apply the status + remaining_transitions update
    update public.events
    set
      status                 = v_to_status,
      remaining_transitions  = v_remaining_transitions
    where id = v_event_id
      and world_id = p_world_id;

    event_status_update_count := event_status_update_count + 1;

    select
      e.duration_type,
      e.duration_transitions,
      e.scope_type,
      e.scope_nation_id,
      e.scope_settlement_id
    into
      v_duration_type,
      v_duration_transitions,
      v_scope_type,
      v_scope_nation_id,
      v_scope_settlement_id
    from public.events e
    where e.id = v_event_id;

    if not found then
      continue;
    end if;

    -- Turns elapsed since first activation: 0 on the turn the event first
    -- activates, incrementing by 1 each subsequent turn it stays active.
    v_turn_offset := case
      when v_duration_type = 'instant' then 0
      else coalesce(v_duration_transitions, 1) - coalesce(v_remaining_transitions, 0) - 1
    end;

    select em.id, em.memory_text
    into v_memory_id, v_memory_text
    from public.event_memories em
    where em.event_id = v_event_id
      and em.turn_offset = v_turn_offset;

    -- Defensive: never let a blank memory_text abort the turn transition.
    if found
      and v_memory_text is not null
      and btrim(v_memory_text) <> '' then
      if v_scope_type = 'settlement' then
        insert into public.citizen_memories (
          citizen_id,
          world_id,
          memory_text,
          source,
          event_id,
          event_memory_id,
          occurred_on_turn_number
        )
        select
          c.id,
          c.world_id,
          v_memory_text,
          'event',
          v_event_id,
          v_memory_id,
          p_to_turn_number
        from public.citizens c
        where c.settlement_id = v_scope_settlement_id
          and c.status = 'alive'
        on conflict do nothing;

      elsif v_scope_type = 'nation' then
        insert into public.citizen_memories (
          citizen_id,
          world_id,
          memory_text,
          source,
          event_id,
          event_memory_id,
          occurred_on_turn_number
        )
        select
          c.id,
          c.world_id,
          v_memory_text,
          'event',
          v_event_id,
          v_memory_id,
          p_to_turn_number
        from public.citizens c
        join public.settlements s on s.id = c.settlement_id
        where s.nation_id = v_scope_nation_id
          and c.status = 'alive'
        on conflict do nothing;

      elsif v_scope_type = 'world' then
        insert into public.citizen_memories (
          citizen_id,
          world_id,
          memory_text,
          source,
          event_id,
          event_memory_id,
          occurred_on_turn_number
        )
        select
          c.id,
          c.world_id,
          v_memory_text,
          'event',
          v_event_id,
          v_memory_id,
          p_to_turn_number
        from public.citizens c
        where c.world_id = p_world_id
          and c.status = 'alive'
        on conflict do nothing;
      end if;

      get diagnostics v_inserted_count = row_count;
      citizen_memory_count := citizen_memory_count + v_inserted_count;

      -- Only log turns that actually created memories (avoids a 0-count log
      -- entry every turn for the lifetime of a sustained event).
      if v_inserted_count > 0 then
        insert into public.turn_log_entries (
          turn_transition_id,
          world_id,
          from_turn_number,
          to_turn_number,
          log_category,
          payload_jsonb
        ) values (
          p_transition_id,
          p_world_id,
          v_from_turn_number,
          p_to_turn_number,
          'event_memories',
          jsonb_build_object(
            'eventId', v_event_id::text,
            'count',   v_inserted_count
          )
        );
      end if;
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- internal_apply_turn_transition_law_amendment_expiry: latest body from
-- 20261007000001_add_law_amendments.sql. p_turn_number is the transition's
-- to_turn_number; from_turn_number is looked up once before the loop.
-- ---------------------------------------------------------------------------
create or replace function public.internal_apply_turn_transition_law_amendment_expiry (
  p_transition_id uuid,
  p_world_id uuid,
  p_turn_number integer,
  out amendment_expired_count integer,
  out amendment_notification_count integer
) returns record language plpgsql security definer
set
  search_path = '' as $$
declare
  v_amendment record;
  v_rows integer;
  v_from_turn_number integer;
begin
  amendment_expired_count := 0;
  amendment_notification_count := 0;

  select from_turn_number
  into v_from_turn_number
  from public.turn_transitions
  where id = p_transition_id;

  for v_amendment in
    select a.id, a.title, d.nation_id, d.settlement_id
    from public.law_amendments a
    inner join public.law_documents d on d.id = a.document_id
    where d.world_id = p_world_id
      and a.status = 'proposed'
      and a.deadline_turn_number is not null
      and a.deadline_turn_number <= p_turn_number
    order by a.id
  loop
    update public.law_amendments
    set status = 'expired', resolved_turn_number = p_turn_number
    where id = v_amendment.id;

    amendment_expired_count := amendment_expired_count + 1;

    insert into public.turn_log_entries (
      turn_transition_id, world_id, from_turn_number, to_turn_number, nation_id, settlement_id, log_category, payload_jsonb
    )
    values (
      p_transition_id, p_world_id, v_from_turn_number, p_turn_number, v_amendment.nation_id, v_amendment.settlement_id,
      'law.amendment_expired',
      jsonb_build_object('amendmentId', v_amendment.id, 'title', v_amendment.title)
    );

    insert into public.notifications (
      recipient_user_id, world_id, nation_id, settlement_id, notification_type, message_text,
      severity, generated_in_transition_id
    )
    select
      recipients.user_id, p_world_id, v_amendment.nation_id, v_amendment.settlement_id,
      'law.amendment_expired'::public.notification_type,
      format('Amendment "%s" expired without quorum.', v_amendment.title),
      'warning'::public.notification_severity,
      p_transition_id
    from (
      select c.user_id
      from public.citizens c
      where c.status = 'alive'
        and c.citizen_type = 'player_character'
        and c.user_id is not null
        and (
          (v_amendment.nation_id is not null and (
            (c.role_type = 'nation_manager' and c.role_nation_id = v_amendment.nation_id)
            or (c.role_type = 'settlement_manager' and c.role_settlement_id in (
              select s.id from public.settlements s where s.nation_id = v_amendment.nation_id
            ))
          ))
          or (v_amendment.settlement_id is not null and c.role_type = 'settlement_manager' and c.role_settlement_id = v_amendment.settlement_id)
        )
      union
      select wa.user_id from public.world_admins wa where wa.world_id = p_world_id
      union
      select u.id from public.users u where u.is_super_admin = true
    ) as recipients (user_id)
    inner join public.users u on u.id = recipients.user_id and u.status = 'active'
    on conflict (
      generated_in_transition_id,
      recipient_user_id,
      notification_type,
      coalesce(event_id, '00000000-0000-0000-0000-000000000000'::uuid),
      coalesce(citizen_id, '00000000-0000-0000-0000-000000000000'::uuid),
      coalesce(settlement_id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) where generated_in_transition_id is not null
    do nothing;

    get diagnostics v_rows = row_count;
    amendment_notification_count := amendment_notification_count + v_rows;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- internal_apply_turn_transition_office_term_expiry: latest body from
-- 20261009000001_add_office_terms.sql. Same change as
-- internal_apply_turn_transition_law_amendment_expiry.
-- ---------------------------------------------------------------------------
create or replace function public.internal_apply_turn_transition_office_term_expiry (
  p_transition_id uuid,
  p_world_id uuid,
  p_turn_number integer,
  out office_term_expired_count integer,
  out office_term_expiry_notification_count integer
) returns record language plpgsql security definer
set
  search_path = '' as $$
declare
  v_office record;
  v_rows integer;
  v_from_turn_number integer;
begin
  office_term_expired_count := 0;
  office_term_expiry_notification_count := 0;

  select from_turn_number
  into v_from_turn_number
  from public.turn_transitions
  where id = p_transition_id;

  for v_office in
    select o.id, o.citizen_id, c.name as citizen_name, ot.name as office_type_name,
      o.nation_id, o.settlement_id
    from public.nation_offices o
    inner join public.citizens c on c.id = o.citizen_id
    inner join public.office_types ot on ot.id = o.office_type_id
    where o.world_id = p_world_id
      and o.ended_turn_number is null
      and o.expires_turn_number is not null
      and o.expires_turn_number <= p_turn_number
    order by o.id
  loop
    update public.nation_offices
    set ended_turn_number = p_turn_number
    where id = v_office.id;

    office_term_expired_count := office_term_expired_count + 1;

    insert into public.turn_log_entries (
      turn_transition_id, world_id, from_turn_number, to_turn_number, nation_id, settlement_id, log_category, payload_jsonb
    )
    values (
      p_transition_id, p_world_id, v_from_turn_number, p_turn_number, v_office.nation_id, v_office.settlement_id,
      'office.term_ended',
      jsonb_build_object(
        'officeId', v_office.id,
        'citizenId', v_office.citizen_id,
        'citizenName', v_office.citizen_name,
        'officeTypeName', v_office.office_type_name
      )
    );

    insert into public.notifications (
      recipient_user_id, world_id, nation_id, settlement_id, notification_type, message_text,
      severity, generated_in_transition_id
    )
    select
      recipients.user_id, p_world_id, v_office.nation_id, v_office.settlement_id,
      'office.term_ended'::public.notification_type,
      format('%s''s term as %s has ended.', v_office.citizen_name, v_office.office_type_name),
      'info'::public.notification_severity,
      p_transition_id
    from (
      select c.user_id
      from public.citizens c
      where c.status = 'alive'
        and c.citizen_type = 'player_character'
        and c.user_id is not null
        and (
          (v_office.nation_id is not null and c.role_type = 'nation_manager' and c.role_nation_id = v_office.nation_id)
          or (v_office.settlement_id is not null and c.role_type = 'settlement_manager' and c.role_settlement_id = v_office.settlement_id)
        )
      union
      select wa.user_id from public.world_admins wa where wa.world_id = p_world_id
      union
      select u.id from public.users u where u.is_super_admin = true
    ) as recipients (user_id)
    inner join public.users u on u.id = recipients.user_id and u.status = 'active'
    on conflict (
      generated_in_transition_id,
      recipient_user_id,
      notification_type,
      coalesce(event_id, '00000000-0000-0000-0000-000000000000'::uuid),
      coalesce(citizen_id, '00000000-0000-0000-0000-000000000000'::uuid),
      coalesce(settlement_id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) where generated_in_transition_id is not null
    do nothing;

    get diagnostics v_rows = row_count;
    office_term_expiry_notification_count := office_term_expiry_notification_count + v_rows;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- internal_apply_turn_transition_citizen_partnership_patches: latest body
-- from 20261104000000_add_education_natural_born_percent.sql. §C32e retroactively
-- stamps turn_transition_id onto manual_deconstruct_overshoot rows (inserted
-- with turn_transition_id = null by manual_deconstruct_settlement_building)
-- once a turn transition picks them up. Change: the same stamp now also
-- backfills from_turn_number/to_turn_number, so those rows carry a turn
-- number as soon as they gain a transition instead of staying null forever.
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
  v_birth_culture_id uuid;
  v_birth_religion_id uuid;
  v_birth_education_level_id uuid;
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
  v_from_turn_number integer;
  v_to_turn_number integer;
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
    v_birth_culture_id          := (v_birth ->> 'cultureId')::uuid;
    v_birth_religion_id         := (v_birth ->> 'religionId')::uuid;
    v_birth_education_level_id  := (v_birth ->> 'educationLevelId')::uuid;

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
      v_birth_nameset_id,
      v_birth_culture_id,
      v_birth_religion_id,
      v_birth_education_level_id
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
    -- everywhere a role is used for authority or notification fan-out -- the
    -- role itself lingering past death was the actual gap, not those checks).
    update public.citizens
    set
      status               = 'dead',
      death_cause_category = v_death_cause_category,
      death_cause           = v_death_cause,
      role_type             = 'none',
      role_nation_id        = null,
      role_settlement_id    = null
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
    where citizen_id = v_citizen_id;

    assignment_clear_count := assignment_clear_count + 1;
  end loop;

  select from_turn_number, to_turn_number
  into v_from_turn_number, v_to_turn_number
  from public.turn_transitions
  where id = p_transition_id;

  update public.turn_log_entries
  set
    turn_transition_id = p_transition_id,
    from_turn_number = v_from_turn_number,
    to_turn_number = v_to_turn_number
  where
    world_id = p_world_id
    and log_category = 'manual_deconstruct_overshoot'
    and turn_transition_id is null;

  get diagnostics overshoot_stamp_count = row_count;
end;
$$;
