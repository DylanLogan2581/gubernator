import { afterEach, describe, expect, it, vi } from "vitest";

import { persistSimulationTransition } from "./persist";

import type { ApplyTurnTransitionPayload } from "./transition";
import type {
  EndTurnSimulationAuthContext,
  EndTurnSimulationRequestBody,
} from "./types";

afterEach(() => {
  vi.unstubAllGlobals();
});

const WORLD_ID = "00000000-0000-0000-0000-000000000001";
const ANON_KEY = "test-anon-key";
const USER_TOKEN = "test-user-access-token";
const SUPABASE_URL = "http://localhost:54321";

const TRANSITION_ID = "00000000-0000-0000-0000-000000000099";

function makeRequestBody(): EndTurnSimulationRequestBody {
  return { expectedTurnNumber: 5, worldId: WORLD_ID };
}

function makeAuthContext(
  overrides?: Partial<EndTurnSimulationAuthContext>,
): EndTurnSimulationAuthContext {
  return {
    authorizationHeader: `Bearer ${USER_TOKEN}`,
    userId: "00000000-0000-0000-0000-000000000001",
    ...overrides,
  };
}

function makeMinimalPayload(): ApplyTurnTransitionPayload {
  return {
    assignmentClears: [],
    bornOnTurnBackfill: [],
    buildingStateChanges: [],
    buildingsCreated: [],
    citizenBirths: [],
    citizenDeaths: [],
    constructionUpdates: [],
    depositUpdates: [],
    logEntries: [],
    managedPopulationUpdates: [],
    notifications: [],
    partnershipChanges: [],
    readinessSummary: {
      notReadySettlementCount: 1,
      readyPercentage: 0,
      readySettlementCount: 0,
      totalSettlementCount: 1,
    },
    settlementSnapshots: [],
    stockpileDeltas: [],
    tradeRouteOutcomes: [],
  };
}

function makeSuccessSummary(): Record<string, unknown> {
  return {
    currentTurnNumber: 6,
    fromTurnNumber: 5,
    patchCounts: { stockpileDeltas: 0, logEntries: 0 },
    toTurnNumber: 6,
    transitionId: TRANSITION_ID,
  };
}

