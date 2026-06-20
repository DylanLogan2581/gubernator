# Architecture Overview

High-level map of the turn engine, simulation phases, determinism contract, and
forecast path.

---

## System layers

```
Browser (React SPA)
  │
  ├─► Supabase REST API (PostgREST)   — queries, RPC calls
  └─► Supabase Edge Functions         — privileged operations
         ├─ end-turn-simulation
         ├─ export-world-template
         └─ admin-create-user
               │
               └─► Supabase Postgres
                     ├─ RPC functions (PL/pgSQL)
                     ├─ Row Level Security policies
                     └─ Tables, views, triggers
```

The frontend never holds service-role credentials. Edge functions that need
admin-level DB access (`end-turn-simulation`, `admin-create-user`) receive
`SUPABASE_SERVICE_ROLE_KEY` from the Supabase runtime and use it only for
specific privileged RPC calls.

---

## Turn engine flow

End-turn is triggered by a world admin or superadmin from the UI. The full path:

```
Client
  │  POST /functions/v1/end-turn-simulation
  │  { worldId, expectedTurnNumber }
  ▼
end-turn-simulation (Edge Function)
  │
  ├─ 1. Validate request body
  ├─ 2. Resolve auth context (JWT → userId)
  ├─ 3. Check CORS allowlist
  ├─ 4. Rate-limit check (10 req/min per user)
  ├─ 5. Authorize (world admin or superadmin)
  ├─ 6. start_turn_transition RPC (service-role)
  │       └─ locks world, returns transitionId
  ├─ 7. resolveSupabaseEndTurnSimulationInput
  │       └─ load full world state (user JWT)
  ├─ 8. planSimulationTransition
  │       ├─ runSimulation(input, transitionId)  ← pure, deterministic
  │       └─ mapSimulationResultToPayload
  ├─ 9. computeForecastSnapshot
  └─ 10. persistSimulationTransition
          └─ apply_turn_transition RPC (service-role)
                ├─ writes stockpile deltas, snapshots, log entries
                ├─ creates citizens/deaths/partnerships
                ├─ writes notifications
                └─ advances world.current_turn_number
```

