import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { currentUserAdminWorldIdsQueryOptions } from "./worldAccessQueries";

describe("currentUserAdminWorldIdsQueryOptions", () => {
  it("fetches current user's admin world ids", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{ world_id: "world-1" }, { world_id: "world-2" }],
      error: null,
    });
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const worldIds = await queryClient.fetchQuery(
      currentUserAdminWorldIdsQueryOptions("user-1", {
        from,
      } as unknown as GubernatorSupabaseClient),
    );

    expect(worldIds).toEqual(["world-1", "world-2"]);
    expect(from).toHaveBeenCalledWith("world_admins");
    expect(select).toHaveBeenCalledWith("world_id");
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(order).toHaveBeenCalledWith("world_id", { ascending: true });
  });

  it("uses a user-scoped query key", () => {
    const options = currentUserAdminWorldIdsQueryOptions(
      "user-1",
      {} as GubernatorSupabaseClient,
    );

    expect(options.queryKey).toEqual([
      "world-access",
      "current-user-admin-world-ids",
      "user-1",
    ]);
  });
});
