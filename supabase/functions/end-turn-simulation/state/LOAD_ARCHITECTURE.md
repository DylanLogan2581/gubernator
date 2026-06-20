# Simulation State Loading Architecture

## Decision: Multi-Fetch over Monolithic RPC

**Status:** Decided (Issue #660)\
**Date:** 2026-06\
**Reviewer:** EF-L8

### Context

`resolveSupabaseEndTurnSimulationInput()` loads a complete simulation snapshot from Supabase. The
challenge: assembling ~16 different entity types from as many PostgREST tables.

### Options Considered

#### Option A: Single SECURITY DEFINER RPC

- **Pros:** One round-trip, one transaction, one RLS evaluation, sidestep `api.max_rows`
- **Cons:**
  - High SQL complexity: nested joins across 16 tables in PL/pgSQL
  - Brittle: schema changes require sync in SQL + TypeScript
  - All-or-nothing failure: one entity failure cascades
  - Type safety loss: RPC `RETURNS record[]` or `JSONB` harder to validate
  - Uncertainty: 18 parallel HTTP might be faster than 1 RPC with complex query plan if
    network-bound

#### Option B: Multi-Fetch in Parallel (Chosen)

- **Pros:**
  - Simplicity: 16 independent fetch functions, one per entity type
  - Maintainability: schema change only touches relevant fetch + mapper
  - Isolation: failed fetch doesn't block other entities (selective retry possible)
  - Flexibility: each fetch independently configurable (select fields, filters, pagination)
  - Already parallelized: `Promise.all()` → all Round 2 fetches in ~one network round
  - Type-safe: each fetch function signature is TypeScript-validated

### Why Multi-Fetch is Sufficient

1. **Not N+1 in practice:** All Round 2 fetches are parallel via `Promise.all()`. The two rounds
   (world→settlements→entities) are sequential, but necessary: settlements determine the scope for
   entity queries.

2. **Point-in-time consistency:** While individual reads aren't in a DB transaction, the drift guard
   in the apply phase compensates. Snapshot consistency is achieved by:
   - All Round 2 queries executing simultaneously (within network RTT)
   - Drift guard detecting and resolving mutation-caused inconsistencies
   - Simulation engine handling minor temporal slew without issues

3. **No api.max_rows truncation:** World-scoped high-cardinality fetches (citizens, events,
   event_effects, assignments, partnerships, stockpiles) use `fetchRowsPaginated`, which detects
   truncation via `Content-Range` and pages through all results.  Settlement-scoped fetches
   (buildings, construction projects, deposits, managed populations, trade routes) also use
   `fetchRowsPaginated` as of #797 — at 50+ settlements these can exceed 1 000 rows.
   `event_effects` is scoped to the current world via an `events!inner(world_id)` join so
   effects from other worlds are never fetched.

4. **HTTP pipelining:** Modern TCP and HTTP/2 implementations pipeline multiple requests over one
   connection, achieving near-RPC latency with RPC simplicity trade-offs.

### Acceptance Criteria (All Met)

✅ **Single transactional round-trip OR documented decision**\
→ Decision documented here.

✅ **Snapshot consistency without `api.max_rows` truncation**\
→ Drift guard handles consistency. No entity count near `api.max_rows` (1000).

✅ **Per-turn DB round-trip count not scaling with entity table count**\
→ Two sequential rounds (world, then parallel entities). Additions to entity types only increase
parallel batch size, not round count.

### Trade-offs

- **Complexity:** Multi-fetch is simpler operationally; RPC would require SQL expertise unavailable
  in browser simulation code.
- **Latency:** Likely negligible (modern HTTP/2 pipelining), not measured.
- **Consistency:** Drift guard already present; no regression.

### Future Reconsideration

Reconsider RPC consolidation if:

- Profiling shows network setup is the bottleneck (not data payload)
- Entity count approaches `api.max_rows` (currently nowhere near)
- Simpler test-harness consistency guarantees needed (cross-browser simulation)

### References

- Related: DB-H2, DB-H3, DB-L9 (other data-loading patterns)
- Implements: Issue #660
- Drift guard: `supabase/functions/end-turn-simulation/apply.ts` (post-apply validation)
