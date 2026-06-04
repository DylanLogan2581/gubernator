import { afterEach, describe, expect, it, vi } from "vitest";

import { handleEndTurnSimulationRequest } from "./index";

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WORLD_ID = "00000000-0000-0000-0000-000000000001";
const SETTLEMENT_ID = "00000000-0000-0000-0000-000000000002";
const FOOD_ID = "00000000-0000-0000-0000-000000000010";
const WATER_ID = "00000000-0000-0000-0000-000000000011";
const USER_ID = "00000000-0000-0000-0000-000000000100";
const TRANSITION_ID = "00000000-0000-0000-0000-000000000099";

function makeValidBody(): string {
  return JSON.stringify({ expectedTurnNumber: 5, worldId: WORLD_ID });
}

function makeWorldRow(): Record<string, unknown> {
  return {
    calendar_config_json: {
      dateFormatTemplate: "{year}",
      months: [{ dayCount: 30, index: 0, name: "First" }],
      startingDayOfMonth: 1,
      startingMonthIndex: 0,
      startingWeekdayOffset: 0,
      startingYear: 1,
      weekdays: [{ index: 0, name: "Day" }],
    },
    current_turn_number: 5,
    fertility_chance: 0.1,
    food_consumption_per_citizen: 1.0,
    homelessness_decline_rate: 0.2,
    id: WORLD_ID,
    incest_prevention_depth: 4,
    maximum_fertility_age_turns: null,
    minimum_partnership_age_turns: 18,
    mourning_period_turns: 3,
    npc_flavor_config_json: null,
    partnership_seek_chance: 0.3,
    starvation_severity_multiplier: 1.0,
    status: "active",
    water_consumption_per_citizen: 1.0,
  };
}

function makeSuccessSummary(): Record<string, unknown> {
  return {
    currentTurnNumber: 6,
    fromTurnNumber: 5,
    patchCounts: {
      buildingStateChanges: 0,
      citizenBirths: 0,
      citizenDeaths: 0,
    },
    toTurnNumber: 6,
    transitionId: TRANSITION_ID,
  };
}

function makeStateResponses(): Record<
  string,
  { body: unknown; status: number }
> {
  return {
    "/rest/v1/worlds": { body: [makeWorldRow()], status: 200 },
    "/rest/v1/settlements": {
      body: [{ id: SETTLEMENT_ID, name: "Settlement One", nations: {} }],
      status: 200,
    },
    "/rest/v1/resources": {
      body: [
        { id: FOOD_ID, slug: "food" },
        { id: WATER_ID, slug: "fresh-water" },
      ],
      status: 200,
    },
    "/rest/v1/settlement_stockpiles_view": { body: [], status: 200 },
    "/rest/v1/job_definitions": { body: [], status: 200 },
    "/rest/v1/building_blueprints": { body: [], status: 200 },
    "/rest/v1/settlement_buildings": { body: [], status: 200 },
    "/rest/v1/construction_projects": { body: [], status: 200 },
    "/rest/v1/deposit_types": { body: [], status: 200 },
    "/rest/v1/deposit_instances": { body: [], status: 200 },
    "/rest/v1/managed_population_types": { body: [], status: 200 },
    "/rest/v1/managed_population_instances": { body: [], status: 200 },
    "/rest/v1/trade_routes": { body: [], status: 200 },
    "/rest/v1/citizens": { body: [], status: 200 },
    "/rest/v1/events": { body: [], status: 200 },
    "/rest/v1/turn_log_entries": { body: [], status: 200 },
    "/rest/v1/citizen_assignments": { body: [], status: 200 },
    "/rest/v1/partnerships": { body: [], status: 200 },
  };
}

/** Stubs Deno.env with the keys all sub-modules require. */
function stubDenoEnv(): void {
  vi.stubGlobal("Deno", {
    env: {
      get: (name: string): string | undefined => {
        if (name === "SUPABASE_URL") return "http://localhost:54321";
        if (name === "SUPABASE_ANON_KEY") return "test-anon-key";
        return undefined;
      },
    },
  });
}

/**
 * Stubs global fetch to dispatch responses keyed on URL substrings.
 * First matching key wins; unmatched URLs return 500.
 */
