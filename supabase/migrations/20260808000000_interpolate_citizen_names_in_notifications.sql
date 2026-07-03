-- Migration: interpolate_citizen_names_in_notifications
-- Issue #938: partnership.formed and citizen.born notification text was a
-- static literal ('A new partnership formed.' / 'A citizen was born in this
-- settlement.'), so players could not tell who a notification was about
-- without leaving it to hunt for the citizen elsewhere.
--
-- Changes:
--   1. partnership.formed now fires one notification PER formation event
--      (was aggregated per settlement — "select distinct settlement_id" over
--      turn_log_entries) and interpolates both citizens' names, e.g.
--      "Kestrel Crane and Merek Weaverson formed a partnership." Sourced
--      directly from p_payload -> 'partnershipChanges' (filtered to
--      toStatus = 'active', which only "formed" entries ever carry — see
--      PartnershipChange in simulationTypes.ts), joined to public.citizens
--      by citizenAId/citizenBId. citizen_id is set to citizen A's id purely
--      so the transition/recipient/type/citizen/settlement dedup index
--      (notifications_transition_dedup_idx) no longer collapses multiple
--      same-settlement formations in one transition into a single row — a
--      citizen can be citizen A in at most one formation per transition.
--   2. citizen.born now fires one notification PER newborn (was likewise
--      aggregated per settlement) and interpolates the newborn's name, e.g.
--      "Kestrel Crane was born in this settlement.", with citizen_id set so
--      the notification links to the new citizen record. Sourced from
--      p_payload -> 'citizenBirths', matched back to the newly-inserted
--      public.citizens row by settlement/parents/turn/name. This is the
--      "backfill the id once created" option from the issue: the newborn's
--      citizen_id is genuinely unknown when the simulation engine emits the
--      citizen.born log entry (§C33a below still runs first in this same
--      function), but internal_apply_turn_transition_citizen_partnership_patches
--      — which performs the actual citizen INSERT — always runs earlier in
--      the enclosing apply_turn_transition call, so the row already exists
--      by the time this function runs.
--
-- Both generators move off the turn_log_entries aggregate scan and read
-- p_payload directly instead, matching the pattern already used by
-- event.activated/event.expired (eventStatusPatches) and citizen.died
-- (citizenDeaths). No payload shape change: partnershipChanges and
-- citizenBirths already carried citizenAId/citizenBId and
-- parentACitizenId/parentBCitizenId/givenName/surname/settlementId
-- respectively for citizen-creation purposes; this migration is simply the
-- first notification generator to also read those fields. No
-- src/types/database.ts impact — the function signature is unchanged.
--
-- Known limitation: if the same couple has two newborns in the same
-- settlement in the same transition with an identical given_name AND
-- surname (true identical-name twins), the citizen.born match below can
-- pair births with citizens non-deterministically. Both notifications still
-- fire; only which newborn a given notification's citizen_id links to may
-- be swapped. Considered acceptable given the rarity of exact same-name
-- twins.
-- ---------------------------------------------------------------------------
comment on column public.notifications.citizen_id is 'FK to citizens; set for citizen.died (per-citizen), citizen.born (per-newborn), and partnership.formed (citizen A of the pair) notifications.';

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

  -- building.suspended (state condition — state-entry guard applied)
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
    'A building was suspended due to insufficient upkeep resources.',
    p_transition_id
  from (
    select distinct cur.settlement_id
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

  -- building.auto_deconstructed (same recipients as building.suspended)
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
    'A building was auto-deconstructed after missing upkeep for too long.',
    p_transition_id
  from (
    select distinct settlement_id
    from public.turn_log_entries
    where turn_transition_id = p_transition_id
      and world_id = p_world_id
      and log_category = 'building.auto_deconstructed'
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

  -- building.recovered (same recipients as building.suspended)
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
    'A suspended building resumed operation after upkeep costs were met.',
    p_transition_id
  from (
    select distinct settlement_id
    from public.turn_log_entries
    where turn_transition_id = p_transition_id
      and world_id = p_world_id
      and log_category = 'building.recovered'
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

  -- construction.completed (same recipients as building.suspended)
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
    'Construction completed.',
    p_transition_id
  from (
    select distinct settlement_id
    from public.turn_log_entries
    where turn_transition_id = p_transition_id
      and world_id = p_world_id
      and log_category = 'construction.completed'
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

  -- deposit.depleted (nation-scoped: nation managers + world admins + super admins)
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
    'A deposit was depleted.',
    p_transition_id
  from (
    select distinct nation_id
    from public.turn_log_entries
    where turn_transition_id = p_transition_id
      and world_id = p_world_id
      and log_category = 'deposit.depleted'
      and nation_id is not null
  ) logs (nation_id)
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

  -- managed_population.extinct (same recipients as building.suspended)
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
    'A managed population has gone extinct.',
    p_transition_id
  from (
    select distinct settlement_id
    from public.turn_log_entries
    where turn_transition_id = p_transition_id
      and world_id = p_world_id
      and log_category = 'managed_population.extinct'
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

  -- managed_population.declining (state condition — state-entry guard applied)
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
    'A managed population is declining due to insufficient maintenance or husbandry.',
    p_transition_id
  from (
    select distinct cur.settlement_id
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

  -- settlement.starvation_occurred (state condition — state-entry guard applied)
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
    'Citizen(s) starved in this settlement.',
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

  -- settlement.homelessness_occurred (same recipients as building.suspended)
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
    'Citizen(s) died from homelessness in this settlement.',
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

  -- construction.paused (settlement-scoped: same recipients as building.suspended)
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
    'A construction project was paused due to insufficient resources.',
    p_transition_id
  from (
    select distinct settlement_id
    from public.turn_log_entries
    where turn_transition_id = p_transition_id
      and world_id = p_world_id
      and log_category = 'construction.paused'
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

  -- partnership.formed (per formation event; interpolates both citizens' names —
  -- issue #938). See migration header for the full rationale.
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

  -- partnership.widowed (settlement-scoped: same recipients as building.suspended)
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
    'partnership.widowed'::public.notification_type,
    'A partnership was widowed.',
    p_transition_id
  from (
    select distinct settlement_id
    from public.turn_log_entries
    where turn_transition_id = p_transition_id
      and world_id = p_world_id
      and log_category = 'partnership.widowed'
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

  -- trade_route.paused (settlement-scoped: same recipients as building.suspended)
  -- log entry carries settlement_id = origin settlement id
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
    'trade_route.paused'::public.notification_type,
    'A trade route was paused.',
    p_transition_id
  from (
    select distinct settlement_id
    from public.turn_log_entries
    where turn_transition_id = p_transition_id
      and world_id = p_world_id
      and log_category = 'trade_route.paused'
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

  -- trade_route.resumed (settlement-scoped: same recipients as building.suspended)
  -- log entry carries settlement_id = origin settlement id
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
    'trade_route.resumed'::public.notification_type,
    'A trade route has resumed.',
    p_transition_id
  from (
    select distinct settlement_id
    from public.turn_log_entries
    where turn_transition_id = p_transition_id
      and world_id = p_world_id
      and log_category = 'trade_route.resumed'
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
    'Event "' || e.name || '" has been activated.',
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
  -- and event_id deep-link as event.activated.
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
    'Event "' || e.name || '" has expired.',
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
  -- rationale on the settlement/parents/turn/name match.
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
  -- to resolve the settlement scope for recipients.
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
    'A citizen has died.',
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
