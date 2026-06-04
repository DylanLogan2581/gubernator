# Epic 6: Simulation Engine

Reference document for the turn-simulation subsystem introduced in Epic 6. Companion to
`docs/epic-3-world-topology.md` and `docs/epic-5-settlement-operations.md`.

This file is a quick map of how the pieces interact and where they live in the codebase.
It does not duplicate the Epic 6 feature guide or schema plan — those remain the source of
truth for product behavior and table shape. The canonical schema lives in the
`supabase/migrations/20260603*` files; the canonical engine logic lives in
`src/shared/simulation/`.

Schema cross-references: `gubernator_schema_simplified_v3.md` §9 (simulation tables),
§10 (snapshots), §11 (notifications and log entries).

---

## Architecture overview

The simulation engine is a **pure TypeScript module** with no database dependency. It
receives a snapshot of world state, runs deterministic computations, and returns a typed
patch list. A Supabase Edge Function adapter wraps it and persists the result via a single
RPC call.

```text
┌──────────────────────────────────────────────────────────────────────┐
│  Browser / caller                                                    │
│  POST /functions/v1/end-turn-simulation                              │
│  { worldId, expectedTurnNumber }                                     │
└────────────────────────────┬─────────────────────────────────────────┘
                             │ HTTP
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Edge Function  (supabase/functions/end-turn-simulation/)            │
│                                                                      │
│  authorize.ts  — is_super_admin / is_world_admin gate               │
│  state.ts      — load SimulationInputState from DB                  │
│  persist.ts    — POST /rest/v1/rpc/start_turn_transition  ──────┐  │
│                  ← returns transitionId (UUID)                   │  │
│  transition.ts — runSimulation(transitionId) →                   │  │
│                  ApplyTurnTransitionPayload                       │  │
│  persist.ts    — POST /rest/v1/rpc/apply_turn_transition ────────┘  │
└────────────────────────────┬─────────────────────────────────────────┘
                             │ PostgREST RPC (two calls)
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│  start_turn_transition (SECURITY DEFINER RPC)                        │
│  • Validates auth, archived, and stale-turn                          │
│  • Inserts turn_transitions row (status='running')                   │
│  • Returns the row's UUID — used as engine RNG seed                 │
├──────────────────────────────────────────────────────────────────────┤
│  apply_turn_transition (SECURITY DEFINER RPC)                        │
│  • Looks up the running transition row by p_transition_id            │
│  • Applies all patch phases (§C28–§C35)                              │
│  • Advances current_turn_number                                      │
│  • Marks transition completed; returns ApplyTurnTransitionSummary    │
└──────────────────────────────────────────────────────────────────────┘
```

**Key separation of concerns:**

- The engine (`src/shared/simulation/`) is pure computation — no I/O, no randomness
  beyond the seeded RNG, no Supabase imports.
- The edge function adapter is the only code that talks to the database.
- The RPC is the only code that writes to the database. It re-enforces auth and world
  state so the edge function cannot bypass them.

---

## Phase order

`runSimulation` in `src/shared/simulation/runSimulation.ts` runs phases in this fixed
order. Phases share a mutable `pendingStockpiles` map that carries running stockpile
totals between phases.

