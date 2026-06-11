// Integration test: runs end-turn-simulation against the local seeded Verdant Reach world.
//
// Requires a running local Supabase instance (`npx supabase start`) with `seed.sql` loaded.
// Fails if the local API is unreachable.
//
// Run with: npm run test:integration

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Well-known local development constants (from `npx supabase status --output json`).
// These derive from the shared JWT secret and never change across dev machines.
// ---------------------------------------------------------------------------
const LOCAL_URL = "http://127.0.0.1:54321";
const LOCAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
// `process` comes from the Node/vitest runtime that executes this integration
// test; declare it for the Deno-targeted edge tsconfig, which ships no node types.
declare const process: { env: Record<string, string | undefined> };
const LOCAL_SERVICE_KEY: string =
  process.env.SUPABASE_SERVICE_ROLE_JWT ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

// ---------------------------------------------------------------------------
// Seed world 101 identifiers (see supabase/seed.sql).
// ---------------------------------------------------------------------------
const WORLD_ID = "00000000-0000-0000-0000-000000000101";
const SEED_TURN = 0;
const SUPER_ADMIN_EMAIL = "superadmin@gubernator.local";
const SUPER_ADMIN_PASSWORD = "password123";
const svc = createClient(LOCAL_URL, LOCAL_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
    storageKey: "end-turn-integration-service",
  },
});
const anon = createClient(LOCAL_URL, LOCAL_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
    storageKey: "end-turn-integration-anon",
  },
});

// All five canonical settlements in Verdant Reach (world 101).
const SETTLEMENT_IDS = [
  "00000000-0000-0000-0000-000000000301", // Hearthwatch
  "00000000-0000-0000-0000-000000000302", // Mistfall Crossing
  "00000000-0000-0000-0000-000000000303", // Sunmere Hold
  "00000000-0000-0000-0000-000000000304", // Tidewatch
  "00000000-0000-0000-0000-000000000305", // Stonehold Keep
];

// Hearthwatch smithy project: in_progress, initial progress = 4 worker-turns.
// Lyss Thornwick (citizen 434) is the construction pool member for settlement 301.
const CONSTRUCTION_PROJECT_ID = "00000000-0000-0000-000b-000000000001";
const CONSTRUCTION_PROJECT_INITIAL_PROGRESS = 4;
const CONSTRUCTION_CITIZEN_ID = "00000000-0000-0000-0000-000000000434";

// Old Mara of the Crossing (citizen 431) is seeded as a deceased NPC with a
// populated death_cause. The seed-topology pgTAP test asserts she stays dead,
// so the revive step below must exclude her and her seed state restored exactly.
const SEED_DECEASED_NPC_ID = "00000000-0000-0000-0000-000000000431";
const SEED_DECEASED_NPC_DEATH_CAUSE =
  "Died peacefully during the first winter after the founding.";
const SEED_DECEASED_NPC_DEATH_CAUSE_CATEGORY = "unknown";

// Sunmere stone quarry: primary resource is stone block.
// Sable Wren (citizen 413) is the deposit worker for this quarry.
const DEPOSIT_INSTANCE_ID = "00000000-0000-0000-000c-000000000003";
const DEPOSIT_RESOURCE_ID = "00000000-0000-0000-0004-000000000109";
const DEPOSIT_INITIAL_REMAINING = 7600;

// Hearthwatch sheep flock: 80 animals, no husbandry workers assigned.
// Without husbandry coverage the population declines each turn, emitting a
// managed_population.declining notification to all world admins (including the super admin).
const MANAGED_POP_ID = "00000000-0000-0000-000d-000000000001";
const MANAGED_POP_INITIAL_COUNT = 80;

