import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  endTurnTransitionMutationOptions,
  isEndTurnTransitionError,
} from "./endTurnTransitionMutations";

const successPatchCounts = {
  assignmentClears: 0,
  bornOnTurnBackfill: 0,
  buildingStateChanges: 0,
  buildingsCreated: 0,
  citizenBirths: 0,
  citizenDeaths: 0,
  constructionUpdates: 0,
  depositUpdates: 0,
  logEntries: 0,
  managedPopulationUpdates: 0,
  notifications: 0,
  overshootStamped: 0,
  partnershipChanges: 0,
  readinessReset: 0,
  settlementSnapshots: 0,
  stockpileDeltas: 0,
  tradeRouteOutcomes: 0,
};

const successResult = {
  data: {
    actorId: "user-1",
    summary: {
      currentTurnNumber: 4,
      fromTurnNumber: 3,
      patchCounts: successPatchCounts,
      toTurnNumber: 4,
      transitionId: "transition-abc",
    },
    worldId: "world-1",
  },
  ok: true,
};

describe("endTurnTransitionMutationOptions", () => {
  it("calls the Edge Function with turn input and returns the summary", async () => {
    const clientFixture = createClient({ data: successResult, error: null });
    const queryClient = createQueryClient();
    vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
    const options = endTurnTransitionMutationOptions({
      client: clientFixture.client,
      queryClient,
    });

    const result = await executeMutation(queryClient, options, {
      expectedTurnNumber: 3,
      worldId: "world-1",
    });

    expect(result).toEqual({
      actorId: "user-1",
      summary: {
        currentTurnNumber: 4,
        fromTurnNumber: 3,
        patchCounts: successPatchCounts,
        toTurnNumber: 4,
        transitionId: "transition-abc",
      },
      worldId: "world-1",
    });
    expect(options.mutationKey).toEqual(["turns", "end-turn-simulation"]);
    expect(clientFixture.invoke).toHaveBeenCalledWith("end-turn-simulation", {
      body: {
        expectedTurnNumber: 3,
        worldId: "world-1",
      },
    });
  });

  it("invalidates all affected queries on success", async () => {
    const clientFixture = createClient({ data: successResult, error: null });
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = endTurnTransitionMutationOptions({
      client: clientFixture.client,
      queryClient,
    });

    await executeMutation(queryClient, options, {
      expectedTurnNumber: 3,
      worldId: "world-1",
    });

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["worlds"] });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["turns", "current-turn-state", "world-1"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["calendar"] });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["settlements", "readiness", "list", "world-1"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["settlements", "readiness", "summary", "world-1"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["turns", "latest-transition-status", "world-1"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["notifications"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["resources"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["buildings"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["deposits"] });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["managed-populations"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["trade"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["citizens"] });
  });

  it("normalizes stale turn responses", async () => {
    const mutationPromise = executeMutationWithResult({
      data: createErrorResponse({
        code: "end_turn_stale_expected_turn",
        message: "Expected current turn no longer matches the world state.",
      }),
      error: null,
    });

    await expect(mutationPromise).rejects.toSatisfy(isEndTurnTransitionError);
    await expect(mutationPromise).rejects.toMatchObject({
      code: "end_turn_stale_turn",
      message: "Expected current turn no longer matches the world state.",
      name: "EndTurnTransitionError",
      worldId: "world-1",
    });
  });

  it("normalizes unauthorized function errors", async () => {
    const mutationPromise = executeMutationWithResult({
      data: null,
      error: createFunctionError(
        createErrorResponse({
          code: "unauthorized",
          message: "End turn is unavailable for this world.",
        }),
      ),
    });

    await expect(mutationPromise).rejects.toMatchObject({
      code: "end_turn_unauthorized",
      message: "End turn is unavailable for this world.",
      worldId: "world-1",
    });
  });

  it("normalizes unauthenticated errors to unauthorized", async () => {
    const mutationPromise = executeMutationWithResult({
      data: createErrorResponse({
        code: "unauthenticated",
        message: "No session found.",
      }),
      error: null,
    });

    await expect(mutationPromise).rejects.toMatchObject({
      code: "end_turn_unauthorized",
      message: "No session found.",
      worldId: "world-1",
    });
  });

  it("normalizes auth_context_unavailable errors to unauthorized", async () => {
    const mutationPromise = executeMutationWithResult({
      data: createErrorResponse({
        code: "auth_context_unavailable",
        message: "Auth context could not be established.",
      }),
      error: null,
    });

    await expect(mutationPromise).rejects.toMatchObject({
      code: "end_turn_unauthorized",
      message: "Auth context could not be established.",
      worldId: "world-1",
    });
  });

  it("normalizes archived world responses", async () => {
    const mutationPromise = executeMutationWithResult({
      data: createErrorResponse({
        code: "end_turn_world_archived",
        message: "Archived worlds cannot advance turns.",
      }),
      error: null,
    });

    await expect(mutationPromise).rejects.toMatchObject({
      code: "end_turn_archived_world",
      message: "Archived worlds cannot advance turns.",
      worldId: "world-1",
    });
  });

  it("normalizes running transition errors", async () => {
    const mutationPromise = executeMutationWithResult({
      data: createErrorResponse({
        code: "end_turn_running_transition",
        message: "Another end-turn transition is already running.",
      }),
      error: null,
    });

    await expect(mutationPromise).rejects.toMatchObject({
      code: "end_turn_running_transition",
      message: "Another end-turn transition is already running.",
      worldId: "world-1",
    });
  });

  it("normalizes transition persistence failures", async () => {
    const mutationPromise = executeMutationWithResult({
      data: createErrorResponse({
        code: "end_turn_transition_failed",
        message: "End turn persistence failed after the transition started.",
      }),
      error: null,
    });

    await expect(mutationPromise).rejects.toMatchObject({
      code: "end_turn_transition_failed",
      message: "End turn persistence failed after the transition started.",
      worldId: "world-1",
    });
  });

  it("normalizes calendar config invalid errors to transition failed", async () => {
    const mutationPromise = executeMutationWithResult({
      data: createErrorResponse({
        code: "end_turn_calendar_config_invalid",
        message: "Calendar configuration is invalid.",
      }),
      error: null,
    });

    await expect(mutationPromise).rejects.toMatchObject({
      code: "end_turn_transition_failed",
      message: "Calendar configuration is invalid.",
      worldId: "world-1",
    });
  });

  it("normalizes state unavailable errors to transition failed", async () => {
    const mutationPromise = executeMutationWithResult({
      data: createErrorResponse({
        code: "end_turn_state_unavailable",
        message: "Simulation state could not be loaded.",
      }),
      error: null,
    });

    await expect(mutationPromise).rejects.toMatchObject({
      code: "end_turn_transition_failed",
      message: "Simulation state could not be loaded.",
      worldId: "world-1",
    });
  });
});

type EndTurnTransitionOptions = ReturnType<
  typeof endTurnTransitionMutationOptions
>;
type FunctionInvokeResult = {
  readonly data: unknown;
  readonly error: unknown;
};

function createClient(result: FunctionInvokeResult): {
  readonly client: GubernatorSupabaseClient;
  readonly invoke: ReturnType<typeof vi.fn>;
} {
  const invoke = vi.fn().mockResolvedValue(result);

  return {
    client: {
      functions: {
        invoke,
      },
    } as unknown as GubernatorSupabaseClient,
    invoke,
  };
}

function createErrorResponse({
  code,
  message,
}: {
  readonly code: string;
  readonly message: string;
}): {
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
  readonly ok: false;
} {
  return {
    error: {
      code,
      message,
    },
    ok: false,
  };
}

function createFunctionError(body: unknown): {
  readonly context: {
    readonly json: () => Promise<unknown>;
  };
} {
  return {
    context: {
      json: () => Promise.resolve(body),
    },
  };
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
}

function executeMutationWithResult(
  result: FunctionInvokeResult,
): Promise<
  Awaited<ReturnType<NonNullable<EndTurnTransitionOptions["mutationFn"]>>>
> {
  const queryClient = createQueryClient();
  const options = endTurnTransitionMutationOptions({
    client: createClient(result).client,
    queryClient,
  });

  return executeMutation(queryClient, options, {
    expectedTurnNumber: 3,
    worldId: "world-1",
  });
}

function executeMutation(
  queryClient: QueryClient,
  options: EndTurnTransitionOptions,
  variables: Parameters<NonNullable<EndTurnTransitionOptions["mutationFn"]>>[0],
): Promise<
  Awaited<ReturnType<NonNullable<EndTurnTransitionOptions["mutationFn"]>>>
> {
  return queryClient
    .getMutationCache()
    .build(queryClient, options)
    .execute(variables);
}
