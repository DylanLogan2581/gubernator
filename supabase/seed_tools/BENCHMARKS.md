# Large-World Performance Benchmarks

**Relates to:** Issue #797 — Large-world performance validation and fetch-truncation audit\
**Target fixture:** `supabase/seed_tools/large_world.sql` (50 settlements · 10 000 citizens)\
**Status:** Tooling added; run the seed + edge function locally to record actuals.

---

## Performance Budgets

| Hot path | Budget | Notes |
|---|---|---|
| End-turn transition (full turn advance) | < 30 s | At 50 settlements / 10 000 citizens |
| Settlement report page load | < 2 s | Supabase JS client, cold cache |
| Turn log browser (first page, no filter) | < 2 s | 50-page limit, world-scoped |
| Turn log browser (filtered by category) | < 2 s | Uses `(world_id, log_category)` index |
| Event auto-memory insert (end-turn) | < 5 s | Bulk insert of citizen_memories |
| Forecast run | < 10 s | Via `/functions/v1/end-turn-simulation` forecast mode |

---

## How to Measure

### 1. Load the large-world fixture

```bash
# Requires a running local stack (npx supabase start).
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  --single-transaction -v ON_ERROR_STOP=1 \
  -f supabase/seed_tools/large_world.sql
```

Expected output (summary row):

```
settlements | citizens | assignments | trade_routes | events | event_effects
------------+----------+-------------+--------------+--------+---------------
         50 |    10000 |       10000 |           20 |     20 |            20
```

### 2. End-turn transition

```bash
# Obtain a session token for superadmin@gubernator.local
ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'  # local anon key
TOKEN=$(curl -s "http://127.0.0.1:54321/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON" -H 'content-type: application/json' \
  -d '{"email":"superadmin@gubernator.local","password":"password123"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

# Trigger end-turn for world 00000000-0000-0000-0002-000000000001.
# Set all settlements ready first:
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
  UPDATE public.settlements s
  SET is_ready_current_turn = true
  FROM public.nations n
  WHERE n.id = s.nation_id AND n.world_id = '00000000-0000-0000-0002-000000000001';
"

time curl -s -X POST "http://127.0.0.1:54321/functions/v1/end-turn-simulation" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"worldId":"00000000-0000-0000-0002-000000000001","expectedTurnNumber":0}' \
  | python3 -m json.tool
```

**Record wall-clock time from `time` output. Budget: < 30 s.**

### 3. Settlement report queries

Open the app at `http://localhost:5173`, log in as `superadmin@gubernator.local`,
navigate to any settlement in the large world, and open the report tab.

Alternatively, measure via Supabase Studio query timing at `http://127.0.0.1:54323`.

**Budget: < 2 s page load.**

### 4. Turn log browser

After at least one turn has advanced, open the turn log browser for the large world
and observe the initial page load time. Apply a `log_category` filter and measure.

**Budget: < 2 s per page.**

### 5. Event auto-memory insert

After end-turn advances, check the `citizen_memories` row count and the edge
function logs for the bulk insert timing.

```sql
SELECT count(*) FROM public.citizen_memories WHERE world_id = '00000000-0000-0000-0002-000000000001';
```

**Budget: < 5 s for the full insert batch.**

---

## Fetch-Truncation Audit (Issue #797)

All whole-world PostgREST reads in `end-turn-simulation/state/queries.ts` have
been audited and either paginate or are proven to be below the 1 000-row cap:

| Table | Fetch function | Paginated? | Notes |
|---|---|---|---|
| `citizens` | `fetchCitizens` | ✅ `fetchRowsPaginated` | World-scoped; 10k rows in large world |
| `events` | `fetchEvents` | ✅ `fetchRowsPaginated` | World-scoped |
| `event_effects` | `fetchEventEffects` | ✅ `fetchRowsPaginated` + world join | Fixed in #797: scoped via `events!inner(world_id)` |
| `citizen_assignments` | `fetchAssignments` | ✅ `fetchRowsPaginated` | World-scoped via citizens join |
| `partnerships` | `fetchPartnerships` | ✅ `fetchRowsPaginated` | World-scoped via citizens join |
| `settlement_stockpiles_view` | `fetchStockpiles` | ✅ `fetchRowsPaginated` | Settlement-scoped |
| `settlement_buildings` | `fetchBuildings` | ✅ `fetchRowsPaginated` | Fixed in #797: was unbounded at 50+ settlements |
| `construction_projects` | `fetchProjects` | ✅ `fetchRowsPaginated` | Fixed in #797 |
| `deposit_instances` | `fetchDeposits` | ✅ `fetchRowsPaginated` | Fixed in #797 |
| `managed_population_instances` | `fetchManagedPops` | ✅ `fetchRowsPaginated` | Fixed in #797 |
| `trade_routes` | `fetchTradeRoutes` | ✅ `fetchRowsPaginated` | Fixed in #797 |
| `resources` | `fetchResources` | `fetchRows` | World-scoped; bounded by resource count |
| `job_definitions` | `fetchJobs` | `fetchRows` | World-scoped; bounded by job count |
| `building_blueprints` | `fetchBlueprints` | `fetchRows` | World-scoped; small count |
| `deposit_types` | `fetchDepositTypes` | `fetchRows` | World-scoped; small count |
| `managed_population_types` | `fetchManagedPopTypes` | `fetchRows` | World-scoped; small count |
| `namesets` | `fetchNamesets` | `fetchRows` | World-scoped; small count |
| `worlds` | `fetchWorldRow` | n/a | Single-row lookup |
| `settlements` | `fetchSettlements` | `fetchRows` | World-scoped; bounded (practical max ~500) |

---

## Index Coverage (Issue #797)

| Query | Index | Status |
|---|---|---|
| Turn log browser — `(world_id, log_category)` | `turn_log_entries_world_category_idx` | ✅ Added in #728 migration |
| Turn log browser — `(world_id, settlement_id)` | `turn_log_entries_world_settlement_idx` | ✅ Added in #728 migration |
| Turn log browser — `(world_id, nation_id)` | `turn_log_entries_world_nation_idx` | ✅ Added in #728 migration |
| Turn log browser — `(world_id, citizen_id)` | `turn_log_entries_world_citizen_idx` | ✅ Added in #728 migration |
| Turn log browser — `(world_id, resource_id)` | `turn_log_entries_world_resource_idx` | ✅ Added in #728 migration |
| Notifications unread count — `recipient_user_id WHERE is_read=false` | `notifications_recipient_user_id_unread_idx` | ✅ Added in #797 migration |
| citizen_memories — `(citizen_id, occurred_on_turn_number)` | `citizen_memories_citizen_turn_idx` | ✅ Pre-existing |
| Events — scope columns (`scope_nation_id`, `scope_settlement_id`) | `events_scope_nation_idx`, `events_scope_settlement_idx` | ✅ Pre-existing |
