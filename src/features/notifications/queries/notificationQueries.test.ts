import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { unreadNotificationsCountQueryOptions } from "./notificationQueries";

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

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0 },
    },
  });
}
