# World Turn Pause Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** While a turn transition runs, every user in that world sees a blocking progress overlay and no gameplay write can reach the database.

**Architecture:** A generic `before insert/update/delete` trigger on every world-scoped gameplay table rejects writes while that world has a `running` turn transition, with a transaction-local escape hatch for the turn itself and the superadmin recovery path. The simulation engine becomes async so the worker can stamp per-phase progress. A `WorldTurnPauseOverlay` mounted in `WorldEntryGate` covers all world-scoped routes and requires an explicit "Continue to turn N" acknowledgment.

**Tech Stack:** Supabase Postgres (plpgsql, pgTAP under `supabase/tests/`, migrations under `supabase/migrations/`), pg_cron, Deno Edge Functions and an external Deno worker (`supabase/functions/turn-worker/`), TypeScript simulation engine (`supabase/functions/_shared/simulation/`), React 19 + TanStack Router/Query, Tailwind + shadcn/ui, Vitest, generated types (`src/types/database.ts`).

**Spec:** `docs/superpowers/specs/2026-08-03-world-turn-pause-design.md`

## Global Constraints

- Migration prefixes are sequential and must not be reused or reordered. This plan consumes, in order: **`20261222000000`**, **`20261223000000`**, **`20261224000000`**, **`20261225000000`**. The last existing migration is `20261221000000_set_based_stockpiles_view_cap.sql`.
- Every schema change follows the `schema-change` skill: migration + RLS decision + pgTAP decision + typegen decision. Regenerate types with `supabase gen types typescript --local > src/types/database.ts`. Never hand-edit `src/types/database.ts` or `src/routeTree.gen.ts`.
- New functions that write are `security definer set search_path = ''` and callable only by their intended principal.
- Application tables use Row Level Security. This plan adds no new tables, so no new policies are required — verify that claim per task rather than assuming it.
- The error contract for a blocked write is `errcode = 'P0001'` with `hint = 'world_turn_in_progress'`. This matches the existing `hint = 'world_archived'` idiom (see `src/features/military/mutations/armiesMutations.ts:233`). Do not invent a new SQLSTATE.
- The escape-hatch GUC is exactly `app.applying_turn`, set with `set_config('app.applying_turn', 'on', true)` — the third argument `true` makes it transaction-local. A session-local flag would leak across a pooled connection and is a correctness bug.
- Cross-runtime code in `supabase/functions/_shared/` and `src/shared/` keeps explicit `.ts` import extensions and must not use browser APIs.
- Commit messages: header ≤ 72 chars, lower-case type and subject, scope required from the enum in `commitlint.config.ts`, body lines ≤ 100 chars, no `Co-Authored-By` trailers.
- Run `git commit` in the foreground with a 600000 ms timeout. The hooks take 1–2 minutes. This is normal.
- Determinism is non-negotiable: `supabase/functions/end-turn-simulation/simulation.golden.json` must remain byte-identical through every task in this plan. If a task changes it, the task is wrong.

## File structure

**Created**

- `supabase/migrations/20261222000000_turn_guard_table_classification.sql` — the classification function that names every base table and its world-resolution path.
- `supabase/migrations/20261223000000_reject_writes_during_turn_transition.sql` — trigger function, trigger attachment, partial index, escape hatch wiring.
- `supabase/migrations/20261224000000_per_phase_turn_progress.sql` — widened `progress_stage` check constraint.
- `supabase/migrations/20261225000000_auto_fail_stale_turn_transitions.sql` — pg_cron stale-heartbeat auto-fail.
- `supabase/tests/turn_guard_table_classification_test.sql` — completeness test.
- `supabase/tests/reject_writes_during_turn_transition_test.sql` — guard behaviour test.
- `supabase/tests/auto_fail_stale_turn_transitions_test.sql` — auto-fail test.
- `src/features/turns/components/WorldTurnPauseOverlay.tsx` — the overlay.
- `src/features/turns/components/WorldTurnPauseOverlay.test.tsx`
- `src/features/turns/hooks/useWorldTurnPause.ts` — acknowledgment state machine.
- `src/features/turns/hooks/useWorldTurnPause.test.ts`
- `src/features/turns/utils/turnPhaseLabels.ts` — phase → human label map, elapsed formatting.
- `src/features/turns/utils/turnPhaseLabels.test.ts`

**Modified**

- `supabase/functions/_shared/simulation/runSimulation.ts` — becomes `async`, gains an `onPhase` hook.
- `supabase/functions/_shared/simulation/simulationTypes.ts` — `SimulationPhaseName`, `RunSimulationOptions`.
- `supabase/functions/end-turn-simulation/transition.ts:179` — awaits `runSimulation`.
- `supabase/functions/turn-worker/runTurnJob.ts` — passes `onPhase`, flushes progress.
- `supabase/functions/turn-worker/queue.ts:148` — `setTransitionProgress` accepts the widened stage type.
- `src/features/auth/utils/authErrors.ts` — `hint` pass-through on `AuthUiError`.
- `src/features/auth/types/authTypes.ts` — `hint` on `AuthErrorDetails`.
- `src/lib/notify.ts` — friendly copy for `world_turn_in_progress`.
- `src/features/turns/types/turnTransitionStatusTypes.ts` — widened `TurnTransitionProgressStage`.
- `src/features/turns/queries/latestTurnTransitionStatusQueries.ts:42` — widened stage list.
- `src/features/turns/components/TurnTransitionProgressPanel.tsx` — running branch removed.
- `src/features/turns/index.ts` — export the overlay and hook.
- `src/features/worlds/components/WorldEntryGate.tsx` — mount the overlay.

---

### Task 1: Table classification + completeness test

The guard is only as good as its table list. This task builds the list as queryable data and the test that proves it is exhaustive, before any trigger exists. Everything later reads from this one source.

**Files:**

- Create: `supabase/migrations/20261222000000_turn_guard_table_classification.sql`
- Create: `supabase/tests/turn_guard_table_classification_test.sql`

**Interfaces:**

- Produces: `public.internal_turn_guard_classification()` returning `table(table_name text, bucket text, key_column text, resolver_sql text)`. `bucket` is one of `guarded`, `turn_output`, `out_of_scope`. For `guarded` rows, `key_column` is the column on that table holding the id to resolve from, and `resolver_sql` is a one-parameter SQL query returning the world id. For non-guarded rows both are `null`.
- Consumed by: Task 2 (trigger attachment), Task 2's behaviour test.

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/turn_guard_table_classification_test.sql`:

```sql
-- pgTAP: the turn-guard classification must name every base table in public
-- exactly once. A table added without a classification fails here, which is
-- what stops a new table from silently landing unguarded.
begin;

select
  plan (5);

-- The function exists and returns the expected shape.
select
  has_function ('public', 'internal_turn_guard_classification', array[]::text[]);

-- Every classified name is a real, non-partition base table in public.
select
  is_empty (
    $$
    select c.table_name
    from public.internal_turn_guard_classification() c
    where not exists (
      select 1
      from pg_class pc
      join pg_namespace pn on pn.oid = pc.relnamespace
      where pn.nspname = 'public'
        and pc.relkind = 'r'
        and not pc.relispartition
        and pc.relname = c.table_name
    )
  $$,
    'classification names only real public base tables'
  );

-- Every real base table is classified.
select
  is_empty (
    $$
    select pc.relname
    from pg_class pc
    join pg_namespace pn on pn.oid = pc.relnamespace
    where pn.nspname = 'public'
      and pc.relkind = 'r'
      and not pc.relispartition
      and not exists (
        select 1 from public.internal_turn_guard_classification() c
        where c.table_name = pc.relname
      )
  $$,
    'every public base table is classified'
  );

-- No table is classified twice.
select
  is_empty (
    $$
    select table_name
    from public.internal_turn_guard_classification()
    group by table_name
    having count(*) > 1
  $$,
    'no table is classified more than once'
  );

