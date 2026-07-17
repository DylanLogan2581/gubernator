# Database Scaling Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bound database storage growth and keep turn-transition time within limits for large worlds (~200 settlements / ~100k citizens / ~30 resources) running for years of daily turns.

**Architecture:** Five independently-shippable phases. (1) Automate + complete + partition-back retention. (2) Convert the row-by-row `apply_turn_transition` SQL to set-based statements. (3) Remove the O(settlements×citizens) engine hot loops. (4) Move the turn off the 30s request path into an enqueued background worker. (5) Slim the in-memory payload. Phases 1–3 shrink the work and de-risk Phase 4 before it re-homes the turn. The existing deterministic TypeScript engine is preserved throughout — only _where and how_ it runs changes.

**Tech Stack:** Supabase Postgres (plpgsql, pgTAP tests under `supabase/tests/`, migrations under `supabase/migrations/`), pg_cron, Deno Edge Functions (`supabase/functions/`), TypeScript simulation engine (`supabase/functions/_shared/simulation/`), Vitest, generated types (`src/types/database.ts` via `supabase gen types`).

## Global Constraints

- Migrations are sequential timestamp-prefixed files; the next free prefix is **`20261122000000`** and each subsequent migration increments by one day (`20261123000000`, …). Do not reuse or reorder prefixes.
- Every schema change follows the repo's `schema-change` skill: migration file + RLS decision + pgTAP test decision + typegen decision (`supabase gen types` → `src/types/database.ts`; never hand-edit generated files or `src/routeTree.gen.ts`).
- Application tables use Row Level Security. New functions that write are `security definer set search_path = ''` and callable only by their intended principal.
- **Determinism is sacred.** The seeded RNG (`seededRng.ts`) threads one mutable stream through settlements in fixed order. No change may alter simulation output for a given seed + fixture. Every engine/SQL-write task carries a golden-output regression check.
- Commit messages: header ≤72 chars, lower-case type + subject, required scope from `commitlint.config.ts` enum (use `config` for migrations/DB, `turns` for simulation engine, `app`/`repo` as fitting). No `Co-Authored-By` trailers.
- Never call Supabase from routes/components; use feature query/mutation modules. Keep route files thin.
- Local verification economy: use the `LSP` tool for per-file TS diagnostics; scope Vitest to touched files; run pgTAP via `supabase test db`; reserve `tsc -b` for a final pre-commit pass.

### Plan depth convention

Phase 1 is written to executable step depth. Phases 2–5 are written as concrete tasks (exact files, interfaces, test assertions, acceptance criteria); **expand each into 2–5-minute steps at execution time**, because their exact code legitimately depends on outcomes and measurements from earlier phases (partition key, worker substrate, realized payload shape). This gating is deliberate, not a placeholder.

---

# PHASE 1 — Bound storage (retention)

**Outcome:** every world's per-turn append tables are bounded automatically, with no superadmin action required, and retention is cheap even at multi-million-row scale.

## File structure

- Create `supabase/migrations/20261122000000_retention_config_defaults_and_coverage.sql` — add `memory_retention_turns` to `world_retention_config`; add `internal_effective_retention()`; rewrite prune to cover **all** append tables + trim `turn_transitions` JSONB; split auth-gated wrapper from cron-callable internal.
- Create `supabase/migrations/20261123000000_enable_pg_cron_retention.sql` — enable pg_cron, schedule the nightly retention job.
- Create `supabase/migrations/20261124000000_retention_index_hygiene.sql` — drop overlapping indexes, add `notifications(world_id, created_at)`.
- Create `supabase/migrations/20261125000000_partition_turn_append_tables.sql` — range-partition `settlement_turn_resource_snapshots` and `turn_log_entries`; add partition-maintenance function.
- Create/extend `supabase/tests/prune_all_append_tables_test.sql`, `supabase/tests/retention_config_defaults_test.sql`, `supabase/tests/retention_cron_scheduled_test.sql`, `supabase/tests/partition_turn_append_tables_test.sql`.
- Modify `src/features/permissions/mutations/superadminMutations.ts`, `src/features/permissions/types/superadminTypes.ts`, `src/features/permissions/components/PruneWorldDataPanel.tsx` — surface config-driven retention; regen `src/types/database.ts`.