// Non-system resource seed stockpiles for all five settlements (grain, beer,
// hardwood_logs, stone_block, iron_ore).  Deterministic UUIDs from Epic 4 seed.
// Reset in beforeAll so simulated consumption/production doesn't corrupt re-runs.
const NON_SYSTEM_STOCKPILE_SEEDS = [
  // Hearthwatch (301)
  {
    settlementId: "00000000-0000-0000-0000-000000000301",
    resourceId: "00000000-0000-0000-0004-000000000101",
    quantity: 250,
  },
  {
    settlementId: "00000000-0000-0000-0000-000000000301",
    resourceId: "00000000-0000-0000-0004-000000000105",
    quantity: 60,
  },
  {
    settlementId: "00000000-0000-0000-0000-000000000301",
    resourceId: "00000000-0000-0000-0004-000000000108",
    quantity: 120,
  },
  {
    settlementId: "00000000-0000-0000-0000-000000000301",
    resourceId: "00000000-0000-0000-0004-000000000109",
    quantity: 200,
  },
  {
    settlementId: "00000000-0000-0000-0000-000000000301",
    resourceId: "00000000-0000-0000-0004-000000000110",
    quantity: 80,
  },
  // Mistfall Crossing (302)
  {
    settlementId: "00000000-0000-0000-0000-000000000302",
    resourceId: "00000000-0000-0000-0004-000000000101",
    quantity: 180,
  },
  {
    settlementId: "00000000-0000-0000-0000-000000000302",
    resourceId: "00000000-0000-0000-0004-000000000105",
    quantity: 40,
  },
  {
    settlementId: "00000000-0000-0000-0000-000000000302",
    resourceId: "00000000-0000-0000-0004-000000000108",
    quantity: 90,
  },
  {
    settlementId: "00000000-0000-0000-0000-000000000302",
    resourceId: "00000000-0000-0000-0004-000000000109",
    quantity: 150,
  },
  {
    settlementId: "00000000-0000-0000-0000-000000000302",
    resourceId: "00000000-0000-0000-0004-000000000110",
    quantity: 55,
  },
  // Sunmere Hold (303)
  {
    settlementId: "00000000-0000-0000-0000-000000000303",
    resourceId: "00000000-0000-0000-0004-000000000101",
    quantity: 300,
  },
  {
    settlementId: "00000000-0000-0000-0000-000000000303",
    resourceId: "00000000-0000-0000-0004-000000000105",
    quantity: 75,
  },
  {
    settlementId: "00000000-0000-0000-0000-000000000303",
    resourceId: "00000000-0000-0000-0004-000000000108",
    quantity: 160,
  },
  {
    settlementId: "00000000-0000-0000-0000-000000000303",
    resourceId: "00000000-0000-0000-0004-000000000109",
    quantity: 240,
  },
  {
    settlementId: "00000000-0000-0000-0000-000000000303",
    resourceId: "00000000-0000-0000-0004-000000000110",
    quantity: 100,
  },
  // Tidewatch (304)
  {
    settlementId: "00000000-0000-0000-0000-000000000304",
    resourceId: "00000000-0000-0000-0004-000000000101",
    quantity: 140,
  },
  {
    settlementId: "00000000-0000-0000-0000-000000000304",
    resourceId: "00000000-0000-0000-0004-000000000105",
    quantity: 35,
  },
  {
    settlementId: "00000000-0000-0000-0000-000000000304",
    resourceId: "00000000-0000-0000-0004-000000000108",
    quantity: 70,
  },
  {
    settlementId: "00000000-0000-0000-0000-000000000304",
    resourceId: "00000000-0000-0000-0004-000000000109",
    quantity: 110,
  },
  {
    settlementId: "00000000-0000-0000-0000-000000000304",
    resourceId: "00000000-0000-0000-0004-000000000110",
    quantity: 45,
  },
  // Stonehold Keep (305)
  {
    settlementId: "00000000-0000-0000-0000-000000000305",
    resourceId: "00000000-0000-0000-0004-000000000101",
    quantity: 200,
  },
  {
    settlementId: "00000000-0000-0000-0000-000000000305",
    resourceId: "00000000-0000-0000-0004-000000000105",
    quantity: 50,
  },
  {
    settlementId: "00000000-0000-0000-0000-000000000305",
    resourceId: "00000000-0000-0000-0004-000000000108",
    quantity: 100,
  },
  {
    settlementId: "00000000-0000-0000-0000-000000000305",
    resourceId: "00000000-0000-0000-0004-000000000109",
    quantity: 180,
  },
  {
    settlementId: "00000000-0000-0000-0000-000000000305",
    resourceId: "00000000-0000-0000-0004-000000000110",
    quantity: 65,
  },
] as const;