-- Guarded rows carry a resolver; non-guarded rows do not.
select
  is_empty (
    $$
    select table_name
    from public.internal_turn_guard_classification()
    where (bucket = 'guarded' and (key_column is null or resolver_sql is null))
       or (bucket <> 'guarded' and (key_column is not null or resolver_sql is not null))
  $$,
    'guarded rows have a resolver and others do not'
  );

select
  *
from
  finish ();

rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `supabase test db --file supabase/tests/turn_guard_table_classification_test.sql`

Expected: FAIL — `function public.internal_turn_guard_classification() does not exist`.

- [ ] **Step 3: Write the classification migration**

Create `supabase/migrations/20261222000000_turn_guard_table_classification.sql`.

The three buckets:

- `guarded` — world-scoped state the simulation reads or writes, including world-admin configuration. World admins and superadmins are blocked here too; the only exemption is the recovery path.
- `turn_output` — written only by the turn itself.
- `out_of_scope` — auth, infrastructure, and per-user preferences that the simulation never reads.

```sql
-- Turn-guard table classification.
--
-- Single source of truth for which tables reject writes while a world has a
-- running turn transition (see 20261223000000). Kept as a function rather than
-- a table so it needs no RLS policy and cannot be edited at runtime.
--
-- Buckets:
--   guarded      - world-scoped state the simulation reads or writes. Includes
--                  world-admin configuration tables: a blueprint edited mid-run
--                  applies to an already-loaded turn just as ambiguously as a
--                  job reassignment.
--   turn_output  - written only by the turn itself.
--   out_of_scope - auth, infrastructure, per-user preferences. The simulation
--                  never reads these.
--
-- turn_guard_table_classification_test.sql asserts these buckets partition
-- public's base tables exactly. Adding a table without classifying it fails
-- that test. That is deliberate.
create or replace function public.internal_turn_guard_classification () returns table (
  table_name text,
  bucket text,
  key_column text,
  resolver_sql text
) language sql immutable
set
  search_path = '' as $$
  with direct as (
    -- Tables carrying world_id themselves.
    select unnest(array[
      'armies', 'building_blueprints', 'citizen_memories', 'citizens',
      'cultures', 'decrees', 'deposit_type_jobs', 'deposit_types',
      'education_enrollments', 'education_levels', 'event_groups', 'events',
      'government_bodies', 'job_definitions', 'law_documents',
      'managed_population_culling_jobs', 'managed_population_husbandry_jobs',
      'managed_population_types', 'namesets', 'nation_currencies',
      'nation_discoveries', 'nation_offices', 'nation_relationships',
      'nation_treaties', 'nation_turn_readiness', 'nations', 'office_types',
      'religions', 'resource_categories', 'resources', 'unit_soldiers',
      'unit_types'
    ]) as table_name
  )
  select table_name, 'guarded', 'world_id', 'select $1'
  from direct

  union all
  -- The world row itself: renames, trash/restore, turn-number bumps.
  select 'worlds', 'guarded', 'id', 'select $1'

  union all
  -- Resolve through nations.
  select unnest(array['nation_readiness_votes', 'nation_resource_stockpiles', 'settlements']),
         'guarded', 'nation_id',
         'select world_id from public.nations where id = $1'

  union all
  -- Resolve through settlements -> nations.
  select unnest(array[
      'construction_project_subsidies', 'construction_projects',
      'deposit_instances', 'managed_population_instances',
      'nation_tax_policies', 'settlement_buildings',
      'settlement_resource_stockpiles'
    ]),
    'guarded', 'settlement_id',
    'select n.world_id from public.settlements s join public.nations n on n.id = s.nation_id where s.id = $1'

  union all
  select 'citizen_assignments', 'guarded', 'citizen_id',
         'select world_id from public.citizens where id = $1'

  union all
  -- partnerships has no world_id; citizen_a_id is not null on every row.
  select 'partnerships', 'guarded', 'citizen_a_id',
         'select world_id from public.citizens where id = $1'

  union all
  select unnest(array['army_groups', 'army_units']), 'guarded', 'army_id',
         'select world_id from public.armies where id = $1'

  union all
  select 'building_blueprint_tiers', 'guarded', 'building_blueprint_id',
         'select world_id from public.building_blueprints where id = $1'

  union all
  select 'deposit_instance_resources', 'guarded', 'deposit_instance_id',
         'select n.world_id from public.deposit_instances di join public.settlements s on s.id = di.settlement_id join public.nations n on n.id = s.nation_id where di.id = $1'

  union all
  select unnest(array['event_effects', 'event_memories']), 'guarded', 'event_id',
         'select world_id from public.events where id = $1'

  union all
  select unnest(array['law_amendments', 'law_articles', 'law_document_versions']),
         'guarded', 'document_id',
         'select world_id from public.law_documents where id = $1'

  union all
  select 'law_amendment_votes', 'guarded', 'amendment_id',
         'select ld.world_id from public.law_amendments la join public.law_documents ld on ld.id = la.document_id where la.id = $1'

  union all
  select 'nation_currency_ledger', 'guarded', 'currency_id',
         'select world_id from public.nation_currencies where id = $1'

  union all
  select 'trade_routes', 'guarded', 'origin_settlement_id',
         'select n.world_id from public.settlements s join public.nations n on n.id = s.nation_id where s.id = $1'

  union all
  select 'trade_route_legs', 'guarded', 'trade_route_id',
         'select n.world_id from public.trade_routes tr join public.settlements s on s.id = tr.origin_settlement_id join public.nations n on n.id = s.nation_id where tr.id = $1'

  union all
  -- Written only by the turn. Guarding these would block the turn itself.
  select unnest(array[
      'army_turn_snapshots', 'nation_currency_snapshots', 'nation_turn_snapshots',
      'settlement_turn_snapshots', 'notifications', 'turn_jobs', 'turn_transitions'
    ]), 'turn_output', null, null

  union all
  -- Auth, infrastructure, and per-user state the simulation never reads.
  select unnest(array[
      'admin_create_user_idempotency_keys', 'edge_rate_limit_buckets',
      'email_send_log', 'notification_preferences', 'smtp_settings', 'users',
      'world_admins', 'user_active_player_characters', 'world_retention_config'
    ]), 'out_of_scope', null, null;
$$;

comment on function public.internal_turn_guard_classification () is 'Classifies every public base table as guarded / turn_output / out_of_scope for the running-turn write guard. Guarded rows carry the column and one-parameter SQL used to resolve the row''s world. Completeness is asserted by turn_guard_table_classification_test.sql.';

revoke all on function public.internal_turn_guard_classification ()
from
  public,
  anon,
  authenticated;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `supabase test db --file supabase/tests/turn_guard_table_classification_test.sql`

Expected: PASS, 5/5.

If the "every public base table is classified" assertion fails, the migration list is out of date relative to the local database. Add the reported tables to the correct bucket — do not weaken the test.

- [ ] **Step 5: Verify no typegen change is needed**

Run: `supabase gen types typescript --local > src/types/database.ts && git diff --stat src/types/database.ts`

Expected: no diff. The function is revoked from `authenticated`, so it is not part of the client API surface. If a diff appears, commit it with the migration.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261222000000_turn_guard_table_classification.sql supabase/tests/turn_guard_table_classification_test.sql
git commit -m "feat(supabase): classify tables for the running-turn write guard"
```

---

### Task 2: Trigger guard + escape hatch

**Files:**

- Create: `supabase/migrations/20261223000000_reject_writes_during_turn_transition.sql`
- Create: `supabase/tests/reject_writes_during_turn_transition_test.sql`
- Modify: the `apply_turn_transition` and `fail_stuck_turn_transition` function bodies (redefined inside the new migration — do not edit the old migration files)

**Interfaces:**