## Task 1.1 — Config defaults + effective-retention helper

**Files:**

- Create: `supabase/migrations/20261122000000_retention_config_defaults_and_coverage.sql`
- Test: `supabase/tests/retention_config_defaults_test.sql`

**Interfaces:**

- Produces: `public.internal_effective_retention(p_world_id uuid) returns table(log_turns integer, snapshot_turns integer, memory_turns integer)` — reads `world_retention_config`, coalescing NULLs to defaults **snapshot=200, log=200, memory=NULL (keep-all)**. `memory_turns IS NULL` means "never prune memories".
- Produces: new column `public.world_retention_config.memory_retention_turns integer` (nullable, `>= 1` check).

- [ ] **Step 1: Write failing pgTAP test** in `retention_config_defaults_test.sql`: with no config row, `internal_effective_retention(world)` returns `(200, 200, NULL)`; after inserting a config row `(log=10, snapshot=5, memory=50)`, returns `(10, 5, 50)`. Use `results_eq`.
- [ ] **Step 2: Run** `supabase test db` — expect FAIL (function/column absent).
- [ ] **Step 3: Implement** in the migration: `alter table public.world_retention_config add column memory_retention_turns integer;` + check constraint `memory_retention_turns is null or memory_retention_turns >= 1`. Then create `internal_effective_retention` (`security definer set search_path=''`) doing `select coalesce(log_retention_turns,200), coalesce(snapshot_retention_turns,200), memory_retention_turns from world_retention_config where world_id=p_world_id`, and a `left join`/`coalesce` so a missing row still yields `(200,200,NULL)`.
- [ ] **Step 4: Run** `supabase test db` — expect PASS.
- [ ] **Step 5: Regen types** `supabase gen types typescript --local > src/types/database.ts`; verify `memory_retention_turns` present.
- [ ] **Step 6: Commit** `config: add retention config defaults and effective-retention helper`.

## Task 1.2 — Complete prune coverage across all append tables

**Files:**

- Modify: `supabase/migrations/20261122000000_retention_config_defaults_and_coverage.sql` (same migration; append the rewritten functions)
- Test: `supabase/tests/prune_all_append_tables_test.sql`

**Interfaces:**

- Produces: `public.internal_prune_world_retention(p_world_id uuid, p_dry_run boolean default false, p_batch_limit integer default 5000) returns jsonb` — **no auth gate**, callable by table owner / cron. Uses `internal_effective_retention`. Deletes, where `turn_number < current_turn - retention`:
  - snapshot-governed: `settlement_turn_snapshots`, `settlement_turn_resource_snapshots`, `nation_turn_snapshots`, `nation_currency_snapshots`, `army_turn_snapshots`;
  - log-governed: `turn_log_entries` (via `turn_transitions.to_turn_number`), `nation_currency_ledger`, `notifications` (by `generated_at`, not wall-clock — see Task 1.5);
  - memory-governed (skip when `memory_turns IS NULL`): `citizen_memories`, `event_memories` (by `occurred_on_turn_number`);
  - width-trim `turn_transitions`: `update ... set readiness_summary_jsonb = null, forecast_snapshot_jsonb = null where to_turn_number < snapshot cutoff and (either jsonb is not null)`.
  - Deletes run in `p_batch_limit`-sized loops (`delete ... where ctid in (select ctid ... limit p_batch_limit)`) accumulating counts, so no single statement locks the table for long.
  - Returns a jsonb object with a per-table deleted-count key.
