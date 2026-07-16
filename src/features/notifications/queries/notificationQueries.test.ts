import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  allNotificationsQueryOptions,
  turnCompletedNotificationsQueryOptions,
  unreadNotificationsCountQueryOptions,
} from "./notificationQueries";

const TURN_COMPLETED_NOTIFICATION_SELECT =
  "id,world_id,generated_in_transition_id,message_text,is_read,generated_at";

describe("unreadNotificationsCountQueryOptions", () => {
  it("loads the current user's unread notification count", async () => {
    const secondEq = vi.fn().mockResolvedValue({ count: 2, error: null });
    const firstEq = vi.fn(() => ({ eq: secondEq }));
    const select = vi.fn(() => ({ eq: firstEq }));
    const from = vi
      .fn()
      .mockReturnValueOnce({ select: createDisabledTypesSelect([]) })
      .mockReturnValueOnce({ select });
    const queryClient = createQueryClient();

    const count = await queryClient.fetchQuery(
      unreadNotificationsCountQueryOptions("user-1", {
        from,
      } as unknown as GubernatorSupabaseClient),
    );

    expect(count).toBe(2);
    expect(from).toHaveBeenCalledWith("notifications");
    expect(from).toHaveBeenCalledWith("notification_preferences");
    expect(select).toHaveBeenCalledWith("id", {
      count: "exact",
      head: true,
    });
    expect(firstEq).toHaveBeenCalledWith("recipient_user_id", "user-1");
    expect(secondEq).toHaveBeenCalledWith("is_read", false);
  });

  it("excludes muted notification types from the unread count", async () => {
    const notCall = vi.fn().mockResolvedValue({ count: 1, error: null });
    const secondEq = vi.fn(() => ({ not: notCall }));
    const firstEq = vi.fn(() => ({ eq: secondEq }));
    const select = vi.fn(() => ({ eq: firstEq }));
    const from = vi
      .fn()
      .mockReturnValueOnce({
        select: createDisabledTypesSelect(["turn.completed"]),
      })
      .mockReturnValueOnce({ select });
    const queryClient = createQueryClient();

    const count = await queryClient.fetchQuery(
      unreadNotificationsCountQueryOptions("user-1", {
        from,
      } as unknown as GubernatorSupabaseClient),
    );

    expect(count).toBe(1);
    expect(notCall).toHaveBeenCalledWith(
      "notification_type",
      "in",
      "(turn.completed)",
    );
  });

  it("uses user-scoped query keys", () => {
    const options = unreadNotificationsCountQueryOptions(
      "user-1",
      {} as GubernatorSupabaseClient,
    );

    expect(options.queryKey).toEqual([
      "notifications",
      "unread-count",
      "user-1",
    ]);
  });

  it("returns zero when Supabase does not include an exact count", async () => {
    const secondEq = vi.fn().mockResolvedValue({ count: null, error: null });
    const queryClient = createQueryClient();

    const count = await queryClient.fetchQuery(
      unreadNotificationsCountQueryOptions(
        "user-1",
        createClient({ secondEq }),
      ),
    );

    expect(count).toBe(0);
  });

  it("normalizes Supabase errors", async () => {
    const secondEq = vi.fn().mockResolvedValue({
      count: null,
      error: {
        code: "42501",
        message: "permission denied for table notifications",
      },
    });
    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery(
        unreadNotificationsCountQueryOptions(
          "user-1",
          createClient({ secondEq }),
        ),
      ),
    ).rejects.toMatchObject({
      code: "42501",
      message: "permission denied for table notifications",
      name: "AuthUiError",
    });
  });
});