| #   | Phase                | Key semantics                                                                                                                                                                                                                                                                               |
| --- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `standardJobs`       | Citizens assigned to `standard` jobs produce/consume resources proportional to worker count.                                                                                                                                                                                                |
| 2   | `depositExtraction`  | Citizens assigned to deposit jobs extract resources; deposits whose remaining quantity hits zero are marked `depleted`.                                                                                                                                                                     |
| 3   | `construction`       | Workers advance active construction projects; completed projects graduate to `complete` and spawn building entries.                                                                                                                                                                         |
| 4   | `buildingUpkeep`     | Each active/suspended building pays its tier's upkeep costs. Successful payment on a suspended building recovers it to `active` and resets `missed_upkeep_count`. Failed payment increments `missed_upkeep_count`; once it exceeds `grace_period_turns` the building is auto-deconstructed. |
| 5   | `passiveEffects`     | Active buildings with `passive_resource_production` effects inject resources with no worker requirement.                                                                                                                                                                                    |
| 6   | `tradeRoutes`        | `active` trade routes transfer resources between settlements; insufficient stockpile at origin pauses the route.                                                                                                                                                                            |
| 7   | `managedPopulations` | Husbandry workers grow herds; culling workers reduce them and produce outputs; extinct populations are removed.                                                                                                                                                                             |
| 8   | `citizenConsumption` | Each alive citizen consumes food and water; citizens who cannot be fed/watered die of starvation.                                                                                                                                                                                           |
| 9   | `partnerships`       | Starvation deaths from phase 8 dissolve partnerships (widowed); eligible NPC pairs may form new partnerships.                                                                                                                                                                               |
| 10  | `homelessness`       | Citizens over the population cap die of homelessness. Manual-deconstruct overshoot log entries from out-of-band admin actions are also resolved here.                                                                                                                                       |
| 11  | `events`             | Pending simulation events whose `activateOnTransitionAfterTurnNumber` has been reached fire their effects (resource grants, population losses, deposit discoveries).                                                                                                                        |
| 12  | `stockpileClamp`     | Stockpiles are clamped to `[0, effectiveStorageCap]`. Caps are pre-computed from the input state before any phase runs, so building-upkeep auto-deconstructions in phase 4 do not shrink caps mid-turn.                                                                                     |
| 13  | `logsAndSnapshots`   | Collects phase outputs and assembles `ResourceSnapshot` and `SettlementSnapshot` records. Produces no mutations.                                                                                                                                                                            |

### Snapshot accounting model

Each `ResourceSnapshot` satisfies the balance equation:

```
quantityAfter = quantityBefore + produced + tradeIn − consumed − tradeOut
```

Phase 12 (stockpile clamp) deltas are classified into the same `produced`/`consumed`
buckets to preserve this invariant:

- A **positive** clamp delta (a stockpile that went negative and is raised back to 0)
  is counted as `produced`.
- A **negative** clamp delta (an over-cap stockpile that is lowered to the cap) is
  counted as `consumed`.

When phase 11 (events) gains stockpile-affecting effects in a future epic, those deltas
must receive the same treatment (positives → `produced`, negatives → `consumed`) so the
balance equation continues to hold.

---

## Determinism model

### Seeded RNG

The engine uses **Mulberry32**, a 32-bit generator seeded from the `transitionId` UUID
supplied by the edge function at call time. Implementation: `src/shared/simulation/seededRng.ts`.

```text
seed = hashStringToSeed(transitionId)   // FNV-1a hash → uint32
rng  = mulberry32(seed)                 // () => number in [0, 1)
```

Phases that need randomness (e.g., partnership formation probability checks) create their
own phase-local `SeededRng` instances derived from the same `transitionId`. This keeps
cross-phase RNG consumption independent so phase ordering changes never affect the random
stream of other phases.

`pickDeterministic(rng, items, count)` implements a Knuth shuffle subset — it draws
`count` items from `items` without replacement in a stable, seed-determined order.

### Deterministic ordering tie-breaks

Phases that iterate over collections (citizens, buildings, deposits, etc.) use the
**UUID sort order of the entity's `id` column** as a consistent tie-break. Input arrays
arrive pre-sorted from the state-loading query in `state.ts`. This guarantees identical
results for a given `(worldId, turnNumber, transitionId)` triple regardless of the host
environment.

---

## RPC contract

The edge function uses a **two-step protocol**: reserve the transition row first, run the
engine with the returned UUID as its RNG seed, then apply the result using the same UUID.
This ensures `turn_transitions.id` and the engine seed are always identical, making engine
output reproducible from the stored row.

---

## `start_turn_transition` RPC

### Signature

```sql
function public.start_turn_transition (p_world_id uuid, p_expected_turn_number integer) returns uuid language plpgsql security definer
set
  search_path = '';
```

### Behaviour

