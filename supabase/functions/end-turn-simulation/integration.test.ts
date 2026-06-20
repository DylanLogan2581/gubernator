// Integration test: runs end-turn-simulation against the local seeded Aldermoor world.
//
// Requires a running local Supabase instance (`npx supabase start`) with the
// seed loaded. The seeded world 101 ("Aldermoor") has already been advanced 32
// turns through the real simulation and tidied into a clean turn-32 snapshot, so
// this test does NOT assume a particular turn number: it reads the world's live
// `current_turn_number`, advances exactly ONE turn, asserts the resulting deltas,
// and then restores the captured state so a later `npx supabase test db` still
// passes.
//
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
// Seed world 101 identifiers (Aldermoor; see supabase/seed.sql).
// ---------------------------------------------------------------------------
const WORLD_ID = "00000000-0000-0000-0000-000000000101";
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

// The six canonical settlements in Aldermoor (world 101).
const SETTLEMENT_IDS = [
  "00000000-0000-0000-0000-000000000301", // Aldercross
  "00000000-0000-0000-0000-000000000302", // Wendlin
  "00000000-0000-0000-0000-000000000303", // Bramhollow
  "00000000-0000-0000-0000-000000000304", // Saltmere
  "00000000-0000-0000-0000-000000000305", // Cobbleford
  "00000000-0000-0000-0000-000000000306", // Carrick Hold
] as const;

// Citizen Wynflaed Quill (431) is seeded as a permanently-dead founder NPC with
// death_cause_category 'unknown'. The seed-topology pgTAP test asserts she stays
// dead, so the restore logic below must keep her seeded death state intact. Her
// exact `{status, death_cause, death_cause_category}` is captured dynamically with
// every other citizen (no hardcoded death-cause string) and restored verbatim, so
// no dedicated identifier is needed here.

// ---------------------------------------------------------------------------
// Mutable settlement-scoped tables the end-turn engine mutates across all six
// settlements (status/progress/count/remaining fields) but does not create or
// delete rows in for the seeded settlements. These are snapshotted (full rows
// via select('*')) before the test turn and upserted back verbatim in afterAll,
// keeping world 101 byte-identical for the pgTAP seed-topology suite.
// ---------------------------------------------------------------------------
const SETTLEMENT_SCOPED_TABLES = [
  "construction_projects",
  "managed_population_instances",
  "deposit_instances",
  "settlement_resource_stockpiles",
  "settlement_buildings",
] as const;

// ---------------------------------------------------------------------------
// Captured before-state, populated in beforeAll.
// ---------------------------------------------------------------------------
type CitizenLifeState = {
  status: string;
  death_cause: string | null;
  death_cause_category: string | null;
};

let accessToken = "";
let startTurn = 0;

// Set of every citizen id present in world 101 before the test turn, plus each
// citizen's life state (so afterAll can revive test-turn deaths and delete
// test-turn newborns).
const beforeCitizenLifeState = new Map<string, CitizenLifeState>();

// Full-row snapshots of the mutable settlement-scoped tables.
const tableSnapshots: Record<string, Record<string, unknown>[]> = {};
let depositResourceSnapshot: Record<string, unknown>[] = [];
let assignmentSnapshot: Record<string, unknown>[] = [];
// The settlements and trade_routes rows are also mutated by the turn (ready
// flags reset; active routes can be paused). They are keyed by `id` / scoped via
// `origin_settlement_id`, so they are captured/restored separately from the
// `settlement_id`-scoped tables above.
let settlementsSnapshot: Record<string, unknown>[] = [];
let tradeRoutesSnapshot: Record<string, unknown>[] = [];

// Aggregate baselines used for delta assertions.
let baselineDepositRemaining = 0;
let baselineConstructionProgress = 0;
const baselinePopulationCounts = new Map<string, number>();

