import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import {
  authStateQueryCacheKeys,
  scheduleAuthStateQueryCacheSync,
  syncAuthStateQueryCache,
} from "@/lib/authStateQueryCache";

import type { Session } from "@supabase/supabase-js";

describe("syncAuthStateQueryCache", () => {
  it("stores signed-in sessions and clears auth-dependent cached data", () => {
    const queryClient = createTestQueryClient();
    const session = createSession("user-2");
    seedAuthDependentQueries(queryClient);

    syncAuthStateQueryCache(queryClient, session);

    expect(
      queryClient.getQueryData(authStateQueryCacheKeys.currentSession()),
    ).toBe(session);
    expectAuthDependentQueriesToBeCleared(queryClient);
  });

  it("stores null after sign-out so route guards cannot reuse a fresh session", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(
      authStateQueryCacheKeys.currentSession(),
      createSession("user-1"),
    );
    seedAuthDependentQueries(queryClient);

    syncAuthStateQueryCache(queryClient, null);

    expect(
      queryClient.getQueryData(authStateQueryCacheKeys.currentSession()),
    ).toBeNull();
    expectAuthDependentQueriesToBeCleared(queryClient);
  });

  it("handles session-loss events the same way as explicit sign-out", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(
      authStateQueryCacheKeys.currentSession(),
      createSession("user-1"),
    );
    seedAuthDependentQueries(queryClient);

    syncAuthStateQueryCache(queryClient, null);

    expect(
      queryClient.getQueryData(authStateQueryCacheKeys.currentSession()),
    ).toBeNull();
    expectAuthDependentQueriesToBeCleared(queryClient);
  });

  it("can defer cache sync until after the auth callback returns", () => {
    vi.useFakeTimers();
    const queryClient = createTestQueryClient();
    const session = createSession("user-2");

    scheduleAuthStateQueryCacheSync(queryClient, session);

    expect(
      queryClient.getQueryData(authStateQueryCacheKeys.currentSession()),
    ).toBeUndefined();

    vi.runOnlyPendingTimers();

    expect(
      queryClient.getQueryData(authStateQueryCacheKeys.currentSession()),
    ).toBe(session);
    vi.useRealTimers();
  });
});

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function seedAuthDependentQueries(queryClient: QueryClient): void {
  queryClient.setQueryData(authStateQueryCacheKeys.currentAppUser(), {
    id: "user-1",
  });
  queryClient.setQueryData(
    [...authStateQueryCacheKeys.permissionsAll, "current-access-context"],
    { userId: "user-1" },
  );
  queryClient.setQueryData(
    [
      ...authStateQueryCacheKeys.worldAccessAll,
      "current-user-admin-world-ids",
      "user-1",
    ],
    ["world-1"],
  );
  queryClient.setQueryData(
    [...authStateQueryCacheKeys.worldsAll, "accessible", "user-1"],
    [{ id: "world-1" }],
  );
}

function expectAuthDependentQueriesToBeCleared(queryClient: QueryClient): void {
  expect(
    queryClient.getQueryData(authStateQueryCacheKeys.currentAppUser()),
  ).toBeUndefined();
  expect(queryClient.getQueriesData({ queryKey: ["permissions"] })).toEqual([]);
  expect(queryClient.getQueriesData({ queryKey: ["world-access"] })).toEqual(
    [],
  );
  expect(queryClient.getQueriesData({ queryKey: ["worlds"] })).toEqual([]);
}

function createSession(userId: string): Session {
  return { user: { id: userId } } as Session;
}