// Food/fresh-water seed quantities per settlement (system resources — IDs are
// dynamic so they are resolved by slug at reset time).
const SYSTEM_STOCKPILE_SEEDS = [
  {
    settlementId: "00000000-0000-0000-0000-000000000301",
    slug: "food",
    quantity: 120,
  },
  {
    settlementId: "00000000-0000-0000-0000-000000000301",
    slug: "fresh-water",
    quantity: 95,
  },
  {
    settlementId: "00000000-0000-0000-0000-000000000302",
    slug: "food",
    quantity: 90,
  },
  {
    settlementId: "00000000-0000-0000-0000-000000000302",
    slug: "fresh-water",
    quantity: 70,
  },
  {
    settlementId: "00000000-0000-0000-0000-000000000303",
    slug: "food",
    quantity: 150,
  },
  {
    settlementId: "00000000-0000-0000-0000-000000000303",
    slug: "fresh-water",
    quantity: 110,
  },
  {
    settlementId: "00000000-0000-0000-0000-000000000304",
    slug: "food",
    quantity: 80,
  },
  {
    settlementId: "00000000-0000-0000-0000-000000000304",
    slug: "fresh-water",
    quantity: 65,
  },
  {
    settlementId: "00000000-0000-0000-0000-000000000305",
    slug: "food",
    quantity: 100,
  },
  {
    settlementId: "00000000-0000-0000-0000-000000000305",
    slug: "fresh-water",
    quantity: 80,
  },
] as const;

// ---------------------------------------------------------------------------
// Test state set up by beforeAll
// ---------------------------------------------------------------------------
let accessToken = "";

