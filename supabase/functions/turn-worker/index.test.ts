import { afterEach, describe, expect, it, vi } from "vitest";

import { handleTurnWorkerRequest } from "./index";

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
const RETRY_TRANSITION_ID = "00000000-0000-0000-0000-0000000000bb";
const JOB_ID = "00000000-0000-0000-0000-0000000000aa";
const SERVICE_ROLE_KEY = "test-service-role-key";

type StubResponse = { body: unknown; status: number };

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
    patchCounts: { buildingStateChanges: 0, citizenBirths: 0, citizenDeaths: 0 },
    toTurnNumber: 6,
    transitionId: TRANSITION_ID,
  };
}

function makeClaim(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    attempts: 1,
    claimedAt: "2026-08-03T00:00:00Z",
    claimedBy: "turn-worker",
    enqueuedByUserId: USER_ID,
    fromTurnNumber: 5,
    jobId: JOB_ID,
    maxAttempts: 3,
    turnTransitionId: TRANSITION_ID,
    worldId: WORLD_ID,
    ...overrides,
  };
}

function makeStateResponses(): Record<string, StubResponse> {
  const empty: StubResponse = { body: [], status: 200 };

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
    "/rest/v1/namesets": empty,
    "/rest/v1/resources": {
      body: [
        { change_amount: 0, change_mode: "percent", id: FOOD_ID, slug: "food" },
        {
          change_amount: 0,
          change_mode: "percent",
          id: WATER_ID,
          slug: "fresh-water",
        },
      ],
      status: 200,
    },
    "/rest/v1/settlement_stockpiles_view": empty,
    "/rest/v1/job_definitions": empty,
    "/rest/v1/building_blueprints": empty,
    "/rest/v1/settlement_buildings": empty,
    "/rest/v1/construction_projects": empty,
    "/rest/v1/deposit_types": empty,
    "/rest/v1/deposit_instances": empty,
    "/rest/v1/managed_population_types": empty,
    "/rest/v1/managed_population_instances": empty,
    "/rest/v1/trade_routes": empty,
    "/rest/v1/citizens": empty,
    "/rest/v1/events": empty,
    "/rest/v1/event_effects": empty,
    "/rest/v1/turn_log_entries": empty,
    "/rest/v1/citizen_assignments": empty,
    "/rest/v1/partnerships": empty,
    "/rest/v1/nations": empty,
    "/rest/v1/nation_offices": empty,
    "/rest/v1/nation_relationships": empty,
    "/rest/v1/nation_resource_stockpiles": empty,
    "/rest/v1/nation_tax_policies": empty,
    "/rest/v1/nation_treaties": empty,
    "/rest/v1/nation_currencies": empty,
    "/rest/v1/nation_currency_ledger": empty,
    "/rest/v1/education_levels": empty,
    "/rest/v1/education_enrollments": empty,
    "/rest/v1/unit_soldiers": empty,
    "/rest/v1/armies": empty,
    "/rest/v1/army_units": empty,
    "/rest/v1/unit_types": empty,
  };
}

function stubDenoEnv(): void {
  vi.stubGlobal("Deno", {
    env: {
      get: (name: string): string | undefined => {
        if (name === "SUPABASE_URL") return "http://localhost:54321";
        if (name === "SUPABASE_ANON_KEY") return "test-anon-key";
        if (name === "SUPABASE_SERVICE_ROLE_KEY") return SERVICE_ROLE_KEY;
        return undefined;
      },
    },
  });
}

