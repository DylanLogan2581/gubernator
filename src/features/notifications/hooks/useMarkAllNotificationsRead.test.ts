import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { notificationQueryKeys } from "../queries/notificationQueryKeys";

import { useMarkAllNotificationsRead } from "./useMarkAllNotificationsRead";

describe("useMarkAllNotificationsRead", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  function createMockClient(): {
    readonly client: GubernatorSupabaseClient;
    readonly rpc: ReturnType<typeof vi.fn>;
  } {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    return { client: { rpc } as unknown as GubernatorSupabaseClient, rpc };
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

  it("calls the mark-all-read rpc and invalidates notification queries", async () => {
    const { client, rpc } = createMockClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useMarkAllNotificationsRead(client), {
      wrapper,
    });

    act(() => {
      result.current.handleMarkAllRead();
    });

    await waitFor(() => {
      expect(rpc).toHaveBeenCalledWith("mark_all_notifications_read");
    });

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: notificationQueryKeys.all,
      });
    });
  });
});
