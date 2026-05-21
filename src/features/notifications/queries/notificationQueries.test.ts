import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
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
    const from = vi.fn(() => ({ select }));
    const queryClient = createQueryClient();

    const count = await queryClient.fetchQuery(
      unreadNotificationsCountQueryOptions("user-1", {
        from,
      } as unknown as GubernatorSupabaseClient),
    );

    expect(count).toBe(2);
    expect(from).toHaveBeenCalledWith("notifications");
    expect(select).toHaveBeenCalledWith("id", {
      count: "exact",
      head: true,
    });
    expect(firstEq).toHaveBeenCalledWith("recipient_user_id", "user-1");
    expect(secondEq).toHaveBeenCalledWith("is_read", false);
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

function createClient({
  secondEq,
}: {
  readonly secondEq: ReturnType<typeof vi.fn>;
}): GubernatorSupabaseClient {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ eq: secondEq })),
      })),
    })),
  } as unknown as GubernatorSupabaseClient;
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
  readonly select: ReturnType<typeof vi.fn>;
  readonly typeEq: ReturnType<typeof vi.fn>;
  readonly worldEq: ReturnType<typeof vi.fn>;
} {
  const order = vi.fn().mockResolvedValue({ data, error });
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
