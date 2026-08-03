---
name: simulation-turn-engine
description: >-
  The turn engine: turn advancement, simulation phases, transition payloads,
  snapshots, turn logs, notifications, deterministic RNG, end-turn Edge
  Function. Trigger when touching supabase/functions/end-turn-simulation,
  supabase/functions/_shared/simulation, src/features/turns, or any
  simulation phase logic.
---

# Simulation Turn Engine

Canonical engine lives in `supabase/functions/_shared/simulation/` (Deno-safe, cross-runtime rules: no browser APIs, no `@/`, explicit `.ts` imports). The browser NEVER runs the engine — `src/shared/simulation` only re-exports notification payload parsers. Frontend feature: `src/features/turns/`.

## Turn Advancement Flow

Browser (`endTurnTransitionMutations.ts`) → `client.functions.invoke("end-turn-simulation", {worldId, expectedTurnNumber, preview?})`. Super/world admins only (checked in `authorize.ts` AND inside both RPCs). `preview: true` = read-only forecast for any world member, nothing persisted.

Real run is ASYNC (#1278): the request queues, the `turn-worker` function runs the pipeline.

On the request:

1. `start_turn_transition` — `FOR UPDATE` row lock on world, rejects `archived`/`stale_expected_turn`, inserts `turn_transitions status='running'`, returns transitionId.
2. `enqueue_turn_job(worldId, expectedTurn, transitionId)` — caller's JWT (authorizes via `is_world_admin`), one active job per world. Response is `202 {jobId, transitionId, worldId, actorId}`; a fire-and-forget nudge wakes the worker.
3. Enqueue failure after step 1 → `failStuckTurnTransition` so the world stays advanceable.

In `supabase/functions/turn-worker/` (service-role key required, checked in the handler):

4. `claim_turn_job` → load state via `resolveServiceRoleEndTurnSimulationInput` (service role, NOT a user JWT) → `runSimulation(input, transitionId)` → `mapSimulationResultToPayload` (`transition.ts`) → `computeForecastSnapshot`.
5. `apply_turn_transition(payload jsonb, ...)` — single transaction: advances turn, writes snapshots/logs/notifications/patches. Error hints: `world_archived`, `stale_expected_turn`, `state_drifted` (refresh + retry). Then `complete_turn_job` (idempotent).
6. Any failure → `failStuckTurnTransition` then `fail_turn_job` (back to `pending` under `max_attempts`, else retired). A retry opens a FRESH transition, since the previous one is terminal.
7. `heartbeat_turn_job` is checked immediately before the apply — a lost claim means another worker owns the turn, so this one applies nothing (no double-apply).

The UI polls `turn_transitions.status` + `progress_stage` (`latestTurnTransitionStatusQueryOptions`); the mutation response no longer carries a summary.

## Phases (order is load-bearing)

`runSimulation.ts` runs: 1 standardJobs, 2 depositExtraction, 3 construction, 4 buildingUpkeep, **4.5 education** (needs this-turn building-state changes), 5 passiveEffects, 6 tradeRoutes, **6.5 nationalEconomy** (tax base = positive p1+p2 deltas only), 6.75 treaties, 7 managedPopulations, **7.5 militaryUpkeep** (after tax, before consumption), 8 citizenConsumption (starvation → `pendingDeaths`), 9 partnerships, 10 homelessness, 11 events, 12 stockpileClamp, 12.5 resourceDecay (12/12.5 mutate `pendingStockpiles` in place), 13 logsAndSnapshots. Post-13: soldier death cascade, succession, treaty-marriage notes, dead-partner partnership filtering.

**Adding a phase**: `phases/phaseX.ts` + colocated `.test.ts` (fixtures from `phases/testFixtures.ts`), call in `runSimulation.ts` in the right slot, `applyDeltas`/`applyNationDeltas` its stockpile deltas (forget = later phases don't see them), spread logs/notifications/patch lists into `SimulationResult` (`simulationTypes.ts`), map into the payload in `transition.ts`, AND handle the new key in the `apply_turn_transition` SQL migration — the payload contract is coupled by `§Cxx` section comments between `transition.ts` and the migration; no version field.

## Deterministic RNG — no exceptions

- `Math.random()` is ESLint-banned in the engine. Use `createSeededRng(seed)` (FNV-1a hash → mulberry32) from `seededRng.ts`; `pickDeterministic(rng, items, count)` for selection.
- Seed convention: `` `${worldId}:${turnNumber}:${phaseName}[:${entityId}]` ``. Derive only from stable inputs — never wall-clock or iteration order. Same input state must replay identically.
- Reordering rng draws changes results; stable sorts via `sortUtils.ts`.

## Snapshots, Logs, Notifications

- p13 builds `SettlementSnapshot`/`ResourceSnapshot`; RPC writes `settlement_turn_snapshots`, `turn_log_entries`, nation/army snapshot tables. Used for history/report views (`src/features/reports`), not rollback.
- Balance invariant: `quantityAfter = before + produced + tradeIn − consumed − tradeOut` — clamp deltas must be classified as production (+) or consumption (−).
- `nation_turn_snapshots` UNIQUE `(turn_transition_id, nation_id)` — tax (6.5) and tribute (6.75) snapshots MUST be merged (`mergeNationTurnSnapshots`) or one silently drops.
- Logs: every phase returns `SimulationLogEntry[]` → `turn_log_entries`; UI is `TurnLogBrowser`. Notifications: `SimulationNotification {scope: settlement|nation|world}` fanned out to recipients in the RPC, deduped per transition id; browser parses payloads via `src/shared/simulation`.

## Tests & Traps

- Colocated vitest per phase; engine coverage thresholds are strict (see verification-workflow). `npm run test:integration` (needs local Supabase) covers `end-turn-simulation/integration.test.ts` and is EXCLUDED from plain `npm test`.
- A citizen can form a partnership (p9) then die homeless (p10) same turn — such changes must be dropped or `apply_turn_transition` rejects the payload.
- Deaths propagate: p8 → `pendingDeaths` → p10+; soldier cascade uses combined p8+p10+p11 deaths.
- `state/LOAD_ARCHITECTURE.md` documents input-state loading; determinism is keyed on `(worldId, turnNumber)`.
