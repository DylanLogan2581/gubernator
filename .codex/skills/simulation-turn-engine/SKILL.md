---
name: simulation-turn-engine
description: Use for Gubernator turn advancement, end-turn simulation, deterministic RNG, simulation phases, shared browser/Edge simulation modules, apply_turn_transition payloads, settlement snapshots, stockpile deltas, logs, notifications, and transition persistence.
---

# Simulation Turn Engine

## Map

- Browser trigger: `src/features/turns/mutations/endTurnTransitionMutations.ts`.
- Edge handler: `supabase/functions/end-turn-simulation/index.ts`.
- Edge state fetch/map: `supabase/functions/end-turn-simulation/state`.
- Edge transition payload map: `supabase/functions/end-turn-simulation/transition.ts`.
- DB persistence RPC: `public.start_turn_transition`, `public.apply_turn_transition`.
- Shared engine source: `src/shared/simulation`.
- Edge mirror: `supabase/functions/_shared/simulation`.

## Flow

1. Browser calls `client.functions.invoke("end-turn-simulation")`.
2. Edge validates method/body/CORS/auth.
3. Edge authorizes super admin/world admin with caller JWT + anon key.
4. Edge fetches world state through RLS-visible REST queries.
5. Edge starts transition via service-role RPC.
6. `runSimulation(input, transitionId)` plans deterministic result.
7. Edge maps result to `apply_turn_transition` JSON payload.
8. Edge persists via service-role RPC.
9. Browser invalidates world, turn, calendar, readiness, notifications, resources,
   buildings, deposits, managed populations, trade, citizens.

## Phase Order

1. Standard jobs.
2. Deposit extraction.
3. Construction.
4. Building upkeep.
5. Passive effects.
6. Trade routes.
7. Managed populations.
8. Citizen consumption.
9. Partnerships.
10. Homelessness.
11. Events.
12. Stockpile clamp.
13. Logs and snapshots.

Order is contract. Changing order needs tests + DB payload review.

## Determinism

- Seed comes from transition UUID.
- No `Math.random`, `Date.now`, `new Date` inside engine.
- Stable sort before RNG-dependent selection.
- Same input + transition ID must produce same result.
- Add/keep determinism tests when random, ordering, or phase data flow changes.

## Shared/Edge

- `src/shared/simulation` imports must use explicit `.ts`.
- No `@/`, browser APIs, Supabase client, Vite env in shared engine.
- Mirror engine changes into `supabase/functions/_shared/simulation`.
- After mirror change during local Edge testing: `npm run functions:cache-clear`.

## Payload Contract

- `transition.ts` maps engine result to `apply_turn_transition` payload.
- Keep payload keys in sync with RPC JSONB contract.
- Absolute DB values matter: convert deltas when RPC expects final values.
- New outcome type needs:
  - engine result type
  - mapper payload entry
  - RPC application logic
  - outcome query/UI type if user-visible
  - tests at phase, mapper, DB, UI boundary as needed

## DB Guards

- Start/apply transition must guard:
  - active world
  - expected turn
  - auth: super admin/world admin
  - single running transition
  - cross-world payload drift
  - failed transition marking on exception
- Service-role call bypasses RLS, so RPC must do authorization/invariant checks.
- Use row locks/unique running constraints for concurrency.

## Tests

- Phase change: focused `phase*.test.ts`.
- Cross-phase state flow: `runSimulation.*.test.ts`.
- Payload map: Edge `transition.test.ts`.
- Fetch/mapper contract: Edge state tests.
- Persistence/RPC: `supabase/tests/apply_turn_transition_*_test.sql`.
- End-to-end local Edge contract: `npm run test:integration`.
- Coverage threshold applies to `src/shared/simulation/**`.
