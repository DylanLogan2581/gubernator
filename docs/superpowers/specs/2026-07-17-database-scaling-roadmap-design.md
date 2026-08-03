# Database Scaling Roadmap — Storage Growth & Turn-Transition Time

**Date:** 2026-07-17
**Status:** Design approved; ready for implementation planning
**Scope:** Roadmap-level design across five phases. Each phase gets its own spec → plan → implementation cycle.

## Problem

Two scaling concerns as large worlds run for many turns:

1. **Storage grows without bound.** ~12 per-turn append/snapshot tables accumulate rows every turn; the only bounding mechanism is a manual, superadmin-triggered prune that covers just 4 of them and is never scheduled.
2. **Turn-transition time grows super-linearly.** The turn loads the whole world into memory, simulates single-threaded, builds a multi-MB JSON payload, and applies it in one transaction with row-by-row PL/pgSQL loops. At large scale this exceeds the 30s RPC cap and Edge limits.

### Target scale

Design for a **large** world: **~200 settlements, ~100k citizens, ~30 resources**, running daily turns for a year or more. Order-of-magnitude implications at this scale:

- State load ≈ **100 sequential paginated round-trips** for citizens alone (1000-row pages), gating the whole load.
- O(settlements × citizens) engine passes ≈ **20M operations each**, repeated across several phases.
- `settlement_turn_resource_snapshots` ≈ **6k rows/turn ≈ 2.2M rows/year/world**; the stockpile write loop alone ≈ **~24k SQL statements/turn**.
- The turn cannot finish within the current **30s RPC cap** — execution model must change, not just micro-optimizations.

## Decisions (locked)

- **Execution model:** the turn becomes **asynchronous / backgrounded** — enqueue, run in a background worker, report status/progress to the UI. Not a synchronous request.
- **Engine:** **keep the existing TypeScript simulation engine.** It is large, tested, and deterministic. We change _where and how_ it runs, not the simulation logic. Rewriting the sim in PL/pgSQL is explicitly rejected (throws away tested deterministic code for large risk).
- **Infrastructure:** full Supabase toolbox is available — **pg_cron** for scheduled retention, and **background workers / queues** (pg-boss, scheduled Edge functions, or a dedicated worker) for async turns.
- **Determinism constraint:** the seeded RNG threads one mutable stream through settlements in order (`seededRng.ts`, `phasePartnerships/index.ts:58`). Settlements cannot be reordered or processed in parallel without changing outcomes. **Async buys wall-clock headroom, not multi-threading** — per-turn _work_ must still come down. Every optimization must preserve identical simulation output.

## Findings (baseline being fixed)

### Storage (Concern 1)

Per-turn append tables and their per-turn row multipliers:

| Table                                 | Rows / turn                         | Notes                                                                                   | Prune path today?  |
| ------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------- | ------------------ |
| `settlement_turn_resource_snapshots`  | settlements × resources             | 6× `numeric(18,4)`, 3 indexes; fastest grower (~2.2M rows/yr)                           | Yes                |
| `settlement_turn_snapshots`           | settlements                         | 4 JSONB summary blobs                                                                   | Yes                |
| `turn_log_entries`                    | events                              | JSONB payload, per-row validate trigger                                                 | Yes                |
| `notifications`                       | players × events                    | 5 indexes; prune filters un-indexed `created_at`, off by default                        | Partial            |
| `nation_turn_snapshots`               | nations                             | JSONB                                                                                   | **No**             |
| `nation_currency_snapshots`           | currencies                          | 3 indexes                                                                               | **No**             |
| `army_turn_snapshots`                 | armies                              | JSONB                                                                                   | **No**             |
| `nation_currency_ledger`              | central-bank actions                | —                                                                                       | **No**             |
| `citizen_memories` / `event_memories` | citizens × memory-events (per turn) | text ≤1000 chars                                                                        | **No**             |
| `turn_transitions`                    | 1 / world                           | 2 unbounded JSONB (`readiness_summary_jsonb`, `forecast_snapshot_jsonb`), never trimmed | Row kept by design |

Retention weaknesses:

1. **Manual only** — runs only via the `PruneWorldDataPanel` superadmin button. pg_cron is "not yet integrated" (`20260619000000_add_snapshot_log_retention_policy.sql:13,18`). Absent human action, growth is unbounded.
2. **Incomplete** — `prune_old_snapshots_and_logs` deletes from only 4 tables; 6+ tables grow forever even when pruning runs.
3. **Config vestigial** — `world_retention_config` exists and admins can set it, but the prune RPC takes retention as a call parameter and **never reads the config table**.
4. Index smells — overlapping `world_id`-leading indexes on the highest-multiplier snapshot tables; `notifications.created_at` un-indexed for its own prune predicate.

### Turn time (Concern 2)

Verified paths: entry `supabase/functions/end-turn-simulation/index.ts`; load `state/index.ts` + `state/queries.ts`; engine `_shared/simulation/runSimulation.ts` + `phases/*`; payload `transition.ts`; persist `persist.ts` → SQL `apply_turn_transition` (orchestrator `supabase/migrations/20261009000001_add_office_terms.sql:838`).

Bottlenecks that grow faster than linearly:

- **State load serializes** — `fetchRowsPaginated` pages sequentially in 1000-row chunks (`queries.ts:102-238`) inside one `Promise.all` (`state/index.ts:211-273`); the single slowest table gates the whole load.
- **O(settlements × citizens) passes** — `citizens.filter(...)` per settlement in citizen consumption (`phaseCitizenConsumption.ts:73`), homelessness (`phaseHomelessness.ts:55`), and the snapshot builder (`settlementSnapshotBuilder.ts:152-279`).
- **Partnerships** — fertility is O(settlements × all partnerships) (`fertility.ts:115`); formation is quadratic: seeking-males × seeking-females × ancestry-BFS per pair (`formation.ts:73,100`; `buildAncestorSet` `:14-36`).
- **Single transaction, row-by-row SQL** — stockpile deltas ≈ 4 statements × (settlements × resources) (`20260730000000_add_adjustment_amount_to_resource_snapshots.sql:131-205`); one statement per birth/death/partnership (`20261104000000_add_education_natural_born_percent.sql:451-646`); per-row drift SELECTs (`20261009000001...:1369-1443`); O(payload × all-citizens) cross-world guard scans (`20261009000001...:1089-1366`). Main risk against `statement_timeout` and the 30s RPC cap.
- **Full-world JSON payloads built in memory** — transition payload (`transition.ts:231-393`) and forecast (`forecast.ts:55-211`, built every real turn), each multi-MB, `JSON.stringify`-ed, POSTed, re-parsed by `jsonb_array_elements`.

## Architectural spine

Enqueue → background worker runs the existing TS engine → **set-based** apply → status/notify. Every phase below is independently shippable and ordered by value/risk. Phases 1–3 shrink the work and de-risk Phase 4 before it re-homes the turn.

---

## Phase 1 — Bound storage (retention)

_Independent, low risk, first._

- **Complete coverage.** Extend pruning to the tables it ignores: `nation_turn_snapshots`, `nation_currency_snapshots`, `army_turn_snapshots`, `nation_currency_ledger`, `event_memories`, `citizen_memories`. Reclaim width on `turn_transitions` by nulling `readiness_summary_jsonb` / `forecast_snapshot_jsonb` past the snapshot window while keeping the row as an FK anchor.
- **Config-driven + safe default.** Prune reads `world_retention_config`. Flip the global default from _keep-all_ to a bounded default (e.g. 200 turns) so every world is bounded even without explicit admin config. Memories get their own retention setting — they are narrative gameplay data and may warrant a longer or independent window.
- **Automate.** Nightly `pg_cron` job iterating worlds, calling the prune with each world's config, deleting in bounded `LIMIT` batches to cap lock time and WAL churn.
- **Index hygiene.** Drop overlapping `world_id`-leading indexes on the snapshot tables; add `notifications(world_id, created_at)` for its prune predicate.
- **Structural upgrade (the real scale answer).** Range-**partition** `settlement_turn_resource_snapshots` and `turn_log_entries` by turn number (or by world), so retention becomes `DROP PARTITION` — instant, no VACUUM bloat — instead of `DELETE` of millions of rows. This keeps the planner healthy at multi-million-row scale.

**Delivers:** storage bounded automatically for all worlds. **Verification:** pgTAP test that prune covers every append table and honors config; a synthetic large-world fixture confirming partition drop reclaims space.