// Reset world 101 to its canonical turn-0 seed state using the service-role
// client (bypasses RLS). Idempotent: safe to run before the test (for
// repeatability) and after it (to leave the shared local database clean for
// the pgTAP seed-topology tests). Returns a list of failures rather than
// throwing so callers can aggregate and report them together.
async function restoreWorldToSeed(): Promise<string[]> {
  const setupErrors: string[] = [];

  // Delete any prior turn-0 transition for this world.  The FK cascade
  // removes the associated settlement_turn_snapshots, turn_log_entries, and
  // notifications so the assertions below start from a clean slate.
  const { error: delErr } = await svc
    .from("turn_transitions")
    .delete()
    .eq("world_id", WORLD_ID)
    .eq("from_turn_number", SEED_TURN);
  if (delErr !== null)
    setupErrors.push(`delete turn_transitions: ${delErr.message}`);

  // Reset the world turn counter.
  const { error: wErr } = await svc
    .from("worlds")
    .update({ current_turn_number: SEED_TURN })
    .eq("id", WORLD_ID);
  if (wErr !== null) setupErrors.push(`update worlds: ${wErr.message}`);

  // Reset construction project progress so the "increased" assertion is reliable.
  const { error: cErr } = await svc
    .from("construction_projects")
    .update({
      progress_worker_turns: CONSTRUCTION_PROJECT_INITIAL_PROGRESS,
      status: "in_progress",
    })
    .eq("id", CONSTRUCTION_PROJECT_ID);
  if (cErr !== null)
    setupErrors.push(`update construction_projects: ${cErr.message}`);

  // Reset deposit remaining quantity.
  const { error: dErr } = await svc
    .from("deposit_instance_resources")
    .update({ remaining_quantity: DEPOSIT_INITIAL_REMAINING })
    .eq("deposit_instance_id", DEPOSIT_INSTANCE_ID)
    .eq("resource_id", DEPOSIT_RESOURCE_ID);
  if (dErr !== null)
    setupErrors.push(`update deposit_instance_resources: ${dErr.message}`);

  // Reset the Hearthwatch sheep flock count.
  const { error: mErr } = await svc
    .from("managed_population_instances")
    .update({ current_count: MANAGED_POP_INITIAL_COUNT })
    .eq("id", MANAGED_POP_ID);
  if (mErr !== null)
    setupErrors.push(`update managed_population_instances: ${mErr.message}`);

  // Reset non-system resource stockpiles to seed values so repeated runs
  // don't start with depleted resources.
  for (const s of NON_SYSTEM_STOCKPILE_SEEDS) {
    const { error } = await svc
      .from("settlement_resource_stockpiles")
      .update({ quantity: s.quantity })
      .eq("settlement_id", s.settlementId)
      .eq("resource_id", s.resourceId);
    if (error !== null) {
      setupErrors.push(
        `update settlement_resource_stockpiles: ${error.message}`,
      );
      break;
    }
  }

  // Resolve food/fresh-water resource IDs by slug (they are generated
  // dynamically per-world) and reset those stockpiles too.
  const { data: sysResources, error: srErr } = await svc
    .from("resources")
    .select("id,slug")
    .eq("world_id", WORLD_ID)
    .eq("is_system_resource", true)
    .in("slug", ["food", "fresh-water"]);
  if (srErr !== null) {
    setupErrors.push(`select resources: ${srErr.message}`);
  } else if (sysResources === null) {
    setupErrors.push("select resources: returned null");
  } else {
    for (const seed of SYSTEM_STOCKPILE_SEEDS) {
      const resource = sysResources.find((r) => r.slug === seed.slug);
      if (resource === undefined) {
        setupErrors.push(`resource not found: slug=${seed.slug}`);
        break;
      }
      const { error } = await svc
        .from("settlement_resource_stockpiles")
        .update({ quantity: seed.quantity })
        .eq("settlement_id", seed.settlementId)
        .eq("resource_id", resource.id);
      if (error !== null) {
        setupErrors.push(
          `update settlement_resource_stockpiles (system): ${error.message}`,
        );
        break;
      }
    }
  }

  // Revive citizens who died during a run, but leave the seed's intentionally
  // deceased NPC (Old Mara, 431) dead so the seed-topology invariant holds.
  const { error: citizenErr } = await svc
    .from("citizens")
    .update({
      status: "alive",
      death_cause: null,
      death_cause_category: null,
    })
    .eq("world_id", WORLD_ID)
    .eq("status", "dead")
    .neq("id", SEED_DECEASED_NPC_ID);
  if (citizenErr !== null)
    setupErrors.push(`update citizens: ${citizenErr.message}`);

  // Restore Old Mara's exact seed death state in case a prior run mutated it.
  const { error: deceasedErr } = await svc
    .from("citizens")
    .update({
      status: "dead",
      death_cause: SEED_DECEASED_NPC_DEATH_CAUSE,
      death_cause_category: SEED_DECEASED_NPC_DEATH_CAUSE_CATEGORY,
    })
    .eq("id", SEED_DECEASED_NPC_ID);
  if (deceasedErr !== null)
    setupErrors.push(`restore deceased seed NPC: ${deceasedErr.message}`);

  // Restore the construction pool assignment for Lyss Thornwick (434) in
  // case it was cleared when the worker died in a prior run.
  const { error: assignErr } = await svc.from("citizen_assignments").upsert(
    {
      citizen_id: CONSTRUCTION_CITIZEN_ID,
      assignment_type: "construction_project",
      job_id: null,
      construction_project_id: null,
      deposit_instance_id: null,
      managed_population_instance_id: null,
      trade_route_id: null,
      trade_route_end: null,
      assigned_on_turn_number: SEED_TURN,
    },
    { onConflict: "citizen_id" },
  );
  if (assignErr !== null)
    setupErrors.push(`upsert citizen_assignments: ${assignErr.message}`);

  return setupErrors;
}

// Settlement-scoped tables the end-turn mutates across ALL five settlements
// (status/progress/count/remaining fields) but does not create or delete rows
// in. The value-based reset above only restores settlement 301's specifics, so
// these are snapshotted at the seed baseline in beforeAll and upserted back
// verbatim in afterAll. That keeps world 101 byte-identical for the pgTAP
// seed-topology suite (e.g. "every settlement has an in_progress project").
const SETTLEMENT_SCOPED_TABLES = [
  "construction_projects",
  "managed_population_instances",
  "deposit_instances",
  "settlement_resource_stockpiles",
  "settlement_buildings",
] as const;

const seedSnapshots: Record<string, unknown[]> = {};
let depositResourceSnapshot: unknown[] = [];

async function captureSeedSnapshot(): Promise<string[]> {
  const errors: string[] = [];
  for (const table of SETTLEMENT_SCOPED_TABLES) {
    const { data, error } = await svc
      .from(table)
      .select("*")
      .in("settlement_id", SETTLEMENT_IDS);
    if (error !== null) {
      errors.push(`snapshot ${table}: ${error.message}`);
      continue;
    }
    seedSnapshots[table] = data ?? [];
  }
  // deposit_instance_resources has no settlement_id; scope it via the snapshot
  // deposit instances for the five settlements.
  const depositIds = (seedSnapshots["deposit_instances"] ?? []).map(
    (d) => (d as { id: string }).id,
  );
  if (depositIds.length > 0) {
    const { data, error } = await svc
      .from("deposit_instance_resources")
      .select("*")
      .in("deposit_instance_id", depositIds);
    if (error !== null) {
      errors.push(`snapshot deposit_instance_resources: ${error.message}`);
    } else {
      depositResourceSnapshot = data ?? [];
    }
  }
  return errors;
}

