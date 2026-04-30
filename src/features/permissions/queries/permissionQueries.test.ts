import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { currentAccessContextQueryOptions } from "./permissionQueries";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

describe("currentAccessContextQueryOptions", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
  });

  it("returns anonymous access context without querying world admin ids", async () => {
    const queryClient = createQueryClient();
    const from = vi.fn();
    requireSupabaseClient.mockReturnValue(
      createClient({
        from,
        session: null,
      }),
    );

    const context = await queryClient.fetchQuery(
      currentAccessContextQueryOptions(queryClient),
    );

    expect(context.isAuthenticated).toBe(false);
    expect(context.isSuperAdmin).toBe(false);
    expect(context.worldAdminWorldIds).toEqual([]);
    expect(
      context.canAccessWorld({ id: "public-world", visibility: "public" }),
    ).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  it("returns current user access context with super-admin and world-admin ids", async () => {
    const queryClient = createQueryClient();
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        user: {
          created_at: "2026-01-01T00:00:00.000Z",
          email: "player@example.com",
          id: "user-1",
          is_super_admin: true,
          status: "active",
          updated_at: "2026-01-01T00:00:00.000Z",
          username: "player",
        },
        worldAdminRows: [{ world_id: "world-1" }, { world_id: "world-2" }],
      }),
    );

    const context = await queryClient.fetchQuery(
      currentAccessContextQueryOptions(queryClient),
    );

    expect(context.isAuthenticated).toBe(true);
    expect(context.isActiveUser).toBe(true);
    expect(context.isSuperAdmin).toBe(true);
    expect(context.userId).toBe("user-1");
    expect(context.worldAdminWorldIds).toEqual(["world-1", "world-2"]);
    expect(context.canAccessWorld({ id: "world-3" })).toBe(true);
  });

  it("returns blocked access context for inactive application users", async () => {
    const queryClient = createQueryClient();
    const inactiveUser = {
      created_at: "2026-01-01T00:00:00.000Z",
      email: "player@example.com",
      id: "user-1",
      is_super_admin: true,
      status: "suspended",
      updated_at: "2026-01-01T00:00:00.000Z",
      username: "player",
    };
    const from = vi.fn((table: string) => {
      if (table === "users") {
        return createUserQueryBuilder(inactiveUser);
      }

      if (table === "world_admins") {
        return createWorldAdminsQueryBuilder([{ world_id: "world-1" }]);
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    requireSupabaseClient.mockReturnValue(
      createClient({
        from,
        session: { user: { id: "user-1" } },
      }),
    );

    const context = await queryClient.fetchQuery(
      currentAccessContextQueryOptions(queryClient),
    );

    expect(context.isAuthenticated).toBe(true);
    expect(context.isActiveUser).toBe(false);
    expect(context.isSuperAdmin).toBe(false);
    expect(context.worldAdminWorldIds).toEqual([]);
    expect(context.canAccessWorld({ id: "world-1" })).toBe(false);
    expect(
      context.canAccessWorld({ id: "public-world", visibility: "public" }),
    ).toBe(false);
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("users");
  });
});

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
}

type FakeClientInput = {
  readonly from?: ReturnType<typeof vi.fn>;
  readonly session: {
    readonly user: {
      readonly id: string;
    };
  } | null;
  readonly user?: unknown;
  readonly worldAdminRows?: readonly { readonly world_id: string }[];
};

function createClient({
  from,
  session,
  user = null,
  worldAdminRows = [],
}: FakeClientInput): unknown {
  const fromHandler = from ?? vi.fn(createQueryBuilder);

  function createQueryBuilder(table: string): unknown {
    if (table === "users") {
      return createUserQueryBuilder(user);
    }

    if (table === "world_admins") {
      return createWorldAdminsQueryBuilder(worldAdminRows);
    }

    throw new Error(`Unexpected table: ${table}`);
  }

  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session },
        error: null,
      }),
    },
    from: fromHandler,
  };
}

function createUserQueryBuilder(user: unknown): unknown {
  const builder = {
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue({
      data: user,
      error: null,
    }),
    select: vi.fn(() => builder),
  };

  return builder;
}

function createWorldAdminsQueryBuilder(
  rows: readonly { readonly world_id: string }[],
): unknown {
  const builder = {
    eq: vi.fn(() => builder),
    order: vi.fn().mockResolvedValue({
      data: rows,
      error: null,
    }),
    select: vi.fn(() => builder),
  };

  return builder;
}