function stubFetch(
  responses: Record<string, { body: unknown; status: number }>,
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((url: string): Promise<Response> => {
    const entry = Object.entries(responses).find(([pattern]) =>
      url.includes(pattern),
    );
    const { body, status } = entry?.[1] ?? {
      body: { error: `Unexpected fetch call: ${url}` },
      status: 500,
    };
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Stubs env + fetch for the complete happy-path cycle. */
function stubFullCycle(
  overrides: Record<string, { body: unknown; status: number }> = {},
): ReturnType<typeof vi.fn> {
  stubDenoEnv();
  return stubFetch({
    "/auth/v1/user": { body: { id: USER_ID }, status: 200 },
    "rpc/is_super_admin": { body: false, status: 200 },
    "rpc/is_world_admin": { body: true, status: 200 },
    "rpc/start_turn_transition": { body: TRANSITION_ID, status: 200 },
    "rpc/apply_turn_transition": { body: makeSuccessSummary(), status: 200 },
    ...makeStateResponses(),
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// CORS / method gate — these paths resolve before any async IO
// ---------------------------------------------------------------------------

describe("handleEndTurnSimulationRequest", () => {
  it("returns a 204 preflight response with CORS headers for OPTIONS", async () => {
    const response = await handleEndTurnSimulationRequest(
      new Request("http://localhost/end-turn-simulation", {
        method: "OPTIONS",
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(response.headers.get("access-control-allow-methods")).toContain(
      "POST",
    );
    expect(response.headers.get("access-control-allow-headers")).toContain(
      "authorization",
    );
    expect(response.headers.get("access-control-max-age")).toBe("86400");
  });

  it("returns a 204 preflight response with echoed origin for a recognized Origin", async () => {
    const response = await handleEndTurnSimulationRequest(
      new Request("http://localhost/end-turn-simulation", {
        headers: { origin: "http://localhost:5173" },
        method: "OPTIONS",
      }),
      { allowedOrigins: ["http://localhost:5173", "http://127.0.0.1:5173"] },
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:5173",
    );
    expect(response.headers.get("access-control-allow-methods")).toContain(
      "POST",
    );
    expect(response.headers.get("access-control-allow-headers")).toContain(
      "authorization",
    );
    expect(response.headers.get("access-control-max-age")).toBe("86400");
  });

  it("returns a 403 for an unrecognized Origin on OPTIONS", async () => {
    const response = await handleEndTurnSimulationRequest(
      new Request("http://localhost/end-turn-simulation", {
        headers: { origin: "http://evil.example.com" },
        method: "OPTIONS",
      }),
      { allowedOrigins: ["http://localhost:5173"] },
    );

    expect(response.status).toBe(403);
  });

  it("returns a 403 for an unrecognized Origin on POST", async () => {
    const response = await handleEndTurnSimulationRequest(
      new Request("http://localhost/end-turn-simulation", {
        body: JSON.stringify({ expectedTurnNumber: 1, worldId: "world-1" }),
        headers: {
          "content-type": "application/json",
          origin: "http://evil.example.com",
        },
        method: "POST",
      }),
      { allowedOrigins: ["http://localhost:5173"] },
    );

    expect(response.status).toBe(403);
  });

  it("returns a 405 for non-POST methods", async () => {
    const response = await handleEndTurnSimulationRequest(
      new Request("http://localhost/end-turn-simulation", { method: "GET" }),
    );

    const responseBody: unknown = await response.json();

    expect(response.status).toBe(405);
    expect(responseBody).toEqual({
      error: {
        code: "method_not_allowed",
        message: "Use POST to request an end-turn simulation.",
      },
      ok: false,
    });
  });

  it("echoes the allowed Origin in access-control-allow-origin header", async () => {
    const response = await handleEndTurnSimulationRequest(
      new Request("http://localhost/end-turn-simulation", {
        body: JSON.stringify({ expectedTurnNumber: 1, worldId: "world-1" }),
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:5173",
        },
        method: "POST",
      }),
      { allowedOrigins: ["http://localhost:5173"] },
    );

    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:5173",
    );
  });

  it("returns 400 for an invalid request body on POST", async () => {
    const response = await handleEndTurnSimulationRequest(
      new Request("http://localhost/end-turn-simulation", {
        body: "not-json",
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    const responseBody: unknown = await response.json();
    expect(response.status).toBe(400);
    expect(responseBody).toMatchObject({
      error: { code: "invalid_request" },
      ok: false,
    });
  });

  // -------------------------------------------------------------------------
  // Auth guards
  // -------------------------------------------------------------------------

  describe("auth guards", () => {
    it("returns 401 when no Authorization header is present", async () => {
      // No Deno env needed — missing header is rejected before any IO.
      const response = await handleEndTurnSimulationRequest(
        new Request("http://localhost/end-turn-simulation", {
          body: makeValidBody(),
          headers: { "content-type": "application/json" },
          method: "POST",
        }),
      );

      const responseBody: unknown = await response.json();
      expect(response.status).toBe(401);
      expect(responseBody).toMatchObject({
        error: { code: "unauthenticated" },
        ok: false,
      });
    });

    it("returns 401 when the Supabase auth endpoint rejects the token", async () => {
      stubDenoEnv();
      stubFetch({
        "/auth/v1/user": { body: { message: "Invalid token" }, status: 401 },
      });

      const response = await handleEndTurnSimulationRequest(
        new Request("http://localhost/end-turn-simulation", {
          body: makeValidBody(),
          headers: {
            authorization: "Bearer bad-token",
            "content-type": "application/json",
          },
          method: "POST",
        }),
      );

      const responseBody: unknown = await response.json();
      expect(response.status).toBe(401);
      expect(responseBody).toMatchObject({
        error: { code: "unauthenticated" },
        ok: false,
      });
    });

    it("returns 403 when the user is neither super admin nor world admin", async () => {
      stubDenoEnv();
      stubFetch({
        "/auth/v1/user": { body: { id: USER_ID }, status: 200 },
        "rpc/is_super_admin": { body: false, status: 200 },
        "rpc/is_world_admin": { body: false, status: 200 },
      });

      const response = await handleEndTurnSimulationRequest(
        new Request("http://localhost/end-turn-simulation", {
          body: makeValidBody(),
          headers: {
            authorization: "Bearer valid-token",
            "content-type": "application/json",
          },
          method: "POST",
        }),
      );

      const responseBody: unknown = await response.json();
      expect(response.status).toBe(403);
      expect(responseBody).toMatchObject({
        error: { code: "unauthorized" },
        ok: false,
      });
    });
  });

  // -------------------------------------------------------------------------
  // POST — happy path
  // -------------------------------------------------------------------------

  describe("POST — happy path", () => {
    it("returns 200 with actorId, worldId, and transition summary on success", async () => {
      stubFullCycle();

      const response = await handleEndTurnSimulationRequest(
        new Request("http://localhost/end-turn-simulation", {
          body: makeValidBody(),
          headers: {
            authorization: "Bearer valid-token",
            "content-type": "application/json",
          },
          method: "POST",
        }),
      );

      expect(response.status).toBe(200);

      const responseBody = (await response.json()) as {
        data: {
          actorId: string;
          summary: {
            currentTurnNumber: number;
            fromTurnNumber: number;
            patchCounts: Record<string, number>;
            toTurnNumber: number;
            transitionId: string;
          };
          worldId: string;
        };
        ok: boolean;
      };

      expect(responseBody.ok).toBe(true);
      expect(responseBody.data.actorId).toBe(USER_ID);
      expect(responseBody.data.worldId).toBe(WORLD_ID);

      const { summary } = responseBody.data;
      expect(summary.fromTurnNumber).toBe(5);
      expect(summary.toTurnNumber).toBe(6);
      expect(summary.currentTurnNumber).toBe(6);
      expect(summary.transitionId).toBe(TRANSITION_ID);
      expect(summary.patchCounts).toEqual({
        buildingStateChanges: 0,
        citizenBirths: 0,
        citizenDeaths: 0,
      });
    });

    it("content-type header is application/json on a 200 response", async () => {
      stubFullCycle();

      const response = await handleEndTurnSimulationRequest(
        new Request("http://localhost/end-turn-simulation", {
          body: makeValidBody(),
          headers: {
            authorization: "Bearer valid-token",
            "content-type": "application/json",
          },
          method: "POST",
        }),
      );

      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
    });

    it("returns 409 when the persist RPC reports an archived world", async () => {
      stubFullCycle({
        "rpc/apply_turn_transition": {
          body: {
            code: "P0001",
            hint: "world_archived",
            message: "world is archived and cannot be advanced",
          },
          status: 500,
        },
      });

      const response = await handleEndTurnSimulationRequest(
        new Request("http://localhost/end-turn-simulation", {
          body: makeValidBody(),
          headers: {
            authorization: "Bearer valid-token",
            "content-type": "application/json",
          },
          method: "POST",
        }),
      );

      const responseBody: unknown = await response.json();
      expect(response.status).toBe(409);
      expect(responseBody).toMatchObject({
        error: { code: "end_turn_world_archived" },
        ok: false,
      });
    });

    it("returns 409 when the persist RPC reports a stale expected turn", async () => {
      stubFullCycle({
        "rpc/apply_turn_transition": {
          body: {
            code: "P0001",
            hint: "stale_expected_turn",
            message: "stale expected turn number",
          },
          status: 500,
        },
      });

      const response = await handleEndTurnSimulationRequest(
        new Request("http://localhost/end-turn-simulation", {
          body: makeValidBody(),
          headers: {
            authorization: "Bearer valid-token",
            "content-type": "application/json",
          },
          method: "POST",
        }),
      );

      const responseBody: unknown = await response.json();
      expect(response.status).toBe(409);
      expect(responseBody).toMatchObject({
        error: { code: "end_turn_stale_expected_turn" },
        ok: false,
      });
    });
  });
});