async function restoreSeedSnapshot(): Promise<string[]> {
  const errors: string[] = [];
  for (const table of SETTLEMENT_SCOPED_TABLES) {
    const rows = seedSnapshots[table];
    if (rows !== undefined && rows.length > 0) {
      const { error } = await svc.from(table).upsert(rows);
      if (error !== null) errors.push(`restore ${table}: ${error.message}`);
    }
  }
  if (depositResourceSnapshot.length > 0) {
    const { error } = await svc
      .from("deposit_instance_resources")
      .upsert(depositResourceSnapshot);
    if (error !== null)
      errors.push(`restore deposit_instance_resources: ${error.message}`);
  }
  return errors;
}

describe("end-turn-simulation integration", () => {
  beforeAll(async () => {
    // Probe local Supabase via the REST root (returns the OpenAPI spec on 200).
    // Fail if the local API is not reachable.
    let probe: Response;
    try {
      probe = await fetch(`${LOCAL_URL}/rest/v1/`, {
        headers: { apikey: LOCAL_ANON_KEY },
        signal: AbortSignal.timeout(2_000),
      });
    } catch (error) {
      throw new Error(`Supabase REST API probe failed: ${String(error)}`, {
        cause: error,
      });
    }
    if (!probe.ok) {
      const responseText = await probe.text();
      throw new Error(
        `Supabase REST API probe failed: ${probe.status} ${probe.statusText} ${responseText}`,
      );
    }

    // Probe the edge function itself. If the local API is reachable but the
    // function or edge runtime is not, fail with the gateway response: proving
    // the edge runtime is available is part of this integration test.
    // Fix: run `npx supabase stop && npx supabase start` to reload functions,
    // and ensure supabase/functions/_shared/simulation/ files are mounted in
    // the edge runtime.
    let fnProbe: Response;
    try {
      fnProbe = await fetch(`${LOCAL_URL}/functions/v1/end-turn-simulation`, {
        method: "OPTIONS",
        signal: AbortSignal.timeout(5_000),
      });
    } catch (error) {
      throw new Error(
        `end-turn-simulation edge probe failed before request completed: ${String(error)}`,
        { cause: error },
      );
    }
    if (!fnProbe.ok) {
      const responseText = await fnProbe.text();
      throw new Error(
        `end-turn-simulation edge probe failed: ${fnProbe.status} ${fnProbe.statusText} ${responseText}`,
      );
    }

    // Restore world 101 to its canonical turn-0 seed state. Runs here so the
    // test is repeatable after previous runs, and again in afterAll so the
    // shared local database is left clean for the pgTAP seed-topology tests.
    const setupErrors = await restoreWorldToSeed();

    // Snapshot the settlement-scoped tables at the seed baseline so afterAll can
    // restore the four other settlements the end-turn mutates, not just 301.
    setupErrors.push(...(await captureSeedSnapshot()));

    // Sign in as the seeded super admin and capture the JWT.
    const { data: authData, error: authErr } =
      await anon.auth.signInWithPassword({
        email: SUPER_ADMIN_EMAIL,
        password: SUPER_ADMIN_PASSWORD,
      });
    if (authErr !== null) {
      setupErrors.push(`sign in: ${authErr.message}`);
    } else if (authData.session === null) {
      setupErrors.push("sign in: session is null");
    } else {
      accessToken = authData.session.access_token;
    }

    // Fail if any setup errors occurred.
    if (setupErrors.length > 0) {
      throw new Error(
        `Integration test setup failed:\n${setupErrors.map((e) => `  - ${e}`).join("\n")}`,
      );
    }
  }, 30_000);

  it("runs end-to-end against the seeded Verdant Reach world and satisfies all assertions", async () => {
    // -----------------------------------------------------------------------
    // 1. Call the edge function as the seeded super admin.
    // -----------------------------------------------------------------------
    const response = await fetch(
      `${LOCAL_URL}/functions/v1/end-turn-simulation`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          worldId: WORLD_ID,
          expectedTurnNumber: SEED_TURN,
        }),
      },
    );

    if (response.status !== 200) {
      const responseText = await response.text();
      throw new Error(
        `end-turn-simulation request failed: ${response.status} ${response.statusText} ${responseText}`,
      );
    }

    const body: unknown = await response.json();
    expect(body).toMatchObject({
      ok: true,
      data: {
        worldId: WORLD_ID,
        summary: {
          fromTurnNumber: SEED_TURN,
          toTurnNumber: SEED_TURN + 1,
        },
      },
    });

    const transitionId = (
      body as {
        data: { summary: { transitionId: string } };
      }
    ).data.summary.transitionId;

    // -----------------------------------------------------------------------
    // 2. Verify DB state using the service-role client (bypasses RLS).
    // -----------------------------------------------------------------------
    // World turn must have incremented.
    const { data: world } = await svc
      .from("worlds")
      .select("current_turn_number")
      .eq("id", WORLD_ID)
      .single();
    expect(world?.current_turn_number).toBe(SEED_TURN + 1);

    // The transitionId from the response must correspond to the completed
    // turn_transitions row — engine seed and stored id are the same UUID.
    const { data: transitionRow } = await svc
      .from("turn_transitions")
      .select("id,status")
      .eq("id", transitionId)
      .single();
    expect(transitionRow?.id).toBe(transitionId);
    expect(transitionRow?.status).toBe("completed");

    // At least one settlement snapshot per settlement for this transition.
    for (const settlementId of SETTLEMENT_IDS) {
      const { count } = await svc
        .from("settlement_turn_snapshots")
        .select("id", { count: "exact", head: true })
        .eq("turn_transition_id", transitionId)
        .eq("settlement_id", settlementId);
      expect(
        count,
        `snapshot missing for settlement ${settlementId}`,
      ).toBeGreaterThanOrEqual(1);
    }

    // Deposit remaining_quantity must have decreased (Sable Wren extracts from the quarry).
    const { data: depRow } = await svc
      .from("deposit_instance_resources")
      .select("remaining_quantity")
      .eq("deposit_instance_id", DEPOSIT_INSTANCE_ID)
      .eq("resource_id", DEPOSIT_RESOURCE_ID)
      .single();
    expect(depRow?.remaining_quantity).toBeLessThan(DEPOSIT_INITIAL_REMAINING);

    // Managed population count must have changed (Hearthwatch flock has no husbandry
    // workers so it declines every turn — see phaseManagedPopulations).
    const { data: popRow } = await svc
      .from("managed_population_instances")
      .select("current_count")
      .eq("id", MANAGED_POP_ID)
      .single();
    expect(popRow?.current_count).not.toBe(MANAGED_POP_INITIAL_COUNT);

    // Construction project progress must have increased (pool worker Lyss Thornwick is
    // allocated to the in_progress smithy project at Hearthwatch).
    const { data: projRow } = await svc
      .from("construction_projects")
      .select("progress_worker_turns")
      .eq("id", CONSTRUCTION_PROJECT_ID)
      .single();
    expect(projRow?.progress_worker_turns).toBeGreaterThan(
      CONSTRUCTION_PROJECT_INITIAL_PROGRESS,
    );

    // -----------------------------------------------------------------------
    // 3. Verify that at least one notification is visible to the super admin.
    //    The Hearthwatch sheep-flock decline generates a managed_population.declining
    //    notification scoped to settlement 301; all super admins are always recipients.
    // -----------------------------------------------------------------------
    const { count: notifCount } = await anon
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("world_id", WORLD_ID);
    expect(notifCount).toBeGreaterThanOrEqual(1);
  }, 60_000);

  // Leave the shared local database in its canonical seed state so the pgTAP
  // seed-topology tests (and any later run) see an unmutated world 101.
  afterAll(async () => {
    const teardownErrors = [
      ...(await restoreWorldToSeed()),
      ...(await restoreSeedSnapshot()),
    ];
    if (teardownErrors.length > 0) {
      throw new Error(
        `Integration test teardown failed:\n${teardownErrors.map((e) => `  - ${e}`).join("\n")}`,
      );
    }
  }, 30_000);
});
