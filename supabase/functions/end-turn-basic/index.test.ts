import { afterEach, describe, expect, it, vi } from "vitest";

import {
  handleEndTurnBasicRequest,
  resolveSupabaseEndTurnAuthorization,
  resolveSupabaseEndTurnTransitionInput,
  type EndTurnBasicAuthContextResult,
  type EndTurnBasicAuthorizationResult,
  type EndTurnBasicTransitionInputResult,
} from "./index";

type EndTurnBasicTransitionInput = Extract<
  EndTurnBasicTransitionInputResult,
  { readonly ok: true }
>["input"];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("handleEndTurnBasicRequest", () => {
  it("returns a typed error response for an invalid request body", async () => {
    const resolveAuthContext = vi.fn<
      () => Promise<EndTurnBasicAuthContextResult>
    >(() =>
      Promise.resolve({
        context: {
          userId: "user-1",
        },
        ok: true,
      }),
    );

    const response = await handleEndTurnBasicRequest(
      createJsonRequest({
        expectedTurnNumber: "1",
        worldId: "",
      }),
      {
        resolveAuthContext,
      },
    );

    const responseBody: unknown = await response.json();

    expect(response.status).toBe(400);
    expect(responseBody).toEqual({
      error: {
        code: "invalid_request",
        details: ["worldId", "expectedTurnNumber"],
        message: "Request body must include worldId and expectedTurnNumber.",
      },
      ok: false,
    });
    expect(resolveAuthContext).not.toHaveBeenCalled();
  });

  it("returns a typed error response for malformed JSON", async () => {
    const response = await handleEndTurnBasicRequest(
      new Request("http://localhost/end-turn-basic", {
        body: "{",
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );

    const responseBody: unknown = await response.json();

    expect(response.status).toBe(400);
    expect(responseBody).toEqual({
      error: {
        code: "invalid_request",
        details: ["body"],
        message: "Request body must be valid JSON.",
      },
      ok: false,
    });
  });

  it("returns a typed error response for an unauthenticated request", async () => {
    const response = await handleEndTurnBasicRequest(
      createJsonRequest({
        expectedTurnNumber: 3,
        worldId: "world-1",
      }),
    );

    const responseBody: unknown = await response.json();

    expect(response.status).toBe(401);
    expect(responseBody).toEqual({
      error: {
        code: "unauthenticated",
        message: "An authenticated Supabase session is required.",
      },
      ok: false,
    });
  });

  it("returns a success response when authorization allows ending the turn", async () => {
    const resolveAuthorization = vi.fn<
      () => Promise<EndTurnBasicAuthorizationResult>
    >(() => Promise.resolve({ ok: true }));
    const resolveTransitionInput = vi.fn<
      () => Promise<EndTurnBasicTransitionInputResult>
    >(() => Promise.resolve(createTransitionInputResult()));

    const response = await handleEndTurnBasicRequest(
      createJsonRequest({
        expectedTurnNumber: 3,
        worldId: "world-1",
      }),
      {
        resolveAuthContext: createResolveAuthContext("user-1"),
        resolveAuthorization,
        resolveTransitionInput,
      },
    );

    const responseBody: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(responseBody).toEqual({
      data: {
        actorId: "user-1",
        expectedTurnNumber: 3,
        worldId: "world-1",
      },
      ok: true,
    });
    expect(resolveAuthorization).toHaveBeenCalledWith(
      {
        expectedTurnNumber: 3,
        worldId: "world-1",
      },
      {
        userId: "user-1",
      },
    );
    expect(resolveTransitionInput).toHaveBeenCalledWith(
      {
        expectedTurnNumber: 3,
        worldId: "world-1",
      },
      {
        userId: "user-1",
      },
    );
  });

  it("returns a safe authorization error when authorization denies ending the turn", async () => {
    const response = await handleEndTurnBasicRequest(
      createJsonRequest({
        expectedTurnNumber: 3,
        worldId: "world-1",
      }),
      {
        resolveAuthContext: createResolveAuthContext("user-1"),
        resolveAuthorization: () =>
          Promise.resolve({
            error: {
              error: {
                code: "unauthorized",
                message: "End turn is unavailable for this world.",
              },
              ok: false,
            },
            ok: false,
            status: 403,
          }),
      },
    );

    const responseBody: unknown = await response.json();

    expect(response.status).toBe(403);
    expect(responseBody).toEqual({
      error: {
        code: "unauthorized",
        message: "End turn is unavailable for this world.",
      },
      ok: false,
    });
  });

  it("rejects archived worlds before writes", async () => {
    const response = await handleEndTurnBasicRequest(
      createJsonRequest({
        expectedTurnNumber: 3,
        worldId: "world-1",
      }),
      {
        resolveAuthContext: createResolveAuthContext("user-1"),
        resolveAuthorization: () => Promise.resolve({ ok: true }),
        resolveTransitionInput: () =>
          Promise.resolve(
            createTransitionInputResult({
              isWorldArchived: true,
            }),
          ),
      },
    );

    const responseBody: unknown = await response.json();

    expect(response.status).toBe(409);
    expect(responseBody).toEqual({
      error: {
        code: "end_turn_world_archived",
        message: "Archived worlds cannot advance turns.",
      },
      ok: false,
    });
  });

  it("rejects a stale expected turn before writes", async () => {
    const response = await handleEndTurnBasicRequest(
      createJsonRequest({
        expectedTurnNumber: 3,
        worldId: "world-1",
      }),
      {
        resolveAuthContext: createResolveAuthContext("user-1"),
        resolveAuthorization: () => Promise.resolve({ ok: true }),
        resolveTransitionInput: () =>
          Promise.resolve(
            createTransitionInputResult({
              currentTurnNumber: 4,
            }),
          ),
      },
    );

    const responseBody: unknown = await response.json();

    expect(response.status).toBe(409);
    expect(responseBody).toEqual({
      error: {
        code: "end_turn_stale_expected_turn",
        message: "Expected current turn no longer matches the world state.",
      },
      ok: false,
    });
  });
});

describe("resolveSupabaseEndTurnTransitionInput", () => {
  it("loads world state, validated calendar config, and settlement readiness rows", async () => {
    const fetchMock = stubSupabaseRuntimeFetch([
      {
        body: [
          {
            calendar_config_json: createCalendarConfig(),
            current_turn_number: 3,
            id: "00000000-0000-0000-0000-000000000001",
            status: "active",
          },
        ],
        status: 200,
      },
      {
        body: [
          {
            auto_ready_enabled: false,
            id: "00000000-0000-0000-0000-000000000101",
            is_ready_current_turn: true,
          },
          {
            auto_ready_enabled: true,
            id: "00000000-0000-0000-0000-000000000102",
            is_ready_current_turn: false,
          },
        ],
        status: 200,
      },
    ]);

    const result = await resolveSupabaseEndTurnTransitionInput(
      {
        expectedTurnNumber: 3,
        worldId: "00000000-0000-0000-0000-000000000001",
      },
      {
        authorizationHeader: "Bearer token",
        userId: "user-1",
      },
    );

    expect(result).toEqual({
      input: {
        actorId: "user-1",
        calendarConfig: createCalendarConfig(),
        currentTurnNumber: 3,
        expectedCurrentTurnNumber: 3,
        isWorldArchived: false,
        readinessRows: [
          {
            autoReadyEnabled: false,
            id: "00000000-0000-0000-0000-000000000101",
            isReadyCurrentTurn: true,
          },
          {
            autoReadyEnabled: true,
            id: "00000000-0000-0000-0000-000000000102",
            isReadyCurrentTurn: false,
          },
        ],
        worldId: "00000000-0000-0000-0000-000000000001",
      },
      ok: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:54321/rest/v1/worlds?id=eq.00000000-0000-0000-0000-000000000001&limit=1&select=id%2Ccurrent_turn_number%2Cstatus%2Ccalendar_config_json",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:54321/rest/v1/settlements?nations.world_id=eq.00000000-0000-0000-0000-000000000001&order=id.asc&select=id%2Cauto_ready_enabled%2Cis_ready_current_turn%2Cnations%21inner%28%29",
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  it("returns a typed not-found error for a missing world", async () => {
    const fetchMock = stubSupabaseRuntimeFetch([
      {
        body: [],
        status: 200,
      },
    ]);

    const result = await resolveSupabaseEndTurnTransitionInput(
      {
        expectedTurnNumber: 3,
        worldId: "00000000-0000-0000-0000-000000000099",
      },
      {
        authorizationHeader: "Bearer token",
        userId: "user-1",
      },
    );

    expect(result).toEqual({
      error: {
        error: {
          code: "end_turn_world_not_found",
          message: "World is unavailable.",
        },
        ok: false,
      },
      ok: false,
      status: 404,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("resolveSupabaseEndTurnAuthorization", () => {
  it("allows a super admin when the world exists", async () => {
    const fetchMock = stubSupabaseRuntimeFetch([
      {
        body: true,
        status: 200,
      },
      {
        body: [{ id: "00000000-0000-0000-0000-000000000001" }],
        status: 200,
      },
    ]);

    const result = await resolveSupabaseEndTurnAuthorization(
      {
        expectedTurnNumber: 3,
        worldId: "00000000-0000-0000-0000-000000000001",
      },
      {
        authorizationHeader: "Bearer token",
        userId: "super-admin-user",
      },
    );

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:54321/rest/v1/rpc/is_super_admin",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:54321/rest/v1/worlds?id=eq.00000000-0000-0000-0000-000000000001&limit=1&select=id",
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  it("allows a world admin", async () => {
    stubSupabaseRuntimeFetch([
      {
        body: false,
        status: 200,
      },
      {
        body: true,
        status: 200,
      },
    ]);

    const result = await resolveSupabaseEndTurnAuthorization(
      {
        expectedTurnNumber: 3,
        worldId: "00000000-0000-0000-0000-000000000001",
      },
      {
        authorizationHeader: "Bearer token",
        userId: "world-admin-user",
      },
    );

    expect(result).toEqual({ ok: true });
  });

  it("denies a non-admin world-access user", async () => {
    stubSupabaseRuntimeFetch([
      {
        body: false,
        status: 200,
      },
      {
        body: false,
        status: 200,
      },
    ]);

    const result = await resolveSupabaseEndTurnAuthorization(
      {
        expectedTurnNumber: 3,
        worldId: "00000000-0000-0000-0000-000000000001",
      },
      {
        authorizationHeader: "Bearer token",
        userId: "world-access-user",
      },
    );

    expect(result).toEqual({
      error: {
        error: {
          code: "unauthorized",
          message: "End turn is unavailable for this world.",
        },
        ok: false,
      },
      ok: false,
      status: 403,
    });
  });

  it("denies an inactive user", async () => {
    stubSupabaseRuntimeFetch([
      {
        body: false,
        status: 200,
      },
      {
        body: false,
        status: 200,
      },
    ]);

    const result = await resolveSupabaseEndTurnAuthorization(
      {
        expectedTurnNumber: 3,
        worldId: "00000000-0000-0000-0000-000000000001",
      },
      {
        authorizationHeader: "Bearer token",
        userId: "inactive-user",
      },
    );

    expect(result).toEqual({
      error: {
        error: {
          code: "unauthorized",
          message: "End turn is unavailable for this world.",
        },
        ok: false,
      },
      ok: false,
      status: 403,
    });
  });

  it("returns a safe error for a missing world", async () => {
    stubSupabaseRuntimeFetch([
      {
        body: true,
        status: 200,
      },
      {
        body: [],
        status: 200,
      },
    ]);

    const result = await resolveSupabaseEndTurnAuthorization(
      {
        expectedTurnNumber: 3,
        worldId: "00000000-0000-0000-0000-000000000099",
      },
      {
        authorizationHeader: "Bearer token",
        userId: "super-admin-user",
      },
    );

    expect(result).toEqual({
      error: {
        error: {
          code: "unauthorized",
          message: "End turn is unavailable for this world.",
        },
        ok: false,
      },
      ok: false,
      status: 403,
    });
  });
});

function createJsonRequest(body: unknown): Request {
  return new Request("http://localhost/end-turn-basic", {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });
}

function createResolveAuthContext(
  userId: string,
): () => Promise<EndTurnBasicAuthContextResult> {
  return () =>
    Promise.resolve({
      context: {
        userId,
      },
      ok: true,
    });
}

function createTransitionInputResult(
  overrides: Partial<EndTurnBasicTransitionInput> = {},
): EndTurnBasicTransitionInputResult {
  return {
    input: {
      actorId: "user-1",
      calendarConfig: createCalendarConfig(),
      currentTurnNumber: 3,
      expectedCurrentTurnNumber: 3,
      isWorldArchived: false,
      readinessRows: [],
      worldId: "world-1",
      ...overrides,
    },
    ok: true,
  };
}

function createCalendarConfig(): EndTurnBasicTransitionInput["calendarConfig"] {
  return {
    months: [
      {
        dayCount: 2,
        index: 0,
        name: "Frostmonth",
      },
      {
        dayCount: 3,
        index: 1,
        name: "Rainmonth",
      },
    ],
    startingDayOfMonth: 1,
    startingMonthIndex: 0,
    startingWeekdayOffset: 0,
    startingYear: 12,
    weekdays: [
      {
        index: 0,
        name: "Moonday",
      },
      {
        index: 1,
        name: "Toilsday",
      },
    ],
    yearFormatTemplate: "Year {n}",
  };
}

function stubSupabaseRuntimeFetch(
  responses: readonly {
    readonly body: unknown;
    readonly status: number;
  }[],
): ReturnType<typeof vi.fn> {
  vi.stubGlobal("Deno", {
    env: {
      get: (name: string): string | undefined => {
        if (name === "SUPABASE_URL") {
          return "http://localhost:54321";
        }

        if (name === "SUPABASE_ANON_KEY") {
          return "anon-key";
        }

        return undefined;
      },
    },
  });

  let callIndex = 0;
  const fetchMock = vi.fn(() => {
    const response = responses[callIndex] ?? {
      body: {
        error: "Unexpected fetch call.",
      },
      status: 500,
    };
    callIndex += 1;

    return Promise.resolve(
      new Response(JSON.stringify(response.body), {
        status: response.status,
      }),
    );
  });

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}