function stubEnvAndFetch(
  fetchResponse: { body: unknown; status: number } | "fetch_throws",
  anonKey: string = ANON_KEY,
): ReturnType<typeof vi.fn> {
  vi.stubGlobal("Deno", {
    env: {
      get: (name: string): string | undefined => {
        if (name === "SUPABASE_URL") return SUPABASE_URL;
        if (name === "SUPABASE_ANON_KEY") return anonKey;
        return undefined;
      },
    },
  });

  const fetchMock = vi.fn((): Promise<Response> => {
    if (fetchResponse === "fetch_throws") {
      return Promise.reject(new Error("network error"));
    }
    return Promise.resolve(
      new Response(JSON.stringify(fetchResponse.body), {
        status: fetchResponse.status,
      }),
    );
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

// ---------------------------------------------------------------------------
// Success path
// ---------------------------------------------------------------------------

describe("persistSimulationTransition — success", () => {
  it("returns ok: true with summary on 200 from apply_turn_transition", async () => {
    stubEnvAndFetch({ body: makeSuccessSummary(), status: 200 });

    const result = await persistSimulationTransition(
      makeRequestBody(),
      makeMinimalPayload(),
      makeAuthContext(),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("type narrowing");

    expect(result.summary.transitionId).toBe(TRANSITION_ID);
    expect(result.summary.fromTurnNumber).toBe(5);
    expect(result.summary.toTurnNumber).toBe(6);
    expect(result.summary.currentTurnNumber).toBe(6);
    expect(result.summary.patchCounts).toBeDefined();
  });

  it("sends p_world_id, p_expected_turn_number, p_payload to the RPC", async () => {
    const fetchMock = stubEnvAndFetch({
      body: makeSuccessSummary(),
      status: 200,
    });

    await persistSimulationTransition(
      makeRequestBody(),
      makeMinimalPayload(),
      makeAuthContext(),
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toContain("/rest/v1/rpc/apply_turn_transition");
    expect(url).toContain(SUPABASE_URL);

    const sentBody = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(sentBody.p_world_id).toBe(WORLD_ID);
    expect(sentBody.p_expected_turn_number).toBe(5);
    expect(sentBody.p_payload).toBeDefined();
  });

  it("uses anon key and caller JWT in apikey and authorization headers", async () => {
    const fetchMock = stubEnvAndFetch({
      body: makeSuccessSummary(),
      status: 200,
    });

    await persistSimulationTransition(
      makeRequestBody(),
      makeMinimalPayload(),
      makeAuthContext(),
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;

    expect(headers["apikey"]).toBe(ANON_KEY);
    expect(headers["authorization"]).toBe(`Bearer ${USER_TOKEN}`);
  });
});

// ---------------------------------------------------------------------------
// Missing env / auth → transition_unavailable
// ---------------------------------------------------------------------------

describe("persistSimulationTransition — missing env", () => {
  it("returns end_turn_transition_unavailable when SUPABASE_ANON_KEY is absent", async () => {
    vi.stubGlobal("Deno", {
      env: {
        get: (name: string): string | undefined => {
          if (name === "SUPABASE_URL") return SUPABASE_URL;
          return undefined;
        },
      },
    });

    const result = await persistSimulationTransition(
      makeRequestBody(),
      makeMinimalPayload(),
      makeAuthContext(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("type narrowing");
    expect(result.error.error.code).toBe("end_turn_transition_unavailable");
    expect(result.status).toBe(500);
  });

  it("returns end_turn_transition_unavailable when authorizationHeader is absent", async () => {
    stubEnvAndFetch({ body: makeSuccessSummary(), status: 200 });

    const result = await persistSimulationTransition(
      makeRequestBody(),
      makeMinimalPayload(),
      makeAuthContext({ authorizationHeader: undefined }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("type narrowing");
    expect(result.error.error.code).toBe("end_turn_transition_unavailable");
    expect(result.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// Error code mapping
// ---------------------------------------------------------------------------

describe("persistSimulationTransition — error code mapping", () => {
  it("maps 42501 (insufficient_privilege) to unauthorized (403)", async () => {
    stubEnvAndFetch({
      body: { code: "42501", message: "insufficient privilege" },
      status: 403,
    });

    const result = await persistSimulationTransition(
      makeRequestBody(),
      makeMinimalPayload(),
      makeAuthContext(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("type narrowing");
    expect(result.error.error.code).toBe("unauthorized");
    expect(result.status).toBe(403);
  });

  it("maps P0001 with 'archived' to end_turn_world_archived (409)", async () => {
    stubEnvAndFetch({
      body: {
        code: "P0001",
        message: "world is archived and cannot be advanced",
      },
      status: 500,
    });

    const result = await persistSimulationTransition(
      makeRequestBody(),
      makeMinimalPayload(),
      makeAuthContext(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("type narrowing");
    expect(result.error.error.code).toBe("end_turn_world_archived");
    expect(result.status).toBe(409);
  });

  it("maps P0001 with 'stale' to end_turn_stale_expected_turn (409)", async () => {
    stubEnvAndFetch({
      body: { code: "P0001", message: "stale expected turn number" },
      status: 500,
    });

    const result = await persistSimulationTransition(
      makeRequestBody(),
      makeMinimalPayload(),
      makeAuthContext(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("type narrowing");
    expect(result.error.error.code).toBe("end_turn_stale_expected_turn");
    expect(result.status).toBe(409);
  });

  it("maps other P0001 errors to end_turn_transition_failed (500)", async () => {
    stubEnvAndFetch({
      body: {
        code: "P0001",
        message: "simulation engine may not kill a player character",
      },
      status: 500,
    });

    const result = await persistSimulationTransition(
      makeRequestBody(),
      makeMinimalPayload(),
      makeAuthContext(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("type narrowing");
    expect(result.error.error.code).toBe("end_turn_transition_failed");
    expect(result.status).toBe(500);
  });

  it("maps network failure to end_turn_transition_unavailable (500)", async () => {
    stubEnvAndFetch("fetch_throws");

    const result = await persistSimulationTransition(
      makeRequestBody(),
      makeMinimalPayload(),
      makeAuthContext(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("type narrowing");
    expect(result.error.error.code).toBe("end_turn_transition_unavailable");
    expect(result.status).toBe(500);
  });

  it("maps unrecognised RPC error code to end_turn_transition_unavailable (500)", async () => {
    stubEnvAndFetch({
      body: { code: "23505", message: "duplicate key value" },
      status: 409,
    });

    const result = await persistSimulationTransition(
      makeRequestBody(),
      makeMinimalPayload(),
      makeAuthContext(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("type narrowing");
    expect(result.error.error.code).toBe("end_turn_transition_unavailable");
    expect(result.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// Caller token not leaked in error messages
// ---------------------------------------------------------------------------

describe("persistSimulationTransition — caller token never leaked", () => {
  it("does not include the caller token in any error message", async () => {
    stubEnvAndFetch("fetch_throws");

    const result = await persistSimulationTransition(
      makeRequestBody(),
      makeMinimalPayload(),
      makeAuthContext(),
    );

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(USER_TOKEN);
  });

  it("does not include the caller token in the 42501 error message", async () => {
    stubEnvAndFetch({
      body: { code: "42501", message: "insufficient privilege" },
      status: 403,
    });

    const result = await persistSimulationTransition(
      makeRequestBody(),
      makeMinimalPayload(),
      makeAuthContext(),
    );

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(USER_TOKEN);
  });
});