1. Validates both params are non-null.
2. Re-checks caller is `is_super_admin()` or `is_world_admin(p_world_id)`; raises
   `insufficient_privilege` (42501) otherwise.
3. Acquires a `FOR UPDATE` row lock on `worlds` to serialize concurrent callers.
4. Raises `P0001` if the world is archived or `p_expected_turn_number` does not match
   `current_turn_number`.
5. Inserts a `turn_transitions` row with `status = 'running'`. On `unique_violation`
   (concurrent caller already inserted the row) it reuses the existing running row.
6. Returns the `turn_transitions.id` UUID. The edge function passes this to
   `planSimulationTransition` as the engine RNG seed and later to `apply_turn_transition`
   as `p_transition_id`.

---

## `apply_turn_transition` RPC contract

### Signature

```sql
function public.apply_turn_transition (
  p_world_id uuid,
  p_expected_turn_number integer,
  p_payload jsonb,
  p_transition_id uuid
) returns jsonb language plpgsql security definer
set
  search_path = '';
```

### Request payload shape (`p_payload`)

The edge function's `transition.ts` maps `SimulationResult` → `ApplyTurnTransitionPayload`
before calling the RPC. Top-level keys and their semantics:

| Key                        | Contents                                                                                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stockpileDeltas`          | Array of `ResourceSnapshot`-shaped objects: `settlementId`, `resourceId`, `quantityBefore`, `quantityAfter`, `produced`, `consumed`, `tradeIn`, `tradeOut`. |
| `constructionUpdates`      | `projectId`, `status`, `progressWorkerTurns` (absolute), `activatedOnTurnNumber` (only when `queued → in_progress`).                                        |
| `buildingsCreated`         | `settlementId`, `buildingBlueprintId`, `currentTierId`. `activated_on_turn_number` is always derived server-side as `to_turn_number`.                       |
| `buildingStateChanges`     | `buildingId`, `state`, `missedUpkeepCount` (absolute).                                                                                                      |
| `depositUpdates`           | `depositInstanceId`, `resourceDeltas` `[{resourceId, delta}]`, `toStatus` (null unless changed).                                                            |
| `managedPopulationUpdates` | `managedPopulationInstanceId`, `countDelta`, `toStatus` (null unless changed).                                                                              |
| `tradeRouteOutcomes`       | `tradeRouteId`, `toStatus` (`active` \| `paused`), `pauseReason`.                                                                                           |
| `bornOnTurnBackfill`       | `citizenId`, `bornOnTurnNumber` — patches existing citizens missing the field (phase 9 backfill).                                                           |
| `citizenBirths`            | Full NPC birth record including flavor fields, parents, and `bornOnTurnNumber`.                                                                             |
| `citizenDeaths`            | `citizenId`, `deathCauseCategory`, `deathCause`.                                                                                                            |
| `partnershipChanges`       | `citizenAId`, `citizenBId`, `toStatus`, `formedOnTurnNumber` / `endedOnTurnNumber` as applicable.                                                           |
| `assignmentClears`         | `citizenId` — rows to delete from `citizen_assignments`.                                                                                                    |
| `logEntries`               | Array of `SimulationLogEntry` objects (see log categories below).                                                                                           |
| `notifications`            | Array of `SimulationNotification` objects (see notification taxonomy below).                                                                                |
| `settlementSnapshots`      | Array of `SettlementSnapshot` objects (see snapshot tables below).                                                                                          |
| `readinessSummary`         | `{ readySettlementCount, notReadySettlementCount, totalSettlementCount, readyPercentage }`.                                                                 |

### Auth

The RPC is `SECURITY DEFINER` and re-checks authorization internally:

```sql
if not (
  public.is_super_admin ()
  or public.is_world_admin (p_world_id)
) then raise exception 'insufficient privilege' using errcode = 'insufficient_privilege';

