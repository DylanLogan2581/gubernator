// Integration test: runs end-turn-simulation against the local seeded world.
//
// Requires a running local Supabase instance (`npx supabase start`) with the
// seed loaded. The seeded world has already been advanced many turns through the
// real simulation and tidied into a clean snapshot, so this test does NOT assume
// a particular turn number or world id: it resolves both, reads the world's live
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
// Seed world identifiers. The seed ships exactly one world, but its id and its
// settlements' ids are generated rather than fixed, so both are resolved from
// the live database in beforeAll instead of hardcoded. An earlier revision
// pinned these to a former fixture world; regenerating the seed silently broke
// every assertion below.
// ---------------------------------------------------------------------------
let WORLD_ID = "";
let SETTLEMENT_IDS: string[] = [];
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

// Resolves the seeded world and its settlements. Returns error strings rather
// than throwing so the caller can aggregate them with the other setup errors.
async function resolveSeedFixtures(): Promise<string[]> {
  const errors: string[] = [];

  const { data: worldRows, error: worldErr } = await svc
    .from("worlds")
    .select("id")
    .eq("is_trashed", false);
  if (worldErr !== null) {
    errors.push(`resolve seed world: ${worldErr.message}`);
    return errors;
  }
  const worlds = (worldRows ?? []) as unknown as { id: string }[];
  if (worlds.length !== 1) {
    errors.push(
      `resolve seed world: expected exactly 1 seeded world, found ${worlds.length}`,
    );
    return errors;
  }
  WORLD_ID = worlds[0].id;

  // Settlements are scoped to a nation, not directly to a world, so resolve the
  // world's nations first.
  const { data: nationRows, error: nationErr } = await svc
    .from("nations")
    .select("id")
    .eq("world_id", WORLD_ID);
  if (nationErr !== null) {
    errors.push(`resolve seed nations: ${nationErr.message}`);
    return errors;
  }
  const nationIds = ((nationRows ?? []) as unknown as { id: string }[]).map(
    (row) => row.id,
  );
  if (nationIds.length === 0) {
    errors.push("resolve seed nations: world has no nations");
    return errors;
  }

  const { data: settlementRows, error: settlementErr } = await svc
    .from("settlements")
    .select("id")
    .in("nation_id", nationIds)
    .order("id");
  if (settlementErr !== null) {
    errors.push(`resolve seed settlements: ${settlementErr.message}`);
    return errors;
  }
  SETTLEMENT_IDS = ((settlementRows ?? []) as unknown as { id: string }[]).map(
    (row) => row.id,
  );
  if (SETTLEMENT_IDS.length === 0) {
    errors.push("resolve seed settlements: world has no settlements");
  }

  return errors;
}

// One seeded citizen is a permanently-dead founder NPC with
// death_cause_category 'unknown'. The seed-topology pgTAP test asserts they stay
// dead, so the restore logic below must keep that seeded death state intact. The
// exact `{status, death_cause, death_cause_category}` is captured dynamically with
// every other citizen (no hardcoded death-cause string) and restored verbatim, so
// no dedicated identifier is needed here.

// ---------------------------------------------------------------------------
// Mutable settlement-scoped tables the end-turn engine mutates across every
// settlement (status/progress/count/remaining fields) but does not create or
// delete rows in for the seeded settlements. These are snapshotted (full rows
// via select('*')) before the test turn and upserted back verbatim in afterAll,
// keeping the seeded world byte-identical for the pgTAP seed-topology suite.
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

// Set of every citizen id present in the seeded world before the test turn, plus each
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
// Helpers for resolving the live set of seeded-world citizen ids (used both to
// scope citizen_assignments and to detect newborns in afterAll).
// ---------------------------------------------------------------------------
async function fetchWorldCitizenIds(): Promise<{
  ids: string[];
  error: string | null;
}> {
  const { rows, error } = await selectAllPages(() =>
    svc.from("citizens").select("id").eq("world_id", WORLD_ID).order("id"),
  );
  if (error !== null) return { ids: [], error };
  return {
    ids: (rows as unknown as { id: string }[]).map((r) => r.id),
    error: null,
  };
}