// Dispatches on URL substrings, first match wins. Entries whose value is an
// array are consumed one call at a time, which is how the drain loop's second
// (empty) claim is expressed.
function stubFetch(
  responses: Record<string, StubResponse | StubResponse[]>,
): ReturnType<typeof vi.fn> {
  const queues = new Map<string, StubResponse[]>();

  const fetchMock = vi.fn((url: string): Promise<Response> => {
    const entry = Object.entries(responses).find(([pattern]) =>
      url.includes(pattern),
    );

    if (entry === undefined) {
      return Promise.resolve(
        new Response(JSON.stringify({ error: `Unexpected fetch: ${url}` }), {
          status: 500,
        }),
      );
    }

    const [pattern, value] = entry;
    let next: StubResponse;

    if (Array.isArray(value)) {
      const queue = queues.get(pattern) ?? [...value];
      next = queue.shift() ?? value[value.length - 1];
      queues.set(pattern, queue);
    } else {
      next = value;
    }

    return Promise.resolve(
      new Response(JSON.stringify(next.body), { status: next.status }),
    );
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Stubs a full worker cycle: one claimable job, then an empty queue. */
function stubWorkerCycle(
  overrides: Record<string, StubResponse | StubResponse[]> = {},
): ReturnType<typeof vi.fn> {
  stubDenoEnv();

  return stubFetch({
    "rpc/claim_turn_job": [
      { body: makeClaim(), status: 200 },
      { body: null, status: 200 },
    ],
    "rpc/heartbeat_turn_job": { body: true, status: 200 },
    "rpc/complete_turn_job": { body: true, status: 200 },
    "rpc/fail_turn_job": { body: "pending", status: 200 },
    "rpc/start_turn_transition": { body: RETRY_TRANSITION_ID, status: 200 },
    "rpc/apply_turn_transition": { body: makeSuccessSummary(), status: 200 },
    "rpc/fail_stuck_turn_transition": { body: { status: "failed" }, status: 200 },
    "/rest/v1/turn_transitions": { body: [{ status: "running" }], status: 200 },
    ...makeStateResponses(),
    ...overrides,
  });
}

function workerRequest(
  init: { authorization?: string; method?: string } = {},
): Request {
  return new Request("http://localhost/turn-worker", {
    body: init.method === "GET" ? undefined : JSON.stringify({ reason: "test" }),
    headers: {
      authorization: init.authorization ?? `Bearer ${SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
    },
    method: init.method ?? "POST",
  });
}

function calledUrls(fetchMock: ReturnType<typeof vi.fn>): string[] {
  return fetchMock.mock.calls.map((call) => String(call[0]));
}

function bodyOf(
  fetchMock: ReturnType<typeof vi.fn>,
  pattern: string,
): Record<string, unknown> | undefined {
  const call = fetchMock.mock.calls.find(([url]) =>
    String(url).includes(pattern),
  );

  if (call === undefined) {
    return undefined;
  }

  const [, init] = call as [string, RequestInit];

  return JSON.parse(init.body as string) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("handleTurnWorkerRequest", () => {
  it("returns 405 for non-POST methods", async () => {
    stubDenoEnv();

    const response = await handleTurnWorkerRequest(
      workerRequest({ method: "GET" }),
    );

    expect(response.status).toBe(405);
  });

  it("rejects a caller that is not presenting the service-role key", async () => {
    const fetchMock = stubWorkerCycle();

    const response = await handleTurnWorkerRequest(
      workerRequest({ authorization: "Bearer some-users-jwt" }),
    );

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns claimed: 0 when the queue is empty", async () => {
    stubDenoEnv();
    stubFetch({ "rpc/claim_turn_job": { body: null, status: 200 } });

    const response = await handleTurnWorkerRequest(workerRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ claimed: 0, outcomes: [] });
  });

  it("runs the full pipeline for a claimed job and completes it", async () => {
    const fetchMock = stubWorkerCycle();

    const response = await handleTurnWorkerRequest(workerRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      claimed: 1,
      outcomes: [
        {
          jobId: JOB_ID,
          status: "completed",
          transitionId: TRANSITION_ID,
          worldId: WORLD_ID,
        },
      ],
    });

    // The transition the request opened is reused, not replaced.
    expect(
      calledUrls(fetchMock).some((url) =>
        url.includes("rpc/start_turn_transition"),
      ),
    ).toBe(false);

    const applyBody = bodyOf(fetchMock, "rpc/apply_turn_transition");
    expect(applyBody?.p_transition_id).toBe(TRANSITION_ID);
    expect(applyBody?.p_world_id).toBe(WORLD_ID);
    expect(applyBody?.p_expected_turn_number).toBe(5);

    expect(bodyOf(fetchMock, "rpc/complete_turn_job")).toEqual({
      p_job_id: JOB_ID,
      p_worker_id: expect.stringContaining("turn-worker:") as unknown,
    });
  });

  it("loads simulation state with the service role, not an end user's JWT", async () => {
    const fetchMock = stubWorkerCycle();

    await handleTurnWorkerRequest(workerRequest());

    const stateCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("/rest/v1/citizens"),
    );
    expect(stateCall).toBeDefined();

    const [, init] = stateCall as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Bearer ${SERVICE_ROLE_KEY}`);
  });

  it("reports progress on the transition as it advances through the pipeline", async () => {
    const fetchMock = stubWorkerCycle();

    await handleTurnWorkerRequest(workerRequest());

    const stages = fetchMock.mock.calls
      .filter(
        ([url, init]) =>
          String(url).includes("/rest/v1/turn_transitions?id=eq.") &&
          (init as RequestInit).method === "PATCH",
      )
      .map(([, init]) => {
        const body = (init as RequestInit).body;
        return body === undefined || body === null
          ? null
          : (JSON.parse(body as string) as { progress_stage: string | null })
            .progress_stage;
      })
      .filter((stage): stage is string | null => stage !== undefined);

    expect(stages).toEqual(["loading", "simulating", "persisting", null]);
  });

  it("fails the transition and releases the job for retry when the apply fails", async () => {
    const fetchMock = stubWorkerCycle({
      "rpc/apply_turn_transition": {
        body: {
          code: "P0001",
          message: "simulation engine may not kill a player character",
        },
        status: 500,
      },
    });

    const response = await handleTurnWorkerRequest(workerRequest());
    const responseBody = (await response.json()) as {
      claimed: number;
      outcomes: { status: string }[];
    };

    expect(responseBody.outcomes[0].status).toBe("failed");

    // The wedged 'running' row is cleared so the world can be advanced again...
    const failStuckBody = bodyOf(fetchMock, "rpc/fail_stuck_turn_transition");
    expect(failStuckBody?.p_transition_id).toBe(TRANSITION_ID);
    expect(failStuckBody?.p_world_id).toBe(WORLD_ID);

    // ...and the claim is released, which returns the job to 'pending'.
    expect(bodyOf(fetchMock, "rpc/fail_turn_job")?.p_job_id).toBe(JOB_ID);
  });

  it("opens a fresh transition when the enqueued one is no longer running", async () => {
    // The retry case: the previous attempt already marked its transition
    // failed, so re-applying against it would be applying to a terminal turn.
    const fetchMock = stubWorkerCycle({
      "/rest/v1/turn_transitions": { body: [{ status: "failed" }], status: 200 },
    });

    const response = await handleTurnWorkerRequest(workerRequest());
    const responseBody = (await response.json()) as {
      outcomes: { transitionId: string }[];
    };

    expect(responseBody.outcomes[0].transitionId).toBe(RETRY_TRANSITION_ID);
    expect(bodyOf(fetchMock, "rpc/start_turn_transition")).toEqual({
      p_expected_turn_number: 5,
      p_initiated_by_user_id: USER_ID,
      p_world_id: WORLD_ID,
    });
    expect(bodyOf(fetchMock, "rpc/apply_turn_transition")?.p_transition_id).toBe(
      RETRY_TRANSITION_ID,
    );
  });

  it("never applies the turn once the claim has been lost", async () => {
    // Stale heartbeat recovery: another worker re-claimed this job. Applying
    // here would be the double-apply the claim protocol exists to prevent.
    const fetchMock = stubWorkerCycle({
      "rpc/heartbeat_turn_job": { body: false, status: 200 },
    });

    const response = await handleTurnWorkerRequest(workerRequest());
    const responseBody = (await response.json()) as {
      outcomes: { status: string }[];
    };

    expect(responseBody.outcomes[0].status).toBe("abandoned");

    const urls = calledUrls(fetchMock);
    expect(urls.some((url) => url.includes("rpc/apply_turn_transition"))).toBe(
      false,
    );
    // The new claimant owns the job now, so this worker touches neither the
    // transition nor the job's terminal state.
    expect(
      urls.some((url) => url.includes("rpc/fail_stuck_turn_transition")),
    ).toBe(false);
    expect(urls.some((url) => url.includes("rpc/fail_turn_job"))).toBe(false);
  });

  it("fails a job that has no enqueuing user to attribute the transition to", async () => {
    const fetchMock = stubWorkerCycle({
      "rpc/claim_turn_job": [
        { body: makeClaim({ enqueuedByUserId: null }), status: 200 },
        { body: null, status: 200 },
      ],
    });

    const response = await handleTurnWorkerRequest(workerRequest());
    const responseBody = (await response.json()) as {
      outcomes: { status: string }[];
    };

    expect(responseBody.outcomes[0].status).toBe("failed");
    expect(bodyOf(fetchMock, "rpc/fail_turn_job")?.p_job_id).toBe(JOB_ID);
    expect(
      calledUrls(fetchMock).some((url) =>
        url.includes("rpc/apply_turn_transition"),
      ),
    ).toBe(false);
  });
});
