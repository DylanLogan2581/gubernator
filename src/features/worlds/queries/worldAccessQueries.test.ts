import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  currentUserAdminWorldIdsQueryOptions,
  currentUserPlayerCharacterWorldIdsQueryOptions,
} from "./worldAccessQueries";

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

  it("returns staleTime of 5 minutes", () => {
    const options = currentUserAdminWorldIdsQueryOptions(
      "user-1",
      {} as GubernatorSupabaseClient,
    );
    expect(options.staleTime).toBe(5 * 60 * 1000);
  });

  it("returns gcTime of 10 minutes", () => {
    const options = currentUserAdminWorldIdsQueryOptions(
      "user-1",
      {} as GubernatorSupabaseClient,
    );
    expect(options.gcTime).toBe(10 * 60 * 1000);
  });
});

describe("currentUserPlayerCharacterWorldIdsQueryOptions", () => {
  it("fetches distinct world ids for the user's living player characters via RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: ["world-1", "world-2"],
      error: null,
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const worldIds = await queryClient.fetchQuery(
      currentUserPlayerCharacterWorldIdsQueryOptions("user-1", {
        rpc,
      } as unknown as GubernatorSupabaseClient),
    );

    expect(worldIds).toEqual(["world-1", "world-2"]);
    expect(rpc).toHaveBeenCalledWith("current_user_player_character_world_ids");
  });

  it("returns an empty array when the RPC returns null", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const worldIds = await queryClient.fetchQuery(
      currentUserPlayerCharacterWorldIdsQueryOptions("user-1", {
        rpc,
      } as unknown as GubernatorSupabaseClient),
    );

    expect(worldIds).toEqual([]);
  });

  it("uses a user-scoped query key", () => {
    const options = currentUserPlayerCharacterWorldIdsQueryOptions(
      "user-1",
      {} as GubernatorSupabaseClient,
    );

    expect(options.queryKey).toEqual([
      "world-access",
      "current-user-player-character-world-ids",
      "user-1",
    ]);
  });
});
