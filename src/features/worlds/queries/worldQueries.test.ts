import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { createAccessContext } from "@/features/permissions";
import { type GubernatorSupabaseClient } from "@/lib/supabase";

import { accessibleWorldsQueryOptions } from "./worldQueries";

describe("accessibleWorldsQueryOptions", () => {
  it("returns an empty list without querying worlds when unauthenticated", async () => {
    const from = vi.fn();
    const queryClient = createQueryClient();
    const accessContext = createAccessContext({
      isSuperAdmin: false,
      userId: null,
      worldAdminWorldIds: [],
    });

    const worlds = await queryClient.fetchQuery(
      accessibleWorldsQueryOptions(accessContext, {
        from,
      } as unknown as GubernatorSupabaseClient),
    );

    expect(worlds).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it("queries worlds through the browser client and maps display fields", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          archived_at: null,
          created_at: "2026-01-01T00:00:00.000Z",
          current_turn_number: 5,
          id: "00000000-0000-0000-0000-000000000101",
          name: "Local Development World",
          owner_id: "user-1",
          status: "active",
          updated_at: "2026-01-02T00:00:00.000Z",
          visibility: "private",
        },
      ],
      error: null,
    });
    const select = vi.fn(() => ({ order }));
    const from = vi.fn(() => ({ select }));
    const queryClient = createQueryClient();
    const accessContext = createAccessContext({
      isSuperAdmin: false,
      userId: "user-1",
      worldAdminWorldIds: [],
    });

    const worlds = await queryClient.fetchQuery(
      accessibleWorldsQueryOptions(accessContext, {
        from,
      } as unknown as GubernatorSupabaseClient),
    );

    expect(worlds).toEqual([
      expect.objectContaining({
        canAccess: true,
        canManage: true,
        currentTurnNumber: 5,
        isArchived: false,
        isHidden: true,
        name: "Local Development World",
        ownerId: "user-1",
        slug: "local-development-world-00000000",
      }),
    ]);
    expect(from).toHaveBeenCalledWith("worlds");
    expect(select).toHaveBeenCalledWith(
      "archived_at,created_at,current_turn_number,id,name,owner_id,status,updated_at,visibility",
    );
    expect(order).toHaveBeenCalledWith("updated_at", { ascending: false });
  });

  it("handles empty accessible world results", async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    const select = vi.fn(() => ({ order }));
    const from = vi.fn(() => ({ select }));
    const queryClient = createQueryClient();
    const accessContext = createAccessContext({
      isSuperAdmin: false,
      userId: "user-1",
      worldAdminWorldIds: [],
    });

    const worlds = await queryClient.fetchQuery(
      accessibleWorldsQueryOptions(accessContext, {
        from,
      } as unknown as GubernatorSupabaseClient),
    );

    expect(worlds).toEqual([]);
  });

  it("filters worlds not allowed by the permission context", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          archived_at: null,
          created_at: "2026-01-01T00:00:00.000Z",
          current_turn_number: 5,
          id: "00000000-0000-0000-0000-000000000101",
          name: "Private Other World",
          owner_id: "user-2",
          status: "active",
          updated_at: "2026-01-02T00:00:00.000Z",
          visibility: "private",
        },
      ],
      error: null,
    });
    const select = vi.fn(() => ({ order }));
    const from = vi.fn(() => ({ select }));
    const queryClient = createQueryClient();
    const accessContext = createAccessContext({
      isSuperAdmin: false,
      userId: "user-1",
      worldAdminWorldIds: [],
    });

    const worlds = await queryClient.fetchQuery(
      accessibleWorldsQueryOptions(accessContext, {
        from,
      } as unknown as GubernatorSupabaseClient),
    );

    expect(worlds).toEqual([]);
  });

  it("uses permission-context scoped query keys", () => {
    const accessContext = createAccessContext({
      isSuperAdmin: true,
      userId: "user-1",
      worldAdminWorldIds: ["world-1"],
    });

    const options = accessibleWorldsQueryOptions(
      accessContext,
      {} as GubernatorSupabaseClient,
    );

    expect(options.queryKey).toEqual([
      "worlds",
      "accessible",
      "user-1",
      true,
      "world-1",
    ]);
  });
});

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}
