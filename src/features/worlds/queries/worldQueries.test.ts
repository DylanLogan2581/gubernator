import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { createAccessContext } from "@/features/permissions";
import { type GubernatorSupabaseClient } from "@/lib/supabase";

import {
  WorldNotFoundError,
  accessibleWorldsQueryOptions,
  isWorldNotFoundError,
  shouldRetryWorldRouteAccessQuery,
  worldRouteAccessQueryOptions,
} from "./worldQueries";

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

  it("returns an empty list without querying worlds for inactive users", async () => {
    const from = vi.fn();
    const queryClient = createQueryClient();
    const accessContext = createAccessContext({
      isActiveUser: false,
      isSuperAdmin: true,
      userId: "user-1",
      worldAdminWorldIds: ["world-1"],
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
      true,
      "world-1",
    ]);
  });
});

describe("worldRouteAccessQueryOptions", () => {
  it("loads a world by id with shell header data", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: createWorldRow({
        current_turn_number: 8,
        id: "00000000-0000-0000-0000-000000000101",
        name: "Local Development World",
        owner_id: "user-1",
        visibility: "private",
      }),
      error: null,
    });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const queryClient = createQueryClient();
    const accessContext = createAccessContext({
      isSuperAdmin: false,
      userId: "user-1",
      worldAdminWorldIds: [],
    });

    const routeAccess = await queryClient.fetchQuery(
      worldRouteAccessQueryOptions(
        "00000000-0000-0000-0000-000000000101",
        accessContext,
        {
          from,
        } as unknown as GubernatorSupabaseClient,
      ),
    );

    expect(routeAccess.canAdmin).toBe(true);
    expect(routeAccess.canManage).toBe(true);
    expect(routeAccess.header).toEqual({
      archivedAt: null,
      currentTurnNumber: 8,
      isArchived: false,
      name: "Local Development World",
      slug: "local-development-world-00000000",
      status: "active",
      visibility: "private",
    });
    expect(routeAccess.world.id).toBe("00000000-0000-0000-0000-000000000101");
    expect(routeAccess.world.name).toBe("Local Development World");
    expect(routeAccess.world.slug).toBe("local-development-world-00000000");
    expect(from).toHaveBeenCalledWith("worlds");
    expect(select).toHaveBeenCalledWith(
      "archived_at,created_at,current_turn_number,id,name,owner_id,status,updated_at,visibility",
    );
    expect(eq).toHaveBeenCalledWith(
      "id",
      "00000000-0000-0000-0000-000000000101",
    );
    expect(maybeSingle).toHaveBeenCalledWith();
  });

  it("keeps route identifiers stable when a world is renamed", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: createWorldRow({
        id: "00000000-0000-0000-0000-000000000101",
        name: "Renamed Local Development World",
        owner_id: "user-1",
        visibility: "private",
      }),
      error: null,
    });
    const select = vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) }));
    const queryClient = createQueryClient();
    const accessContext = createAccessContext({
      isSuperAdmin: false,
      userId: "user-1",
      worldAdminWorldIds: [],
    });

    const routeAccess = await queryClient.fetchQuery(
      worldRouteAccessQueryOptions(
        "00000000-0000-0000-0000-000000000101",
        accessContext,
        {
          from: vi.fn(() => ({ select })),
        } as unknown as GubernatorSupabaseClient,
      ),
    );

    expect(routeAccess.header.name).toBe("Renamed Local Development World");
    expect(routeAccess.world.id).toBe("00000000-0000-0000-0000-000000000101");
  });

  it("returns not-found when the id does not exist in RLS-visible rows", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const select = vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) }));
    const queryClient = createQueryClient();
    const accessContext = createAccessContext({
      isSuperAdmin: false,
      userId: "user-1",
      worldAdminWorldIds: [],
    });

    await expect(
      queryClient.fetchQuery(
        worldRouteAccessQueryOptions(
          "ffffffff-ffff-ffff-ffff-ffffffffffff",
          accessContext,
          {
            from: vi.fn(() => ({ select })),
          } as unknown as GubernatorSupabaseClient,
        ),
      ),
    ).rejects.toBeInstanceOf(WorldNotFoundError);
  });

  it("returns not-found when RLS does not expose the requested world", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const select = vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) }));
    const queryClient = createQueryClient();
    const accessContext = createAccessContext({
      isSuperAdmin: false,
      userId: "user-1",
      worldAdminWorldIds: [],
    });

    await expect(
      queryClient.fetchQuery(
        worldRouteAccessQueryOptions(
          "00000000-0000-0000-0000-000000000202",
          accessContext,
          {
            from: vi.fn(() => ({ select })),
          } as unknown as GubernatorSupabaseClient,
        ),
      ),
    ).rejects.toMatchObject({
      message: "World not found.",
      worldId: "00000000-0000-0000-0000-000000000202",
    });
  });

  it("returns not-found without querying worlds when unauthenticated", async () => {
    const from = vi.fn();
    const queryClient = createQueryClient();
    const accessContext = createAccessContext({
      isSuperAdmin: false,
      userId: null,
      worldAdminWorldIds: [],
    });

    await expect(
      queryClient.fetchQuery(
        worldRouteAccessQueryOptions(
          "00000000-0000-0000-0000-000000000101",
          accessContext,
          {
            from,
          } as unknown as GubernatorSupabaseClient,
        ),
      ),
    ).rejects.toSatisfy(isWorldNotFoundError);
    expect(from).not.toHaveBeenCalled();
  });

  it("returns not-found without querying worlds for inactive users", async () => {
    const from = vi.fn();
    const queryClient = createQueryClient();
    const accessContext = createAccessContext({
      isActiveUser: false,
      isSuperAdmin: true,
      userId: "user-1",
      worldAdminWorldIds: ["world-1"],
    });

    await expect(
      queryClient.fetchQuery(
        worldRouteAccessQueryOptions(
          "00000000-0000-0000-0000-000000000101",
          accessContext,
          {
            from,
          } as unknown as GubernatorSupabaseClient,
        ),
      ),
    ).rejects.toSatisfy(isWorldNotFoundError);
    expect(from).not.toHaveBeenCalled();
  });

  it("preserves archived world state for shell headers", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: createWorldRow({
        archived_at: "2026-01-03T00:00:00.000Z",
        id: "00000000-0000-0000-0000-000000000404",
        name: "Archived World",
        status: "archived",
      }),
      error: null,
    });
    const select = vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) }));
    const queryClient = createQueryClient();
    const accessContext = createAccessContext({
      isSuperAdmin: false,
      userId: "user-1",
      worldAdminWorldIds: [],
    });

    const routeAccess = await queryClient.fetchQuery(
      worldRouteAccessQueryOptions(
        "00000000-0000-0000-0000-000000000404",
        accessContext,
        {
          from: vi.fn(() => ({ select })),
        } as unknown as GubernatorSupabaseClient,
      ),
    );

    expect(routeAccess.header).toEqual(
      expect.objectContaining({
        archivedAt: "2026-01-03T00:00:00.000Z",
        isArchived: true,
        status: "archived",
      }),
    );
    expect(routeAccess.world.isArchived).toBe(true);
  });

  it("uses id and permission-context scoped query keys", () => {
    const accessContext = createAccessContext({
      isSuperAdmin: true,
      userId: "user-1",
      worldAdminWorldIds: ["world-1"],
    });

    const options = worldRouteAccessQueryOptions(
      "00000000-0000-0000-0000-000000000101",
      accessContext,
      {} as GubernatorSupabaseClient,
    );

    expect(options.queryKey).toEqual([
      "worlds",
      "by-id",
      "00000000-0000-0000-0000-000000000101",
      "user-1",
      true,
      true,
      "world-1",
    ]);
  });

  it("does not retry not-found world route access results", () => {
    expect(
      shouldRetryWorldRouteAccessQuery(
        0,
        new WorldNotFoundError("ffffffff-ffff-ffff-ffff-ffffffffffff"),
      ),
    ).toBe(false);
    expect(
      shouldRetryWorldRouteAccessQuery(0, new Error("network failed")),
    ).toBe(true);
    expect(
      shouldRetryWorldRouteAccessQuery(3, new Error("network failed")),
    ).toBe(false);
  });
});

function createWorldRow(
  overrides: Partial<{
    readonly archived_at: string | null;
    readonly created_at: string;
    readonly current_turn_number: number;
    readonly id: string;
    readonly name: string;
    readonly owner_id: string;
    readonly status: string;
    readonly updated_at: string;
    readonly visibility: string;
  }> = {},
): {
  readonly archived_at: string | null;
  readonly created_at: string;
  readonly current_turn_number: number;
  readonly id: string;
  readonly name: string;
  readonly owner_id: string;
  readonly status: string;
  readonly updated_at: string;
  readonly visibility: string;
} {
  return {
    archived_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    current_turn_number: 5,
    id: "00000000-0000-0000-0000-000000000101",
    name: "Local Development World",
    owner_id: "user-1",
    status: "active",
    updated_at: "2026-01-02T00:00:00.000Z",
    visibility: "public",
    ...overrides,
  };
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}
