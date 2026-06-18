// Integration test: each bundled scenario produces a world that completes turn 1.
//
// Requires a running local Supabase instance (`npx supabase start`) with `seed.sql` loaded.
// Fails if the local API is unreachable.
//
// Run with: npm run test:integration (VITEST_INTEGRATION=true)

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database, Json } from "@/types/database";

import { BUNDLED_SCENARIOS } from "./bundledScenarios";

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

const SUPER_ADMIN_EMAIL = "superadmin@gubernator.local";
const SUPER_ADMIN_PASSWORD = "password123";

// Service-role client: bypasses RLS, used for cleanup only.
const svc = createClient(LOCAL_URL, LOCAL_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
    storageKey: "scenario-integration-service",
  },
});

// Anon client: used to sign in as the seeded super admin.
const anon = createClient(LOCAL_URL, LOCAL_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
    storageKey: "scenario-integration-anon",
  },
});

// ---------------------------------------------------------------------------
// Test state populated in beforeAll
// ---------------------------------------------------------------------------
let accessToken = "";
// World IDs created during the test run; cleaned up in afterAll.
const createdWorldIds: string[] = [];

describe("bundled scenario turn-1 integration", () => {
  beforeAll(async () => {
    // Probe local Supabase REST API.
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

    // Probe the end-turn-simulation edge function.
    let fnProbe: Response;
    try {
      fnProbe = await fetch(`${LOCAL_URL}/functions/v1/end-turn-simulation`, {
        method: "OPTIONS",
        signal: AbortSignal.timeout(5_000),
      });
    } catch (error) {
      throw new Error(
        `end-turn-simulation edge probe failed: ${String(error)}`,
        { cause: error },
      );
    }
    if (!fnProbe.ok) {
      const responseText = await fnProbe.text();
      throw new Error(
        `end-turn-simulation edge probe failed: ${fnProbe.status} ${fnProbe.statusText} ${responseText}`,
      );
    }

    // Sign in as the seeded super admin.
    const { data: authData, error: authErr } =
      await anon.auth.signInWithPassword({
        email: SUPER_ADMIN_EMAIL,
        password: SUPER_ADMIN_PASSWORD,
      });
    if (authErr !== null) {
      throw new Error(`sign in failed: ${authErr.message}`);
    }
    if (authData.session === null) {
      throw new Error("sign in: session is null");
    }
    accessToken = authData.session.access_token;
  }, 30_000);

  // ---------------------------------------------------------------------------
  // One test per bundled scenario
  // ---------------------------------------------------------------------------
  it.each(BUNDLED_SCENARIOS.map((s) => [s.id, s] as const))(
    "scenario '%s' produces a world that completes turn 1",
    async (_id, scenario) => {
      // Authenticated client for this test run.
      // Typed as SupabaseClient<Database> so it satisfies GubernatorSupabaseClient
      // in the topology generator signature.
      const auth = createClient<Database>(LOCAL_URL, LOCAL_ANON_KEY, {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
          storageKey: `scenario-integration-auth-${scenario.id}`,
        },
        global: {
          headers: { authorization: `Bearer ${accessToken}` },
        },
      });

      // ------------------------------------------------------------------
      // 1. Import template → create world (superadmin becomes world admin
      //    via the worlds_insert_creator_as_admin after-insert trigger).
      // ------------------------------------------------------------------
      const { data: worldRow, error: importErr } = await auth
        .rpc("import_world_from_template", {
          p_name: `[test] ${scenario.name}`,
          p_visibility: "private",
          p_template: scenario.template as unknown as Json,
        })
        .maybeSingle<{ id: string; current_turn_number: number }>();

      expect(
        importErr,
        `import_world_from_template failed: ${importErr?.message}`,
      ).toBeNull();
      if (worldRow === null)
        throw new Error("import_world_from_template: no row returned");

      const worldId = worldRow.id;
      const startTurn = worldRow.current_turn_number;
      createdWorldIds.push(worldId);

      // ------------------------------------------------------------------
      // 2. Run topology generator (creates nations, settlements, citizens).
      // ------------------------------------------------------------------
      await expect(
        scenario.generateTopology(auth, worldId),
      ).resolves.not.toThrow();

      // ------------------------------------------------------------------
      // 3. Call end-turn-simulation.
      // ------------------------------------------------------------------
      const response = await fetch(
        `${LOCAL_URL}/functions/v1/end-turn-simulation`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            worldId,
            expectedTurnNumber: startTurn,
          }),
        },
      );

      if (response.status !== 200) {
        const responseText = await response.text();
        throw new Error(
          `end-turn-simulation failed for scenario '${scenario.id}': ` +
            `${response.status} ${response.statusText} ${responseText}`,
        );
      }

      const body: unknown = await response.json();
      expect(body).toMatchObject({
        ok: true,
        data: {
          worldId,
          summary: {
            fromTurnNumber: startTurn,
            toTurnNumber: startTurn + 1,
          },
        },
      });

      // ------------------------------------------------------------------
      // 4. Verify world turn incremented in the DB.
      // ------------------------------------------------------------------
      const { data: world } = await svc
        .from("worlds")
        .select("current_turn_number")
        .eq("id", worldId)
        .single();
      expect(world?.current_turn_number).toBe(startTurn + 1);
    },
    60_000,
  );

  // ---------------------------------------------------------------------------
  // Cleanup: trash + hard-delete every world created during the test run.
  // Runs even if tests failed so ephemeral worlds don't accumulate.
  // ---------------------------------------------------------------------------
  afterAll(async () => {
    const teardownErrors: string[] = [];
    for (const worldId of createdWorldIds) {
      const { error: trashErr } = await svc.rpc("trash_world", {
        p_world_id: worldId,
      });
      if (trashErr !== null)
        teardownErrors.push(`trash world ${worldId}: ${trashErr.message}`);

      const { error: deleteErr } = await svc.rpc("hard_delete_world", {
        p_world_id: worldId,
      });
      if (deleteErr !== null)
        teardownErrors.push(
          `hard delete world ${worldId}: ${deleteErr.message}`,
        );
    }
    if (teardownErrors.length > 0) {
      throw new Error(
        `Scenario integration teardown errors:\n${teardownErrors.map((e) => `  - ${e}`).join("\n")}`,
      );
    }
  }, 30_000);
});