- Consumes: `public.internal_turn_guard_classification()` from Task 1.
- Produces: `public.internal_reject_write_during_transition()` trigger function. Blocked writes raise `errcode = 'P0001'`, `hint = 'world_turn_in_progress'`, message `world turn in progress`.

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/reject_writes_during_turn_transition_test.sql`:

```sql
-- pgTAP: gameplay writes are rejected while a world has a running turn
-- transition, and permitted when it is idle, in another world, or inside the
-- turn's own escape hatch.
--
-- UUID prefix map (d1-prefixed range, unique to this file):
--   d1100000 = worlds   d1200000 = nations   d1300000 = settlements
--   d1400000 = turn_transitions
begin;

select
  plan (6);

insert into
  public.worlds (id, name, current_turn_number)
values
  ('d1100000-0000-0000-0000-000000000001', 'Guarded World', 5),
  ('d1100000-0000-0000-0000-000000000002', 'Other World', 5);

insert into
  public.nations (id, world_id, name)
values
  (
    'd1200000-0000-0000-0000-000000000001',
    'd1100000-0000-0000-0000-000000000001',
    'Guarded Nation'
  ),
  (
    'd1200000-0000-0000-0000-000000000002',
    'd1100000-0000-0000-0000-000000000002',
    'Other Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'd1300000-0000-0000-0000-000000000001',
    'd1200000-0000-0000-0000-000000000001',
    'Guarded Town'
  ),
  (
    'd1300000-0000-0000-0000-000000000002',
    'd1200000-0000-0000-0000-000000000002',
    'Other Town'
  );

-- Idle world: the write succeeds.
select
  lives_ok (
    $$ update public.settlements set name = 'Renamed Idle'
       where id = 'd1300000-0000-0000-0000-000000000001' $$,
    'write succeeds while no transition is running'
  );

insert into
  public.turn_transitions (id, world_id, from_turn_number, to_turn_number, status, started_at)
values
  (
    'd1400000-0000-0000-0000-000000000001',
    'd1100000-0000-0000-0000-000000000001',
    5,
    6,
    'running',
    now()
  );

-- Running: direct world_id resolution (settlements -> nations).
select
  throws_ok (
    $$ update public.settlements set name = 'Renamed Running'
       where id = 'd1300000-0000-0000-0000-000000000001' $$,
    'P0001',
    'world turn in progress',
    'write rejected while the world transition is running'
  );

-- Running: a delete is rejected too, not just update/insert.
select
  throws_ok (
    $$ delete from public.settlements
       where id = 'd1300000-0000-0000-0000-000000000001' $$,
    'P0001',
    'world turn in progress',
    'delete rejected while the world transition is running'
  );

-- Another world is unaffected.
select
  lives_ok (
    $$ update public.settlements set name = 'Renamed Other'
       where id = 'd1300000-0000-0000-0000-000000000002' $$,
    'a transition in one world does not block another world'
  );

-- The escape hatch lets the turn write.
select
  lives_ok (
    $$ select set_config('app.applying_turn', 'on', true);
       update public.settlements set name = 'Renamed By Turn'
       where id = 'd1300000-0000-0000-0000-000000000001' $$,
    'the applying_turn escape hatch permits the write'
  );

-- A completed transition stops blocking.
update public.turn_transitions
set
  status = 'completed',
  finished_at = now()
where
  id = 'd1400000-0000-0000-0000-000000000001';

select
  lives_ok (
    $$ select set_config('app.applying_turn', '', true);
       update public.settlements set name = 'Renamed After'
       where id = 'd1300000-0000-0000-0000-000000000001' $$,
    'write succeeds once the transition is no longer running'
  );

select
  *
from
  finish ();

rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `supabase test db --file supabase/tests/reject_writes_during_turn_transition_test.sql`

Expected: FAIL — the `throws_ok` assertions fail because the update succeeds; no trigger exists yet.

- [ ] **Step 3: Write the guard migration**

Create `supabase/migrations/20261223000000_reject_writes_during_turn_transition.sql`:

```sql
-- Reject gameplay writes while a world has a running turn transition.
--
-- Why a trigger and not RLS: all gameplay RPCs are `security definer` and
-- therefore bypass RLS entirely, so an RLS-policy guard would protect nothing
-- on the paths that matter. Triggers fire regardless of security definer, RLS,
-- or which client issued the statement.
--
-- The turn itself writes these same tables, so apply_turn_transition and the
-- superadmin recovery path set a transaction-local escape hatch that this
-- trigger honours.
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
```

- [ ] **Step 4: Add the escape hatch to the turn write path**

Append to the same migration. Read the current bodies first so the rest of each function is preserved verbatim:

Run: `grep -rl "create or replace function public.apply_turn_transition" supabase/migrations | tail -1`

Then append to `20261223000000_reject_writes_during_turn_transition.sql` a `create or replace function public.apply_turn_transition (...)` that is the current body with this as its **first statement inside `begin`**:

```sql
-- Transaction-local: the turn writes the same tables the guard protects.
perform set_config ('app.applying_turn', 'on', true);
```

Do the same for `public.fail_stuck_turn_transition`. Find it with:

Run: `grep -rl "create or replace function public.fail_stuck_turn_transition" supabase/migrations | tail -1`

Do **not** add the flag to any other function. The exemption is the turn's own write path and the superadmin recovery path only.

- [ ] **Step 5: Run the guard test to verify it passes**

Run: `supabase test db --file supabase/tests/reject_writes_during_turn_transition_test.sql`

Expected: PASS, 6/6.

- [ ] **Step 6: Run the full database suite for regressions**

Run: `supabase test db`

Expected: PASS. Existing `apply_turn_transition` tests exercise the turn write path; if they now fail with `world turn in progress`, the escape hatch in Step 4 was not applied to the function the tests actually call. Fix that rather than relaxing the trigger.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20261223000000_reject_writes_during_turn_transition.sql supabase/tests/reject_writes_during_turn_transition_test.sql
git commit -m "feat(supabase): reject gameplay writes during a turn transition"
```

---

### Task 3: Async simulation engine with an onPhase hook

`runSimulation` is currently synchronous with 20 straight-line phase calls. A ~7 s synchronous block starves the event loop, so the worker cannot flush a progress write mid-run. This task makes the phase sequence async and yields between phases.

Phase order and RNG draws must not change. The golden fixture is the proof.

**Files:**

- Modify: `supabase/functions/_shared/simulation/simulationTypes.ts`
- Modify: `supabase/functions/_shared/simulation/runSimulation.ts:47`
- Modify: `supabase/functions/end-turn-simulation/transition.ts:179`
- Test: `supabase/functions/end-turn-simulation/goldenDeterminism.test.ts` (must stay green, unchanged output)
- Test: `supabase/functions/_shared/simulation/runSimulation.test.ts`

**Interfaces:**

- Produces:
  - `export type SimulationPhaseName = "standard_jobs" | "deposit_extraction" | "construction" | "building_upkeep" | "education" | "passive_effects" | "trade_routes" | "national_economy" | "treaties" | "managed_populations" | "military_upkeep" | "citizen_consumption" | "partnerships" | "homelessness" | "events" | "stockpile_clamp" | "resource_decay" | "succession" | "treaty_marriage_notes" | "logs_and_snapshots";`
  - `export type RunSimulationOptions = { readonly onPhase?: (phase: SimulationPhaseName) => void };`
  - `export function runSimulation(input: SimulationInputState, transitionId: string, options?: RunSimulationOptions): Promise<SimulationResult>`
- Consumed by: Task 4 (worker progress reporting).

- [ ] **Step 1: Write the failing test**

Add to `supabase/functions/_shared/simulation/runSimulation.test.ts`:

```ts
import { makeGoldenWorldInput } from "./goldenWorldFixture.ts";
import { runSimulation } from "./runSimulation.ts";

import type { SimulationPhaseName } from "./simulationTypes.ts";