end if;
```

The edge function performs a pre-flight auth check (via `authorize.ts`) before calling the
RPC, so the RPC check is defense-in-depth rather than the primary gate.

### Idempotency and concurrency

Both RPCs acquire a `FOR UPDATE` row lock on `worlds` at the start of the transaction,
serializing concurrent end-turn calls for the same world.

`start_turn_transition` catches a `unique_violation` on the `turn_transitions` insert and
reuses the existing running row, returning the same UUID. This lets the edge function retry
the full two-step call after an interruption between `start_turn_transition` and
`apply_turn_transition`.

`apply_turn_transition` verifies the supplied `p_transition_id` is in `status = 'running'`
before proceeding. A stale second call (same `p_expected_turn_number` after the world turn
already advanced) raises `P0001`.

Snapshot inserts (`settlement_turn_resource_snapshots`, `settlement_turn_snapshots`)
use `ON CONFLICT … DO NOTHING` with partial unique indexes, making those phases
idempotent on retry.

### Error contract

All application-level errors are raised as PostgreSQL exceptions and mapped to
`EndTurnSimulationErrorCode` values in `persist.ts`:

| PG error code                      | Condition                                              | HTTP status | `EndTurnSimulationErrorCode`   |
| ---------------------------------- | ------------------------------------------------------ | ----------- | ------------------------------ |
| `42501` / `insufficient_privilege` | Caller not world admin or super admin                  | 403         | `unauthorized`                 |
| `P0001` containing `"archived"`    | World is archived                                      | 409         | `end_turn_world_archived`      |
| `P0001` containing `"stale"`       | `expectedTurnNumber` does not match current world turn | 409         | `end_turn_stale_expected_turn` |
| `P0001` (other)                    | Patch validation failure                               | 500         | `end_turn_transition_failed`   |

Any exception inside the outer failure-capture block sets the `turn_transitions` row to
`status = 'failed'` before re-raising, so partial runs are distinguishable from successes.

### Return value

```json
{
  "transitionId": "<uuid>",
  "fromTurnNumber": 42,
  "toTurnNumber": 43,
  "currentTurnNumber": 43,
  "patchCounts": {
    "stockpileDeltas": 3,
    "constructionUpdates": 1,
    "buildingsCreated": 0,
    "buildingStateChanges": 0,
    "depositUpdates": 2,
    "managedPopulationUpdates": 1,
    "tradeRouteOutcomes": 1,
    "bornOnTurnBackfill": 0,
    "citizenBirths": 2,
    "citizenDeaths": 1,
    "partnershipChanges": 1,
    "assignmentClears": 1,
    "overshootStamped": 0,
    "logEntries": 18,
    "notifications": 3,
    "settlementSnapshots": 1,
    "readinessReset": 1
  }
}
```

---

## RLS expectations on snapshot tables

Snapshot tables are **INSERT-only through the RPC**; the RPC runs as `SECURITY DEFINER` so
it bypasses RLS for its writes.

**SELECT** policies follow the standard world-access pattern — any user with a role in the
world (owner, world admin, nation manager, settlement manager, or player character) can
read snapshots for that world.

Direct `INSERT`, `UPDATE`, and `DELETE` through the table API are blocked for all roles
including World Admin; mutations route exclusively through `apply_turn_transition`.
Super Admin retains a **DELETE escape hatch** (RLS policy `*_delete_super_admin`) for
incident recovery — e.g., purging a corrupted snapshot row without a full DB migration.
Direct `INSERT` is blocked even for Super Admin (the INSERT grant is revoked); re-seed via
the RPC or a direct Postgres/service-role connection if needed.

Key snapshot tables:

| Table                                | One row per                                                                   |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| `turn_transitions`                   | Per-transition record; tracks `status` (`running` → `completed` \| `failed`). |
| `settlement_turn_snapshots`          | Settlement × transition.                                                      |
| `settlement_turn_resource_snapshots` | Settlement × resource × transition.                                           |
| `turn_log_entries`                   | Structured engine log entries (one row per `SimulationLogEntry`).             |

---

## Notification taxonomy and fan-out matrix

Notifications are produced by the engine and fanned out to per-user `notifications` rows
by the RPC at §C33b. The `scope` field controls recipient resolution.

### Notification types

| Constant                           | `notificationType` value           | Emitted by phase        |
| ---------------------------------- | ---------------------------------- | ----------------------- |
| `BUILDING_AUTO_DECONSTRUCTED`      | `building.auto_deconstructed`      | 4 — Building Upkeep     |
| `BUILDING_SUSPENDED`               | `building.suspended`               | 4 — Building Upkeep     |
| `CONSTRUCTION_COMPLETED`           | `construction.completed`           | 3 — Construction        |
| `CONSTRUCTION_PAUSED`              | `construction.paused`              | 3 — Construction        |
| `DEPOSIT_DEPLETED`                 | `deposit.depleted`                 | 2 — Deposit Extraction  |
| `MANAGED_POPULATION_DECLINING`     | `managed_population.declining`     | 7 — Managed Populations |
| `MANAGED_POPULATION_EXTINCT`       | `managed_population.extinct`       | 7 — Managed Populations |
| `PARTNERSHIP_FORMED`               | `partnership.formed`               | 9 — Partnerships        |
| `PARTNERSHIP_WIDOWED`              | `partnership.widowed`              | 9 — Partnerships        |
| `SETTLEMENT_HOMELESSNESS_OCCURRED` | `settlement.homelessness_occurred` | 10 — Homelessness       |
| `SETTLEMENT_STARVATION_OCCURRED`   | `settlement.starvation_occurred`   | 8 — Citizen Consumption |
| `TRADE_ROUTE_PAUSED`               | `trade_route.paused`               | 6 — Trade Routes        |
| `TRADE_ROUTE_RESUMED`              | `trade_route.resumed`              | 6 — Trade Routes        |

### Scope fan-out matrix

| `scope`      | Recipients                                                                                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `settlement` | Settlement Manager of the named settlement + Nation Manager of that settlement's nation + World Admins (owner, explicit `world_admins` rows, super admins) |
| `nation`     | Nation Manager of the named nation + World Admins                                                                                                          |
| `world`      | World Admins only                                                                                                                                          |

Nation ID is derived from the settlement when `scope = 'settlement'` and `nationId` is not
explicitly supplied in the payload.

The partial unique index `notifications_transition_dedup_idx` prevents duplicate rows on
retry: `ON CONFLICT (generated_in_transition_id, recipient_user_id, notification_type,
coalesce(settlement_id, …)) DO NOTHING`.

---

## PC-immunity invariants

Player characters (citizens with `citizen_type = 'player_character'`) must never die as a
result of the simulation engine. This is enforced at two layers:

**Engine layer** (`src/shared/simulation/phases/phaseCitizenConsumption.ts` and
`phaseHomelessness.ts`): phases that produce `CitizenDeath` entries filter out citizens
whose `citizenType === 'player_character'` before emitting deaths.

**RPC layer** (§C32b in `apply_turn_transition`): before applying each death entry the RPC
reads `citizens.citizen_type` from the database and raises a `P0001` exception if it finds
`'player_character'`:

```sql
if v_citizen_type = 'player_character' then raise exception 'simulation engine may not kill a player character (citizen %)',
v_citizen_id using errcode = 'P0001';

end if;
```

This defense-in-depth means a bug in the engine cannot silently kill a PC; the RPC will
abort and mark the transition `failed` before any writes are committed.

---

## Cross-references

- Schema: `gubernator_schema_simplified_v3.md` §9 (turn_transitions, turn_log_entries),
  §10 (settlement_turn_snapshots, settlement_turn_resource_snapshots),
  §11 (notifications).
- Feature guide: §13 (Epic 6 simulation engine end-to-end).
- Epic 6 issue group: GitHub issues tagged `epic-6`.
- Engine entry point: `src/shared/simulation/runSimulation.ts`.
- Phase implementations: `src/shared/simulation/phases/phase*.ts`.
- Edge function: `supabase/functions/end-turn-simulation/`.
- RPC migrations: `supabase/migrations/20260603000001` through `20260603000009`.