- Produces (rewrite): `public.prune_old_snapshots_and_logs(p_world_id uuid, p_retention_turns integer default 100, p_prune_notifications boolean default false, p_dry_run boolean default false) returns jsonb` — **keeps its superadmin gate**, keeps its existing return keys for the panel, and now delegates its deletes to shared internal logic so coverage cannot drift again. (`army_turn_snapshots` etc. use `world_id`; `nation_currency_ledger` has no `world_id` — join through `nation_currencies → nations.world_id`, confirmed by schema map.)

- [ ] **Step 1: Write failing test** `prune_all_append_tables_test.sql`: seed a world at `current_turn_number = 300` with one row per append table at `turn_number = 50` (below a 200 cutoff) and one at `turn_number = 250` (above). Call `internal_prune_world_retention(world, p_dry_run => false)`. Assert every old row is gone and every recent row remains, for all 10 tables; assert `turn_transitions` old row's two JSONB columns are now NULL but the row still exists; assert memory tables are untouched when `memory_retention_turns IS NULL`, and pruned when set.
- [ ] **Step 2: Run** `supabase test db` — expect FAIL.
- [ ] **Step 3: Implement** `internal_prune_world_retention` with the batched deletes and the `nation_currency_ledger` join-through-`nation_currencies`; rewrite `prune_old_snapshots_and_logs` to keep its gate + return shape but call the shared deletes.
- [ ] **Step 4: Run** `supabase test db` — expect PASS.
- [ ] **Step 5: Run existing** `supabase/tests/prune_old_snapshots_and_logs_test.sql` — expect PASS (backward-compatible return keys).
- [ ] **Step 6: Commit** `config: extend retention prune to all per-turn append tables`.

## Task 1.3 — Enable pg_cron and schedule nightly retention

**Files:**

- Create: `supabase/migrations/20261123000000_enable_pg_cron_retention.sql`
- Test: `supabase/tests/retention_cron_scheduled_test.sql`

**Interfaces:**

- Produces: `public.run_scheduled_retention() returns void` — loops `select id from public.worlds` and calls `internal_prune_world_retention(id)` for each, wrapped per-world in a `begin/exception when others` so one bad world doesn't abort the batch (log via `raise warning`).
- Produces: a `cron.schedule('nightly-retention', '17 3 * * *', $$select public.run_scheduled_retention()$$)` job.

- [ ] **Step 1: Write failing test**: assert a row exists in `cron.job` with `jobname = 'nightly-retention'`; assert `run_scheduled_retention` exists and, after seeding two worlds with prunable rows, running it deletes from both. (If pg_cron is unavailable in the local test image, the test asserts the function behavior and skips the `cron.job` assertion with `skip(1, 'pg_cron not loaded')` guarded on `select count(*) from pg_extension where extname='pg_cron'`.)
- [ ] **Step 2: Run** `supabase test db` — expect FAIL.
- [ ] **Step 3: Implement** `create extension if not exists pg_cron;` (guarded), `run_scheduled_retention()`, and the `cron.schedule(...)` call (wrapped in a `do $$ ... $$` that no-ops if the `cron` schema is absent).
- [ ] **Step 4: Run** `supabase test db` — expect PASS. Note in the migration comment that hosted Supabase requires pg_cron enabled in the dashboard Extensions list once.
- [ ] **Step 5: Commit** `config: schedule automatic nightly world retention via pg_cron`.

## Task 1.4 — Index hygiene

**Files:**

- Create: `supabase/migrations/20261124000000_retention_index_hygiene.sql`
- Test: extend `supabase/tests/retention_config_defaults_test.sql` or add `retention_index_hygiene_test.sql`

**Interfaces:** Produces: dropped redundant index `settlement_turn_snapshots_world_transition_idx` (covered by `(world_id, turn_number desc)` for prune, and `(settlement_id, turn_number desc)` for reads — verify no query needs the `(world_id, turn_transition_id)` leading form before dropping); new index `notifications_world_created_at_idx on notifications(world_id, created_at)`.

