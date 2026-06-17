import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { notificationQueryKeys } from "../queries/notificationQueryKeys";

import { useNotificationsRealtime } from "./useNotificationsRealtime";

describe("useNotificationsRealtime", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  function createMockClient(): {
    readonly channel: ReturnType<typeof vi.fn>;
    readonly channelSubscription: object;
    readonly client: GubernatorSupabaseClient;
    readonly on: ReturnType<typeof vi.fn>;
    readonly removeChannel: ReturnType<typeof vi.fn>;
    readonly triggerEvent: () => void;
  } {
    let capturedCallback: (() => void) | null = null;

    const channelSubscription = {};
    const subscribe = vi.fn().mockReturnValue(channelSubscription);
    const on = vi
      .fn()
      .mockImplementation(
        (_event: string, _filter: unknown, callback: () => void) => {
          capturedCallback = callback;
          return { subscribe };
        },
      );
    const channel = vi.fn().mockReturnValue({ on });
    const removeChannel = vi.fn().mockResolvedValue("ok");

    return {
      channel,
      channelSubscription,
      client: { channel, removeChannel } as unknown as GubernatorSupabaseClient,
      on,
      removeChannel,
      triggerEvent: () => {
        capturedCallback?.();
      },
    };
  }

  function wrapper({
    children,
  }: {
    readonly children: React.ReactNode;
  }): React.JSX.Element {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  }

  it("subscribes to the notifications channel for the current user", () => {
    const { client, channel, on } = createMockClient();

    renderHook(() => useNotificationsRealtime("user-1", client), { wrapper });

    expect(channel).toHaveBeenCalledWith("notifications:user:user-1");
    expect(on).toHaveBeenCalledWith(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: "recipient_user_id=eq.user-1",
      },
      expect.any(Function),
    );
  });

  it("invalidates all notification queries when a change arrives", () => {
    const { client, triggerEvent } = createMockClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    renderHook(() => useNotificationsRealtime("user-1", client), { wrapper });

    act(() => {
      triggerEvent();
    });

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: notificationQueryKeys.all,
    });
  });

  it("does not subscribe when userId is null", () => {
    const { client, channel } = createMockClient();

    renderHook(() => useNotificationsRealtime(null, client), { wrapper });

    expect(channel).not.toHaveBeenCalled();
  });

  it("removes the channel on unmount", () => {
    const { client, removeChannel, channelSubscription } = createMockClient();

    const { unmount } = renderHook(
      () => useNotificationsRealtime("user-1", client),
      { wrapper },
    );

    unmount();

    expect(removeChannel).toHaveBeenCalledWith(channelSubscription);
  });

  it("resubscribes and removes old channel when userId changes", () => {
    const { client, channel, removeChannel } = createMockClient();

    const { rerender } = renderHook(
      ({ userId }: { readonly userId: string | null }) =>
        useNotificationsRealtime(userId, client),
      {
        wrapper,
        initialProps: { userId: "user-1" },
      },
    );

    expect(channel).toHaveBeenCalledTimes(1);
    expect(channel).toHaveBeenCalledWith("notifications:user:user-1");

    rerender({ userId: "user-2" });

    expect(removeChannel).toHaveBeenCalledTimes(1);
    expect(channel).toHaveBeenCalledTimes(2);
    expect(channel).toHaveBeenLastCalledWith("notifications:user:user-2");
  });
});