describe("turnCompletedNotificationsQueryOptions", () => {
  it("loads minimal turn-completed notifications for the current user", async () => {
    const row = {
      generated_at: "2026-05-03T10:00:00.000Z",
      generated_in_transition_id: "transition-1",
      id: "notification-1",
      is_read: false,
      message_text: "Turn 2 is complete.",
      recipient_user_id: "user-1",
      world_id: "world-1",
    };
    const queryChain = createTurnCompletedQueryChain({
      data: [row],
      error: null,
    });
    const queryClient = createQueryClient();

    const notifications = await queryClient.fetchQuery(
      turnCompletedNotificationsQueryOptions("user-1", {}, queryChain.client),
    );

    expect(notifications).toEqual([
      {
        generatedAt: "2026-05-03T10:00:00.000Z",
        generatedInTransitionId: "transition-1",
        id: "notification-1",
        isRead: false,
        messageText: "Turn 2 is complete.",
        worldId: "world-1",
      },
    ]);
    expect(queryChain.from).toHaveBeenCalledWith("notifications");
    expect(queryChain.select).toHaveBeenCalledWith(
      TURN_COMPLETED_NOTIFICATION_SELECT,
    );
    expect(queryChain.recipientEq).toHaveBeenCalledWith(
      "recipient_user_id",
      "user-1",
    );
    expect(queryChain.typeEq).toHaveBeenCalledWith(
      "notification_type",
      "turn.completed",
    );
    expect(queryChain.worldEq).not.toHaveBeenCalled();
    expect(queryChain.order).toHaveBeenCalledWith("generated_at", {
      ascending: false,
    });
    expect(queryChain.secondOrder).toHaveBeenCalledWith("id", {
      ascending: false,
    });
  });

  it("can filter turn-completed notifications by world id", async () => {
    const queryChain = createTurnCompletedQueryChain({
      data: [],
      error: null,
    });
    const queryClient = createQueryClient();

    await queryClient.fetchQuery(
      turnCompletedNotificationsQueryOptions(
        "user-1",
        { worldId: "world-1" },
        queryChain.client,
      ),
    );

    expect(queryChain.worldEq).toHaveBeenCalledWith("world_id", "world-1");
  });

  it("uses user and world scoped query keys", () => {
    const options = turnCompletedNotificationsQueryOptions(
      "user-1",
      { worldId: "world-1" },
      {} as GubernatorSupabaseClient,
    );

    expect(options.queryKey).toEqual([
      "notifications",
      "turn-completed",
      "user-1",
      "world-1",
    ]);
  });

  it("returns an empty list when RLS exposes no current-user rows", async () => {
    const queryChain = createTurnCompletedQueryChain({
      data: [],
      error: null,
    });
    const queryClient = createQueryClient();

    const notifications = await queryClient.fetchQuery(
      turnCompletedNotificationsQueryOptions("user-1", {}, queryChain.client),
    );

    expect(notifications).toEqual([]);
    expect(queryChain.recipientEq).toHaveBeenCalledWith(
      "recipient_user_id",
      "user-1",
    );
  });

  it("normalizes Supabase errors", async () => {
    const queryChain = createTurnCompletedQueryChain({
      data: null,
      error: {
        code: "42501",
        message: "permission denied for table notifications",
      },
    });
    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery(
        turnCompletedNotificationsQueryOptions("user-1", {}, queryChain.client),
      ),
    ).rejects.toMatchObject({
      code: "42501",
      message: "permission denied for table notifications",
      name: "AuthUiError",
    });
  });
});