// The seeded world has hundreds of citizens; enumerating every id in a single PostgREST `.in()`
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

// PostgREST caps every response at `max_rows` (supabase/config.toml: 1000) and
// truncates SILENTLY — no error, just a short array. The seeded world is well
// past that on several tables, so a single unpaginated read returns a partial,
// non-deterministically-ordered snapshot; restoring from one leaves rows behind
// and the re-insert then collides on the primary key. Every read below pages
// through with an explicit order so the full set comes back.
const PAGE_SIZE = 1000;

async function selectAllPages(
  build: () => {
    range: (
      from: number,
      to: number,
    ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  },
): Promise<{ rows: Record<string, unknown>[]; error: string | null }> {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build().range(from, from + PAGE_SIZE - 1);
    if (error !== null) return { rows: [], error: error.message };
    const page = (data ?? []) as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return { rows, error: null };
  }
}

// Selects `columns` from `table` where `column` is in `ids`, batching the
// `.in()` filter so the request URL stays short and paging each batch so no
// result is truncated. Every id-filtered read in this file goes through here:
// the seeded world has grown past the point where a single `.in()` fits in a
// request URL, and an unbatched one fails with "URI too long".
async function selectByIds(
  table: string,
  column: string,
  ids: readonly string[],
  columns = "*",
  orderColumn = "id",
): Promise<{ rows: Record<string, unknown>[]; error: string | null }> {
  const rows: Record<string, unknown>[] = [];
  for (const batch of chunk(ids, ID_BATCH_SIZE)) {
    const { rows: page, error } = await selectAllPages(() =>
      svc
        // The table name is a literal from this file, not user input; the
        // client's generated table union can't express that, so widen it here.
        .from(table as never)
        .select(columns)
        .in(column, batch)
        .order(orderColumn),
    );
    if (error !== null) return { rows: [], error };
    rows.push(...page);
  }
  return { rows, error: null };
}