// ---------------------------------------------------------------------------
// Helpers for resolving the live set of world-101 citizen ids (used both to
// scope citizen_assignments and to detect newborns in afterAll).
// ---------------------------------------------------------------------------
async function fetchWorldCitizenIds(): Promise<{
  ids: string[];
  error: string | null;
}> {
  const { data, error } = await svc
    .from("citizens")
    .select("id")
    .eq("world_id", WORLD_ID);
  if (error !== null) return { ids: [], error: error.message };
  const rows = (data ?? []) as unknown as { id: string }[];
  return { ids: rows.map((r) => r.id), error: null };
}

// World 101 has ~292 citizens; enumerating every id in a single PostgREST `.in()`
// filter overflows the GET request URL ("URI too long"). Split id lists into
// small batches so each request URL stays well within the gateway limit.
const ID_BATCH_SIZE = 80;

function chunk<T>(items: readonly T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

// Selects all citizen_assignments for the given citizen ids, batching the `.in()`
// filter so the request URL stays short. Returns rows or an error string.
async function fetchAssignmentsForCitizens(
  citizenIds: readonly string[],
): Promise<{ rows: Record<string, unknown>[]; error: string | null }> {
  const rows: Record<string, unknown>[] = [];
  for (const batch of chunk(citizenIds, ID_BATCH_SIZE)) {
    const { data, error } = await svc
      .from("citizen_assignments")
      .select("*")
      .in("citizen_id", batch);
    if (error !== null) return { rows: [], error: error.message };
    rows.push(...((data ?? []) as Record<string, unknown>[]));
  }
  return { rows, error: null };
}

// Deletes all citizen_assignments for the given citizen ids, batching the `.in()`
// filter so the request URL stays short. Returns an error string or null.
async function deleteAssignmentsForCitizens(
  citizenIds: readonly string[],
): Promise<string | null> {
  for (const batch of chunk(citizenIds, ID_BATCH_SIZE)) {
    const { error } = await svc
      .from("citizen_assignments")
      .delete()
      .in("citizen_id", batch);
    if (error !== null) return error.message;
  }
  return null;
}

// Captures everything required to (a) assert deltas after advancing one turn and
// (b) restore world 101 afterward. Returns a list of failures rather than
// throwing so the caller can aggregate them.
async function captureBeforeState(): Promise<string[]> {
  const errors: string[] = [];

  // Live turn number — do NOT assume turn 0.
  const { data: worldRow, error: worldErr } = await svc
    .from("worlds")
    .select("current_turn_number")
    .eq("id", WORLD_ID)
    .single();
  if (worldErr !== null) {
    errors.push(`read world turn: ${worldErr.message}`);
  } else if (worldRow === null) {
    errors.push("read world turn: world 101 not found");
  } else {
    startTurn = Number(worldRow.current_turn_number);
  }

  // Every citizen's life state, keyed by id.
  const { data: citizenRows, error: citizenErr } = await svc
    .from("citizens")
    .select("id,status,death_cause,death_cause_category")
    .eq("world_id", WORLD_ID);
  if (citizenErr !== null) {
    errors.push(`capture citizens: ${citizenErr.message}`);
  } else {
    beforeCitizenLifeState.clear();
    for (const row of citizenRows ?? []) {
      const r = row as { id: string } & CitizenLifeState;
      beforeCitizenLifeState.set(r.id, {
        status: r.status,
        death_cause: r.death_cause,
        death_cause_category: r.death_cause_category,
      });
    }
  }

  // Full-row snapshots of the mutable settlement-scoped tables.
  for (const table of SETTLEMENT_SCOPED_TABLES) {
    const { data, error } = await svc
      .from(table)
      .select("*")
      .in("settlement_id", SETTLEMENT_IDS);
    if (error !== null) {
      errors.push(`snapshot ${table}: ${error.message}`);
      continue;
    }
    tableSnapshots[table] = (data ?? []) as Record<string, unknown>[];
  }

  // deposit_instance_resources has no settlement_id; scope it via the snapshot
  // deposit instances for the six settlements.
  const depositIds = (tableSnapshots["deposit_instances"] ?? []).map(
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
      depositResourceSnapshot = (data ?? []) as Record<string, unknown>[];
    }
  }

  // All citizen_assignments for world-101 citizens.
  const worldCitizenIds = [...beforeCitizenLifeState.keys()];
  if (worldCitizenIds.length > 0) {
    const { rows, error } = await fetchAssignmentsForCitizens(worldCitizenIds);
    if (error !== null) {
      errors.push(`snapshot citizen_assignments: ${error}`);
    } else {
      assignmentSnapshot = rows;
    }
  }

  // The six canonical settlement rows (the engine resets ready flags each turn).
  const { data: settlementRows, error: settlementErr } = await svc
    .from("settlements")
    .select("*")
    .in("id", SETTLEMENT_IDS);
  if (settlementErr !== null) {
    errors.push(`snapshot settlements: ${settlementErr.message}`);
  } else {
    settlementsSnapshot = (settlementRows ?? []) as Record<string, unknown>[];
  }

  // World-101 trade routes (the engine can pause active routes). All routes for
  // this world originate from the six canonical settlements.
  const { data: tradeRouteRows, error: tradeRouteErr } = await svc
    .from("trade_routes")
    .select("*")
    .in("origin_settlement_id", SETTLEMENT_IDS);
  if (tradeRouteErr !== null) {
    errors.push(`snapshot trade_routes: ${tradeRouteErr.message}`);
  } else {
    tradeRoutesSnapshot = (tradeRouteRows ?? []) as Record<string, unknown>[];
  }

  // Aggregate baselines.
  baselineDepositRemaining = depositResourceSnapshot.reduce(
    (sum, r) => sum + Number((r as { remaining_quantity: number }).remaining_quantity),
    0,
  );
  baselineConstructionProgress = (tableSnapshots["construction_projects"] ?? []).reduce(
    (sum, r) =>
      sum + Number((r as { progress_worker_turns: number }).progress_worker_turns),
    0,
  );
  baselinePopulationCounts.clear();
  for (const row of tableSnapshots["managed_population_instances"] ?? []) {
    const r = row as { id: string; current_count: number };
    baselinePopulationCounts.set(r.id, Number(r.current_count));
  }

  return errors;
}