describe("allNotificationsQueryOptions", () => {
  it("maps embedded world, nation, and settlement names", async () => {
    const row = {
      citizen_id: null,
      event_id: null,
      generated_at: "2026-05-03T10:00:00.000Z",
      generated_in_transition_id: null,
      id: "notif-1",
      is_read: false,
      message_text: "Turn 2 is complete.",
      nation_id: "nation-1",
      nation: { name: "Gondor" },
      notification_type: "turn.completed",
      settlement_id: "settlement-1",
      settlement: { name: "Minas Tirith" },
      severity: "info" as const,
      trade_route_id: null,
      world_id: "world-1",
      world: { name: "Earth" },
    };
    const client = createAllNotificationsClient({ rows: [row], total: 1 });
    const queryClient = createQueryClient();

    const result = await queryClient.fetchQuery(
      allNotificationsQueryOptions("user-1", {}, client),
    );

    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]).toMatchObject({
      worldName: "Earth",
      nationName: "Gondor",
      settlementName: "Minas Tirith",
    });
  });

  it("maps null nation and settlement names when embeds are null", async () => {
    const row = {
      citizen_id: null,
      event_id: null,
      generated_at: "2026-05-03T10:00:00.000Z",
      generated_in_transition_id: null,
      id: "notif-2",
      is_read: true,
      message_text: "World event occurred.",
      nation_id: null,
      nation: null,
      notification_type: "turn.completed",
      settlement_id: null,
      settlement: null,
      severity: "info" as const,
      trade_route_id: null,
      world_id: "world-1",
      world: { name: "Earth" },
    };
    const client = createAllNotificationsClient({ rows: [row], total: 1 });
    const queryClient = createQueryClient();

    const result = await queryClient.fetchQuery(
      allNotificationsQueryOptions("user-1", {}, client),
    );

    expect(result.notifications[0]).toMatchObject({
      worldName: "Earth",
      nationName: null,
      settlementName: null,
    });
  });

  it("returns empty list when userId is null", async () => {
    const from = vi.fn();
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();

    const result = await queryClient.fetchQuery(
      allNotificationsQueryOptions(null, {}, client),
    );

    expect(result).toEqual({ notifications: [], total: 0 });
    expect(from).not.toHaveBeenCalled();
  });

  it("excludes muted notification types from the list and total", async () => {
    const row = {
      citizen_id: null,
      event_id: null,
      generated_at: "2026-05-03T10:00:00.000Z",
      generated_in_transition_id: null,
      id: "notif-5",
      is_read: false,
      message_text: "Turn 2 is complete.",
      nation_id: null,
      nation: null,
      notification_type: "trade_proposal_received",
      settlement_id: null,
      settlement: null,
      severity: "info" as const,
      trade_route_id: null,
      world_id: "world-1",
      world: { name: "Earth" },
    };

    const countNot = vi.fn().mockResolvedValue({ count: 1, error: null });
    const countRecipientEq = vi.fn(() => ({ not: countNot }));
    const countSelect = vi.fn(() => ({ eq: countRecipientEq }));

    const dataNot = vi.fn().mockResolvedValue({ data: [row], error: null });
    const range = vi.fn(() => ({ not: dataNot }));
    const secondOrder = vi.fn(() => ({ range }));
    const order = vi.fn(() => ({ order: secondOrder }));
    const dataRecipientEq = vi.fn(() => ({ order }));
    const dataSelect = vi.fn(() => ({ eq: dataRecipientEq }));

    const from = vi
      .fn()
      .mockReturnValueOnce({
        select: createDisabledTypesSelect(["turn.completed"]),
      })
      .mockReturnValueOnce({ select: countSelect })
      .mockReturnValueOnce({ select: dataSelect });
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();

    const result = await queryClient.fetchQuery(
      allNotificationsQueryOptions("user-1", {}, client),
    );

    expect(result.total).toBe(1);
    expect(result.notifications).toHaveLength(1);
    expect(countNot).toHaveBeenCalledWith(
      "notification_type",
      "in",
      "(turn.completed)",
    );
    expect(dataNot).toHaveBeenCalledWith(
      "notification_type",
      "in",
      "(turn.completed)",
    );
  });

  it("maps severity from the row", async () => {
    const row = {
      citizen_id: null,
      event_id: null,
      generated_at: "2026-05-03T10:00:00.000Z",
      generated_in_transition_id: null,
      id: "notif-crit",
      is_read: false,
      message_text: "Starvation occurred.",
      nation_id: null,
      nation: null,
      notification_type: "settlement.starvation_occurred",
      settlement_id: null,
      settlement: null,
      severity: "critical" as const,
      trade_route_id: null,
      world_id: "world-1",
      world: { name: "Earth" },
    };
    const client = createAllNotificationsClient({ rows: [row], total: 1 });
    const queryClient = createQueryClient();

    const result = await queryClient.fetchQuery(
      allNotificationsQueryOptions("user-1", {}, client),
    );

    expect(result.notifications[0]).toMatchObject({ severity: "critical" });
  });

  it("maps embedded citizen, event, transition, and trade route names", async () => {
    const row = {
      citizen_id: "citizen-1",
      citizen: { name: "Frodo" },
      event_id: "event-1",
      event: { name: "Harvest Festival" },
      generated_at: "2026-05-03T10:00:00.000Z",
      generated_in_transition_id: "transition-1",
      id: "notif-3",
      is_read: false,
      message_text: "Turn 2 is complete.",
      nation_id: null,
      nation: null,
      notification_type: "turn.completed",
      settlement_id: null,
      settlement: null,
      severity: "info" as const,
      trade_route_id: "route-1",
      trade_route: {
        origin_settlement: {
          id: "settlement-1",
          name: "Minas Tirith",
          nation_id: "nation-1",
        },
      },
      transition: {
        to_turn_number: 2,
        finished_at: "2026-05-03T12:00:00.000Z",
        started_at: "2026-05-03T11:00:00.000Z",
      },
      world_id: "world-1",
      world: { name: "Earth" },
    };
    const client = createAllNotificationsClient({ rows: [row], total: 1 });
    const queryClient = createQueryClient();

    const result = await queryClient.fetchQuery(
      allNotificationsQueryOptions("user-1", {}, client),
    );

    expect(result.notifications[0]).toMatchObject({
      citizenName: "Frodo",
      eventName: "Harvest Festival",
      transition: {
        toTurnNumber: 2,
        finishedAt: "2026-05-03T12:00:00.000Z",
        startedAt: "2026-05-03T11:00:00.000Z",
      },
      tradeRoute: {
        originSettlementId: "settlement-1",
        originSettlementName: "Minas Tirith",
        originNationId: "nation-1",
      },
    });
  });

  it("maps null citizen, event, transition, and trade route when embeds are absent", async () => {
    const row = {
      citizen_id: null,
      event_id: null,
      generated_at: "2026-05-03T10:00:00.000Z",
      generated_in_transition_id: null,
      id: "notif-4",
      is_read: false,
      message_text: "Nothing to report.",
      nation_id: null,
      nation: null,
      notification_type: "turn.completed",
      settlement_id: null,
      settlement: null,
      severity: "info" as const,
      trade_route_id: null,
      world_id: "world-1",
      world: { name: "Earth" },
    };
    const client = createAllNotificationsClient({ rows: [row], total: 1 });
    const queryClient = createQueryClient();

    const result = await queryClient.fetchQuery(
      allNotificationsQueryOptions("user-1", {}, client),
    );

    expect(result.notifications[0]).toMatchObject({
      citizenName: null,
      eventName: null,
      transition: null,
      tradeRoute: null,
    });
  });
});