## Phase 2 — Collapse the SQL write path

_Biggest turn-time DB win._

Convert the per-row PL/pgSQL `FOR` loops in `apply_turn_transition` to **set-based** statements (`jsonb_to_recordset` → single `INSERT…SELECT` / `UPDATE…FROM`):

- Stockpile deltas (~24k statements → a handful).
- Births, deaths, partnership changes, assignment clears (one statement per element → one statement each).
- Replace per-row **drift SELECTs** with a single join-based validation returning conflicting rows.
- Replace **O(payload × all-citizens)** `= any(big_array)` cross-world guard scans with join / `EXISTS` validation against real tables.

**Delivers:** removes the `statement_timeout` cliff; slashes transaction and lock duration. **Verification:** existing `apply_turn_transition_*` pgTAP suite must stay green (row-level outcomes unchanged); add a large-payload timing assertion.

## Phase 3 — Fix the engine hot loops

_Biggest turn-time CPU win._

- Pre-group citizens and partnerships by settlement **once** at the top of `runSimulation` (`Map<settlementId, Citizen[]>`, `Map<settlementId, Partnership[]>`), passed into phases — eliminates the repeated O(settlements × citizens) `.filter` passes (consumption, homelessness, snapshot builder, fertility). 20M ops → linear.
- Partnership **formation**: memoize ancestry sets (`buildAncestorSet`) and bound the candidate pool to tame the quadratic pairing. Preserve RNG stream order.
- Forecast: index buildings/routes into Maps to remove `.find` in loops.

All changes preserve iteration/RNG order → identical outcomes.

**Delivers:** large CPU reduction per turn. **Verification:** a **determinism golden test** — run the engine before/after on a fixed seed + fixture and assert byte-identical output; micro-benchmark the grouped phases.

## Phase 4 — Async execution + load path

_Removes the wall-clock ceiling; the infra lift that unlocks full 100k scale._

- **Enqueue + worker.** Admin action enqueues a turn job (jobs table / pg-boss); a background worker (scheduled Edge function or dedicated worker) claims it, runs the engine, applies results (chunked), updates `turn_transitions.status` + progress. Frontend polls/subscribes for progress; the 30s request cap no longer applies.
- **Load path.** With the cap gone, parallelize or raise the state-load pagination (the ~100 serial citizen round-trips), and stream writes in chunks rather than one multi-MB payload.

**Delivers:** turns of arbitrary duration complete reliably at target scale. **Verification:** end-to-end run of a 100k-citizen fixture world completing a turn via the worker; failure/retry semantics tested (job crash → transition marked `failed`, re-enqueue safe).

## Phase 5 — Payload & load slimming

_Contingent polish; largest worlds only._

Once async, shrink peak memory and transfer: batch the apply payload per-settlement-chunk instead of one whole-world JSON blob; trim redundant snapshot JSONB. Revisit only if Phase 4 leaves memory/transfer as the bottleneck.

**Delivers:** lower peak memory and transfer for the largest worlds. **Verification:** peak-memory measurement on the 100k fixture below a chosen ceiling.

---

## Sequencing & dependencies

1. **Phase 1** — independent; do first (stops storage bleeding).
2. **Phase 2** — independent; removes the DB-time cliff and de-risks Phase 4's apply.
3. **Phase 3** — independent; removes the CPU term.
4. **Phase 4** — depends on Phases 2–3 having shrunk the work; delivers the async model.
5. **Phase 5** — depends on Phase 4; optional.

Phases 1–3 each ship standalone value and can proceed in parallel if staffed; Phase 4 should follow them.

## Out of scope

- Rewriting the simulation engine in SQL/PL-pgSQL.
- Keeping the turn synchronous.
- Multi-threading the simulation (precluded by deterministic RNG).
- Gameplay/behavior changes — every phase must preserve identical simulation outcomes.

## Open questions (resolve during per-phase planning)

- Partition key for the big append tables: by `turn_number` range vs by `world_id` (or composite). Affects prune-by-drop granularity and cross-world query plans.
- Memory-table retention default: keep-all, or a long bounded window — product call on narrative persistence.
- Worker substrate for Phase 4: scheduled Edge function vs pg-boss vs dedicated worker — decide against operational constraints at planning time.
- Whether the safe bounded retention default (200 turns) is global or per-world-template configurable.

