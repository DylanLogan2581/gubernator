import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  endTurnBasicMutationOptions,
  isEndTurnBasicError,
} from "./endTurnBasicMutations";

describe("endTurnBasicMutationOptions", () => {
  it("calls the Edge Function with turn input and invalidates affected queries", async () => {
    const clientFixture = createClient({
      data: {
        data: {
          actorId: "user-1",
          transition: {
            nextTurnNumber: 4,
            previousTurnNumber: 3,
          },
          worldId: "world-1",
        },
        ok: true,
      },
      error: null,
    });
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = endTurnBasicMutationOptions({
      client: clientFixture.client,
      queryClient,
    });

    const result = await executeMutation(queryClient, options, {
      expectedTurnNumber: 3,
      worldId: "world-1",
    });

    expect(result).toEqual({
      actorId: "user-1",
      transition: {
        nextTurnNumber: 4,
        previousTurnNumber: 3,
      },
      worldId: "world-1",
    });
    expect(options.mutationKey).toEqual(["turns", "end-turn-basic"]);
    expect(clientFixture.invoke).toHaveBeenCalledWith("end-turn-basic", {
      body: {
        expectedTurnNumber: 3,
        worldId: "world-1",
      },
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
  });

  it("normalizes stale turn responses", async () => {
    const mutationPromise = executeMutationWithResult({
      data: createErrorResponse({
        code: "end_turn_stale_expected_turn",
        message: "Expected current turn no longer matches the world state.",
      }),
      error: null,
    });

    await expect(mutationPromise).rejects.toSatisfy(isEndTurnBasicError);
    await expect(mutationPromise).rejects.toMatchObject({
      code: "end_turn_stale_turn",
      message: "Expected current turn no longer matches the world state.",
      name: "EndTurnBasicError",
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
        code: "end_turn_transition_unavailable",
        message: "End turn transition could not be started.",
      }),
      error: null,
    });

    await expect(mutationPromise).rejects.toMatchObject({
      code: "end_turn_running_transition",
      message: "End turn transition could not be started.",
      worldId: "world-1",
    });
  });
});

type EndTurnBasicOptions = ReturnType<typeof endTurnBasicMutationOptions>;
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
  Awaited<ReturnType<NonNullable<EndTurnBasicOptions["mutationFn"]>>>
> {
  const queryClient = createQueryClient();
  const options = endTurnBasicMutationOptions({
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
  options: EndTurnBasicOptions,
  variables: Parameters<NonNullable<EndTurnBasicOptions["mutationFn"]>>[0],
): Promise<
  Awaited<ReturnType<NonNullable<EndTurnBasicOptions["mutationFn"]>>>
> {
  return queryClient
    .getMutationCache()
    .build(queryClient, options)
    .execute(variables);
}