function createAllNotificationsClient({
  rows,
  total,
}: {
  readonly rows: readonly unknown[];
  readonly total: number;
}): GubernatorSupabaseClient {
  // Count query: from → select → eq(recipient) → awaitable { count, error }
  // Default filters (isRead=null, type=null) → no extra .eq() after recipient eq.
  const countRecipientEq = vi
    .fn()
    .mockResolvedValue({ count: total, error: null });
  const countSelect = vi.fn(() => ({ eq: countRecipientEq }));

  // Data query: from → select → eq(recipient) → order → order → range → awaitable { data, error }
  const range = vi.fn().mockResolvedValue({ data: rows, error: null });
  const secondOrder = vi.fn(() => ({ range }));
  const order = vi.fn(() => ({ order: secondOrder }));
  const dataRecipientEq = vi.fn(() => ({ order }));
  const dataSelect = vi.fn(() => ({ eq: dataRecipientEq }));

  const from = vi
    .fn()
    .mockReturnValueOnce({ select: createDisabledTypesSelect([]) })
    .mockReturnValueOnce({ select: countSelect })
    .mockReturnValueOnce({ select: dataSelect });

  return { from } as unknown as GubernatorSupabaseClient;
}

function createClient({
  secondEq,
}: {
  readonly secondEq: ReturnType<typeof vi.fn>;
}): GubernatorSupabaseClient {
  const from = vi
    .fn()
    .mockReturnValueOnce({ select: createDisabledTypesSelect([]) })
    .mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ eq: secondEq })),
      })),
    });

  return { from } as unknown as GubernatorSupabaseClient;
}

/** Mocks the notification_preferences select→eq(user_id)→eq(enabled,false) chain. */
function createDisabledTypesSelect(
  disabledTypes: readonly string[],
): ReturnType<typeof vi.fn> {
  const enabledEq = vi.fn().mockResolvedValue({
    data: disabledTypes.map((notificationType) => ({
      notification_type: notificationType,
    })),
    error: null,
  });
  const userEq = vi.fn(() => ({ eq: enabledEq }));
  return vi.fn(() => ({ eq: userEq }));
}

function createTurnCompletedQueryChain({
  data,
  error,
}: {
  readonly data: readonly unknown[] | null;
  readonly error: unknown;
}): {
  readonly client: GubernatorSupabaseClient;
  readonly from: ReturnType<typeof vi.fn>;
  readonly order: ReturnType<typeof vi.fn>;
  readonly recipientEq: ReturnType<typeof vi.fn>;
  readonly secondOrder: ReturnType<typeof vi.fn>;
  readonly select: ReturnType<typeof vi.fn>;
  readonly typeEq: ReturnType<typeof vi.fn>;
  readonly worldEq: ReturnType<typeof vi.fn>;
} {
  const secondOrder = vi.fn().mockResolvedValue({ data, error });
  const order = vi.fn(() => ({ order: secondOrder }));
  const worldEq = vi.fn(() => ({ order }));
  const typeEq = vi.fn(() => ({ eq: worldEq, order }));
  const recipientEq = vi.fn(() => ({ eq: typeEq }));
  const select = vi.fn(() => ({ eq: recipientEq }));
  const from = vi.fn(() => ({ select }));

  return {
    client: { from } as unknown as GubernatorSupabaseClient,
    from,
    order,
    recipientEq,
    secondOrder,
    select,
    typeEq,
    worldEq,
  };
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0 },
    },
  });
}
