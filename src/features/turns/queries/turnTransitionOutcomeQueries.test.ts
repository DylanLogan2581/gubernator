import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { endTurnTransitionMutationOptions } from "../mutations/endTurnTransitionMutations";

import { turnQueryKeys } from "./turnQueryKeys";
import {
  latestSettlementTransitionOutcomeQueryOptions,
  latestWorldTransitionOutcomeQueryOptions,
} from "./turnTransitionOutcomeQueries";

// -- Notification scope filtering --

describe("latestSettlementTransitionOutcomeQueryOptions notification filtering", () => {
  it("excludes world-scope notifications (settlement_id null) from settlement-scoped results", async () => {
    const queryClient = createQueryClient();

    const options = latestSettlementTransitionOutcomeQueryOptions(
      "settlement-1",
      createSettlementFilterClient([
        makeNotificationRow({ id: "notif-world", settlement_id: null }),
        makeNotificationRow({
          id: "notif-settlement",
          settlement_id: "settlement-1",
        }),
      ]) as GubernatorSupabaseClient,
    );
    const result = await queryClient.fetchQuery(options);

    expect(result?.notifications.map((n) => n.id)).toEqual([
      "notif-settlement",
    ]);
  });

  it("excludes notifications scoped to other settlements", async () => {
    const queryClient = createQueryClient();

    const options = latestSettlementTransitionOutcomeQueryOptions(
      "settlement-1",
      createSettlementFilterClient([
        makeNotificationRow({ id: "notif-a", settlement_id: "settlement-1" }),
        makeNotificationRow({ id: "notif-b", settlement_id: "settlement-2" }),
      ]) as GubernatorSupabaseClient,
    );
    const result = await queryClient.fetchQuery(options);

    expect(result?.notifications.map((n) => n.id)).toEqual(["notif-a"]);
  });
});

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

// -- Notification scope filtering fixtures --

type NotificationRowFixture = {
  readonly citizen_id: null;
  readonly generated_at: string;
  readonly generated_in_transition_id: string;
  readonly id: string;
  readonly is_read: boolean;
  readonly message_text: string;
  readonly nation_id: null;
  readonly notification_type: string;
  readonly recipient_user_id: string;
  readonly settlement_id: string | null;
  readonly world_id: string;
};

function makeNotificationRow(
  overrides: Partial<NotificationRowFixture> = {},
): NotificationRowFixture {
  return {
    citizen_id: null,
    generated_at: "2026-06-01T12:00:00Z",
    generated_in_transition_id: "transition-1",
    id: "notif-1",
    is_read: false,
    message_text: "A notification.",
    nation_id: null,
    notification_type: "building.suspended",
    recipient_user_id: "user-1",
    settlement_id: "settlement-1",
    world_id: "world-1",
    ...overrides,
  };
}

function createSettlementFilterClient(
  notifications: readonly NotificationRowFixture[],
): unknown {
  const snapshotBuilder: Record<string, unknown> = {};
  snapshotBuilder.select = vi.fn(() => snapshotBuilder);
  snapshotBuilder.eq = vi.fn(() => snapshotBuilder);
  snapshotBuilder.not = vi.fn(() => snapshotBuilder);
  snapshotBuilder.order = vi.fn(() => snapshotBuilder);
  snapshotBuilder.limit = vi.fn(() => snapshotBuilder);
  snapshotBuilder.maybeSingle = vi.fn().mockResolvedValue({
    data: { turn_transition_id: "transition-1" },
    error: null,
  });

  const row = {
    finished_at: "2026-06-01T12:00:00Z",
    from_turn_number: 5,
    id: "transition-1",
    notifications,
    settlement_turn_resource_snapshots: [],
    settlement_turn_snapshots: [],
    started_at: "2026-06-01T11:55:00Z",
    status: "completed",
    to_turn_number: 6,
    turn_log_entries: [],
    world_id: "world-1",
  };

  const transitionBuilder: Record<string, unknown> = {};
  transitionBuilder.select = vi.fn(() => transitionBuilder);
  transitionBuilder.eq = vi.fn(() => transitionBuilder);
  transitionBuilder.maybeSingle = vi
    .fn()
    .mockResolvedValue({ data: row, error: null });

  return {
    from: vi.fn((table: string) => {
      if (table === "settlement_turn_snapshots") {
        return snapshotBuilder;
      }
      if (table === "turn_transitions") {
        return transitionBuilder;
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}
