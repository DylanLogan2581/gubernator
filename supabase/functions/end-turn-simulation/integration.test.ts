// Integration test: runs end-turn-simulation against the local seeded Verdant Reach world.
//
// Requires a running local Supabase instance (`npx supabase start`) with `seed.sql` loaded.
// Automatically skips when the local API is unreachable so it never blocks CI.
//
// Run with: npm run test:integration

import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Well-known local development constants (from `npx supabase status --output json`).
// These derive from the shared JWT secret and never change across dev machines.
// ---------------------------------------------------------------------------
const LOCAL_URL = "http://127.0.0.1:54321";
const LOCAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const LOCAL_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

// ---------------------------------------------------------------------------
// Seed world 101 identifiers (see supabase/seed.sql).
// ---------------------------------------------------------------------------
const WORLD_ID = "00000000-0000-0000-0000-000000000101";
const SEED_TURN = 0;
const SUPER_ADMIN_EMAIL = "superadmin@gubernator.local";
const SUPER_ADMIN_PASSWORD = "password123";

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
let available = false;
let accessToken = "";

describe("end-turn-simulation integration", () => {
  beforeAll(async () => {
    // Probe local Supabase via the REST root (returns the OpenAPI spec on 200).
    // Skip the entire suite when the local API is not reachable.
    try {
      const probe = await fetch(`${LOCAL_URL}/rest/v1/`, {
        headers: { apikey: LOCAL_ANON_KEY },
        signal: AbortSignal.timeout(2_000),
      });
      if (!probe.ok) return;
    } catch {
      return;
    }

    // Probe the edge function itself.  The runtime returns "Function not found"
    // (404) when the container was started before end-turn-simulation was
    // registered; in that case skip rather than fail.
    // Fix: run `npx supabase stop && npx supabase start` to reload functions,
    // and ensure src/shared/simulation/ files are mounted in the edge runtime.
    try {
      const fnProbe = await fetch(
        `${LOCAL_URL}/functions/v1/end-turn-simulation`,
        {
          method: "OPTIONS",
          signal: AbortSignal.timeout(5_000),
        },
      );
      // 404 means the function is not registered in this runtime instance.
      if (fnProbe.status === 404) return;
    } catch {
      return;
    }

    // Use the service-role client (bypasses RLS) to reset world 101 to the
    // canonical turn-0 state so the test is repeatable after previous runs.
    const svc = createClient(LOCAL_URL, LOCAL_SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // Delete any prior turn-0 transition for this world.  The FK cascade
    // removes the associated settlement_turn_snapshots, turn_log_entries, and
    // notifications so the assertions below start from a clean slate.
    const { error: delErr } = await svc
      .from("turn_transitions")
      .delete()
      .eq("world_id", WORLD_ID)
      .eq("from_turn_number", SEED_TURN);
    if (delErr !== null) return;

    // Reset the world turn counter.
    const { error: wErr } = await svc
      .from("worlds")
      .update({ current_turn_number: SEED_TURN })
      .eq("id", WORLD_ID);
    if (wErr !== null) return;

    // Reset construction project progress so the "increased" assertion is reliable.
    const { error: cErr } = await svc
      .from("construction_projects")
      .update({
        progress_worker_turns: CONSTRUCTION_PROJECT_INITIAL_PROGRESS,
        status: "in_progress",
      })
      .eq("id", CONSTRUCTION_PROJECT_ID);
    if (cErr !== null) return;

    // Reset deposit remaining quantity.
    const { error: dErr } = await svc
      .from("deposit_instance_resources")
      .update({ remaining_quantity: DEPOSIT_INITIAL_REMAINING })
      .eq("deposit_instance_id", DEPOSIT_INSTANCE_ID)
      .eq("resource_id", DEPOSIT_RESOURCE_ID);
    if (dErr !== null) return;

    // Reset the Hearthwatch sheep flock count.
    const { error: mErr } = await svc
      .from("managed_population_instances")
      .update({ current_count: MANAGED_POP_INITIAL_COUNT })
      .eq("id", MANAGED_POP_ID);
    if (mErr !== null) return;

    // Reset non-system resource stockpiles to seed values so repeated runs
    // don't start with depleted resources.
    for (const s of NON_SYSTEM_STOCKPILE_SEEDS) {
      const { error } = await svc
        .from("settlement_resource_stockpiles")
        .update({ quantity: s.quantity })
        .eq("settlement_id", s.settlementId)
        .eq("resource_id", s.resourceId);
      if (error !== null) return;
    }

    // Resolve food/fresh-water resource IDs by slug (they are generated
    // dynamically per-world) and reset those stockpiles too.
    const { data: sysResources, error: srErr } = await svc
      .from("resources")
      .select("id,slug")
      .eq("world_id", WORLD_ID)
      .eq("is_system_resource", true)
      .in("slug", ["food", "fresh-water"]);
    if (srErr !== null || sysResources === null) return;

    for (const seed of SYSTEM_STOCKPILE_SEEDS) {
      const resource = sysResources.find((r) => r.slug === seed.slug);
      if (resource === undefined) return;
      const { error } = await svc
        .from("settlement_resource_stockpiles")
        .update({ quantity: seed.quantity })
        .eq("settlement_id", seed.settlementId)
        .eq("resource_id", resource.id);
      if (error !== null) return;
    }

    // Restore citizens who may have died in a prior run to alive status.
    const { error: citizenErr } = await svc
      .from("citizens")
      .update({
        status: "alive",
        death_cause: null,
        death_cause_category: null,
      })
      .eq("world_id", WORLD_ID)
      .eq("status", "dead");
    if (citizenErr !== null) return;

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
    if (assignErr !== null) return;

    // Sign in as the seeded super admin and capture the JWT.
    const anon = createClient(LOCAL_URL, LOCAL_ANON_KEY, {
      auth: { persistSession: false },
    });
    const { data: authData, error: authErr } =
      await anon.auth.signInWithPassword({
        email: SUPER_ADMIN_EMAIL,
        password: SUPER_ADMIN_PASSWORD,
      });
    if (authErr !== null || authData.session === null) return;
    accessToken = authData.session.access_token;

    available = true;
  }, 30_000);

  it("runs end-to-end against the seeded Verdant Reach world and satisfies all assertions", async () => {
    if (!available) {
      // Local Supabase is not running — skip gracefully.
      return;
    }

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

    expect(response.status).toBe(200);
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
    const svc = createClient(LOCAL_URL, LOCAL_SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // World turn must have incremented.
    const { data: world } = await svc
      .from("worlds")
      .select("current_turn_number")
      .eq("id", WORLD_ID)
      .single();
    expect(world?.current_turn_number).toBe(SEED_TURN + 1);

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
    const anon = createClient(LOCAL_URL, LOCAL_ANON_KEY, {
      auth: { persistSession: false },
    });
    await anon.auth.signInWithPassword({
      email: SUPER_ADMIN_EMAIL,
      password: SUPER_ADMIN_PASSWORD,
    });
    const { count: notifCount } = await anon
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("world_id", WORLD_ID);
    expect(notifCount).toBeGreaterThanOrEqual(1);
  }, 60_000);
});