// Selects all citizen_assignments for the given citizen ids, batching the `.in()`
// filter so the request URL stays short. Returns rows or an error string.
async function fetchAssignmentsForCitizens(
  citizenIds: readonly string[],
): Promise<{ rows: Record<string, unknown>[]; error: string | null }> {
  return await selectByIds(
    "citizen_assignments",
    "citizen_id",
    citizenIds,
    "*",
    // citizen_assignments is keyed by citizen_id, not id.
    "citizen_id",
  );
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

// Deletes every partnership with the given citizens on either side, batching the
// `.in()` filter so the request URL stays short. Returns an error string or null.
async function deletePartnershipsForCitizens(
  citizenIds: readonly string[],
): Promise<string | null> {
  for (const column of ["citizen_a_id", "citizen_b_id"] as const) {
    for (const batch of chunk(citizenIds, ID_BATCH_SIZE)) {
      const { error } = await svc
        .from("partnerships")
        .delete()
        .in(column, batch);
      if (error !== null) return error.message;
    }
  }
  return null;
}

// Deletes the given citizens, batching the `.in()` filter so the request URL
// stays short. Returns an error string or null.
async function deleteCitizensByIds(
  citizenIds: readonly string[],
): Promise<string | null> {
  for (const batch of chunk(citizenIds, ID_BATCH_SIZE)) {
    const { error } = await svc.from("citizens").delete().in("id", batch);
    if (error !== null) return error.message;
  }
  return null;
}

// Captures everything required to (a) assert deltas after advancing one turn and
// (b) restore the seeded world afterward. Returns a list of failures rather than
// throwing so the caller can aggregate them.
async function captureBeforeState(): Promise<string[]> {
  const errors: string[] = [];

  // Resolve the seeded world/settlement ids first — every query below is scoped
  // by them, so there is nothing meaningful to capture if this fails.
  const resolveErrors = await resolveSeedFixtures();
  if (resolveErrors.length > 0) return resolveErrors;

  // Live turn number — do NOT assume turn 0.
  const { data: worldRow, error: worldErr } = await svc
    .from("worlds")
    .select("current_turn_number")
    .eq("id", WORLD_ID)
    .single();
  if (worldErr !== null) {
    errors.push(`read world turn: ${worldErr.message}`);
  } else if (worldRow === null) {
    errors.push("read world turn: seeded world not found");
  } else {
    startTurn = Number(worldRow.current_turn_number);
  }

  // Every citizen's life state, keyed by id.
  const { rows: citizenRows, error: citizenErr } = await selectAllPages(() =>
    svc
      .from("citizens")
      .select("id,status,death_cause,death_cause_category")
      .eq("world_id", WORLD_ID)
      .order("id"),
  );
  if (citizenErr !== null) {
    errors.push(`capture citizens: ${citizenErr}`);
  } else {
    beforeCitizenLifeState.clear();
    for (const row of citizenRows) {
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
    const { rows, error } = await selectByIds(
      table,
      "settlement_id",
      SETTLEMENT_IDS,
    );
    if (error !== null) {
      errors.push(`snapshot ${table}: ${error}`);
      continue;
    }
    tableSnapshots[table] = rows;
  }

  // deposit_instance_resources has no settlement_id; scope it via the snapshot
  // deposit instances for the seeded settlements.
  const depositIds = (tableSnapshots["deposit_instances"] ?? []).map(
    (d) => (d as { id: string }).id,
  );
  if (depositIds.length > 0) {
    const { rows, error } = await selectByIds(
      "deposit_instance_resources",
      "deposit_instance_id",
      depositIds,
    );
    if (error !== null) {
      errors.push(`snapshot deposit_instance_resources: ${error}`);
    } else {
      depositResourceSnapshot = rows;
    }
  }

  // All citizen_assignments for the seeded world's citizens.
  const worldCitizenIds = [...beforeCitizenLifeState.keys()];
  if (worldCitizenIds.length > 0) {
    const { rows, error } = await fetchAssignmentsForCitizens(worldCitizenIds);
    if (error !== null) {
      errors.push(`snapshot citizen_assignments: ${error}`);
    } else {
      assignmentSnapshot = rows;
    }
  }

  // The seeded settlement rows (the engine resets ready flags each turn).
  const { rows: settlementRows, error: settlementErr } = await selectByIds(
    "settlements",
    "id",
    SETTLEMENT_IDS,
  );
  if (settlementErr !== null) {
    errors.push(`snapshot settlements: ${settlementErr}`);
  } else {
    settlementsSnapshot = settlementRows;
  }

  // Trade routes (the engine can pause active routes). All routes for this world
  // originate from the seeded settlements.
  const { rows: tradeRouteRows, error: tradeRouteErr } = await selectByIds(
    "trade_routes",
    "origin_settlement_id",
    SETTLEMENT_IDS,
  );
  if (tradeRouteErr !== null) {
    errors.push(`snapshot trade_routes: ${tradeRouteErr}`);
  } else {
    tradeRoutesSnapshot = tradeRouteRows;
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

// Restores the seeded world close to its seeded turn-N state. Returns failures rather
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
      // Partnerships reference citizens with a plain FK (no cascade), and the
      // turn can partner a newborn's parents or the newborns themselves, so any
      // partnership touching a newborn has to go first or the delete below
      // fails on partnerships_citizen_a_id_fkey.
      const partnershipErr = await deletePartnershipsForCitizens(newbornIds);
      if (partnershipErr !== null) {
        errors.push(`delete test-turn partnerships: ${partnershipErr}`);
      }
      // Batched like every other id-filtered request here: a single `.in()` over
      // a full turn's newborns overflows the GET/DELETE request URL.
      const newbornErr = await deleteCitizensByIds(newbornIds);
      if (newbornErr !== null) {
        errors.push(`delete test-turn newborns: ${newbornErr}`);
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

  // 6. Restore citizen_assignments: delete all current seeded-world assignments and
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

// ---------------------------------------------------------------------------
// State captured once by the single end-turn call in beforeAll, then asserted
// on by focused, independent `it`s below. Splitting into one call + many
// small assertions (rather than one call + one mega-assertion) keeps this
// test's DB round trips to a minimum (advancing the seeded world's turn
// counter twice per run would require a second capture/restore cycle) while
// still giving each concern its own pass/fail signal.
// ---------------------------------------------------------------------------
let responseStatus = 0;
let responseBody: unknown;
let transitionId = "";
let worldTurnAfter: number | null | undefined;
let transitionRow:
  | { id: string; status: string; forecast_snapshot_jsonb: unknown }
  | null
  | undefined;
let forecastBySettlement: Record<string, unknown> = {};
const settlementSnapshotCounts = new Map<string, number>();
let totalDepositRemainingAfter = 0;
let populationRowsAfter: { id: string; current_count: number }[] = [];
let totalConstructionProgressAfter = 0;
let notifCountAfter: number | null | undefined;
let transitionStatusAfterWorker: string | null = null;

// Polls until the background worker drives the transition to a terminal
// status. Throws rather than silently asserting against a half-run turn.
async function waitForTransitionToFinish(id: string): Promise<string> {
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    const { data } = await svc
      .from("turn_transitions")
      .select("status")
      .eq("id", id)
      .single();
    const status = data?.status as string | undefined;

    if (status !== undefined && status !== "running") {
      return status;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`turn transition ${id} did not finish within 120s`);
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

    // -----------------------------------------------------------------------
    // Call the edge function ONCE as the seeded super admin, advancing the
    // live turn (expectedTurnNumber MUST equal current_turn_number or it
    // 409s). The response and every follow-up read used by the `it`s below
    // are captured here rather than in each `it`, since a second call would
    // advance the world a second turn and require a second capture/restore
    // cycle — the `it`s below only assert on data captured in this one pass.
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
    responseStatus = response.status;

    if (response.status !== 202) {
      const responseText = await response.text();
      throw new Error(
        `end-turn-simulation request failed: ${response.status} ${response.statusText} ${responseText}`,
      );
    }

    // #1278: the request only queues the turn. The pipeline runs in the
    // turn-worker function, so every assertion below is against what that
    // worker produced -- this is the end-to-end proof that the background
    // host yields the same transition the inline path used to.
    responseBody = (await response.json()) as unknown;
    transitionId = (
      responseBody as {
        data: { transitionId: string };
      }
    ).data.transitionId;

    transitionStatusAfterWorker = await waitForTransitionToFinish(transitionId);

    // World turn after the call.
    const { data: world } = await svc
      .from("worlds")
      .select("current_turn_number")
      .eq("id", WORLD_ID)
      .single();
    worldTurnAfter = world?.current_turn_number as number | null | undefined;

    // The completed turn_transitions row for this call.
    const { data: fetchedTransitionRow } = await svc
      .from("turn_transitions")
      .select("id,status,forecast_snapshot_jsonb")
      .eq("id", transitionId)
      .single();
    transitionRow = fetchedTransitionRow;
    const forecast = transitionRow?.forecast_snapshot_jsonb as {
      bySettlement?: Record<string, unknown>;
    };
    forecastBySettlement = forecast?.bySettlement ?? {};

    // Settlement-turn-snapshot counts per seeded settlement for this transition.
    for (const settlementId of SETTLEMENT_IDS) {
      const { count } = await svc
        .from("settlement_turn_snapshots")
        .select("id", { count: "exact", head: true })
        .eq("turn_transition_id", transitionId)
        .eq("settlement_id", settlementId);
      settlementSnapshotCounts.set(settlementId, count ?? 0);
    }

    // Total deposit remaining_quantity across the seeded settlements after the call.
    const depositIds = (tableSnapshots["deposit_instances"] ?? []).map(
      (d) => (d as { id: string }).id,
    );
    const { rows: depRows } = await selectByIds(
      "deposit_instance_resources",
      "deposit_instance_id",
      depositIds,
      "remaining_quantity",
    );
    const depositRemainingRows = depRows as unknown as {
      remaining_quantity: number;
    }[];
    totalDepositRemainingAfter = depositRemainingRows.reduce(
      (sum, r) => sum + Number(r.remaining_quantity),
      0,
    );

    // Managed-population counts after the call.
    const { rows: popRows } = await selectByIds(
      "managed_population_instances",
      "settlement_id",
      SETTLEMENT_IDS,
      "id,current_count",
    );
    populationRowsAfter = popRows as unknown as typeof populationRowsAfter;

    // Total construction progress after the call.
    const { rows: projRows } = await selectByIds(
      "construction_projects",
      "settlement_id",
      SETTLEMENT_IDS,
      "progress_worker_turns,status",
    );
    totalConstructionProgressAfter = projRows.reduce(
      (sum, r) =>
        sum +
        Number((r as { progress_worker_turns: number }).progress_worker_turns),
      0,
    );

    // Notifications emitted for the seeded world, visible to the super admin (all
    // super admins are always recipients).
    const { count: fetchedNotifCount } = await anon
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("world_id", WORLD_ID);
    notifCountAfter = fetchedNotifCount;
  }, 180_000);

  it("returns 202 with the queued job and transition ids", () => {
    expect(responseStatus).toBe(202);
    expect(responseBody).toMatchObject({
      ok: true,
      data: {
        transitionId,
        worldId: WORLD_ID,
      },
    });
    expect((responseBody as { data: { jobId: string } }).data.jobId).toEqual(
      expect.any(String),
    );
  });

  it("completes the transition in the background worker", () => {
    expect(transitionStatusAfterWorker).toBe("completed");
  });

  it("increments the world's current_turn_number", () => {
    expect(worldTurnAfter).toBe(startTurn + 1);
  });

  it("marks the turn_transitions row completed with the response's transitionId", () => {
    expect(transitionRow?.id).toBe(transitionId);
    expect(transitionRow?.status).toBe("completed");
  });

  it("populates a forecast snapshot for every seeded settlement", () => {
    expect(transitionRow?.forecast_snapshot_jsonb).toBeDefined();
    expect(transitionRow?.forecast_snapshot_jsonb).not.toBeNull();
    expect(forecastBySettlement).toBeDefined();
    const forecastSettlementIds = Object.keys(forecastBySettlement);
    expect(forecastSettlementIds.length).toBeGreaterThanOrEqual(
      SETTLEMENT_IDS.length,
    );
    for (const settlementId of SETTLEMENT_IDS) {
      expect(forecastSettlementIds).toContain(settlementId);
    }
  });

  it("shapes each settlement's forecast with the required fields", () => {
    for (const [settlementId, settlementForecast] of Object.entries(
      forecastBySettlement,
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
  });

  it("writes at least one settlement_turn_snapshot per seeded settlement", () => {
    for (const settlementId of SETTLEMENT_IDS) {
      expect(
        settlementSnapshotCounts.get(settlementId),
        `snapshot missing for settlement ${settlementId}`,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it("decreases total deposit remaining_quantity (staffed deposits extract each turn)", () => {
    expect(totalDepositRemainingAfter).toBeLessThan(baselineDepositRemaining);
  });

  it("changes at least one managed-population count", () => {
    const someCountChanged = populationRowsAfter.some((row) => {
      const baseline = baselinePopulationCounts.get(row.id);
      return baseline !== undefined && Number(row.current_count) !== baseline;
    });
    expect(someCountChanged).toBe(true);
  });

  it("does not decrease total construction progress", () => {
    // Worker-turns may reset to 0 on completion, so be tolerant and assert
    // >=: this also accepts the case where a previously in-progress project
    // completed during the test turn.
    expect(totalConstructionProgressAfter).toBeGreaterThanOrEqual(
      baselineConstructionProgress,
    );
  });

  it("emits at least one notification for the world", () => {
    expect(notifCountAfter).toBeGreaterThanOrEqual(1);
  });

  // Leave the shared local database close to its canonical seed state so
  // the pgTAP seed-topology tests (and any later run) see an unmutated seeded world.
  afterAll(async () => {
    const teardownErrors = await restoreWorldToCapturedState();
    if (teardownErrors.length > 0) {
      throw new Error(
        `Integration test teardown failed:\n${teardownErrors.map((e) => `  - ${e}`).join("\n")}`,
      );
    }
    // 60s, not 30s: the restore undoes a turn the background worker applied
    // in full, and on a loaded machine the batched id-filtered deletes were
    // already running close to the old budget.
  }, 60_000);
});
