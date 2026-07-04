import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  failStuckTurnTransitionMutationOptions,
  isFailStuckTurnTransitionError,
} from "./failStuckTurnTransitionMutations";

const WORLD_ID = "world-1";
const TRANSITION_ID = "transition-1";

const successResult = {
  markedFailedAt: "2026-07-03T00:00:00.000Z",
  status: "failed",
  transitionId: TRANSITION_ID,
  worldId: WORLD_ID,
};

type SupabaseError = { readonly code?: string; readonly message: string };
type RpcResult =
  | { readonly data: typeof successResult; readonly error: null }
  | { readonly data: null; readonly error: SupabaseError | null };

describe("failStuckTurnTransitionMutationOptions", () => {
  it("calls the RPC with world and transition ids and returns the result", async () => {
    const { client, rpc } = createRpcClient({
      data: successResult,
      error: null,
    });
    const queryClient = createQueryClient();
    vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
    const options = failStuckTurnTransitionMutationOptions({
      client,
      queryClient,
    });

    const result = await executeMutation(queryClient, options, {
      transitionId: TRANSITION_ID,
      worldId: WORLD_ID,
    });

    expect(rpc).toHaveBeenCalledWith("fail_stuck_turn_transition", {
      p_transition_id: TRANSITION_ID,
      p_world_id: WORLD_ID,
    });
    expect(result).toEqual({
      result: successResult,
      worldId: WORLD_ID,
    });
  });

  it("invalidates all turn-derived query keys on success", async () => {
    const { client } = createRpcClient({ data: successResult, error: null });
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = failStuckTurnTransitionMutationOptions({
      client,
      queryClient,
    });

    await executeMutation(queryClient, options, {
      transitionId: TRANSITION_ID,
      worldId: WORLD_ID,
    });

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["turns", "current-turn-state", WORLD_ID],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["turns", "latest-transition-status", WORLD_ID],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["turns", "latest-transition-outcome", WORLD_ID],
    });
  });

  it("maps a null response to an unknown error", async () => {
    const mutationPromise = executeMutationWithResult({
      data: null,
      error: null,
    });

    await expect(mutationPromise).rejects.toSatisfy(
      isFailStuckTurnTransitionError,
    );
    await expect(mutationPromise).rejects.toMatchObject({
      code: "fail_stuck_unknown_error",
      message: "No response from fail_stuck_turn_transition RPC.",
      worldId: WORLD_ID,
    });
  });

  it("maps 42501 (insufficient privilege) to unauthorized", async () => {
    const mutationPromise = executeMutationWithResult({
      data: null,
      error: { code: "42501", message: "insufficient privilege" },
    });

    await expect(mutationPromise).rejects.toMatchObject({
      code: "fail_stuck_unauthorized",
      message: "insufficient privilege",
      worldId: WORLD_ID,
    });
  });

  it("maps the archived-world P0001 message to fail_stuck_archived_world", async () => {
    const mutationPromise = executeMutationWithResult({
      data: null,
      error: {
        code: "P0001",
        message: "world is archived and cannot be modified",
      },
    });

    await expect(mutationPromise).rejects.toMatchObject({
      code: "fail_stuck_archived_world",
      worldId: WORLD_ID,
    });
  });

  it("maps the not-found P0001 message to fail_stuck_transition_not_found", async () => {
    const mutationPromise = executeMutationWithResult({
      data: null,
      error: {
        code: "P0001",
        message: `transition ${TRANSITION_ID} not found for world ${WORLD_ID}`,
      },
    });

    await expect(mutationPromise).rejects.toMatchObject({
      code: "fail_stuck_transition_not_found",
      worldId: WORLD_ID,
    });
  });

  it("maps the not-running P0001 message to fail_stuck_transition_not_running", async () => {
    const mutationPromise = executeMutationWithResult({
      data: null,
      error: {
        code: "P0001",
        message: `transition ${TRANSITION_ID} is not in running status (current: failed)`,
      },
    });

    await expect(mutationPromise).rejects.toMatchObject({
      code: "fail_stuck_transition_not_running",
      worldId: WORLD_ID,
    });
  });

  it("maps the stale-transition P0001 message to fail_stuck_stale_transition", async () => {
    const mutationPromise = executeMutationWithResult({
      data: null,
      error: {
        code: "P0001",
        message:
          "world turn has advanced past transition from_turn_number; transition is stale",
      },
    });

    await expect(mutationPromise).rejects.toMatchObject({
      code: "fail_stuck_stale_transition",
      worldId: WORLD_ID,
    });
  });

  it("maps 42883 (RPC not deployed) honestly to unknown error, not unauthorized", async () => {
    const mutationPromise = executeMutationWithResult({
      data: null,
      error: { code: "42883", message: "function does not exist" },
    });

    await expect(mutationPromise).rejects.toMatchObject({
      code: "fail_stuck_unknown_error",
      message: "function does not exist",
      worldId: WORLD_ID,
    });
  });

  it("maps unrecognized errors to fail_stuck_unknown_error", async () => {
    const mutationPromise = executeMutationWithResult({
      data: null,
      error: { code: "23505", message: "unique_violation" },
    });

    await expect(mutationPromise).rejects.toMatchObject({
      code: "fail_stuck_unknown_error",
      worldId: WORLD_ID,
    });
  });
});

function createRpcClient(result: RpcResult): {
  readonly client: GubernatorSupabaseClient;
  readonly rpc: ReturnType<typeof vi.fn>;
} {
  const rpc = vi.fn().mockResolvedValue(result);
  return {
    client: { rpc } as unknown as GubernatorSupabaseClient,
    rpc,
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

type FailStuckTurnTransitionOptions = ReturnType<
  typeof failStuckTurnTransitionMutationOptions
>;

function executeMutationWithResult(
  result: RpcResult,
): Promise<
  Awaited<ReturnType<NonNullable<FailStuckTurnTransitionOptions["mutationFn"]>>>
> {
  const queryClient = createQueryClient();
  vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
  const options = failStuckTurnTransitionMutationOptions({
    client: createRpcClient(result).client,
    queryClient,
  });

  return executeMutation(queryClient, options, {
    transitionId: TRANSITION_ID,
    worldId: WORLD_ID,
  });
}

function executeMutation(
  queryClient: QueryClient,
  options: FailStuckTurnTransitionOptions,
  variables: Parameters<
    NonNullable<FailStuckTurnTransitionOptions["mutationFn"]>
  >[0],
): Promise<
  Awaited<ReturnType<NonNullable<FailStuckTurnTransitionOptions["mutationFn"]>>>
> {
  return queryClient
    .getMutationCache()
    .build(queryClient, options)
    .execute(variables);
}
