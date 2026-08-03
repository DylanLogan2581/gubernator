-- Migration: ensure_turn_log_partition_at_world_creation
--
-- Follow-up to Task 1.6b (20261126000000_partition_turn_log_entries).
--
-- Problem: ensure_turn_log_partition is only called from the bulk turn path
-- (internal_apply_turn_transition_log_entries_and_notifications). Several other
-- paths write turn_log_entries earlier -- internal_apply_turn_transition_event_patches
-- (runs before the bulk helper inside apply_turn_transition) and manual RPCs such
-- as create_partnership / end_partnership_internal / reassign_partner /
-- manual_deconstruct_settlement_building / law-amendment logging. If one of those
-- logs a row for a brand-new world first, the row lands in the shared DEFAULT
-- partition; from then on the world can never get its own partition, and
-- ensure_turn_log_partition re-attempts the failing CREATE every single turn --
-- each attempt taking ACCESS EXCLUSIVE on (and scanning) the shared DEFAULT
-- partition before swallowing the check_violation.
--
-- Fix, in two parts:
--   1. Create the world's partition at world creation, via an AFTER INSERT
--      trigger on public.worlds (the same shape as the existing world-seeding
--      triggers). The partition then exists before ANY path can log a row for
--      that world, so no new world is ever pinned to DEFAULT.
--   2. Short-circuit ensure_turn_log_partition when the world already has rows in
--      the DEFAULT partition (only possible for worlds pinned before this
--      migration): the CREATE cannot succeed for them, so stop attempting it.
--
-- Structure-only: no simulation-output change, no new RLS policy (partitions are
-- secured by the existing internal_secure_turn_log_partition helper), no function
-- signature change (no typegen impact).
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- 1. ensure_turn_log_partition: unchanged behaviour except for the new
-- DEFAULT-residency short-circuit. Still idempotent and still tolerant of the
-- concurrent-create / DEFAULT-conflict races (must never raise).
-- ---------------------------------------------------------------------------
create or replace function public.ensure_turn_log_partition (p_world_id uuid) returns void language plpgsql security definer
set
  search_path = '' as $$
declare
  v_hex        text := replace(p_world_id::text, '-', '');
  v_world_part text := 'turn_log_w_' || v_hex;
begin
  if to_regclass('public.' || v_world_part) is not null then
    return;
  end if;

  -- Legacy pinned world: rows for it already sit in the shared DEFAULT
  -- partition, so `create table ... partition of ...` can only ever fail with
  -- check_violation. Skip the attempt entirely instead of paying its ACCESS
  -- EXCLUSIVE lock + DEFAULT scan on every turn.
  if exists (
    select 1
    from only public.turn_log_entries_p_default
    where world_id = p_world_id
  ) then
    return;
  end if;

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
end;
$$;

comment on function public.ensure_turn_log_partition (uuid) is 'Internal: idempotently ensures the LIST partition for p_world_id exists on turn_log_entries and is secured (RLS + SELECT policy + write-revoke). Called by the worlds_ensure_turn_log_partition AFTER INSERT trigger (so every world has its partition before any path can log a row) and at the top of internal_apply_turn_transition_log_entries_and_notifications. Safe to call every turn: it returns immediately when the partition exists, and also when the world already has rows in the DEFAULT partition (legacy pinned worlds, where the CREATE could only fail). Not granted to authenticated.';

revoke all on function public.ensure_turn_log_partition (uuid)
from
  public;

revoke
execute on function public.ensure_turn_log_partition (uuid)
from
  anon,
  authenticated;

-- ---------------------------------------------------------------------------
-- 2. Create each new world's partition at world-creation time. SECURITY DEFINER
-- because creating a partition of turn_log_entries requires ownership of the
-- parent table, which the calling (authenticated) role does not have.
-- ---------------------------------------------------------------------------
create or replace function public.create_world_turn_log_partition () returns trigger language plpgsql security definer
set
  search_path = '' as $$
begin
  perform public.ensure_turn_log_partition(new.id);
  return new;
end;
$$;

comment on function public.create_world_turn_log_partition () is 'Trigger fn: creates the world''s dedicated turn_log_entries LIST partition as soon as the world row is inserted, so no log-writing path can pin the world to the shared DEFAULT partition. Not granted to authenticated.';

revoke
execute on function public.create_world_turn_log_partition ()
from
  public,
  anon,
  authenticated;

create trigger worlds_ensure_turn_log_partition
after insert on public.worlds for each row
execute function public.create_world_turn_log_partition ();

-- ---------------------------------------------------------------------------
-- 3. Backfill: any world with no partition and no DEFAULT rows yet (created
-- after the 1.6b migration but not yet logged to) gets its partition now.
-- Worlds already pinned to DEFAULT are left alone -- their rows stay put, and
-- the short-circuit above stops the per-turn re-attempts.
-- ---------------------------------------------------------------------------
do $$
declare
  v_world record;
begin
  for v_world in
    select id
    from public.worlds
  loop
    perform public.ensure_turn_log_partition(v_world.id);
  end loop;
end;
$$;
