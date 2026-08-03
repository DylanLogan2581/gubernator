# World Turn Pause — Design

**Date:** 2026-08-03
**Status:** Approved for planning
**Milestone:** Epic 12 follow-on (milestone #16)

## Problem

The turn now runs in a background worker (#1278). The worker path is correct, but the
user-facing model around it is not.

`TurnTransitionProgressPanel` renders only inside `EndTurnControl` — the dashboard card and
the header chip. In practice only the admin who pressed End Turn sees that a turn is running.
The panel tells that admin "You can keep using the app while the turn runs."

Everyone else keeps playing. Nothing stops them. The only database guard is a single-active-
transition-per-world check that prevents a second End Turn; ordinary gameplay writes are
unrestricted while the worker holds a loaded copy of world state.

Two concrete failures follow:

1. **Lost or misapplied intent.** A settlement manager reassigning a job after the worker has
   loaded state gets a change that silently applies to the _next_ turn. Nothing tells them
   which turn their action landed in.
2. **Stale reads presented as current.** Every screen shows pre-transition numbers for the
   duration of the run, with no indication they are about to change.

On the largest target worlds the run is not brief. The Phase 5 scale benchmark
(`supabase/functions/end-turn-simulation/turnScale.bench.ts`) measures ~6.8 s of engine time
at 201 settlements / 100k citizens, before load and persistence. The window is wide enough to
matter.

## Goals

- Every user in a transitioning world knows a turn is advancing, and cannot act until it ends.
- No gameplay write can land during a transition, regardless of which code path attempts it.
- No ambiguity about which turn a change applies to.
- No time limit on the transition: the pause is bounded by the worker, not by a request.

## Non-goals

- Changing the simulation engine, determinism, or the queue/claim protocol.
- Payload chunking (Phase 5 Task 5.1) — tracked separately.
- Cross-world pausing. A transition in world A must not affect world B.

## Decisions

| Question        | Decision                                                                    |
| --------------- | --------------------------------------------------------------------------- |
| Enforcement     | UI overlay **and** database write block                                     |
| Exemptions      | Superadmin recovery path only; no general superadmin exemption              |
| Scope           | World-scoped. Global routes and other worlds unaffected                     |
| On completion   | Explicit "Continue to turn N" acknowledgment, not auto-dismiss              |
| On failure      | Players stay blocked with a neutral message; admins see detail and recovery |
| Progress detail | Per simulation phase, plus client-derived elapsed time                      |
| Guard mechanism | Trigger on gameplay tables (see below)                                      |
| Stale worker    | Auto-fail included in this spec                                             |

### Why a trigger, and not RLS or per-RPC guards

All 132 gameplay RPCs are `security definer`, so **they bypass RLS**. An RLS-policy guard would
protect nothing on the paths that matter. Adding the check to each RPC (mirroring the existing
`world is archived` guard) is 132 hand edits, is forgettable on RPC #133, and still misses the
26 tables written directly from feature mutation modules.

Triggers fire under `security definer`, under RLS bypass, from RPCs, from direct writes, and
from the SQL editor. Coverage is the reason for the choice; the costs are a permanent per-row
check on gameplay writes and the up-front work of classifying every table.

## Architecture

Three cooperating pieces, each independently testable.

### 1. Database guard (source of truth)

A `security definer` trigger function `internal_reject_write_during_transition()`, attached as
`before insert or update or delete for each row` to every guarded table. It resolves the
affected row's world, and if a `turn_transitions` row for that world has `status = 'running'`,
raises `world turn in progress` with `errcode = 'P0001'`.

It short-circuits on a transaction-local escape hatch:

```sql
current_setting ('app.applying_turn', true) = 'on'
```

`apply_turn_transition` and `fail_stuck_turn_transition` set that flag via
`set_config('app.applying_turn', 'on', true)` at their top, so the turn's own writes and the
superadmin recovery path pass through. The flag is transaction-local; it cannot leak to a
subsequent statement on a pooled connection.

A partial index keeps the lookup to an index probe:

```sql
create index turn_transitions_running_world_idx on public.turn_transitions (world_id)
where
  status = 'running';
```

**Table classification is a deliverable, not an implementation detail.** The migration carries
an explicit commented list in three buckets:

- **Guarded** — any world-scoped state the simulation reads or writes. This includes world-admin
  configuration tables (`building_blueprints`, `job_definitions`, `resources`, and similar), not
  only player-facing tables: a blueprint edited mid-run would apply to an already-loaded turn just
  as ambiguously as a job reassignment. World admins and superadmins are blocked here too; the
  only exemption is the recovery path. Each entry records its world-resolution
  expression alongside its name (direct `world_id`; or through `settlement_id` →
  `nations` → `worlds`; or through `nation_id`; or through `citizen_id`).
- **Unguarded, turn output** — written only by the turn: `turn_transitions`, `turn_jobs`,
  `notifications`, and the `*_turn_snapshots` tables.
- **Unguarded, out of scope** — auth and infrastructure: `users`, `smtp_settings`,
  `email_send_log`, `edge_rate_limit_buckets`, `admin_create_user_idempotency_keys`,
  `notification_preferences`.

A pgTAP test asserts the three buckets partition `public`'s base tables exactly. A future table
added without a classification fails the suite rather than silently landing unguarded. This
test is what makes the guarantee real rather than aspirational.

Of the ~70 public base tables, ~40 carry `world_id` directly and ~11 resolve through
`settlement_id`/`nation_id`/`citizen_id`. The remaining ~19 (`partnerships`, `trade_routes`,
`army_units`, `law_amendments`, `event_effects`, and similar) need individual classification
during implementation; the completeness test forces that work to finish.

### 2. Status feed

`latestTurnTransitionStatusQueryOptions` already polls `turn_transitions` every 3 s while a
transition is running and is readable by any world member. Two changes:

- `progress_stage` widens from `queued | loading | simulating | persisting` to one value per
  simulation phase, so the bar does not sit on "simulating" for the bulk of the wait.
- Elapsed time is derived client-side from the existing `started_at`. Nothing new is stored.

The 3 s interval stays. While the overlay is up the app is otherwise idle, so the cost is one
small query per user per 3 s in place of a full page's worth of queries.

Per-phase progress writes are side-band: they must not touch the RNG, and the golden
determinism fixture must remain byte-identical.

**Per-phase reporting requires an async engine.** `runSimulation` is synchronous, with 20
straight-line phase calls. A ~7 s synchronous block starves the event loop, so the worker
cannot flush a progress write mid-run — it can only stamp a stage before and after. The engine
therefore becomes `async`, awaiting a yield between phases, and gains an optional `onPhase`
hook. There is one production caller (`transition.ts:179`). Phase order and RNG draws are
unchanged; only the scheduling around them changes, which is why the golden fixture stays
byte-identical.

### 3. Overlay

A new `WorldTurnPauseOverlay`, rendered inside `WorldEntryGate` in
`src/routes/worlds.$worldId.tsx`. That component already wraps every world-scoped route, so the
overlay covers the whole world with no per-page work and reaches nothing outside it.

Three states:

- **Running** — phase label, progress bar, elapsed timer. No dismiss control.
- **Completed, unacknowledged** — a "Continue to turn N" button. Clicking it invalidates every
  world-scoped query, then unmounts the overlay, so the user cannot see pre-turn numbers after
  acknowledging.
- **Failed** — players see a neutral "the turn did not complete; an admin has been notified"
  message and stay blocked. Admins additionally see the error and the existing retry and
  recovery controls.

**Acknowledgment is session-local and not persisted.** The completion state shows only to
clients that had the overlay mounted when the transition finished. A user who loads the page
fresh three turns later simply sees the current turn. No new table, and no backlog of stale
acknowledgments to click through.

`TurnTransitionProgressPanel`'s running branch is removed rather than left to duplicate the
overlay.

### Flow

1. Admin clicks End Turn; the Edge Function enqueues a `turn_jobs` row and returns.
2. Every client's next poll (≤3 s) observes `running`. Overlays mount world-wide.
3. Gameplay writes are now rejected at the database.
4. The worker reports each phase as it enters it.
5. On `completed`, overlays swap to the acknowledgment state.
6. Each user clicks Continue; their queries invalidate and the overlay clears.

## Error handling

The overlay is eventually consistent — up to 3 s of poll lag — so a user with a request already
in flight when the turn starts **will** hit the guard. That seam is where the UI pause and the
database pause meet, and it is the most likely source of a confusing bug.

`normalizeSupabaseError` maps `world_turn_in_progress` to a distinct `AuthUiError` variant, and
`notify` renders it as "The turn is advancing — your change was not saved" rather than a
generic failure toast.

## Stale worker auto-fail

This design converts a wedged worker from a one-admin annoyance into a world-wide outage, so
the mitigation ships with it.

`turn_jobs` already carries `heartbeat_at` and supports stale re-claim, which covers a worker
that dies while another is available. It does not cover the case where no worker is alive: the
`turn_transitions` row stays `running` indefinitely and the world stays frozen.

A `pg_cron` job (pg_cron is already enabled and scheduled from Phase 1 retention) marks a
transition `failed` when its job's heartbeat is stale beyond a configured threshold and its
attempts are exhausted. The world then lands in the failed state, which players see as
"paused, an admin notified" and admins can recover from — rather than an indefinite freeze
with no signal.

## Testing

**pgTAP**

- Gameplay write rejected while a transition is running.
- The same write permitted when idle.
- Writes inside `apply_turn_transition` permitted (escape hatch).
- Writes on the `fail_stuck_turn_transition` recovery path permitted.
- A transition running in world A does not block writes in world B.
- Table classification completeness: guarded ∪ turn-output ∪ out-of-scope = all base tables.
- Stale-heartbeat auto-fail marks the transition `failed`.

**Vitest**

- Overlay running / acknowledge / failed states, player and admin variants.
- Acknowledgment invalidates world-scoped queries and unmounts.
- Elapsed-time formatting.
- `world_turn_in_progress` error mapping and toast copy.

**Determinism**

- The golden fixture stays byte-identical; per-phase progress writes are side-band.

**Browser**

- `dev-browser` verification of the full flow in two profiles simultaneously (an admin and a
  non-admin), watching the non-admin freeze and release. Desktop and mobile widths.

## Risks

| Risk                                                 | Mitigation                                                      |
| ---------------------------------------------------- | --------------------------------------------------------------- |
| A guarded table is missed, leaving a write path open | Classification completeness pgTAP test                          |
| Per-row trigger cost on every gameplay write         | Partial index; check is an index probe                          |
| Escape-hatch flag leaks across statements            | `set_config(..., true)` is transaction-local; asserted in pgTAP |
| Wedged worker freezes a world indefinitely           | Stale-heartbeat auto-fail via pg_cron                           |
| Poll lag lets an in-flight write hit the guard       | Typed error mapped to explicit user-facing copy                 |