describe("runSimulation onPhase", () => {
  it("reports every phase once, in run order", async () => {
    const seen: SimulationPhaseName[] = [];

    await runSimulation(makeGoldenWorldInput(), "tt-phase-test", {
      onPhase: (phase) => {
        seen.push(phase);
      },
    });

    expect(seen).toEqual([
      "standard_jobs",
      "deposit_extraction",
      "construction",
      "building_upkeep",
      "education",
      "passive_effects",
      "trade_routes",
      "national_economy",
      "treaties",
      "managed_populations",
      "military_upkeep",
      "citizen_consumption",
      "partnerships",
      "homelessness",
      "events",
      "stockpile_clamp",
      "resource_decay",
      "succession",
      "treaty_marriage_notes",
      "logs_and_snapshots",
    ]);
  });

  it("yields to the event loop between phases", async () => {
    let ticked = false;
    setTimeout(() => {
      ticked = true;
    }, 0);

    await runSimulation(makeGoldenWorldInput(), "tt-yield-test");

    expect(ticked).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run supabase/functions/_shared/simulation/runSimulation.test.ts`

Expected: FAIL — `runSimulation` takes two arguments and returns a value, not a promise.

- [ ] **Step 3: Add the types**

In `supabase/functions/_shared/simulation/simulationTypes.ts`, add near `SimulationInputState`:

```ts
export type SimulationPhaseName =
  | "standard_jobs"
  | "deposit_extraction"
  | "construction"
  | "building_upkeep"
  | "education"
  | "passive_effects"
  | "trade_routes"
  | "national_economy"
  | "treaties"
  | "managed_populations"
  | "military_upkeep"
  | "citizen_consumption"
  | "partnerships"
  | "homelessness"
  | "events"
  | "stockpile_clamp"
  | "resource_decay"
  | "succession"
  | "treaty_marriage_notes"
  | "logs_and_snapshots";

export type RunSimulationOptions = {
  readonly onPhase?: (phase: SimulationPhaseName) => void;
};
```

- [ ] **Step 4: Make the engine async**

In `runSimulation.ts`, change the signature at line 47:

```ts
export async function runSimulation(
  input: SimulationInputState,
  _transitionId: string,
  options?: RunSimulationOptions,
): Promise<SimulationResult> {
```

Add a local helper immediately above the first phase call:

```ts
// Yield to the event loop so the worker can flush a progress write between
// phases. Reporting is side-band: it must not touch the RNG, and phase order
// is unchanged, so the golden fixture stays byte-identical.
const enterPhase = async (phase: SimulationPhaseName): Promise<void> => {
  options?.onPhase?.(phase);
  await new Promise((resolve) => setTimeout(resolve, 0));
};
```

Then precede each of the 20 phase calls with its `await enterPhase(...)`. For example, at line 198:

```ts
await enterPhase("standard_jobs");
const p1 = phaseStandardJobs(context);
```

and at line 205:

```ts
await enterPhase("deposit_extraction");
const p2 = phaseDepositExtraction(context);
```

Continue for all 20, using the names and order listed in Step 1's test. Do not reorder, merge, or skip any phase call, and do not move any code between phases.

- [ ] **Step 5: Update the caller**

In `supabase/functions/end-turn-simulation/transition.ts:179`:

```ts
result = await runSimulation(input, transitionId);
```

Then make the enclosing function `async` and update its return type to `Promise<...>` if it is not already, and `await` it at its own call sites. Find them with:

Run: `grep -rn "planSimulationTransition(" supabase/functions src --include=*.ts | grep -v "\.test\."`

- [ ] **Step 6: Run the determinism and unit tests**

Run: `npx vitest run supabase/functions/_shared/simulation supabase/functions/end-turn-simulation`

Expected: PASS, including `goldenDeterminism.test.ts` with no change to `simulation.golden.json`.

Run: `git diff --stat supabase/functions/end-turn-simulation/simulation.golden.json`

Expected: no diff. A diff here means a phase was reordered or the RNG was touched. Revert and redo Step 4 rather than regenerating the golden.

- [ ] **Step 7: Fix the benchmark call sites**

`supabase/functions/end-turn-simulation/turnScale.bench.ts` calls `runSimulation` synchronously in three places. Make the measurement block and both `bench` callbacks `async` and `await` the call.

Run: `npx vitest bench --run supabase/functions/end-turn-simulation/turnScale.bench.ts`

Expected: completes and prints the Phase 5 gate measurement. Note the new engine time — the per-phase yields add 20 event-loop turns, which should be negligible against ~6.8 s, but record the number.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/_shared/simulation supabase/functions/end-turn-simulation
git commit -m "refactor(turns): make the simulation engine async with a phase hook"
```

---

### Task 4: Per-phase progress reporting

**Files:**

- Create: `supabase/migrations/20261224000000_per_phase_turn_progress.sql`
- Modify: `supabase/functions/turn-worker/runTurnJob.ts`
- Modify: `supabase/functions/turn-worker/queue.ts:148`
- Modify: `src/features/turns/types/turnTransitionStatusTypes.ts`
- Modify: `src/features/turns/queries/latestTurnTransitionStatusQueries.ts:42`
- Create: `src/features/turns/utils/turnPhaseLabels.ts`
- Create: `src/features/turns/utils/turnPhaseLabels.test.ts`

**Interfaces:**

- Consumes: `SimulationPhaseName`, `RunSimulationOptions` from Task 3.
- Produces:
  - `TurnTransitionProgressStage` widened to `"queued" | "loading" | "persisting" | SimulationPhaseName`.
  - `export function getTurnPhaseLabel(stage: TurnTransitionProgressStage | null): string`
  - `export function formatElapsed(startedAt: string, now: number): string` returning `m:ss`.
- Consumed by: Task 6 (overlay).

- [ ] **Step 1: Write the failing test**

Create `src/features/turns/utils/turnPhaseLabels.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { formatElapsed, getTurnPhaseLabel } from "./turnPhaseLabels";

describe("getTurnPhaseLabel", () => {
  it("labels worker stages", () => {
    expect(getTurnPhaseLabel("queued")).toBe("Queued");
    expect(getTurnPhaseLabel("loading")).toBe("Loading world state");
    expect(getTurnPhaseLabel("persisting")).toBe("Saving results");
  });

  it("labels simulation phases in plain language", () => {
    expect(getTurnPhaseLabel("standard_jobs")).toBe("Working jobs");
    expect(getTurnPhaseLabel("citizen_consumption")).toBe("Feeding citizens");
    expect(getTurnPhaseLabel("logs_and_snapshots")).toBe("Recording history");
  });

  it("falls back for an unknown or absent stage", () => {
    expect(getTurnPhaseLabel(null)).toBe("Advancing the turn");
  });
});

describe("formatElapsed", () => {
  it("formats as m:ss", () => {
    const startedAt = "2026-08-03T12:00:00.000Z";
    const now = Date.parse("2026-08-03T12:01:07.000Z");
    expect(formatElapsed(startedAt, now)).toBe("1:07");
  });

  it("clamps a clock skew to zero", () => {
    const startedAt = "2026-08-03T12:00:05.000Z";
    const now = Date.parse("2026-08-03T12:00:00.000Z");
    expect(formatElapsed(startedAt, now)).toBe("0:00");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/turns/utils/turnPhaseLabels.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Widen the database constraint**

Create `supabase/migrations/20261224000000_per_phase_turn_progress.sql`:

```sql
-- Widen turn_transitions.progress_stage from four coarse stages to one value
-- per simulation phase. With the whole world blocked behind a progress
-- overlay, a bar that sits on 'simulating' for the bulk of the run reads as
-- hung. 'simulating' is retained so an in-flight transition written by an old
-- worker build still satisfies the constraint.
alter table public.turn_transitions
drop constraint if exists turn_transitions_progress_stage_check;

alter table public.turn_transitions add constraint turn_transitions_progress_stage_check check (
  progress_stage is null
  or progress_stage in (
    'queued',
    'loading',
    'simulating',
    'persisting',
    'standard_jobs',
    'deposit_extraction',
    'construction',
    'building_upkeep',
    'education',
    'passive_effects',
    'trade_routes',
    'national_economy',
    'treaties',
    'managed_populations',
    'military_upkeep',
    'citizen_consumption',
    'partnerships',
    'homelessness',
    'events',
    'stockpile_clamp',
    'resource_decay',
    'succession',
    'treaty_marriage_notes',
    'logs_and_snapshots'
  )
);

comment on column public.turn_transitions.progress_stage is 'Progress of the background turn worker while status = ''running'': a queue/load/persist stage, or the simulation phase currently executing. Null once the transition reaches a terminal status. Written by the worker (service role); readable through the existing world-access select policy.';
```

- [ ] **Step 4: Regenerate types**

Run: `supabase db reset && supabase gen types typescript --local > src/types/database.ts`

Run: `git diff --stat src/types/database.ts`

Expected: no shape change (`progress_stage` stays `string | null`); a check-constraint widening does not alter the generated type. If there is no diff, that is the expected outcome.

- [ ] **Step 5: Write the label module**

Create `src/features/turns/utils/turnPhaseLabels.ts`:

```ts
import type { TurnTransitionProgressStage } from "../types/turnTransitionStatusTypes";

// Player-facing names. These are read by everyone in the world while they are
// blocked, so they describe what is happening in the world rather than naming
// engine internals.
const PHASE_LABELS: Record<TurnTransitionProgressStage, string> = {
  building_upkeep: "Maintaining buildings",
  citizen_consumption: "Feeding citizens",
  construction: "Advancing construction",
  deposit_extraction: "Working deposits",
  education: "Teaching students",
  events: "Resolving events",
  homelessness: "Housing citizens",
  loading: "Loading world state",
  logs_and_snapshots: "Recording history",
  managed_populations: "Tending livestock",
  military_upkeep: "Supplying armies",
  national_economy: "Settling national accounts",
  partnerships: "Forming partnerships",
  passive_effects: "Applying passive effects",
  persisting: "Saving results",
  queued: "Queued",
  resource_decay: "Spoiling resources",
  simulating: "Simulating",
  standard_jobs: "Working jobs",
  stockpile_clamp: "Reconciling stockpiles",
  succession: "Settling succession",
  trade_routes: "Running trade routes",
  treaties: "Honouring treaties",
  treaty_marriage_notes: "Recording marriages",
};

export function getTurnPhaseLabel(
  stage: TurnTransitionProgressStage | null,
): string {
  if (stage === null) {
    return "Advancing the turn";
  }
  return PHASE_LABELS[stage];
}

export function formatElapsed(startedAt: string, now: number): string {
  const elapsedMs = Math.max(0, now - Date.parse(startedAt));
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString()}:${seconds.toString().padStart(2, "0")}`;
}
```

- [ ] **Step 6: Widen the client stage type**

In `src/features/turns/types/turnTransitionStatusTypes.ts`, widen `TurnTransitionProgressStage` to the full union of the 24 keys above.

In `src/features/turns/queries/latestTurnTransitionStatusQueries.ts:42`, replace the `TURN_TRANSITION_PROGRESS_STAGES` array with the same 24 values. The existing `toTurnTransitionProgressStage` fallback already maps unknown values to `null`, so no other change is needed there.

- [ ] **Step 7: Run the label tests**

Run: `npx vitest run src/features/turns`

Expected: PASS.

- [ ] **Step 8: Wire the worker**

In `supabase/functions/turn-worker/queue.ts:148`, `setTransitionProgress` already accepts `TurnTransitionProgressStage | null` — update its imported type to the widened Deno-side union so the phase names type-check.

In `runTurnJob.ts`, pass an `onPhase` that fires a fire-and-forget progress stamp. Progress is cosmetic and must never abort or slow a turn:

```ts
const result = await runSimulation(input, transitionId, {
  onPhase: (phase) => {
    // Fire-and-forget: setTransitionProgress already swallows its own
    // errors, and awaiting here would serialise a network round-trip
    // between every phase.
    void setTransitionProgress(config, transitionId, phase, requestId);
  },
});
```

- [ ] **Step 9: Verify the worker still runs a turn end to end**

Run: `npx vitest run supabase/functions/turn-worker`

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add supabase/migrations/20261224000000_per_phase_turn_progress.sql supabase/functions/turn-worker src/features/turns src/types/database.ts
git commit -m "feat(turns): report per-phase progress from the turn worker"
```

---

### Task 5: Client error mapping for blocked writes

The overlay is eventually consistent — up to 3 s of poll lag — so a user with a request already in flight when the turn starts will hit the guard. Without this task they get a raw `world turn in progress` toast.

**Files:**

- Modify: `src/features/auth/types/authTypes.ts`
- Modify: `src/features/auth/utils/authErrors.ts:7-51`
- Modify: `src/lib/notify.ts`
- Test: `src/features/auth/utils/authErrors.test.ts`
- Test: `src/lib/notify.test.ts`

**Interfaces:**

- Produces: `AuthUiError.hint?: string`; `notifyMutationError` renders `world_turn_in_progress` as `"The turn is advancing — your change was not saved."`

- [ ] **Step 1: Write the failing tests**

Add to `src/features/auth/utils/authErrors.test.ts`:

```ts
it("preserves the postgres hint on a postgrest-like error", () => {
  const normalized = normalizeSupabaseError({
    code: "P0001",
    hint: "world_turn_in_progress",
    message: "world turn in progress",
  });

  expect(normalized.hint).toBe("world_turn_in_progress");
});
```

Add to `src/lib/notify.test.ts`:

```ts
it("renders a friendly message when the turn is advancing", () => {
  const error = {
    hint: "world_turn_in_progress",
    message: "world turn in progress",
  };

  expect(resolveMutationErrorMessage(error)).toBe(
    "The turn is advancing — your change was not saved.",
  );
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/auth/utils/authErrors.test.ts src/lib/notify.test.ts`

Expected: FAIL — `hint` is `undefined`, and the raw message is returned.

- [ ] **Step 3: Add hint pass-through**

In `src/features/auth/types/authTypes.ts`, add `readonly hint?: string;` to `AuthErrorDetails`.

In `src/features/auth/utils/authErrors.ts`:

```ts
export class AuthUiError extends Error {
  readonly code?: string;
  readonly hint?: string;
  readonly status?: number;

  constructor({ code, hint, message, status }: AuthErrorDetails) {
    super(message);
    this.name = "AuthUiError";
    this.code = code;
    this.hint = hint;
    this.status = status;
  }
}
```

Widen `isPostgrestLikeError` to `error is { code?: string; hint?: string; message: string }` and pass `hint: error.hint` in the branch at line 39.

- [ ] **Step 4: Add the friendly copy**

In `src/lib/notify.ts`, at the top of `resolveMutationErrorMessage`, before the `issues` unwrapping:

```ts
// Kept here rather than imported from the turns feature: src/lib must not
// depend on a feature module.
const TURN_IN_PROGRESS_HINT = "world_turn_in_progress";

// ...inside resolveMutationErrorMessage, as the first check:
if (
  error !== null &&
  typeof error === "object" &&
  "hint" in error &&
  (error as { hint?: unknown }).hint === TURN_IN_PROGRESS_HINT
) {
  return "The turn is advancing — your change was not saved.";
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/features/auth src/lib`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/auth src/lib
git commit -m "feat(app): explain writes blocked by a running turn transition"
```

---

### Task 6: The overlay component

**Files:**

- Create: `src/features/turns/hooks/useWorldTurnPause.ts`
- Create: `src/features/turns/hooks/useWorldTurnPause.test.ts`
- Create: `src/features/turns/components/WorldTurnPauseOverlay.tsx`
- Create: `src/features/turns/components/WorldTurnPauseOverlay.test.tsx`
- Modify: `src/features/turns/index.ts`

**Interfaces:**

- Consumes: `latestTurnTransitionStatusQueryOptions`, `invalidateAfterTurnAdvance` (`src/features/turns/mutations/endTurnTransitionMutations.ts:139`), `getTurnPhaseLabel`, `formatElapsed` from Task 4.
- Produces:
  - `export type WorldTurnPauseState = { readonly kind: "idle" } | { readonly kind: "running"; readonly toTurnNumber: number; readonly startedAt: string; readonly stage: TurnTransitionProgressStage | null } | { readonly kind: "acknowledge"; readonly toTurnNumber: number } | { readonly kind: "failed"; readonly toTurnNumber: number };`
  - `export function useWorldTurnPause(worldId: string): { readonly state: WorldTurnPauseState; readonly acknowledge: () => void };`
  - `export function WorldTurnPauseOverlay({ worldId }: { readonly worldId: string }): JSX.Element | null;`

- [ ] **Step 1: Write the failing hook test**

Create `src/features/turns/hooks/useWorldTurnPause.test.ts`. Acknowledgment is session-local: the `acknowledge` state appears only for a client that observed `running` first.

```ts
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { useWorldTurnPause } from "./useWorldTurnPause";

const WORLD_ID = "11111111-1111-1111-1111-111111111111";

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useWorldTurnPause", () => {
  it("is idle when no transition is running and none was observed", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["turns", "latestTransitionStatus", WORLD_ID], {
      isRunning: false,
      progressStage: null,
      startedAt: "2026-08-03T12:00:00.000Z",
      state: "completed",
      toTurnNumber: 7,
    });

    const { result } = renderHook(() => useWorldTurnPause(WORLD_ID), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.state.kind).toBe("idle");
    });
  });

  it("moves running -> acknowledge -> idle once acknowledged", async () => {
    const queryClient = new QueryClient();
    const key = ["turns", "latestTransitionStatus", WORLD_ID];
    queryClient.setQueryData(key, {
      isRunning: true,
      progressStage: "standard_jobs",
      startedAt: "2026-08-03T12:00:00.000Z",
      state: "running",
      toTurnNumber: 7,
    });

    const { result } = renderHook(() => useWorldTurnPause(WORLD_ID), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.state.kind).toBe("running");
    });

    act(() => {
      queryClient.setQueryData(key, {
        isRunning: false,
        progressStage: null,
        startedAt: "2026-08-03T12:00:00.000Z",
        state: "completed",
        toTurnNumber: 7,
      });
    });

    await waitFor(() => {
      expect(result.current.state.kind).toBe("acknowledge");
    });

    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    act(() => {
      result.current.acknowledge();
    });

    await waitFor(() => {
      expect(result.current.state.kind).toBe("idle");
    });
    expect(invalidate).toHaveBeenCalled();
  });

  it("reports failed while a transition ended in failure", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["turns", "latestTransitionStatus", WORLD_ID], {
      isRunning: false,
      progressStage: null,
      startedAt: "2026-08-03T12:00:00.000Z",
      state: "failed",
      toTurnNumber: 7,
    });

    const { result } = renderHook(() => useWorldTurnPause(WORLD_ID), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.state.kind).toBe("failed");
    });
  });
});
```

Confirm the exact query key before running: `grep -n "latestTransitionStatus" src/features/turns/queries/turnQueryKeys.ts` and use it verbatim in place of the placeholder array above.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/turns/hooks/useWorldTurnPause.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

Create `src/features/turns/hooks/useWorldTurnPause.ts`:

```ts
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { invalidateAfterTurnAdvance } from "../mutations/endTurnTransitionMutations";
import { latestTurnTransitionStatusQueryOptions } from "../queries/latestTurnTransitionStatusQueries";

import type { TurnTransitionProgressStage } from "../types/turnTransitionStatusTypes";

export type WorldTurnPauseState =
  | { readonly kind: "idle" }
  | {
      readonly kind: "running";
      readonly stage: TurnTransitionProgressStage | null;
      readonly startedAt: string;
      readonly toTurnNumber: number;
    }
  | { readonly kind: "acknowledge"; readonly toTurnNumber: number }
  | { readonly kind: "failed"; readonly toTurnNumber: number };

export function useWorldTurnPause(worldId: string): {
  readonly acknowledge: () => void;
  readonly state: WorldTurnPauseState;
} {
  const queryClient = useQueryClient();
  const statusQuery = useQuery(latestTurnTransitionStatusQueryOptions(worldId));
  const transition = statusQuery.data ?? null;

  // Session-local: a client that never saw the run does not get an
  // acknowledgment prompt. Someone opening the app three turns later just
  // sees the current turn.
  const observedRunningRef = useRef(false);
  const [acknowledgedTurn, setAcknowledgedTurn] = useState<number | null>(null);

  useEffect(() => {
    if (transition?.isRunning === true) {
      observedRunningRef.current = true;
    }
  }, [transition?.isRunning]);

  const acknowledge = useCallback(() => {
    if (transition === null) {
      return;
    }
    observedRunningRef.current = false;
    setAcknowledgedTurn(transition.toTurnNumber);
    void invalidateAfterTurnAdvance(queryClient, worldId);
  }, [queryClient, transition, worldId]);

  if (transition === null) {
    return { acknowledge, state: { kind: "idle" } };
  }

  if (transition.isRunning) {
    return {
      acknowledge,
      state: {
        kind: "running",
        stage: transition.progressStage,
        startedAt: transition.startedAt,
        toTurnNumber: transition.toTurnNumber,
      },
    };
  }

  if (transition.state === "failed") {
    return {
      acknowledge,
      state: { kind: "failed", toTurnNumber: transition.toTurnNumber },
    };
  }

  if (
    observedRunningRef.current &&
    acknowledgedTurn !== transition.toTurnNumber
  ) {
    return {
      acknowledge,
      state: { kind: "acknowledge", toTurnNumber: transition.toTurnNumber },
    };
  }

  return { acknowledge, state: { kind: "idle" } };
}
```

- [ ] **Step 4: Run the hook test to verify it passes**

Run: `npx vitest run src/features/turns/hooks/useWorldTurnPause.test.ts`

Expected: PASS.

- [ ] **Step 5: Write the failing component test**

Create `src/features/turns/components/WorldTurnPauseOverlay.test.tsx`. Mock the hook and assert on rendered output only — the hook's behaviour is already covered in Step 1.

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WorldTurnPauseOverlay } from "./WorldTurnPauseOverlay";

import type { WorldTurnPauseState } from "../hooks/useWorldTurnPause";

const acknowledge = vi.fn();
const useWorldTurnPause = vi.fn();

vi.mock("../hooks/useWorldTurnPause", () => ({
  useWorldTurnPause: (worldId: string) => useWorldTurnPause(worldId) as unknown,
}));

function setState(state: WorldTurnPauseState): void {
  useWorldTurnPause.mockReturnValue({ acknowledge, state });
}

const WORLD_ID = "11111111-1111-1111-1111-111111111111";

describe("WorldTurnPauseOverlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when idle", () => {
    setState({ kind: "idle" });

    const { container } = render(<WorldTurnPauseOverlay worldId={WORLD_ID} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the phase label and elapsed time while running, with no dismiss", () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse("2026-08-03T12:01:07.000Z"));
    setState({
      kind: "running",
      stage: "standard_jobs",
      startedAt: "2026-08-03T12:00:00.000Z",
      toTurnNumber: 7,
    });

    render(<WorldTurnPauseOverlay worldId={WORLD_ID} />);

    expect(screen.getByText("Advancing to turn 7")).toBeInTheDocument();
    expect(screen.getByText("Working jobs")).toBeInTheDocument();
    expect(screen.getByText("1:07")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it("acknowledges from the completed state", async () => {
    const user = userEvent.setup();
    setState({ kind: "acknowledge", toTurnNumber: 7 });

    render(<WorldTurnPauseOverlay worldId={WORLD_ID} />);
    await user.click(
      screen.getByRole("button", { name: "Continue to turn 7" }),
    );

    expect(acknowledge).toHaveBeenCalledOnce();
  });

  it("keeps players blocked with a neutral message on failure", () => {
    setState({ kind: "failed", toTurnNumber: 7 });

    render(<WorldTurnPauseOverlay worldId={WORLD_ID} />);

    expect(screen.getByText("Turn paused")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The turn did not complete. An administrator has been notified.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run the component test to verify it fails**

Run: `npx vitest run src/features/turns/components/WorldTurnPauseOverlay.test.tsx`

Expected: FAIL — module not found.

- [ ] **Step 7: Implement the overlay**

Create `src/features/turns/components/WorldTurnPauseOverlay.tsx`. Reuse existing primitives from `src/components/ui` rather than inventing styles.

```tsx
import { useEffect, useState, type JSX } from "react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

import { useWorldTurnPause } from "../hooks/useWorldTurnPause";
import { formatElapsed, getTurnPhaseLabel } from "../utils/turnPhaseLabels";

type WorldTurnPauseOverlayProps = {
  readonly worldId: string;
};

// Covers every world-scoped route while a turn advances. The DB guard
// (20261223000000) is what actually rejects writes; this is the explanation,
// and the acknowledgment is what guarantees nobody reads pre-turn numbers as
// if they were current.
export function WorldTurnPauseOverlay({
  worldId,
}: WorldTurnPauseOverlayProps): JSX.Element | null {
  const { acknowledge, state } = useWorldTurnPause(worldId);

  if (state.kind === "idle") {
    return null;
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-background/95 p-6 backdrop-blur-sm"
      role="dialog"
    >
      <div className="grid w-full max-w-md gap-4 rounded-lg border border-border bg-card p-6 shadow-lg">
        {state.kind === "running" ? (
          <RunningState
            stage={state.stage}
            startedAt={state.startedAt}
            toTurnNumber={state.toTurnNumber}
          />
        ) : null}

        {state.kind === "acknowledge" ? (
          <>
            <h2 className="text-lg font-semibold">
              {`Turn ${state.toTurnNumber.toString()} is ready`}
            </h2>
            <p className="text-sm text-muted-foreground">
              The world has advanced. Continue to see the new turn.
            </p>
            <Button onClick={acknowledge}>
              {`Continue to turn ${state.toTurnNumber.toString()}`}
            </Button>
          </>
        ) : null}

        {state.kind === "failed" ? (
          <>
            <h2 className="text-lg font-semibold">Turn paused</h2>
            <p className="text-sm text-muted-foreground">
              The turn did not complete. An administrator has been notified.
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}

// Players stay here for the whole run, so the elapsed timer matters: it is the
// difference between "working" and "hung" when a phase is slow.
function RunningState({
  stage,
  startedAt,
  toTurnNumber,
}: {
  readonly stage: Parameters<typeof getTurnPhaseLabel>[0];
  readonly startedAt: string;
  readonly toTurnNumber: number;
}): JSX.Element {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      <h2 className="text-lg font-semibold">
        {`Advancing to turn ${toTurnNumber.toString()}`}
      </h2>
      <div aria-live="polite" className="grid gap-2" role="status">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm">{getTurnPhaseLabel(stage)}</p>
          <p className="text-sm tabular-nums text-muted-foreground">
            {formatElapsed(startedAt, now)}
          </p>
        </div>
        {/* Indeterminate: phase order is fixed but phase duration is not, so a
            percentage would misrepresent how far along the turn is. */}
        <Progress
          aria-label="Turn transition progress"
          aria-valuetext={getTurnPhaseLabel(stage)}
          className="h-2"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        The world is locked until the turn finishes.
      </p>
    </>
  );
}
```

Note the deliberate omission: no close control, no backdrop-click dismiss, no Escape handler. `role="dialog"` with `aria-modal` is correct here even though it is not dismissible, because the rest of the app genuinely is inert.

Export the component and the hook's types from `src/features/turns/index.ts`.

- [ ] **Step 8: Run the component test to verify it passes**

Run: `npx vitest run src/features/turns`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/features/turns
git commit -m "feat(turns): add the world turn pause overlay"
```

---

### Task 7: Mount the overlay and verify in the browser

**Files:**

- Modify: `src/features/worlds/components/WorldEntryGate.tsx`
- Modify: `src/features/turns/components/TurnTransitionProgressPanel.tsx:28-57`
- Test: `src/features/turns/components/TurnTransitionProgressPanel.test.tsx`

- [ ] **Step 1: Mount the overlay**

In `WorldEntryGate.tsx`, wrap the returned children so every world-scoped route is covered. The overlay must render for all four `return <>{children}</>` paths in `WorldEntryDecision`, so add it once at the `WorldEntryWorldGate` level, immediately around `WorldEntryDecision`:

```tsx
return (
  <>
    <WorldTurnPauseOverlay worldId={worldId} />
    <WorldEntryDecision
      accessContext={accessContext}
      worldAccess={worldQuery.data}
      worldId={worldId}
    >
      {children}
    </WorldEntryDecision>
  </>
);
```

Import from the feature entrypoint: `import { WorldTurnPauseOverlay } from "@/features/turns";`

Placing it here and not in `WorldLayoutRoute` is deliberate: the world must resolve and be accessible before we poll its transition status, otherwise an unauthorized user triggers a status query for a world they cannot see.

- [ ] **Step 2: Remove the duplicated running panel**

In `TurnTransitionProgressPanel.tsx`, delete the `if (transition.isRunning)` branch (lines 28-57) and its now-unused `Progress`, `getTurnProgressLabel`, and `getTurnProgressPercentage` imports. Keep the `failed` branch — that is the admin-facing detail the overlay deliberately omits.

Update the file's leading comment to say the running state now lives in `WorldTurnPauseOverlay`.

- [ ] **Step 3: Update the panel test**

In `TurnTransitionProgressPanel.test.tsx`, delete the running-state assertions and add one asserting the component renders `null` for a running transition. Keep the failed-state tests.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/features/turns src/features/worlds`

Expected: PASS.

- [ ] **Step 5: Typecheck**

Load the `LSP` tool once (`ToolSearch` query `select:LSP`) and check diagnostics on the four modified files. Do not run `npx tsc -b` as an iteration loop.

Expected: clean.

- [ ] **Step 6: Verify in the browser**

Per CLAUDE.md, UI work is not complete until verified in a browser.

1. Ensure the dev server is running: `npm run dev` (Vite, port 5173).
2. Ensure local Supabase is running with seed data and the turn worker is running.
3. Using `dev-browser`, sign in as `worldadmin@gubernator.local` (password `password123`) and open a world.
4. In a second browser profile, sign in as `test@gubernator.local` (a settlement manager) and open the same world.
5. Trigger End Turn as the world admin. Within 3 s, **both** windows must show the overlay.
6. Screenshot both. Confirm: the phase label changes as the run proceeds, the elapsed timer ticks, and there is no way to dismiss.
7. As the settlement manager, confirm the app is unreachable behind the overlay.
8. When the run completes, confirm both windows show `Continue to turn N` and that clicking it reveals post-turn numbers, not stale ones.
9. Check the browser console for errors and the network tab for failed requests in both windows.
10. Repeat the screenshot review at a mobile viewport width.

Fix anything found and re-verify until a screenshot review passes.

- [ ] **Step 7: Commit**

```bash
git add src/features/worlds src/features/turns
git commit -m "feat(turns): pause the whole world during a turn transition"
```

---

### Task 8: Stale-heartbeat auto-fail

This design turns a wedged worker into a world-wide outage. `turn_jobs` already has `heartbeat_at` and stale re-claim, which covers a worker dying while another is available; it does not cover no worker being alive, where `turn_transitions` stays `running` and the world stays frozen indefinitely.

**Files:**

- Create: `supabase/migrations/20261225000000_auto_fail_stale_turn_transitions.sql`
- Create: `supabase/tests/auto_fail_stale_turn_transitions_test.sql`

**Interfaces:**

- Produces: `public.auto_fail_stale_turn_transitions(p_stale_after interval default '10 minutes')` returning `integer` — the number of transitions failed.

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/auto_fail_stale_turn_transitions_test.sql`:

```sql
-- pgTAP: a turn transition whose worker stopped heartbeating is failed, so a
-- dead worker cannot freeze a world indefinitely behind the write guard.
--
-- UUID prefix map (d2-prefixed range, unique to this file):
--   d2100000 = worlds   d2400000 = turn_transitions   d2500000 = turn_jobs
begin;

select
  plan (5);

insert into
  public.worlds (id, name, current_turn_number)
values
  ('d2100000-0000-0000-0000-000000000001', 'Stale World', 5),
  ('d2100000-0000-0000-0000-000000000002', 'Live World', 5),
  ('d2100000-0000-0000-0000-000000000003', 'Done World', 5);

insert into
  public.turn_transitions (id, world_id, from_turn_number, to_turn_number, status, started_at)
values
  ('d2400000-0000-0000-0000-000000000001', 'd2100000-0000-0000-0000-000000000001', 5, 6, 'running', now() - interval '1 hour'),
  ('d2400000-0000-0000-0000-000000000002', 'd2100000-0000-0000-0000-000000000002', 5, 6, 'running', now() - interval '1 hour'),
  ('d2400000-0000-0000-0000-000000000003', 'd2100000-0000-0000-0000-000000000003', 5, 6, 'completed', now() - interval '1 hour');

-- One stale heartbeat, one fresh, one already finished.
insert into
  public.turn_jobs (id, world_id, transition_id, status, claimed_at, heartbeat_at)
values
  ('d2500000-0000-0000-0000-000000000001', 'd2100000-0000-0000-0000-000000000001', 'd2400000-0000-0000-0000-000000000001', 'claimed', now() - interval '1 hour', now() - interval '30 minutes'),
  ('d2500000-0000-0000-0000-000000000002', 'd2100000-0000-0000-0000-000000000002', 'd2400000-0000-0000-0000-000000000002', 'claimed', now() - interval '1 hour', now()),
  ('d2500000-0000-0000-0000-000000000003', 'd2100000-0000-0000-0000-000000000003', 'd2400000-0000-0000-0000-000000000003', 'completed', now() - interval '1 hour', now() - interval '55 minutes');

select
  is (
    public.auto_fail_stale_turn_transitions ('10 minutes'::interval),
    1,
    'exactly one stale transition is failed'
  );

select
  is (
    (
      select
        status
      from
        public.turn_transitions
      where
        id = 'd2400000-0000-0000-0000-000000000001'
    ),
    'failed',
    'the stale transition is marked failed'
  );

select
  isnt (
    (
      select
        finished_at
      from
        public.turn_transitions
      where
        id = 'd2400000-0000-0000-0000-000000000001'
    ),
    null,
    'the stale transition records finished_at'
  );

select
  is (
    (
      select
        status
      from
        public.turn_transitions
      where
        id = 'd2400000-0000-0000-0000-000000000002'
    ),
    'running',
    'a transition with a fresh heartbeat is untouched'
  );

select
  is (
    (
      select
        status
      from
        public.turn_transitions
      where
        id = 'd2400000-0000-0000-0000-000000000003'
    ),
    'completed',
    'a finished transition is untouched'
  );

select
  *
from
  finish ();

rollback;
```

Check the `turn_jobs` column list against `supabase/migrations/20261218000000_add_turn_jobs_queue.sql:40` before running and adjust the inserts if the columns differ — in particular whether the status values are `claimed`/`completed` and whether `transition_id` is the correct link column.

- [ ] **Step 2: Run the test to verify it fails**

Run: `supabase test db --file supabase/tests/auto_fail_stale_turn_transitions_test.sql`

Expected: FAIL — `function public.auto_fail_stale_turn_transitions(interval) does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20261225000000_auto_fail_stale_turn_transitions.sql`:

```sql
-- Auto-fail turn transitions abandoned by a dead worker.
--
-- With the running-turn write guard in place (20261223000000), a transition
-- stuck in 'running' freezes an entire world. turn_jobs' heartbeat covers a
-- worker dying while another is available to re-claim; this covers no worker
-- being alive at all. A failed transition surfaces to players as "paused, an
-- administrator has been notified" and is recoverable, which an indefinite
-- freeze is not.
create or replace function public.auto_fail_stale_turn_transitions (p_stale_after interval default '10 minutes') returns integer language plpgsql security definer
set
  search_path = '' as $$
declare
  v_failed integer;
begin
  -- The guard's escape hatch: this function writes turn_transitions, which is
  -- unguarded, but fail paths may touch guarded rows in future.
  perform set_config('app.applying_turn', 'on', true);

  with stale as (
    select tt.id
    from public.turn_transitions tt
    join public.turn_jobs tj on tj.transition_id = tt.id
    where tt.status = 'running'
      and coalesce(tj.heartbeat_at, tj.claimed_at, tt.started_at)
          < now() - p_stale_after
    for update of tt skip locked
  )
  update public.turn_transitions tt
  set status = 'failed',
      finished_at = now(),
      progress_stage = null
  from stale
  where tt.id = stale.id;

  get diagnostics v_failed = row_count;

  return v_failed;
end;
$$;

comment on function public.auto_fail_stale_turn_transitions (interval) is 'Marks running turn transitions failed when their job heartbeat has gone stale, so a dead worker cannot freeze a world indefinitely behind the running-turn write guard. Scheduled nightly-adjacent via pg_cron; also callable manually by a superadmin.';

revoke all on function public.auto_fail_stale_turn_transitions (interval)
from
  public,
  anon,
  authenticated;

-- Schedule every five minutes. Wrapped so the migration still applies on an
-- instance where pg_cron is not loaded (hosted Supabase requires enabling it
-- once in the dashboard Extensions list).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'auto-fail-stale-turn-transitions',
      '*/5 * * * *',
      $cron$select public.auto_fail_stale_turn_transitions();$cron$
    );
  end if;
end;
$$;
```

Confirm the `turn_jobs` column names before writing this — check `transition_id`, `heartbeat_at`, and `claimed_at` against `supabase/migrations/20261218000000_add_turn_jobs_queue.sql:40` and correct the query if they differ.

- [ ] **Step 4: Run the test to verify it passes**

Run: `supabase test db --file supabase/tests/auto_fail_stale_turn_transitions_test.sql`

Expected: PASS.

- [ ] **Step 5: Run the full suite**

Run: `supabase test db`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261225000000_auto_fail_stale_turn_transitions.sql supabase/tests/auto_fail_stale_turn_transitions_test.sql
git commit -m "feat(supabase): auto-fail turn transitions abandoned by a worker"
```

---

## Final verification

- [ ] **Run the full local gate**

Run: `npm run lint && npx vitest run && supabase test db`

Run: `npx tsc -b`

Expected: all green. This is the one place `tsc -b` belongs; it takes 5–10 minutes.

- [ ] **Confirm determinism held across the whole plan**

Run: `git diff main --stat -- supabase/functions/end-turn-simulation/simulation.golden.json`

Expected: no diff.

- [ ] **Confirm the guard covers what it claims**

Run: `supabase test db --file supabase/tests/turn_guard_table_classification_test.sql`

Expected: PASS. If a task in this plan added a table, it must be classified.