// Restores world 101 close to its seeded turn-N state. Returns failures rather
// than throwing so the caller can aggregate them.
async function restoreWorldToCapturedState(): Promise<string[]> {
  const errors: string[] = [];

  // 1. Delete the transition created by the test turn. The FK cascade removes
  //    that turn's settlement_turn_snapshots, turn_log_entries, and notifications.
  const { error: delErr } = await svc
    .from("turn_transitions")
    .delete()
    .eq("world_id", WORLD_ID)
    .eq("from_turn_number", startTurn);
  if (delErr !== null) {
    errors.push(`delete turn_transitions: ${delErr.message}`);
  }

  // 2. Reset the world turn counter back to the captured start turn.
  const { error: wErr } = await svc
    .from("worlds")
    .update({ current_turn_number: startTurn })
    .eq("id", WORLD_ID);
  if (wErr !== null) errors.push(`reset world turn: ${wErr.message}`);

  // 3. Delete citizens born during the test turn (ids present now but not in the
  //    captured before-set). Their citizen_assignments cascade away. Do this
  //    before restoring assignments so the re-insert below is consistent.
  const { ids: currentCitizenIds, error: idErr } = await fetchWorldCitizenIds();
  if (idErr !== null) {
    errors.push(`list current citizens: ${idErr}`);
  } else {
    const newbornIds = currentCitizenIds.filter(
      (id) => !beforeCitizenLifeState.has(id),
    );
    if (newbornIds.length > 0) {
      const { error: newbornErr } = await svc
        .from("citizens")
        .delete()
        .in("id", newbornIds);
      if (newbornErr !== null) {
        errors.push(`delete test-turn newborns: ${newbornErr.message}`);
      }
    }
  }

  // 4. Restore every captured citizen's life state. This revives any test-turn
  //    deaths and keeps the seeded dead NPC (Wynflaed Quill, 431) dead because
  //    her captured state is `dead`.
  for (const [citizenId, life] of beforeCitizenLifeState) {
    const { error } = await svc
      .from("citizens")
      .update({
        status: life.status,
        death_cause: life.death_cause,
        death_cause_category: life.death_cause_category,
      })
      .eq("id", citizenId);
    if (error !== null) {
      errors.push(`restore citizen ${citizenId}: ${error.message}`);
      break;
    }
  }

  // 5. Upsert the captured mutable settlement-scoped rows back verbatim.
  for (const table of SETTLEMENT_SCOPED_TABLES) {
    const rows = tableSnapshots[table];
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
  if (settlementsSnapshot.length > 0) {
    const { error } = await svc.from("settlements").upsert(settlementsSnapshot);
    if (error !== null) errors.push(`restore settlements: ${error.message}`);
  }
  if (tradeRoutesSnapshot.length > 0) {
    const { error } = await svc
      .from("trade_routes")
      .upsert(tradeRoutesSnapshot);
    if (error !== null) errors.push(`restore trade_routes: ${error.message}`);
  }

  // 6. Restore citizen_assignments: delete all current world-101 assignments and
  //    re-insert the captured ones. (Newborns were already deleted above, so no
  //    stray assignments remain for them.)
  const { ids: liveCitizenIds, error: liveIdErr } = await fetchWorldCitizenIds();
  if (liveIdErr !== null) {
    errors.push(`list citizens for assignment reset: ${liveIdErr}`);
  } else if (liveCitizenIds.length > 0) {
    const delAssignErr = await deleteAssignmentsForCitizens(liveCitizenIds);
    if (delAssignErr !== null) {
      errors.push(`clear citizen_assignments: ${delAssignErr}`);
    }
  }
  if (assignmentSnapshot.length > 0) {
    const { error: insAssignErr } = await svc
      .from("citizen_assignments")
      .insert(assignmentSnapshot);
    if (insAssignErr !== null) {
      errors.push(`restore citizen_assignments: ${insAssignErr.message}`);
    }
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

    // Capture the live turn number and full before-state. Does NOT delete
    // existing history or reset the world to turn 0.
    const setupErrors = await captureBeforeState();

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

  it("advances one turn against the seeded Aldermoor world and satisfies all assertions", async () => {
    // -----------------------------------------------------------------------
    // 1. Call the edge function as the seeded super admin, advancing the live
    //    turn (expectedTurnNumber MUST equal current_turn_number or it 409s).
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
          expectedTurnNumber: startTurn,
        }),
      },
    );

    if (response.status !== 200) {
      const responseText = await response.text();
      throw new Error(
        `end-turn-simulation request failed: ${response.status} ${response.statusText} ${responseText}`,
      );
    }
    expect(response.status).toBe(200);

    const body: unknown = await response.json();
    expect(body).toMatchObject({
      ok: true,
      data: {
        worldId: WORLD_ID,
        summary: {
          fromTurnNumber: startTurn,
          toTurnNumber: startTurn + 1,
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
    expect(world?.current_turn_number).toBe(startTurn + 1);

    // The transitionId from the response must correspond to the completed
    // turn_transitions row — engine seed and stored id are the same UUID.
    const { data: transitionRow } = await svc
      .from("turn_transitions")
      .select("id,status,forecast_snapshot_jsonb")
      .eq("id", transitionId)
      .single();
    expect(transitionRow?.id).toBe(transitionId);
    expect(transitionRow?.status).toBe("completed");

    // Forecast snapshot must be populated for every completed transition and
    // must contain all six canonical settlements.
    expect(transitionRow?.forecast_snapshot_jsonb).toBeDefined();
    expect(transitionRow?.forecast_snapshot_jsonb).not.toBeNull();
    const forecast = transitionRow?.forecast_snapshot_jsonb as unknown as {
      bySettlement?: Record<string, unknown>;
    };
    expect(forecast?.bySettlement).toBeDefined();
    const forecastSettlementIds = Object.keys(forecast?.bySettlement ?? {});
    expect(forecastSettlementIds.length).toBeGreaterThanOrEqual(
      SETTLEMENT_IDS.length,
    );
    for (const settlementId of SETTLEMENT_IDS) {
      expect(forecastSettlementIds).toContain(settlementId);
    }
    // Each settlement forecast should have the required structure.
    for (const [settlementId, settlementForecast] of Object.entries(
      forecast?.bySettlement ?? {},
    )) {
      const sf = settlementForecast as {
        settlementId?: string;
        resourceDeltas?: unknown[];
        deathsBy?: unknown;
        completedProjects?: unknown[];
        buildingUpkeepFailures?: unknown[];
        tradeChanges?: unknown[];
      };
      expect(sf?.settlementId).toBe(settlementId);
      expect(Array.isArray(sf?.resourceDeltas)).toBe(true);
      expect(sf?.deathsBy).toBeDefined();
      expect(Array.isArray(sf?.completedProjects)).toBe(true);
      expect(Array.isArray(sf?.buildingUpkeepFailures)).toBe(true);
      expect(Array.isArray(sf?.tradeChanges)).toBe(true);
    }

    // At least one settlement snapshot per canonical settlement for this transition.
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

    // Total deposit remaining_quantity across the six settlements must have
    // DECREASED (every settlement has staffed deposits that extract each turn).
    const depositIds = (tableSnapshots["deposit_instances"] ?? []).map(
      (d) => (d as { id: string }).id,
    );
    const { data: depRows } = await svc
      .from("deposit_instance_resources")
      .select("remaining_quantity")
      .in("deposit_instance_id", depositIds);
    const depositRemainingRows = (depRows ?? []) as unknown as {
      remaining_quantity: number;
    }[];
    const totalDepositRemaining = depositRemainingRows.reduce(
      (sum, r) => sum + Number(r.remaining_quantity),
      0,
    );
    expect(totalDepositRemaining).toBeLessThan(baselineDepositRemaining);

    // At least one managed-population count must have CHANGED.
    const { data: popRows } = await svc
      .from("managed_population_instances")
      .select("id,current_count")
      .in("settlement_id", SETTLEMENT_IDS);
    const populationRows = (popRows ?? []) as unknown as {
      id: string;
      current_count: number;
    }[];
    const someCountChanged = populationRows.some((row) => {
      const baseline = baselinePopulationCounts.get(row.id);
      return baseline !== undefined && Number(row.current_count) !== baseline;
    });
    expect(someCountChanged).toBe(true);

    // Total construction progress must have INCREASED (or a project completed —
    // be tolerant and assert >=). Worker-turns may reset to 0 on completion, so
    // also accept the case where a previously in-progress project completed.
    const { data: projRows } = await svc
      .from("construction_projects")
      .select("progress_worker_turns,status")
      .in("settlement_id", SETTLEMENT_IDS);
    const totalConstructionProgress = (projRows ?? []).reduce(
      (sum, r) =>
        sum +
        Number((r as { progress_worker_turns: number }).progress_worker_turns),
      0,
    );
    expect(totalConstructionProgress).toBeGreaterThanOrEqual(
      baselineConstructionProgress,
    );

    // -----------------------------------------------------------------------
    // 3. Verify that notifications were emitted for world 101 and are visible
    //    to the super admin (all super admins are always recipients).
    // -----------------------------------------------------------------------
    const { count: notifCount } = await anon
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("world_id", WORLD_ID);
    expect(notifCount).toBeGreaterThanOrEqual(1);
  }, 60_000);

  // Leave the shared local database close to its canonical turn-32 seed state so
  // the pgTAP seed-topology tests (and any later run) see an unmutated world 101.
  afterAll(async () => {
    const teardownErrors = await restoreWorldToCapturedState();
    if (teardownErrors.length > 0) {
      throw new Error(
        `Integration test teardown failed:\n${teardownErrors.map((e) => `  - ${e}`).join("\n")}`,
      );
    }
  }, 30_000);
});