- [ ] **Step 1: Write failing test** asserting `notifications_world_created_at_idx` exists in `pg_indexes` and the dropped index does not.
- [ ] **Step 2: Run** `supabase test db` — expect FAIL.
- [ ] **Step 3:** Before dropping, `grep` the codebase and views for queries filtering `settlement_turn_snapshots` by `(world_id, turn_transition_id)`; if any rely on it, keep it and drop a different genuinely-redundant one instead — record the finding in the migration comment. Then write the `drop index` + `create index`.
- [ ] **Step 4: Run** `supabase test db` — expect PASS.
- [ ] **Step 5: Commit** `config: prune redundant snapshot index, add notifications prune index`.

## Task 1.5 — Notifications prune by turn, not wall-clock

**Files:** Modify `supabase/migrations/20261122000000_...` (fold into Task 1.2's internal function) · Test: add case to `prune_all_append_tables_test.sql`.

**Interfaces:** `notifications` currently prune by `created_at < now() - N days` (`20260805000001:256-258`), which is fragile and un-turn-aligned. Change the internal prune to delete notifications by `generated_in_transition_id in (select id from turn_transitions where world_id=... and to_turn_number < log cutoff)`, matching `turn_log_entries` semantics.

- [ ] **Step 1: Write failing test**: a notification tied to an old transition is pruned; one tied to a recent transition and one with `generated_in_transition_id IS NULL` (manual) are retained.
- [ ] **Step 2: Run** `supabase test db` — expect FAIL.
- [ ] **Step 3: Implement** the transition-based delete in `internal_prune_world_retention`.
- [ ] **Step 4: Run** `supabase test db` — expect PASS.
- [ ] **Step 5: Commit** `config: prune notifications by turn window instead of wall-clock`.

## Task 1.6 — Range-partition the two highest-multiplier append tables

**Files:**

- Create: `supabase/migrations/20261125000000_partition_turn_append_tables.sql`
- Test: `supabase/tests/partition_turn_append_tables_test.sql`

**Interfaces:**

- Produces: `settlement_turn_resource_snapshots` and `turn_log_entries` become **`partition by range (turn_number)`** (for `turn_log_entries`, add a stored `turn_number` column derived from its transition, or partition by a turn-derived key — resolve the exact key in step 1). Partition width: 100 turns.
- Produces: `public.ensure_turn_partitions(p_upcoming_turn integer)` — creates the partition covering `p_upcoming_turn` if absent; called from `run_scheduled_retention()` and at turn start.
- Produces: retention for these two tables becomes `drop table <partition>` for fully-elapsed windows (via `internal_prune_world_retention`), falling back to batched `delete` only for the partial boundary partition.

**Migration strategy (spell out in step 3):** create the new partitioned parent under a temp name, `insert into ... select` existing rows (batched), create needed partitions, swap names inside one transaction, re-create indexes/constraints/RLS/grants on the parent, point FKs at it. This is the highest-risk migration in Phase 1 — it recreates two large tables.

- [ ] **Step 1:** Decide and document the partition key for `turn_log_entries` (it has no `turn_number` today — either add one populated from `turn_transitions.to_turn_number`, or partition by `world_id`). Write the decision into the migration header comment. Write failing test: after the migration, `pg_partitioned_table` lists both tables; inserting rows across two turn-windows lands them in different partitions; `internal_prune_world_retention` drops a fully-old partition rather than deleting row-by-row (assert via `pg_tables` partition disappearance).
- [ ] **Step 2: Run** `supabase test db` — expect FAIL.
- [ ] **Step 3: Implement** the partitioning migration + `ensure_turn_partitions` + wire partition-drop into the internal prune; preserve all existing indexes, unique constraints, RLS policies, and grants on the new parents.
- [ ] **Step 4: Run** `supabase test db` — expect PASS; run existing `settlement_turn_resource_snapshots_rls_test.sql` and `apply_turn_transition_*` snapshot tests — expect PASS.
- [ ] **Step 5: Regen types** and diff `src/types/database.ts` (partitioning should not change the column shape).
- [ ] **Step 6: Commit** `config: range-partition resource snapshots and turn logs for O(1) retention`.

## Task 1.7 — Surface config-driven retention in the superadmin UI

**Files:**

- Modify: `src/features/permissions/types/superadminTypes.ts`, `src/features/permissions/mutations/superadminMutations.ts`, `src/features/permissions/components/PruneWorldDataPanel.tsx`
- Test: colocated Vitest for the mutation options; UI verified per CLAUDE.md `dev-browser` requirement.

**Interfaces:** Add a mutation `setWorldRetentionConfigMutationOptions` writing `world_retention_config` (log/snapshot/memory turns); the panel shows current effective retention (from `internal_effective_retention` exposed via a small `get_world_retention` RPC) and lets a superadmin set it. The existing manual dry-run/prune button stays as an override.

- [ ] **Step 1: Write failing Vitest** for the new mutation options object (mutationKey + mutationFn shape), mirroring the existing `pruneWorldDataMutationOptions` test pattern.
- [ ] **Step 2: Run** `npx vitest run src/features/permissions` — expect FAIL.
- [ ] **Step 3: Implement** the RPC (in the Task 1.2 migration or a small follow-up), the mutation/types, and the panel fields.
- [ ] **Step 4: Run** `npx vitest run src/features/permissions` — expect PASS; `LSP` diagnostics clean on the three files.
- [ ] **Step 5: UI-verify** with `dev-browser` as `superadmin@gubernator.local`: open the prune panel, set retention, confirm persisted value and dry-run preview. Screenshot review per CLAUDE.md.
- [ ] **Step 6: Commit** `app: let superadmins configure per-world retention`.

**Phase 1 self-check:** storage bounded automatically (Task 1.3), all tables covered (1.2, 1.5), config honored (1.1, 1.7), cheap at scale (1.6), indexes sane (1.4).

---

# PHASE 2 — Collapse the SQL write path

**Outcome:** `apply_turn_transition` executes a bounded number of set-based statements regardless of world size, removing the `statement_timeout`/30s-cap cliff.

## File structure

- Create one migration per converted section (keeps each reviewable and revertable): `20261126000000_setbased_stockpile_deltas.sql`, `20261127000000_setbased_citizen_patches.sql`, `20261128000000_setbased_guards_and_drift.sql`. Each `create or replace`s the relevant `internal_apply_turn_transition_*` helper or the orchestrator section.
- Extend `supabase/tests/apply_turn_transition_*` pgTAP suite with a large-payload timing/behaviour test.

## Task 2.1 — Set-based stockpile deltas

**Files:** Create `supabase/migrations/20261126000000_setbased_stockpile_deltas.sql` (rewrites the loop at `20260730000000_add_adjustment_amount_to_resource_snapshots.sql:131-205`). Test: `supabase/tests/apply_turn_transition_setbased_stockpiles_test.sql`.

**Interfaces:** Replace the `FOR v_delta IN jsonb_array_elements(...) LOOP` (per settlement×resource: cap-call + prior-snapshot SELECT + UPDATE + INSERT) with: one `insert into settlement_turn_resource_snapshots select ... from jsonb_to_recordset(p_payload->'stockpileDeltas')` joined to a set-based storage-cap computation and to prior stockpiles via `left join`; one `update settlement_resource_stockpiles ... from jsonb_to_recordset(...)`. Storage-cap-per-settlement computed once as a CTE, not per row.

**Concrete cycle:** (1) golden test — capture `settlement_resource_stockpiles` + `settlement_turn_resource_snapshots` output of the current function on a fixed multi-settlement payload; (2) run — passes on old code; (3) rewrite loop → set-based; (4) run — byte-identical output, assert statement count via `EXPLAIN`/timing that it no longer scales with row count; (5) run full `apply_turn_transition_*` suite green; (6) commit `turns: convert stockpile delta writes to set-based statements`.

**Verification note:** the `settlement_effective_storage_cap_internal` call must be reproduced as a set-based expression/CTE; confirm it has no per-row side effects before inlining.

## Task 2.2 — Set-based citizen/partnership patches

**Files:** Create `20261127000000_setbased_citizen_patches.sql` (rewrites loops at `20261104000000_add_education_natural_born_percent.sql:451-646`). Test: `apply_turn_transition_setbased_citizen_patches_test.sql`.

**Interfaces:** Replace the five per-row `FOR` loops (`bornOnTurnBackfill` UPDATE, `citizenBirths` INSERT, `citizenDeaths` UPDATE, `partnershipChanges` INSERT/UPDATE, `assignmentClears` DELETE) with five set-based statements over `jsonb_to_recordset`. Ordering/id-assignment that the engine relies on (e.g. deterministic new-citizen ids) must be preserved — confirm ids are supplied in the payload, not generated per-row in SQL, before converting.

**Concrete cycle:** golden test on a payload with births+deaths+partnerships+assignment-clears across multiple settlements → rewrite → assert identical resulting `citizens`/`partnerships`/`citizen_assignments` rows → suite green → commit `turns: convert citizen and partnership patches to set-based writes`.

## Task 2.3 — Set-based cross-world guards + drift validation

**Files:** Create `20261128000000_setbased_guards_and_drift.sql` (rewrites `20261009000001_add_office_terms.sql:1089-1366` guards and `:1369-1443` drift SELECTs). Test: `apply_turn_transition_setbased_guards_test.sql` + reuse `apply_turn_transition_concurrent_drift_test.sql`, `apply_turn_transition_cross_world_test.sql`.

**Interfaces:** Replace the ~25 `FOR`-loop membership checks (`= any(v_valid_*_ids)` against arrays of all ids) with single set-difference queries: `select ... from jsonb_to_recordset(payload_section) x left join <entity> e on e.id = x.id and e.world_id = p_world_id where e.id is null` → if any row returned, raise the same cross-world error. Replace per-delta drift SELECTs with one join between the payload's expected-prior values and current stockpiles, raising on mismatch. Same error codes/messages as today so existing tests pass.

**Concrete cycle:** the existing `cross_world` and `concurrent_drift` tests are the spec — they must stay green; add a large-payload case proving guard cost no longer scales with citizen count → commit `turns: make cross-world guards and drift checks set-based`.

**Phase 2 self-check:** stockpile (2.1), citizen (2.2), guards/drift (2.3) all converted; every existing `apply_turn_transition_*` test green; a large-payload test demonstrates flat statement count.

---

# PHASE 3 — Fix the engine hot loops

**Outcome:** per-turn CPU drops from O(settlements×citizens)/quadratic to ~linear, with provably identical simulation output.

## File structure

- Create `supabase/functions/_shared/simulation/indexing/bySettlement.ts` — builds `Map<settlementId, Citizen[]>` / `Map<settlementId, Partnership[]>` once, in stable order.
- Modify the phase files to consume the maps: `phaseCitizenConsumption.ts:73`, `phaseHomelessness.ts:55`, `settlementSnapshotBuilder.ts:152`, `phasePartnerships/fertility.ts:115`, `phasePartnerships/formation.ts`, `forecast.ts:145-173`.
- Create `supabase/functions/_shared/simulation/__tests__/determinism-golden.test.ts` — golden regression harness.

## Task 3.1 — Golden determinism harness (do first)

**Files:** Create `determinism-golden.test.ts` + a committed fixture (a mid-size seeded world snapshot) + its expected `runSimulation` output serialized to a golden JSON.

**Interfaces:** `runGolden(fixture, seed) → SimulationResult`; the test asserts `JSON.stringify(result)` equals the committed golden. This locks current behaviour before any optimization so Tasks 3.2–3.4 can prove non-regression.

**Concrete cycle:** generate fixture + capture golden from current engine → commit the golden → this test is the gate for the rest of Phase 3. Commit `turns: add golden determinism harness for simulation engine`.

## Task 3.2 — Group entities by settlement once

**Files:** Create `indexing/bySettlement.ts`; modify `phaseCitizenConsumption.ts`, `phaseHomelessness.ts`, `settlementSnapshotBuilder.ts`, `fertility.ts`.

**Interfaces:**

- Produces: `groupCitizensBySettlement(citizens: Citizen[]): Map<string, Citizen[]>` and `groupPartnershipsBySettlement(partnerships: Partnership[]): Map<string, Partnership[]>` — single pass, preserving input order within each group (critical for determinism).
- Consumes: called once near the top of `runSimulation`; the maps are threaded to the phases replacing their per-settlement `citizens.filter(...)` / all-partnerships scans.

**Concrete cycle:** unit test `bySettlement.ts` (order-preserving grouping) → run FAIL → implement → run PASS → refactor the four call sites to read `map.get(settlementId) ?? []` instead of `.filter` → run the **golden test (3.1)** and assert unchanged → micro-benchmark consumption+homelessness on a 100k-citizen fixture showing linear scaling → commit `turns: index citizens and partnerships by settlement once per turn`.

## Task 3.3 — Tame partnership formation

**Files:** Modify `phasePartnerships/formation.ts` (`buildAncestorSet:14-36`, `hasCloseKinship:38-51`, pairing loop `:100-132`).

**Interfaces:** Memoize `buildAncestorSet` results in a `Map<citizenId, Set<citizenId>>` computed once per phase (not per candidate pair); bound the seeking-candidate pool per settlement before the double loop. Preserve the RNG draw order and `compareById` tie-breaks exactly.

**Concrete cycle:** add a formation-specific unit test asserting identical pairings before/after on a fixed seed (subset of golden) → implement memoization + pool bound → run formation test + golden (3.1) → benchmark a dense-settlement fixture → commit `turns: memoize ancestry and bound candidate pool in partnership formation`.

## Task 3.4 — Map lookups in forecast

**Files:** Modify `forecast.ts:145-173`.

**Interfaces:** Replace `settlementBuildings.find(...)` / `tradeRoutes.find(...)` inside loops with pre-built `Map<id, …>` lookups.

**Concrete cycle:** forecast is exercised every real turn; assert forecast output unchanged via a forecast fixture test → implement → golden/forecast tests green → commit `turns: index buildings and routes for forecast lookups`.

**Phase 3 self-check:** golden harness (3.1) green after every task; grouping (3.2), formation (3.3), forecast (3.4) done; benchmarks recorded.

---

# PHASE 4 — Async execution + load path

**Outcome:** a turn of arbitrary duration completes reliably off the 30s request path, with progress visible in the UI.

**Decision gate (resolve in Task 4.0 before coding):** worker substrate — scheduled Edge Function polling a jobs table vs pg-boss vs dedicated worker. Evaluate against the repo's deployment constraints; record the choice in a short ADR appended to the Phase 4 spec. All later tasks assume that choice.

## File structure (indicative; finalized after Task 4.0)

- Create a `turn_jobs` table (or reuse `turn_transitions.status`) as the queue with `claimed_at`, `heartbeat_at`, `attempts`.
- Create `supabase/functions/end-turn-enqueue/` (thin: validate + insert job + return job id) and `supabase/functions/turn-worker/` (claims a job, runs the existing `runSimulation` + `apply_turn_transition`, updates status/progress).
- Modify `src/features/turns/` mutations + a progress subscription; modify the end-turn UI to show progress instead of blocking.

## Tasks (expand to steps after Task 4.0)

- **Task 4.0 — Substrate decision + queue schema.** Migration for the job/claim model with a single-active-turn-per-world guard (reuse the `FOR UPDATE` world lock). pgTAP: claiming is exclusive; a crashed claim (`heartbeat_at` stale) is re-claimable; completion is idempotent. Commit `config: add turn job queue with exclusive world claim`.
- **Task 4.1 — Worker runs the turn.** The worker function loads state, runs `runSimulation`, calls the (now set-based) `apply_turn_transition`, writes `turn_transitions.status` transitions (`running`→`completed`/`failed`) and a progress field. Reuses all Phase 1–3 code. Deno test with a seeded fixture end-to-end; a forced mid-run crash marks the transition `failed` and is safely re-enqueueable. Commit `turns: run end-turn simulation in background worker`.
- **Task 4.2 — Enqueue + progress UI.** `end-turn-enqueue` inserts the job and returns immediately; the turns UI subscribes to status/progress and shows a running/%/failed state. Vitest for the mutation/subscription; `dev-browser` UI verification of the full enqueue→progress→complete flow per CLAUDE.md. Commit `app: make end-turn asynchronous with progress UI`.
- **Task 4.3 — Parallelize state load.** With the cap gone, raise/parallelize `fetchRowsPaginated` (`queries.ts:102-238`) — issue page requests concurrently (known total via a `count`) instead of sequential `Range` walking, so the ~100 serial citizen round-trips overlap. Deno test asserting identical loaded set; benchmark load time on the 100k fixture. Commit `turns: parallelize world-state pagination`.

**Phase 4 self-check:** exclusive claim + crash recovery (4.0/4.1); async UX (4.2); faster load (4.3). End-to-end 100k-citizen turn completes via the worker.

---

# PHASE 5 — Payload & load slimming (contingent)

**Outcome:** peak worker memory and DB transfer bounded for the largest worlds. **Do only if Phase 4 benchmarks show memory/transfer as the residual bottleneck.**

## Tasks (expand to steps if triggered)

- **Task 5.1 — Chunked apply.** Change the persist path so `apply_turn_transition` accepts per-settlement-chunk payloads applied across several calls inside the worker (each its own transaction, or one outer coordinating transition record), instead of one multi-MB whole-world JSON. Requires the guards (Task 2.3) to be chunk-safe. pgTAP: N-chunk apply yields identical result to single-blob apply. Commit `turns: apply turn results in per-settlement chunks`.
- **Task 5.2 — Trim snapshot JSONB.** Audit the four `settlement_turn_snapshots` summary JSONB blobs and `turn_transitions.forecast_snapshot_jsonb` for redundant/derivable fields; drop what the UI recomputes. Migration + typegen + UI check. Commit `config: trim redundant per-turn snapshot payload fields`.

**Phase 5 self-check:** peak memory measured below the chosen ceiling on the 100k fixture; snapshot width reduced without UI regressions.

---

# Roadmap self-review (spec coverage)

- Spec Phase 1 (retention: coverage, config, automate, indexes, partition) → Tasks 1.1–1.7. ✅
- Spec Phase 2 (set-based writes: stockpile, citizen, guards/drift) → Tasks 2.1–2.3. ✅
- Spec Phase 3 (hot loops: grouping, formation, forecast, determinism) → Tasks 3.1–3.4. ✅
- Spec Phase 4 (async: enqueue/worker/status, load path) → Tasks 4.0–4.3. ✅
- Spec Phase 5 (payload slimming) → Tasks 5.1–5.2. ✅
- Spec open questions (partition key → 1.6 step 1; memory retention default → 1.1; worker substrate → 4.0; global retention default → 1.1) each land on an owning task. ✅
- Determinism constraint enforced by the golden harness (3.1) gating Phase 3 and by "identical error codes/output" acceptance criteria in Phase 2. ✅
