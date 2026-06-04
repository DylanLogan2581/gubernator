import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { endTurnTransitionMutationOptions } from "../mutations/endTurnTransitionMutations";

import { turnQueryKeys } from "./turnQueryKeys";
import {
  latestSettlementTransitionOutcomeQueryOptions,
  latestWorldTransitionOutcomeQueryOptions,
} from "./turnTransitionOutcomeQueries";

// -- Query key shape --

describe("latestWorldTransitionOutcomeQueryOptions", () => {
  it("uses world-scoped turn query keys", () => {
    const options = latestWorldTransitionOutcomeQueryOptions(
      "world-1",
      {} as GubernatorSupabaseClient,
    );

    expect(options.queryKey).toEqual(
      turnQueryKeys.latestTransitionOutcome("world-1"),
    );
  });
});

describe("latestSettlementTransitionOutcomeQueryOptions", () => {
  it("uses settlement-scoped turn query keys", () => {
    const options = latestSettlementTransitionOutcomeQueryOptions(
      "settlement-1",
      {} as GubernatorSupabaseClient,
    );

    expect(options.queryKey).toEqual(
      turnQueryKeys.latestSettlementTransitionOutcome("settlement-1"),
    );
  });
});

// -- Cache invalidation on endTurnTransition success --

describe("endTurnTransitionMutationOptions cache invalidation", () => {
  it("invalidates the world transition outcome query on success", async () => {
    const clientFixture = createMutationClient({
      data: makeSuccessResult(),
      error: null,
    });
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

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: turnQueryKeys.latestTransitionOutcome("world-1"),
    });
  });

  it("invalidates all settlement transition outcome queries on success", async () => {
    const clientFixture = createMutationClient({
      data: makeSuccessResult(),
      error: null,
    });
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

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: turnQueryKeys.latestSettlementTransitionOutcomeAll(),
    });
  });
});

// -- Fixtures --

type MutationOptions = ReturnType<typeof endTurnTransitionMutationOptions>;

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
}

function createMutationClient(result: {
  readonly data: unknown;
  readonly error: unknown;
}): {
  readonly client: GubernatorSupabaseClient;
} {
  const invoke = vi.fn().mockResolvedValue(result);
  return {
    client: {
      functions: { invoke },
    } as unknown as GubernatorSupabaseClient,
  };
}

function makeSuccessResult(): {
  readonly data: unknown;
  readonly ok: true;
} {
  return {
    data: {
      actorId: "user-1",
      summary: {
        currentTurnNumber: 4,
        fromTurnNumber: 3,
        patchCounts: {
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
        },
        toTurnNumber: 4,
        transitionId: "transition-abc",
      },
      worldId: "world-1",
    },
    ok: true,
  };
}

function executeMutation(
  queryClient: QueryClient,
  options: MutationOptions,
  variables: Parameters<NonNullable<MutationOptions["mutationFn"]>>[0],
): Promise<Awaited<ReturnType<NonNullable<MutationOptions["mutationFn"]>>>> {
  return queryClient
    .getMutationCache()
    .build(queryClient, options)
    .execute(variables);
}
