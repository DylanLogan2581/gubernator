-- Migration: partition_turn_log_entries
--
-- Task 1.6b of the DB scaling roadmap. Converts the append-only per-turn log
-- table public.turn_log_entries into a single-level partitioned table:
--   PARTITION BY LIST (world_id)  -- one partition per world (physical isolation)
--   + a DEFAULT partition as a catch-all safety net so an insert can never fail
--     for a missing world partition.
--
-- This table has NO turn_number column, so (unlike the sibling 1.6a table
-- settlement_turn_resource_snapshots) there is NO turn sub-partitioning.
-- Retention for turn_log_entries stays a batched DELETE via the shared
-- internal_prune_batch_delete helper, which Task 1.6a already made
-- partition-safe (it identifies rows by (tableoid, ctid)); this migration does
-- NOT modify retention logic.
--
-- Structure-only change: same 9 columns/types/defaults, all 3 CHECK
-- constraints, all 5 FKs, all 6 secondary indexes, the same RLS SELECT policy,
-- the same append-only grant posture, and the same validate-scope BEFORE
-- trigger. The turn engine and every existing test must still pass. No
-- simulation-output change.
--
-- Security lessons carried over from Task 1.6a (review-caught there): child
-- partitions do NOT inherit the parent's RLS or grants. In Supabase every
-- public table is reachable via PostgREST by `authenticated` under its OWN RLS,
-- so EACH partition (DEFAULT, migration-time, runtime) is secured by a single
-- shared helper that enables RLS, replicates the parent SELECT policy, and
-- revokes insert/update/delete from authenticated,anon (append-only: writes go
-- only through the SECURITY DEFINER RPC). Omitting the revoke is a Critical
-- write-escalation hole.
-- ===========================================================================
-- ---------------------------------------------------------------------------
-- Step 0: shared securing helper. Enables RLS and reproduces the parent's
-- security posture on a single partition. Child partitions are ordinary tables
-- in schema public and receive Supabase's default authenticated/anon grants, so
-- without their own RLS + write-revoke an authenticated user could SELECT a
-- partition directly (bypassing the parent world-access policy) or POST a write
-- directly to it. Applying this to every partition closes both holes and keeps
-- the "every public table has RLS + a policy" invariant satisfied for
-- dynamically-created partitions. Parent-routed queries use only the parent's
-- policy (Postgres does not double-apply child policies), so normal access
-- semantics are unchanged.
-- ---------------------------------------------------------------------------
create or replace function public.internal_secure_turn_log_partition (p_partition regclass) returns void language plpgsql security definer
set
  search_path = '' as $$
begin
  execute format('alter table %s enable row level security', p_partition);
  execute format('create policy "turn_log_entries_select_world_access" on %s for select to authenticated using (public.current_user_has_world_access(world_id))', p_partition);
  -- Append-only posture: child partitions keep Supabase's default broad
  -- authenticated/anon write grants. The parent revokes direct INSERT/UPDATE/
  -- DELETE from authenticated (writes flow only through the SECURITY DEFINER
  -- RPC); the same must hold on every child or a caller could POST directly to
  -- a partition and fabricate log rows, bypassing the RPC-only write path.
  execute format('revoke insert, update, delete on %s from authenticated, anon', p_partition);
end;
$$;

comment on function public.internal_secure_turn_log_partition (regclass) is 'Internal: enables RLS, creates the turn_log_entries SELECT policy, and revokes direct writes on one turn_log_entries partition, so direct partition access has the same append-only + world-access posture as the parent. Not granted to authenticated.';

revoke all on function public.internal_secure_turn_log_partition (regclass)
from
  public;

revoke
execute on function public.internal_secure_turn_log_partition (regclass)
from
  anon,
  authenticated;

