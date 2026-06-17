-- Migration: emit_turn_completed_notification
-- Adds a turn.completed notification to the live end-turn flow.
--
-- Previously, turn.completed was only emitted by the legacy
-- advance_world_turn_if_current RPC (dropped in 20260603000010).
-- apply_turn_transition never wired it up, so the Turn completed filter in
-- the notifications UI always returned empty.
--
-- Fix: extend internal_apply_turn_transition_log_entries_and_notifications
-- with a §C33c block that inserts one turn.completed row per active world
-- admin and active super admin for the transition's world.  Recipients are
-- world-scoped (no settlement_id / nation_id).  The existing partial unique
-- index (notifications_transition_dedup_idx) prevents duplicates if the
-- function is called more than once for the same transition.
-- ---------------------------------------------------------------------------
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
  v_rows integer;
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

  -- building.suspended
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
    select distinct settlement_id
    from public.turn_log_entries
    where turn_transition_id = p_transition_id
      and world_id = p_world_id
      and log_category = 'building.suspended'
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

  -- managed_population.declining (same recipients as building.suspended)
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
    select distinct settlement_id
    from public.turn_log_entries
    where turn_transition_id = p_transition_id
      and world_id = p_world_id
      and log_category = 'managed_population.declining'
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

  -- settlement.starvation_occurred (same recipients as building.suspended)
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
    select distinct settlement_id
    from public.turn_log_entries
    where turn_transition_id = p_transition_id
      and world_id = p_world_id
      and log_category = 'settlement.starvation_occurred'
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

  -- partnership.formed (settlement-scoped: same recipients as building.suspended)
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
    'partnership.formed'::public.notification_type,
    'A new partnership formed.',
    p_transition_id
  from (
    select distinct settlement_id
    from public.turn_log_entries
    where turn_transition_id = p_transition_id
      and world_id = p_world_id
      and log_category = 'partnership.formed'
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

end;
$$;

revoke all on function public.internal_apply_turn_transition_log_entries_and_notifications (uuid, uuid, jsonb)
from
  public;
