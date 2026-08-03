import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { turnQueryKeys } from "../queries/turnQueryKeys";

import { useWorldTurnPause } from "./useWorldTurnPause";

import type { LatestTurnTransitionStatus } from "../types/turnTransitionStatusTypes";

// Structural shape of the mocked module — avoids an `import()` type, which
// the repo's eslint config forbids.
type LatestStatusQueriesModule = {
  readonly latestTurnTransitionStatusQueryOptions: (
    worldId: string,
  ) => Record<string, unknown>;
};

const { statusQueryFn } = vi.hoisted(() => ({
  statusQueryFn: vi.fn<() => Promise<unknown>>(),
}));

// Keep the real options (notably their conditional refetchInterval) but swap
// the queryFn so the poll can be counted without a Supabase client.
vi.mock("../queries/latestTurnTransitionStatusQueries", async () => {
  const actual = await vi.importActual<LatestStatusQueriesModule>(
    "../queries/latestTurnTransitionStatusQueries",
  );
  return {
    ...actual,
    latestTurnTransitionStatusQueryOptions: (worldId: string) => ({
      ...actual.latestTurnTransitionStatusQueryOptions(worldId),
      queryFn: statusQueryFn,
    }),
  };
});

const WORLD_ID = "11111111-1111-1111-1111-111111111111";
const STATUS_KEY = turnQueryKeys.latestTransitionStatus(WORLD_ID);

function createQueryClient(): QueryClient {
  return new QueryClient({
    // Seeded cache only: the tests never hit Supabase.
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
}

function createStatus(
  overrides: Partial<LatestTurnTransitionStatus>,
): LatestTurnTransitionStatus {
  return {
    finishedAt: null,
    fromTurnNumber: 6,
    id: "22222222-2222-2222-2222-222222222222",
    isRunning: false,
    progressStage: null,
    startedAt: "2026-08-03T12:00:00.000Z",
    state: "completed",
    toTurnNumber: 7,
    worldId: WORLD_ID,
    ...overrides,
  };
}

function wrapper(queryClient: QueryClient) {
  return ({ children }: { readonly children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useWorldTurnPause", () => {
  it("is idle when no transition is running and none was observed", async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(STATUS_KEY, createStatus({}));

    const { result } = renderHook(() => useWorldTurnPause(WORLD_ID), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.state.kind).toBe("idle");
    });
  });

  it("moves running -> acknowledge -> idle once acknowledged", async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(
      STATUS_KEY,
      createStatus({
        isRunning: true,
        progressStage: "standard_jobs",
        state: "running",
      }),
    );

    const { result } = renderHook(() => useWorldTurnPause(WORLD_ID), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.state.kind).toBe("running");
    });

    act(() => {
      queryClient.setQueryData(
        STATUS_KEY,
        createStatus({ finishedAt: "2026-08-03T12:01:00.000Z" }),
      );
    });

    await waitFor(() => {
      expect(result.current.state.kind).toBe("acknowledge");
    });

    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    act(() => {
      result.current.acknowledge();
    });

    await waitFor(() => {
      expect(result.current.state.kind).toBe("idle");
    });
    expect(invalidate).toHaveBeenCalled();
  });

  // Regression guard: a client that was idle when the turn started must still
  // learn about it, so the poll cannot be conditional on a known running run.
  it("keeps polling the status while no transition is running", async () => {
    vi.useFakeTimers();
    statusQueryFn.mockReset();
    statusQueryFn.mockResolvedValue(createStatus({}));

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    renderHook(() => useWorldTurnPause(WORLD_ID), {
      wrapper: wrapper(queryClient),
    });

    await vi.waitFor(() => {
      expect(statusQueryFn).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });

    expect(statusQueryFn.mock.calls.length).toBeGreaterThan(1);

    queryClient.clear();
    vi.useRealTimers();
  });

  it("reports failed while a transition ended in failure", async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(STATUS_KEY, createStatus({ state: "failed" }));

    const { result } = renderHook(() => useWorldTurnPause(WORLD_ID), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.state.kind).toBe("failed");
    });
  });
});
