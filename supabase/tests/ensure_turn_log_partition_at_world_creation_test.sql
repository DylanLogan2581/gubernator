-- pgTAP tests for creating a world's turn_log_entries partition at world
-- creation (follow-up to Task 1.6b partitioning).
-- Covers:
--   * inserting a world creates its dedicated turn_log_w_<hex> partition
--   * a manual log insert for a brand-new world (the shape used by RPCs such as
--     create_partnership, before the world's first turn) routes to that
--     dedicated partition, NOT to the shared DEFAULT partition
--   * the new partition is secured (append-only for authenticated)
--   * ensure_turn_log_partition short-circuits for a world already pinned to
--     DEFAULT instead of re-attempting a CREATE that can only fail
--
-- UUID range (unique to this file): ea=worlds eb=turn_log_entries
begin;

select
  plan (6);

-- ---------------------------------------------------------------------------
-- World A: created normally, never turned. The AFTER INSERT trigger must have
-- created its partition already.
-- ---------------------------------------------------------------------------
insert into
  public.worlds (id, name, current_turn_number, status)
values
  (
    'ea000000-0000-0000-0000-00000000000a',
    'Turn Log Partition At Creation World A',
    1,
    'active'
  );

select
  ok (
    to_regclass(
      'public.turn_log_w_' || replace('ea000000-0000-0000-0000-00000000000a', '-', '')
    ) is not null,
    'inserting a world creates its dedicated turn_log_entries partition'
  );

-- A manual, pre-first-turn log insert (the shape used by create_partnership and
-- friends; postgres bypasses RLS/grants exactly as those SECURITY DEFINER RPCs
-- do). turn_transition_id is NULL so the MATCH SIMPLE composite FK is skipped.
insert into
  public.turn_log_entries (
    id,
    turn_transition_id,
    world_id,
    log_category,
    payload_jsonb
  )
values
  (
    'eb000000-0000-0000-0000-00000000000a',
    null,
    'ea000000-0000-0000-0000-00000000000a',
    'citizen.partnership_started',
    '{"message":"manual log before first turn"}'::jsonb
  );

select
  is (
    (
      select
        tableoid::regclass
      from
        public.turn_log_entries
      where
        id = 'eb000000-0000-0000-0000-00000000000a'
    ),
    (
      'public.turn_log_w_' || replace('ea000000-0000-0000-0000-00000000000a', '-', '')
    )::regclass,
    'manual pre-first-turn log row lands in the world partition, not DEFAULT'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        only public.turn_log_entries_p_default
      where
        world_id = 'ea000000-0000-0000-0000-00000000000a'
    ),
    0,
    'no rows for the new world sit in the DEFAULT partition'
  );

select
  ok (
    not has_table_privilege(
      'authenticated',
      (
        'public.turn_log_w_' || replace('ea000000-0000-0000-0000-00000000000a', '-', '')
      ),
      'INSERT'
    )
    and has_table_privilege(
      'authenticated',
      (
        'public.turn_log_w_' || replace('ea000000-0000-0000-0000-00000000000a', '-', '')
      ),
      'SELECT'
    ),
    'the creation-time partition is secured (append-only, SELECT kept)'
  );

-- ---------------------------------------------------------------------------
-- World B: simulate a legacy world pinned to DEFAULT (partition dropped, then
-- logged to). ensure_turn_log_partition must not raise and must not re-attempt
-- the CREATE that can only fail.
-- ---------------------------------------------------------------------------
insert into
  public.worlds (id, name, current_turn_number, status)
values
  (
    'ea000000-0000-0000-0000-00000000000b',
    'Turn Log Partition At Creation World B',
    1,
    'active'
  );

do $$
begin
  execute format(
    'drop table public.%I',
    'turn_log_w_' || replace('ea000000-0000-0000-0000-00000000000b', '-', '')
  );
end;
$$;

insert into
  public.turn_log_entries (
    id,
    turn_transition_id,
    world_id,
    log_category,
    payload_jsonb
  )
values
  (
    'eb000000-0000-0000-0000-00000000000b',
    null,
    'ea000000-0000-0000-0000-00000000000b',
    'transition.completed',
    '{"message":"pinned to default"}'::jsonb
  );

select
  lives_ok (
    $$select public.ensure_turn_log_partition('ea000000-0000-0000-0000-00000000000b')$$,
    'ensure_turn_log_partition tolerates a world already pinned to DEFAULT'
  );

select
  ok (
    to_regclass(
      'public.turn_log_w_' || replace('ea000000-0000-0000-0000-00000000000b', '-', '')
    ) is null,
    'ensure_turn_log_partition short-circuits instead of creating for a pinned world'
  );

select
  *
from
  finish ();

rollback;