-- ---------------------------------------------------------------------------
-- Step 0b: ensure_turn_log_partition -- idempotently creates a world's LIST
-- partition (secured via the helper) if missing. Called at the top of the
-- bulk log-insert path so the target partition exists before insert. Safe to
-- call every turn. Not granted to authenticated. The DEFAULT partition is a
-- safety net, but running ensure_ first gives a new world's rows a dedicated
-- secured partition instead of landing them in DEFAULT (which would later block
-- attaching that world's partition with a check_violation).
-- ---------------------------------------------------------------------------
create or replace function public.ensure_turn_log_partition (p_world_id uuid) returns void language plpgsql security definer
set
  search_path = '' as $$
declare
  v_hex        text := replace(p_world_id::text, '-', '');
  v_world_part text := 'turn_log_w_' || v_hex;
begin
  if to_regclass('public.' || v_world_part) is null then
    begin
      execute format(
        'create table public.%I partition of public.turn_log_entries for values in (%L)',
        v_world_part, p_world_id
      );
      perform public.internal_secure_turn_log_partition(('public.' || v_world_part)::regclass);
    exception
      when duplicate_table then null;   -- created concurrently; fine
      when duplicate_object then null;  -- policy already present (race); fine
      when check_violation then null;   -- rows already sit in the DEFAULT partition; leave them there
    end;
  end if;
end;
$$;

comment on function public.ensure_turn_log_partition (uuid) is 'Internal: idempotently ensures the LIST partition for p_world_id exists on turn_log_entries and is secured (RLS + SELECT policy + write-revoke). Called at the top of internal_apply_turn_transition_log_entries_and_notifications so the target partition exists before insert. Safe to call every turn. Not granted to authenticated.';

revoke all on function public.ensure_turn_log_partition (uuid)
from
  public;

revoke
execute on function public.ensure_turn_log_partition (uuid)
from
  anon,
  authenticated;

-- ---------------------------------------------------------------------------
-- Step 1: new partitioned parent (temporary name turn_log_entries_p). The PK
-- backing index name must be temporary because index names are schema-unique
-- and the old table still owns the canonical name until it is dropped in step
-- 5. CHECK/FK constraint names are per-table, so they take their final names
-- directly. New PK is (world_id, id): a partitioned table's PK must include the
-- partition key.
-- ---------------------------------------------------------------------------
create table public.turn_log_entries_p (
  id uuid not null default gen_random_uuid(),
  turn_transition_id uuid,
  world_id uuid not null,
  nation_id uuid,
  settlement_id uuid,
  citizen_id uuid,
  resource_id uuid,
  log_category text not null,
  payload_jsonb jsonb not null default '{}'::jsonb,
  constraint turn_log_entries_pkey_tmp primary key (world_id, id),
  constraint turn_log_entries_log_category_check check (char_length(btrim(log_category)) >= 1),
  constraint turn_log_entries_log_category_max_length_check check (char_length(log_category) <= 64),
  constraint turn_log_entries_payload_jsonb_size_check check (pg_column_size(payload_jsonb) <= 32768),
  constraint turn_log_entries_world_id_fkey foreign key (world_id) references public.worlds (id) on delete cascade,
  constraint turn_log_entries_nation_id_fkey foreign key (nation_id) references public.nations (id) on delete set null,
  constraint turn_log_entries_settlement_id_fkey foreign key (settlement_id) references public.settlements (id) on delete set null,
  constraint turn_log_entries_citizen_id_fkey foreign key (citizen_id) references public.citizens (id) on delete set null,
  constraint turn_log_entries_transition_world_fkey foreign key (turn_transition_id, world_id) references public.turn_transitions (id, world_id) on delete cascade
)
partition by
  list (world_id);

comment on column public.turn_log_entries_p.citizen_id is 'Nullable placeholder for the future citizens table; intentionally not yet constrained by a foreign key.';

comment on column public.turn_log_entries_p.resource_id is 'Nullable placeholder for the future resources table; intentionally not yet constrained by a foreign key.';

-- Catch-all DEFAULT partition: any world without an explicit partition lands
-- here so a direct insert can never fail for a missing partition.
create table public.turn_log_entries_p_default partition of public.turn_log_entries_p default;

select
  public.internal_secure_turn_log_partition ('public.turn_log_entries_p_default'::regclass);

-- ---------------------------------------------------------------------------
-- Step 2: create a LIST partition per existing world that has rows. Names match
-- ensure_turn_log_partition so runtime and migration-time agree.
-- ---------------------------------------------------------------------------
do $$
declare
  v_world      record;
  v_hex        text;
  v_world_part text;
begin
  for v_world in
    select distinct world_id
    from public.turn_log_entries
  loop
    v_hex        := replace(v_world.world_id::text, '-', '');
    v_world_part := 'turn_log_w_' || v_hex;

    execute format(
      'create table public.%I partition of public.turn_log_entries_p for values in (%L)',
      v_world_part, v_world.world_id
    );
    perform public.internal_secure_turn_log_partition(('public.' || v_world_part)::regclass);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Step 3: copy all rows (columns in table order) into the partitioned table.
-- ---------------------------------------------------------------------------
insert into
  public.turn_log_entries_p (
    id,
    turn_transition_id,
    world_id,
    nation_id,
    settlement_id,
    citizen_id,
    resource_id,
    log_category,
    payload_jsonb
  )
select
  id,
  turn_transition_id,
  world_id,
  nation_id,
  settlement_id,
  citizen_id,
  resource_id,
  log_category,
  payload_jsonb
from
  public.turn_log_entries;

-- ---------------------------------------------------------------------------
-- Step 4: integrity self-check. ABORT (raise) if the row count OR an
-- order-independent digest over every column differs, BEFORE the old table is
-- dropped. If this fails the whole transaction rolls back and the old table
-- survives untouched.
-- ---------------------------------------------------------------------------
do $$
declare
  v_old_count  bigint;
  v_new_count  bigint;
  v_old_digest numeric;
  v_new_digest numeric;
begin
  select count(*),
         coalesce(sum(hashtextextended(
           id::text || '|' || coalesce(turn_transition_id::text, '') || '|'
           || world_id::text || '|' || coalesce(nation_id::text, '') || '|'
           || coalesce(settlement_id::text, '') || '|' || coalesce(citizen_id::text, '') || '|'
           || coalesce(resource_id::text, '') || '|' || log_category || '|'
           || payload_jsonb::text, 0)), 0)
    into v_old_count, v_old_digest
  from public.turn_log_entries;

  select count(*),
         coalesce(sum(hashtextextended(
           id::text || '|' || coalesce(turn_transition_id::text, '') || '|'
           || world_id::text || '|' || coalesce(nation_id::text, '') || '|'
           || coalesce(settlement_id::text, '') || '|' || coalesce(citizen_id::text, '') || '|'
           || coalesce(resource_id::text, '') || '|' || log_category || '|'
           || payload_jsonb::text, 0)), 0)
    into v_new_count, v_new_digest
  from public.turn_log_entries_p;

  if v_old_count <> v_new_count or v_old_digest <> v_new_digest then
    raise exception 'turn_log_entries partition integrity check FAILED: count(old=%, new=%), digest(old=%, new=%)',
      v_old_count, v_new_count, v_old_digest, v_new_digest;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Step 5: drop the old table (frees the canonical table / index / constraint
-- names). No inbound FKs reference turn_log_entries, so no dependents to drop.
-- ---------------------------------------------------------------------------
drop table public.turn_log_entries;

-- ---------------------------------------------------------------------------
-- Step 6: rename the new parent and its PK-backing constraint to canonical.
-- (RENAME CONSTRAINT on the PK also renames the backing index.)
-- ---------------------------------------------------------------------------
alter table public.turn_log_entries_p
rename to turn_log_entries;

alter table public.turn_log_entries
rename constraint turn_log_entries_pkey_tmp to turn_log_entries_pkey;

-- ---------------------------------------------------------------------------
-- Step 7: recreate the 6 secondary indexes on the parent (propagate to all
-- partitions). NOTE: turn_log_entries_world_id_idx was dropped in Task 1.4 and
-- is intentionally NOT recreated.
-- ---------------------------------------------------------------------------
create index turn_log_entries_turn_transition_id_idx on public.turn_log_entries (turn_transition_id);

create index turn_log_entries_world_category_idx on public.turn_log_entries (world_id, log_category);

create index turn_log_entries_world_settlement_idx on public.turn_log_entries (world_id, settlement_id)
where
  settlement_id is not null;

create index turn_log_entries_world_nation_idx on public.turn_log_entries (world_id, nation_id)
where
  nation_id is not null;

create index turn_log_entries_world_citizen_idx on public.turn_log_entries (world_id, citizen_id)
where
  citizen_id is not null;

create index turn_log_entries_world_resource_idx on public.turn_log_entries (world_id, resource_id)
where
  resource_id is not null;

-- ---------------------------------------------------------------------------
-- Step 8: RLS + grants + trigger. Reproduces the exact net posture on the
-- recreated parent (which inherits Supabase's default privileges on creation):
-- authenticated keeps SELECT only; insert/update/delete are revoked (append-only
-- -- writes flow through the SECURITY DEFINER RPC path). Only the SELECT policy
-- exists (there were never insert/update/delete policies after the append-only
-- lockdown). The validate-scope BEFORE trigger is recreated on the parent; as a
-- BEFORE ROW trigger on a partitioned parent it cascades to every partition and
-- fires for parent-routed inserts.
-- ---------------------------------------------------------------------------
alter table public.turn_log_entries enable row level security;

create policy "turn_log_entries_select_world_access" on public.turn_log_entries for
select
  to authenticated using (public.current_user_has_world_access (world_id));

revoke insert,
update,
delete on public.turn_log_entries
from
  authenticated;

create trigger turn_log_entries_validate_scope before insert
or
update on public.turn_log_entries for each row
execute function public.validate_turn_log_entry_scope ();

-- ---------------------------------------------------------------------------
-- Step 9: re-create the bulk log-insert helper with a single
-- ensure_turn_log_partition call at the top so the target world partition
-- always exists before the bulk insert; all other logic is preserved
-- byte-for-byte from the latest definition (20260915000001).
--
-- NOTE: the brief also named advance_world_turn_if_current as a second insert
-- path, but that legacy RPC was dropped in 20260603000010 and never recreated
-- (its responsibilities moved to apply_turn_transition). It no longer exists,
-- so there is nothing to wire there. The other small single-row log inserts
-- (partnerships, event/law/office-term expiry, manual deconstruct) rely on the
-- DEFAULT partition safety net; because turn_log_entries retention is a batched
-- DELETE (partition-safe, not drop-based), rows in DEFAULT are pruned normally,
-- so this is fully correct.
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
  v_rows                integer;
  v_current_from_turn   integer;
  v_prev_transition_id  uuid;
begin
  log_entry_count    := 0;
  notification_count := 0;

  -- Task 1.6b: ensure this world's LIST partition exists before the bulk insert.
  perform public.ensure_turn_log_partition(p_world_id);

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

revoke all on function public.internal_apply_turn_transition_log_entries_and_notifications (uuid, uuid, jsonb)
from
  public;

revoke
execute on function public.internal_apply_turn_transition_log_entries_and_notifications (uuid, uuid, jsonb)
from
  anon,
  authenticated;