The `start_turn_transition` RPC locks the world against concurrent end-turns.
If the Edge Function crashes after step 6 but before step 10, the world is left
in `running` status — see [Admin Operations: stuck-transition
recovery](admin-operations.md#stuck-transition-recovery).

### Forecast preview path

When `preview: true` is sent in the request body, the function runs steps 1–5
and 7–9, then returns `{ forecastSnapshot }` without calling
`start_turn_transition` or `apply_turn_transition`. No state is modified.
Non-admin users who have the `view_forecast` permission may call this path.

---

## Simulation phases

`runSimulation` in
`supabase/functions/_shared/simulation/runSimulation.ts` runs the following
phases in order. Each phase reads from shared mutable state (stockpile map,
pending deaths, etc.) initialized before phase 1 and updated after each phase.

| #    | Phase               | Key outputs                                                           |
| ---- | ------------------- | --------------------------------------------------------------------- |
| 1    | Standard Jobs       | stockpile deltas (job production/consumption)                         |
| 2    | Deposit Extraction  | stockpile deltas (deposit yield)                                      |
| 3    | Construction        | construction progress updates, new buildings                          |
| 4    | Building Upkeep     | building state changes (active/suspended/deconstructed), upkeep costs |
| 5    | Passive Effects     | passive resource production from active buildings                     |
| 6    | Trade Routes        | stockpile transfers between settlements, route status                 |
| 7    | Managed Populations | population growth/culling, population deltas                          |
| 8    | Citizen Consumption | food/water deductions, starvation deaths                              |
| 9    | Partnerships        | new partnerships, dissolutions, widowing (receives phase-8 deaths)    |
| 10   | Homelessness        | homelessness decline, housing checks                                  |
| 11   | Events              | event effects applied, managed-population deltas from events          |
| 11.5 | _(merge)_           | event-driven managed-population deltas merged into phase-7 results    |
| 12   | Stockpile Clamp     | stockpiles clamped to effective storage caps                          |
| 13   | Resource Decay      | decay applied to decaying resources                                   |
| 14   | Logs and Snapshots  | turn log entries, settlement and resource snapshots assembled         |

Phases 1–14 are always run in this order. There are no conditional branches
between phases — every phase executes every turn.

---

## Determinism and seeding contract

`runSimulation` is a pure function: same input → same output, no side effects,
no network calls.

Any stochastic behaviour (citizen births, partnership formation, name generation)
uses a seeded PRNG seeded from the `transitionId` UUID:

1. `hashStringToSeed(transitionId)` — FNV-1a hash of the UUID string → uint32
2. `mulberry32(seed)` — fast 32-bit PRNG, well-distributed

Implementation: `supabase/functions/_shared/simulation/seededRng.ts`

**Invariants that must be preserved to keep simulations reproducible:**

- `runSimulation` must never call `Date.now()`, `Math.random()`, or any
  non-deterministic API.
- The `transitionId` passed to `runSimulation` must be the one returned by
  `start_turn_transition` (not a locally generated UUID).
- Phase order must not change without a corresponding schema migration that
  resets affected worlds.
- All input state must be loaded before the simulation begins. Phases must not
  query the database.

---

## apply_turn_transition RPC contract

`apply_turn_transition` is a PL/pgSQL function that receives the fully-computed
`ApplyTurnTransitionPayload` JSONB and atomically writes all results. The
payload sections correspond to migration comments labelled `§C28`–`§C35`.

Key sections of the payload:

| Payload key                               | DB write                                            |
| ----------------------------------------- | --------------------------------------------------- |
| `stockpileDeltas`                         | `settlement_stockpiles` + `resource_snapshots`      |
| `constructionUpdates`, `buildingsCreated` | `construction_projects`, `settlement_buildings`     |
| `buildingStateChanges`                    | `settlement_buildings.state`, `missed_upkeep_count` |
| `tradeRouteOutcomes`                      | `trade_routes.status`, `pause_reason`               |
| `citizenBirths`, `citizenDeaths`          | `citizens` (insert/soft-delete)                     |
| `partnershipChanges`                      | `partnerships`                                      |
| `managedPopulationUpdates`                | `managed_populations`                               |
| `depositUpdates`                          | `deposits`                                          |
| `eventStatusPatches`                      | `events`                                            |
| `settlementSnapshots`                     | `settlement_turn_snapshots`                         |
| `logEntries`                              | `turn_log_entries`                                  |
| `notifications`                           | `notifications`                                     |
| `readinessSummary`                        | `turn_transitions` (summary column)                 |
| `forecastSnapshot`                        | `turn_transitions.forecast_snapshot_jsonb`          |

The RPC raises `P0001` with a typed hint on business-logic errors:

| Hint                  | Meaning                                    |
| --------------------- | ------------------------------------------ |
| `world_archived`      | World was archived between start and apply |
| `stale_expected_turn` | Another transition completed concurrently  |
| `state_drifted`       | World state changed during processing      |

---

## State loading

World state is loaded in `resolveSupabaseEndTurnSimulationInput`
(`supabase/functions/end-turn-simulation/state.ts`) using the caller's JWT, not
the service-role key. This means RLS policies apply. The loaded
`SimulationInputState` type
(`supabase/functions/_shared/simulation/simulationTypes.ts`) includes every
table the simulation reads.

---

## Edge function caching

Supabase Edge Functions run in Deno. Module-level code (including
`assertEdgeEnvVars`) runs once per cold start and is not re-executed per
request. If you change `supabase/config.toml` secrets locally, restart the edge
runtime:

```bash
npx supabase stop && npx supabase start
```

Or clear the module cache without a full restart:

```bash
npm run functions:cache-clear
```
