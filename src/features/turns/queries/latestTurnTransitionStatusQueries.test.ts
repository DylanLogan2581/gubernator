import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { AuthUiError } from "@/features/auth";
import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  LatestTurnTransitionStatusError,
  latestTurnTransitionStatusQueryOptions,
  shouldRetryLatestTurnTransitionStatusQuery,
} from "./latestTurnTransitionStatusQueries";

describe("latestTurnTransitionStatusQueryOptions", () => {
  it("returns null when the RLS-visible world has no turn transition", async () => {
    const testClient = createClient({
      transitionRow: null,
      worldRow: { id: "world-1" },
    });
    const queryClient = createQueryClient();

    const status = await queryClient.fetchQuery(
      latestTurnTransitionStatusQueryOptions("world-1", testClient.client),
    );

    expect(status).toBeNull();
    expect(testClient.from).toHaveBeenCalledWith("turn_transitions");
    expect(testClient.transitionBuilder.select).toHaveBeenCalledWith(
      "id,world_id,from_turn_number,to_turn_number,status,started_at,finished_at",
    );
    expect(testClient.transitionBuilder.eq).toHaveBeenCalledWith(
      "world_id",
      "world-1",
    );
    expect(testClient.transitionBuilder.order).toHaveBeenCalledWith(
      "started_at",
      { ascending: false },
    );
    expect(testClient.transitionBuilder.limit).toHaveBeenCalledWith(1);
    expect(testClient.transitionBuilder.maybeSingle).toHaveBeenCalledWith();
    expect(testClient.from).toHaveBeenCalledWith("worlds");
    expect(testClient.worldBuilder.select).toHaveBeenCalledWith("id");
    expect(testClient.worldBuilder.eq).toHaveBeenCalledWith("id", "world-1");
    expect(testClient.worldBuilder.maybeSingle).toHaveBeenCalledWith();
  });

  it("loads the latest running turn transition status", async () => {
    const testClient = createClient({
      transitionRow: createTransitionRow({ status: "running" }),
    });
    const queryClient = createQueryClient();

    const status = await queryClient.fetchQuery(
      latestTurnTransitionStatusQueryOptions("world-1", testClient.client),
    );

    expect(status).toEqual({
      finishedAt: null,
      fromTurnNumber: 4,
      id: "transition-1",
      isRunning: true,
      startedAt: "2026-05-03T10:00:00.000Z",
      state: "running",
      toTurnNumber: 5,
      worldId: "world-1",
    });
    expect(testClient.worldBuilder.maybeSingle).not.toHaveBeenCalled();
  });

  it("loads the latest completed turn transition status", async () => {
    const queryClient = createQueryClient();

    const status = await queryClient.fetchQuery(
      latestTurnTransitionStatusQueryOptions(
        "world-1",
        createClient({
          transitionRow: createTransitionRow({
            finished_at: "2026-05-03T10:00:05.000Z",
            status: "completed",
          }),
        }).client,
      ),
    );

    expect(status).toMatchObject({
      finishedAt: "2026-05-03T10:00:05.000Z",
      isRunning: false,
      state: "completed",
    });
  });

  it("loads the latest failed turn transition status", async () => {
    const queryClient = createQueryClient();

    const status = await queryClient.fetchQuery(
      latestTurnTransitionStatusQueryOptions(
        "world-1",
        createClient({
          transitionRow: createTransitionRow({
            finished_at: "2026-05-03T10:00:05.000Z",
            status: "failed",
          }),
        }).client,
      ),
    );

    expect(status).toMatchObject({
      finishedAt: "2026-05-03T10:00:05.000Z",
      isRunning: false,
      state: "failed",
    });
  });

  it("returns a normalized error when RLS hides the world", async () => {
    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery(
        latestTurnTransitionStatusQueryOptions(
          "world-restricted",
          createClient({
            transitionRow: null,
            worldRow: null,
          }).client,
        ),
      ),
    ).rejects.toMatchObject({
      code: "latest_turn_transition_status_unauthorized",
      message: "Latest turn transition status is unavailable.",
      name: "LatestTurnTransitionStatusError",
      worldId: "world-restricted",
    });
  });

  it("normalizes Supabase errors from the transition query", async () => {
    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery(
        latestTurnTransitionStatusQueryOptions(
          "world-1",
          createClient({
            transitionError: {
              code: "42501",
              message: "permission denied for table turn_transitions",
            },
            transitionRow: null,
          }).client,
        ),
      ),
    ).rejects.toMatchObject({
      code: "42501",
      message: "permission denied for table turn_transitions",
      name: "AuthUiError",
    });
  });

  it("uses world-scoped turn query keys", () => {
    const options = latestTurnTransitionStatusQueryOptions(
      "world-1",
      {} as GubernatorSupabaseClient,
    );

    expect(options.queryKey).toEqual([
      "turns",
      "latest-transition-status",
      "world-1",
    ]);
  });

  it("does not retry normalized latest turn transition status errors", () => {
    expect(
      shouldRetryLatestTurnTransitionStatusQuery(
        0,
        new LatestTurnTransitionStatusError({
          code: "latest_turn_transition_status_unauthorized",
          message: "Latest turn transition status is unavailable.",
          worldId: "world-1",
        }),
      ),
    ).toBe(false);
    expect(
      shouldRetryLatestTurnTransitionStatusQuery(
        0,
        new AuthUiError({ message: "" }),
      ),
    ).toBe(true);
    expect(
      shouldRetryLatestTurnTransitionStatusQuery(
        3,
        new AuthUiError({ message: "" }),
      ),
    ).toBe(false);
  });
});

