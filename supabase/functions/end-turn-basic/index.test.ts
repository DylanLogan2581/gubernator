import { afterEach, describe, expect, it, vi } from "vitest";

import {
  handleEndTurnBasicRequest,
  persistSupabaseRunningTransition,
  resolveSupabaseEndTurnAuthorization,
  resolveSupabaseEndTurnTransitionInput,
  type EndTurnBasicAuthContextResult,
  type EndTurnBasicAuthorizationResult,
  type EndTurnBasicPersistRunningTransitionResult,
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

  it("returns the dry-write transition result when authorization allows ending the turn", async () => {
    const resolveAuthorization = vi.fn<
      () => Promise<EndTurnBasicAuthorizationResult>
    >(() => Promise.resolve({ ok: true }));
    const resolveTransitionInput = vi.fn<
      () => Promise<EndTurnBasicTransitionInputResult>
    >(() =>
      Promise.resolve(
        createTransitionInputResult({
          readinessRows: [
            {
              autoReadyEnabled: false,
              id: "settlement-1",
              isReadyCurrentTurn: true,
            },
            {
              autoReadyEnabled: false,
              id: "settlement-2",
              isReadyCurrentTurn: false,
            },
          ],
        }),
      ),
    );
    const persistRunningTransition = vi.fn<
      () => Promise<EndTurnBasicPersistRunningTransitionResult>
    >(() =>
      Promise.resolve({
        ok: true,
        transition: {
          fromTurnNumber: 3,
          id: "transition-1",
          initiatedByUserId: "user-1",
          startedAt: "2026-05-03T10:00:00.000Z",
          status: "running",
          toTurnNumber: 4,
          worldId: "world-1",
        },
      }),
    );

    const response = await handleEndTurnBasicRequest(
      createJsonRequest({
        expectedTurnNumber: 3,
        worldId: "world-1",
      }),
      {
        resolveAuthContext: createResolveAuthContext("user-1"),
        resolveAuthorization,
        resolveTransitionInput,
        persistRunningTransition,
      },
    );

    const responseBody: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(responseBody).toEqual({
      data: {
        actorId: "user-1",
        transition: {
          nextDate: {
            dayOfMonth: 2,
            monthIndex: 1,
            monthName: "Rainmonth",
            turnNumber: 4,
            weekdayIndex: 1,
            weekdayName: "Toilsday",
            year: 12,
          },
          nextTurnNumber: 4,
          previousDate: {
            dayOfMonth: 1,
            monthIndex: 1,
            monthName: "Rainmonth",
            turnNumber: 3,
            weekdayIndex: 0,
            weekdayName: "Moonday",
            year: 12,
          },
          previousTurnNumber: 3,
          readinessSummary: {
            notReadySettlementCount: 1,
            readyPercentage: 50,
            readySettlementCount: 1,
            totalSettlementCount: 2,
          },
        },
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
    expect(persistRunningTransition).toHaveBeenCalledOnce();
    expect(persistRunningTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "user-1",
        currentTurnNumber: 3,
        worldId: "world-1",
      }),
      expect.objectContaining({
        fromTurnNumber: 3,
        toTurnNumber: 4,
      }),
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

describe("persistSupabaseRunningTransition", () => {
  it("advances the world one turn and returns the running transition", async () => {
    const fetchMock = stubSupabaseRuntimeFetch([
      {
        body: [
          createRunningTransitionRow({
            from_turn_number: 3,
            initiated_by_user_id: "user-1",
            to_turn_number: 4,
            world_id: "00000000-0000-0000-0000-000000000001",
          }),
        ],
        status: 201,
      },
    ]);

    const result = await persistSupabaseRunningTransition(
      createTransitionInput({
        actorId: "user-1",
        worldId: "00000000-0000-0000-0000-000000000001",
      }),
      createPlannedTransition({ fromTurnNumber: 3, toTurnNumber: 4 }),
      {
        authorizationHeader: "Bearer token",
        userId: "user-1",
      },
    );

    expect(result).toEqual({
      ok: true,
      transition: {
        fromTurnNumber: 3,
        id: "00000000-0000-0000-0000-000000000201",
        initiatedByUserId: "user-1",
        startedAt: "2026-05-03T10:00:00.000Z",
        status: "running",
        toTurnNumber: 4,
        worldId: "00000000-0000-0000-0000-000000000001",
      },
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:54321/rest/v1/rpc/advance_world_turn_if_current",
      expect.objectContaining({
        body: JSON.stringify({
          p_expected_turn_number: 3,
          p_world_id: "00000000-0000-0000-0000-000000000001",
        }),
        headers: {
          apikey: "anon-key",
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );
  });

  it("returns a stale expected turn error when the atomic advance affects no rows", async () => {
    const fetchMock = stubSupabaseRuntimeFetch([
      {
        body: [],
        status: 200,
      },
    ]);

    const result = await persistSupabaseRunningTransition(
      createTransitionInput(),
      createPlannedTransition({ fromTurnNumber: 3, toTurnNumber: 4 }),
      {
        authorizationHeader: "Bearer token",
        userId: "user-1",
      },
    );

    expect(result).toEqual({
      error: {
        error: {
          code: "end_turn_stale_expected_turn",
          message: "Expected current turn no longer matches the world state.",
        },
        ok: false,
      },
      ok: false,
      status: 409,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:54321/rest/v1/rpc/advance_world_turn_if_current",
      expect.objectContaining({
        body: JSON.stringify({
          p_expected_turn_number: 3,
          p_world_id: "world-1",
        }),
        method: "POST",
      }),
    );
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
    input: createTransitionInput(overrides),
    ok: true,
  };
}

function createTransitionInput(
  overrides: Partial<EndTurnBasicTransitionInput> = {},
): EndTurnBasicTransitionInput {
  return {
    actorId: "user-1",
    calendarConfig: createCalendarConfig(),
    currentTurnNumber: 3,
    expectedCurrentTurnNumber: 3,
    isWorldArchived: false,
    readinessRows: [],
    worldId: "world-1",
    ...overrides,
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

function createPlannedTransition({
  fromTurnNumber,
  toTurnNumber,
}: {
  readonly fromTurnNumber: number;
  readonly toTurnNumber: number;
}): Parameters<typeof persistSupabaseRunningTransition>[1] {
  const previousDate = {
    dayOfMonth: 1,
    monthIndex: 1,
    monthName: "Rainmonth",
    turnNumber: fromTurnNumber,
    weekdayIndex: 0,
    weekdayName: "Moonday",
    year: 12,
  } as const;
  const nextDate = {
    dayOfMonth: 2,
    monthIndex: 1,
    monthName: "Rainmonth",
    turnNumber: toTurnNumber,
    weekdayIndex: 1,
    weekdayName: "Toilsday",
    year: 12,
  } as const;
  const readinessSummary = {
    notReadySettlementCount: 0,
    readyPercentage: 0,
    readySettlementCount: 0,
    totalSettlementCount: 0,
  } as const;

  return {
    fromTurnNumber,
    logPayload: {
      category: "turn_transition",
      fromTurnNumber,
      nextDate,
      previousDate,
      readinessSummary,
      toTurnNumber,
    },
    nextDate,
    notificationPayload: {
      messageText: `Turn ${toTurnNumber} is ready.`,
      notificationType: "turn_advanced",
    },
    previousDate,
    readinessSummary,
    toTurnNumber,
  };
}

function createRunningTransitionRow(
  overrides: Partial<{
    readonly from_turn_number: number;
    readonly id: string;
    readonly initiated_by_user_id: string;
    readonly started_at: string;
    readonly status: "running";
    readonly to_turn_number: number;
    readonly world_id: string;
  }> = {},
): {
  readonly from_turn_number: number;
  readonly id: string;
  readonly initiated_by_user_id: string;
  readonly started_at: string;
  readonly status: "running";
  readonly to_turn_number: number;
  readonly world_id: string;
} {
  return {
    from_turn_number: 3,
    id: "00000000-0000-0000-0000-000000000201",
    initiated_by_user_id: "user-1",
    started_at: "2026-05-03T10:00:00.000Z",
    status: "running",
    to_turn_number: 4,
    world_id: "world-1",
    ...overrides,
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
