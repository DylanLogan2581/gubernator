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
      body: [
        {
          id: SETTLEMENT_ID,
          name: "Settlement One",
          nameset_id: null,
          nations: { nameset_id: null },
        },
      ],
      status: 200,
    },
    "/rest/v1/namesets": { body: [], status: 200 },
    "/rest/v1/resources": {
      body: [
        { decay_rate: 0, id: FOOD_ID, slug: "food" },
        { decay_rate: 0, id: WATER_ID, slug: "fresh-water" },
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
    "/rest/v1/event_effects": { body: [], status: 200 },
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
        if (name === "SUPABASE_SERVICE_ROLE_KEY")
          return "test-service-role-key";
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

  it("returns a 403 with error response for an unrecognized Origin on OPTIONS", async () => {
    const response = await handleEndTurnSimulationRequest(
      new Request("http://localhost/end-turn-simulation", {
        headers: { origin: "http://evil.example.com" },
        method: "OPTIONS",
      }),
      { allowedOrigins: ["http://localhost:5173"] },
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      error: {
        code: "origin_not_allowed",
        message: "Origin not allowed.",
      },
      ok: false,
    });
  });

  it("returns a 403 with error response for an unrecognized Origin on POST", async () => {
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

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      error: {
        code: "origin_not_allowed",
        message: "Origin not allowed.",
      },
      ok: false,
    });
  });

  it("allows a POST with no Origin header to proceed to auth checks", async () => {
    stubFullCycle();

    const response = await handleEndTurnSimulationRequest(
      new Request("http://localhost/end-turn-simulation", {
        body: makeValidBody(),
        headers: {
          authorization: "Bearer valid-token",
          "content-type": "application/json",
          // No Origin header — non-browser client
        },
        method: "POST",
      }),
      { allowedOrigins: ["http://localhost:5173"] },
    );

    // Should succeed (200), not fail at CORS check (403)
    expect(response.status).toBe(200);
    const responseBody = (await response.json()) as {
      data?: { actorId: string };
      ok?: boolean;
    };
    expect(responseBody.ok).toBe(true);
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

    it("preview mode returns a forecast without starting or applying a transition", async () => {
      const fetchMock = stubFullCycle();

      const response = await handleEndTurnSimulationRequest(
        new Request("http://localhost/end-turn-simulation", {
          body: JSON.stringify({
            expectedTurnNumber: 0,
            preview: true,
            worldId: WORLD_ID,
          }),
          headers: {
            authorization: "Bearer valid-token",
            "content-type": "application/json",
          },
          method: "POST",
        }),
      );

      expect(response.status).toBe(200);

      const responseBody = (await response.json()) as {
        data: { forecastSnapshot: { bySettlement: Record<string, unknown> } };
        ok: boolean;
      };
      expect(responseBody.ok).toBe(true);
      expect(typeof responseBody.data.forecastSnapshot.bySettlement).toBe(
        "object",
      );

      // No writes: neither the start nor the apply RPC may be invoked.
      const calledUrls = fetchMock.mock.calls.map((call) => String(call[0]));
      expect(
        calledUrls.some((url) => url.includes("rpc/start_turn_transition")),
      ).toBe(false);
      expect(
        calledUrls.some((url) => url.includes("rpc/apply_turn_transition")),
      ).toBe(false);
    });

    it("preview mode loads world state with the caller JWT", async () => {
      stubDenoEnv();

      // Capture authorization headers used for all PostgREST state entity calls.
      // Preview state loading must use the caller JWT (same as the real
      // end-turn). A service-role load was tried but settlement_stockpiles_view
      // delegates to a security-definer helper that RAISEs 'forbidden' without a
      // user context, so service-role reads fail with 42501.
      const stateEntityPaths = [
        "/rest/v1/worlds",
        "/rest/v1/settlements",
        "/rest/v1/citizens",
        "/rest/v1/resources",
        "/rest/v1/trade_routes",
        "/rest/v1/citizen_assignments",
      ];
      const capturedAuthByPath: { path: string; auth: string }[] = [];

      const stateResponses = makeStateResponses();
      const fetchMock = vi.fn(
        (url: string, init?: RequestInit): Promise<Response> => {
          // Capture auth header for state entity REST calls.
          const matchedPath = stateEntityPaths.find((p) => url.includes(p));
          // Exclude the single-field world-exists auth check (select=id only).
          // URLSearchParams encodes commas as %2C, so the state-load URL has
          // select=id%2Cstatus%2C... while the auth check has select=id alone.
          const isWorldExistsCheck =
            url.includes("/rest/v1/worlds") && url.includes("select=id") &&
            !url.includes("select=id%2C");
          if (matchedPath !== undefined && !isWorldExistsCheck) {
            const headers = init?.headers as Record<string, string> | undefined;
            const auth = headers?.authorization ?? headers?.Authorization ?? "";
            capturedAuthByPath.push({ path: matchedPath, auth });
          }

          // Route responses
          if (url.includes("/auth/v1/user")) {
            return Promise.resolve(
              new Response(JSON.stringify({ id: USER_ID }), { status: 200 }),
            );
          }
          // World-exists auth check: return world visible to the caller.
          if (isWorldExistsCheck) {
            return Promise.resolve(
              new Response(JSON.stringify([{ id: WORLD_ID }]), { status: 200 }),
            );
          }
          // All other state responses
          const entry = Object.entries(stateResponses).find(([pattern]) =>
            url.includes(pattern),
          );
          const { body, status } = entry?.[1] ?? {
            body: { error: `Unexpected fetch call: ${url}` },
            status: 500,
          };
          return Promise.resolve(
            new Response(JSON.stringify(body), { status }),
          );
        },
      );
      vi.stubGlobal("fetch", fetchMock);

      const response = await handleEndTurnSimulationRequest(
        new Request("http://localhost/end-turn-simulation", {
          body: JSON.stringify({
            expectedTurnNumber: 0,
            preview: true,
            worldId: WORLD_ID,
          }),
          headers: {
            authorization: "Bearer valid-token",
            "content-type": "application/json",
          },
          method: "POST",
        }),
      );

      expect(response.status).toBe(200);

      // All captured state-load calls must use the caller JWT, not service-role.
      expect(capturedAuthByPath.length).toBeGreaterThan(0);
      for (const { auth } of capturedAuthByPath) {
        expect(auth).toBe("Bearer valid-token");
      }
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

    it("gates archived world before calling state resolvers", async () => {
      stubDenoEnv();
      const fetchMock = vi.fn((url: string): Promise<Response> => {
        if (url.includes("/auth/v1/user")) {
          return Promise.resolve(
            new Response(JSON.stringify({ id: USER_ID }), { status: 200 }),
          );
        }
        if (url.includes("rpc/is_super_admin")) {
          return Promise.resolve(
            new Response(JSON.stringify(false), { status: 200 }),
          );
        }
        if (url.includes("rpc/is_world_admin")) {
          return Promise.resolve(
            new Response(JSON.stringify(true), { status: 200 }),
          );
        }
        if (url.includes("select=") && url.includes("status")) {
          return Promise.resolve(
            new Response(
              JSON.stringify([{ status: "archived", current_turn_number: 5 }]),
              { status: 200 },
            ),
          );
        }
        // State resolvers should not be called
        if (
          url.includes("/rest/v1/settlements") ||
          url.includes("/rest/v1/resources") ||
          url.includes("/rest/v1/citizens")
        ) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ error: "State resolvers should not be called" }),
              { status: 500 },
            ),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ error: "Unexpected call" }), {
            status: 500,
          }),
        );
      });
      vi.stubGlobal("fetch", fetchMock);

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

      // Verify no state resolver calls were made
      const stateResolverCalls = fetchMock.mock.calls.filter(
        ([url]) =>
          url.includes("/rest/v1/settlements") ||
          url.includes("/rest/v1/resources") ||
          url.includes("/rest/v1/citizens"),
      );
      expect(stateResolverCalls).toHaveLength(0);
    });

    // -------------------------------------------------------------------------
    // Rate limiting
    // -------------------------------------------------------------------------

    it("returns 429 with rate_limit_exceeded when rate limit is exceeded", async () => {
      stubDenoEnv();
      stubFetch({
        "/auth/v1/user": { body: { id: USER_ID }, status: 200 },
        "rpc/is_super_admin": { body: false, status: 200 },
        "rpc/is_world_admin": { body: true, status: 200 },
        "rpc/increment_rate_limit_bucket": { body: 11, status: 200 }, // exceeds 10/min limit
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
      expect(response.status).toBe(429);
      expect(responseBody).toMatchObject({
        error: { code: "rate_limit_exceeded" },
        ok: false,
      });
      expect(response.headers.get("retry-after")).not.toBeNull();
    });

    it("returns 429 with stable error message (no upstream detail)", async () => {
      stubDenoEnv();
      stubFetch({
        "/auth/v1/user": { body: { id: USER_ID }, status: 200 },
        "rpc/is_super_admin": { body: false, status: 200 },
        "rpc/is_world_admin": { body: true, status: 200 },
        "rpc/increment_rate_limit_bucket": { body: 100, status: 200 },
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

      const responseBody = (await response.json()) as {
        error: { code: string; message: string };
        ok: boolean;
      };
      expect(response.status).toBe(429);
      expect(responseBody.error.message).toBe(
        "Too many requests. Please wait before retrying.",
      );
    });

    it("succeeds normally when rate limit DB call fails (fail-open)", async () => {
      // Rate limit RPC returns 500 → fail open → request proceeds
      stubFullCycle({
        "rpc/increment_rate_limit_bucket": {
          body: { error: "rate limit DB unavailable" },
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

      expect(response.status).toBe(200);
      const responseBody = (await response.json()) as { ok: boolean };
      expect(responseBody.ok).toBe(true);
    });

    // -------------------------------------------------------------------------
    // Error sanitization (#733 lineage): upstream error detail must not leak
    // -------------------------------------------------------------------------

    it("returns stable unauthenticated code when auth service returns error detail", async () => {
      // GoTrue may include internal details in its error response body.
      // The client must only see the stable code, never the upstream message.
      stubDenoEnv();
      stubFetch({
        "/auth/v1/user": {
          body: {
            message:
              "JWT expired. Internal detail: token hash mismatch at claim row 42",
            status: 401,
          },
          status: 401,
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

      const responseBody = (await response.json()) as {
        error: { code: string; message: string };
        ok: boolean;
      };

      expect(response.status).toBe(401);
      expect(responseBody.ok).toBe(false);
      expect(responseBody.error.code).toBe("unauthenticated");
      // Raw GoTrue message must never reach the client.
      expect(responseBody.error.message).not.toContain("JWT expired");
      expect(responseBody.error.message).not.toContain("token hash mismatch");
      expect(responseBody.error.message).not.toContain("claim row 42");
    });

    it("never reflects RPC error body to client when transition start fails", async () => {
      // #733 lineage: internal DB error messages must not be forwarded to clients.
      // The RPC may return arbitrary messages; only stable codes reach the client.
      const internalDbMessage =
        "Database deadlock detected at table turn_transitions row 42, transaction id 9876543";

      stubFullCycle({
        "rpc/start_turn_transition": {
          body: { code: "40P01", message: internalDbMessage },
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

      const responseBody = (await response.json()) as {
        error: { code: string; message: string };
        ok: boolean;
      };

      expect(response.status).toBe(500);
      expect(responseBody.ok).toBe(false);
      // Stable error code — never the raw RPC code
      expect(responseBody.error.code).not.toBe("40P01");
      // Internal DB message must never appear in client response
      expect(responseBody.error.message).not.toContain(internalDbMessage);
      expect(responseBody.error.message).not.toContain("deadlock");
      expect(responseBody.error.message).not.toContain("row 42");
    });

    it("gates stale turn before calling state resolvers", async () => {
      stubDenoEnv();
      const fetchMock = vi.fn((url: string): Promise<Response> => {
        if (url.includes("/auth/v1/user")) {
          return Promise.resolve(
            new Response(JSON.stringify({ id: USER_ID }), { status: 200 }),
          );
        }
        if (url.includes("rpc/is_super_admin")) {
          return Promise.resolve(
            new Response(JSON.stringify(false), { status: 200 }),
          );
        }
        if (url.includes("rpc/is_world_admin")) {
          return Promise.resolve(
            new Response(JSON.stringify(true), { status: 200 }),
          );
        }
        if (url.includes("select=") && url.includes("status")) {
          return Promise.resolve(
            new Response(
              JSON.stringify([{ status: "active", current_turn_number: 10 }]),
              { status: 200 },
            ),
          );
        }
        // State resolvers should not be called
        if (
          url.includes("/rest/v1/settlements") ||
          url.includes("/rest/v1/resources") ||
          url.includes("/rest/v1/citizens")
        ) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ error: "State resolvers should not be called" }),
              { status: 500 },
            ),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ error: "Unexpected call" }), {
            status: 500,
          }),
        );
      });
      vi.stubGlobal("fetch", fetchMock);

      const response = await handleEndTurnSimulationRequest(
        new Request("http://localhost/end-turn-simulation", {
          body: makeValidBody(), // expects turn 5 but world is at turn 10
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

      // Verify no state resolver calls were made
      const stateResolverCalls = fetchMock.mock.calls.filter(
        ([url]) =>
          url.includes("/rest/v1/settlements") ||
          url.includes("/rest/v1/resources") ||
          url.includes("/rest/v1/citizens"),
      );
      expect(stateResolverCalls).toHaveLength(0);
    });
  });
});