type TestLatestTurnTransitionStatusRow = {
  readonly finished_at: string | null;
  readonly from_turn_number: number;
  readonly id: string;
  readonly started_at: string;
  readonly status: string;
  readonly to_turn_number: number;
  readonly world_id: string;
};
type TestWorldVisibilityRow = {
  readonly id: string;
};
type TestSupabaseError = {
  readonly code: string;
  readonly message: string;
};
type TestTransitionBuilder = {
  readonly eq: ReturnType<typeof vi.fn>;
  readonly limit: ReturnType<typeof vi.fn>;
  readonly maybeSingle: ReturnType<typeof vi.fn>;
  readonly order: ReturnType<typeof vi.fn>;
  readonly select: ReturnType<typeof vi.fn>;
};
type TestWorldBuilder = {
  readonly eq: ReturnType<typeof vi.fn>;
  readonly maybeSingle: ReturnType<typeof vi.fn>;
  readonly select: ReturnType<typeof vi.fn>;
};

function createClient({
  transitionError = null,
  transitionRow,
  worldError = null,
  worldRow = { id: "world-1" },
}: {
  readonly transitionError?: TestSupabaseError | null;
  readonly transitionRow: TestLatestTurnTransitionStatusRow | null;
  readonly worldError?: TestSupabaseError | null;
  readonly worldRow?: TestWorldVisibilityRow | null;
}): {
  readonly client: GubernatorSupabaseClient;
  readonly from: ReturnType<typeof vi.fn>;
  readonly transitionBuilder: TestTransitionBuilder;
  readonly worldBuilder: TestWorldBuilder;
} {
  const transitionBuilder = createTransitionBuilder({
    error: transitionError,
    row: transitionRow,
  });
  const worldBuilder = createWorldBuilder({
    error: worldError,
    row: worldRow,
  });
  const from = vi.fn((tableName: string) =>
    tableName === "turn_transitions" ? transitionBuilder : worldBuilder,
  );

  return {
    client: { from } as unknown as GubernatorSupabaseClient,
    from,
    transitionBuilder,
    worldBuilder,
  };
}

function createTransitionBuilder({
  error,
  row,
}: {
  readonly error: TestSupabaseError | null;
  readonly row: TestLatestTurnTransitionStatusRow | null;
}): TestTransitionBuilder {
  const builder = {
    eq: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
    order: vi.fn(),
    select: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.maybeSingle.mockResolvedValue({ data: row, error });

  return builder;
}

function createWorldBuilder({
  error,
  row,
}: {
  readonly error: TestSupabaseError | null;
  readonly row: TestWorldVisibilityRow | null;
}): TestWorldBuilder {
  const builder = {
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    select: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.maybeSingle.mockResolvedValue({ data: row, error });

  return builder;
}

function createTransitionRow(
  overrides: Partial<TestLatestTurnTransitionStatusRow> = {},
): TestLatestTurnTransitionStatusRow {
  return {
    finished_at: null,
    from_turn_number: 4,
    id: "transition-1",
    started_at: "2026-05-03T10:00:00.000Z",
    status: "running",
    to_turn_number: 5,
    world_id: "world-1",
    ...overrides,
  };
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0 },
    },
  });
}