---

## ADR-001 — Phase 4 worker substrate (2026-08-03, issue #1277)

**Status:** accepted.

### Context

Phase 4 moves turn execution off the synchronous Edge request. The substrate
question from the open questions above had to be settled before the queue could
be built, because it determines whether Phase 5 (payload/turn chunking) is
contingent polish or a hard prerequisite.

Options considered:

1. **In-database queue (`turn_jobs` table or pgmq) + `pg_cron` → `pg_net` invoking an Edge worker.**
   Repo-native: `pg_cron` is already enabled (`20261123000000_enable_pg_cron_retention.sql`),
   nothing new to host or deploy. But Supabase Edge Functions have their own
   execution ceiling, so the largest turns may still not fit in one worker
   invocation.
2. **External polling worker** (a small deployed Node/Deno service consuming the
   queue). No runtime cap, cleanest for arbitrary-duration turns, but it is new
   infrastructure to host, deploy, secure and monitor — the project currently
   deploys nothing outside Supabase.
3. **pg-boss** — needs a long-running Node process, so it collapses into option 2
   plus a dependency.

### Decision

Adopt **option 1**: a durable in-database `turn_jobs` queue with SECURITY DEFINER
claim RPCs, consumed by a Supabase-hosted worker. No external infrastructure is
introduced.

The queue is deliberately **worker-agnostic**: the claim protocol
(`enqueue_turn_job` / `claim_turn_job` / `heartbeat_turn_job` /
`complete_turn_job` / `fail_turn_job`) makes no assumption about where the
claimant runs. Its only contract is `claimed_by` + a periodic `heartbeat_at`, so
option 2 remains a drop-in swap later — an external worker would consume the
exact same RPCs — without a schema change or a data migration.

`pgmq` was rejected in favour of a plain table because the queue is tiny
(at most one active job per world), needs domain columns (`world_id`,
`from_turn_number`, `turn_transition_id`) and a domain-specific uniqueness rule,
and benefits from being visible to the existing pgTAP and RLS tooling.

### Consequences

- **Phase 5 (payload & turn chunking) becomes mandatory, not contingent.** A
  bounded worker runtime means the largest turns must be chunked across
  invocations; the job row is the natural place to carry chunk progress.
- The existing `turn_transitions` lifecycle stays the coordination surface and
  the UI's polling target (`latestTurnTransitionStatusQueryOptions`); the queue
  sits beside it, linked by `turn_jobs.turn_transition_id`.
- Single-active-turn-per-world is enforced twice: a partial unique index on
  `turn_jobs(world_id) where status in ('pending','claimed')`, and an enqueue-time
  refusal while a `turn_transitions` row for the world is still `running`, taken
  under the existing `FOR UPDATE` world lock.
- Crashed workers are recovered by heartbeat staleness rather than by a manual
  admin action; `fail_stuck_turn_transition` remains the escape hatch for a
  wedged transition.
- If the Edge ceiling later proves insufficient even with chunking, the escape
  hatch is option 2 and it costs no schema work.

### Follow-ups

- #4.1 / #4.2 build the worker loop and the enqueue-side UX on top of this queue.
- The `pg_cron` → `pg_net` scheduling of the worker is deliberately **not** part
  of #1277; it lands with the worker itself, so no schedule fires against an
  unimplemented consumer.

### Delivered (2026-08-03, issue #1278)

Phase 4 shipped on this substrate: `supabase/functions/turn-worker/` consumes
the queue and runs the unchanged `resolveEndTurnSimulationInput` →
`runSimulation` → `computeForecastSnapshot` → `apply_turn_transition` pipeline,
while `end-turn-simulation` reduces to auth → `start_turn_transition` →
`enqueue_turn_job` → `202`. Two follow-ups are explicitly still open:

- **Periodic scheduling.** The worker is woken by a nudge from the enqueueing
  request. Recovering a job whose worker died still waits for the next
  invocation rather than a timer; the `pg_cron` → `pg_net` sweep lands with
  phase 5.
- **The ~100k-citizen budget target.** Not yet demonstrated. Per this ADR's own
  consequences, the largest turns need phase 5 chunking before a single worker
  invocation can be expected to hold them.
