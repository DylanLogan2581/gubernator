import { QueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { routeTree } from "@/routeTree.gen";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
  supabase: null,
}));

type TestRouter = {
  readonly state: {
    readonly location: {
      readonly pathname: string;
      readonly search: unknown;
    };
  };
};

describe("worlds route auth guard", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
  });

  it("redirects anonymous users to sign-in with a return path", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ session: null }));
    const router = renderAt("/worlds");

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/sign-in");
    });
    expect(router.state.location.search).toEqual({ returnTo: "/worlds" });
    expect(screen.queryByText("Worlds")).toBeNull();
  });

  it("redirects anonymous users from world routes to sign-in with a return path", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ session: null }));
    const router = renderAt("/worlds/00000000-0000-0000-0000-000000000101");

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/sign-in");
    });
    expect(router.state.location.search).toEqual({
      returnTo: "/worlds/00000000-0000-0000-0000-000000000101",
    });
    expect(screen.queryByText("World unavailable")).toBeNull();
  });

  it("allows authenticated users to enter the protected route", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({ session: { user: { id: "user-1" } } }),
    );

    renderAt("/worlds");

    expect(await screen.findByText("Worlds")).toBeDefined();
    expect(await screen.findByText("No accessible worlds")).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Sign in" })).toBeNull();
  });

  it("shows loading state while auth is resolving without leaking world data", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: new Promise(() => undefined),
      }),
    );

    renderAt("/worlds");

    expect(
      await screen.findByRole("status", { name: "Checking session…" }),
    ).toBeDefined();
    expect(screen.queryByText("Worlds")).toBeNull();
  });

  it("shows loading state on world routes while auth is resolving", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: new Promise(() => undefined),
      }),
    );

    renderAt("/worlds/00000000-0000-0000-0000-000000000101");

    expect(
      await screen.findByRole("status", { name: "Checking session…" }),
    ).toBeDefined();
    expect(screen.queryByText("World unavailable")).toBeNull();
  });
});

describe("worlds route list", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
  });

  it("renders accessible worlds returned by the worlds query module", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: [
          createWorldRow({
            id: "00000000-0000-0000-0000-000000000101",
            name: "Public World",
            owner_id: "user-2",
            visibility: "public",
          }),
          createWorldRow({
            id: "00000000-0000-0000-0000-000000000202",
            name: "Hidden World",
            owner_id: "user-1",
            visibility: "private",
          }),
          createWorldRow({
            id: "00000000-0000-0000-0000-000000000303",
            name: "Other Hidden World",
            owner_id: "user-3",
            visibility: "private",
          }),
        ],
      }),
    );

    renderAt("/worlds");

    expect(await screen.findByText("Public World")).toBeDefined();
    expect(await screen.findByText("Hidden World")).toBeDefined();
    expect(screen.getByText("Hidden")).toBeDefined();
    expect(screen.queryByText("Other Hidden World")).toBeNull();
  });

  it("shows an empty state when the user has no accessible worlds", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: [],
      }),
    );

    renderAt("/worlds");

    expect(await screen.findByText("No accessible worlds")).toBeDefined();
  });

  it("blocks inactive users without leaking accessible world details", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        currentUser: createUser({
          id: "user-1",
          is_super_admin: true,
          status: "suspended",
        }),
        session: { user: { id: "user-1" } },
        worldRows: [
          createWorldRow({
            id: "00000000-0000-0000-0000-000000000101",
            name: "Suspended Owner World",
            owner_id: "user-1",
            visibility: "private",
          }),
          createWorldRow({
            id: "00000000-0000-0000-0000-000000000202",
            name: "Public World",
            owner_id: "user-2",
            visibility: "public",
          }),
        ],
      }),
    );

    renderAt("/worlds");

    expect(await screen.findByText("Account access unavailable")).toBeDefined();
    expect(screen.getByText(/account is not active/i)).toBeDefined();
    expect(screen.queryByText("Suspended Owner World")).toBeNull();
    expect(screen.queryByText("Public World")).toBeNull();
  });

  it("shows the shared loading state while worlds are loading", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: new Promise(() => undefined),
      }),
    );

    renderAt("/worlds");

    expect(
      await screen.findByRole("status", { name: "Loading worlds…" }),
    ).toBeDefined();
  });

  it("shows the shared error state when accessible worlds fail to load", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldError: { message: "database unavailable" },
      }),
    );

    renderAt("/worlds");

    expect(await screen.findByRole("alert")).toBeDefined();
    expect(screen.getByText("Worlds could not be loaded")).toBeDefined();
    expect(screen.getByText("database unavailable")).toBeDefined();
  });

  it("navigates to the world shell when a world is selected", async () => {
    const user = userEvent.setup();

    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: [
          createWorldRow({
            id: "00000000-0000-0000-0000-000000000101",
            name: "Public World",
            owner_id: "user-1",
            visibility: "private",
          }),
        ],
      }),
    );

    const router = renderAt("/worlds");

    await user.click(
      await screen.findByRole("link", { name: /Public World/i }),
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        "/worlds/00000000-0000-0000-0000-000000000101",
      );
    });
    expect(
      await screen.findByRole("heading", { name: "Public World" }),
    ).toBeDefined();
    expect(screen.getByText("Planning turn")).toBeDefined();
    expect(screen.getByText("1")).toBeDefined();
  });
});

describe("world shell route", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
  });

  it("renders basic world context for authorized users", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: [
          createWorldRow({
            current_turn_number: 12,
            id: "00000000-0000-0000-0000-000000000404",
            name: "Eastern Marches",
            owner_id: "user-1",
            visibility: "private",
          }),
        ],
        settlementRows: [
          createSettlementRow({
            id: "settlement-1",
            name: "Amberhold",
          }),
        ],
      }),
    );

    renderAt("/worlds/00000000-0000-0000-0000-000000000404");

    expect(
      await screen.findByRole("heading", { name: "Eastern Marches" }),
    ).toBeDefined();
    expect(screen.getByText("Planning turn")).toBeDefined();
    expect(screen.getByText("12")).toBeDefined();
    expect(await screen.findByText("Settlement readiness list")).toBeDefined();
    expect(screen.getByText("Amberhold")).toBeDefined();
    expect(screen.queryByText(/citizen/i)).toBeNull();
  });

  it("renders a safe not-found state for missing or inaccessible worlds", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: [],
      }),
    );

    renderAt("/worlds/00000000-0000-0000-0000-000000000202");

    expect(await screen.findByText("World unavailable")).toBeDefined();
    expect(
      screen.getByText(
        "This world does not exist or your Gubernator account does not have access.",
      ),
    ).toBeDefined();
    expect(
      screen.queryByText("00000000-0000-0000-0000-000000000202"),
    ).toBeNull();
  });

  it("shows read-only status messaging for archived worlds", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: [
          createWorldRow({
            archived_at: "2026-01-03T00:00:00.000Z",
            id: "00000000-0000-0000-0000-000000000505",
            name: "Archived Realm",
            owner_id: "user-1",
            status: "archived",
          }),
        ],
      }),
    );

    renderAt("/worlds/00000000-0000-0000-0000-000000000505");

    expect(
      await screen.findByRole("heading", { name: "Archived Realm" }),
    ).toBeDefined();
    expect(screen.getByText("Read-only archive")).toBeDefined();
    expect(screen.getByText(/gameplay actions are read-only/i)).toBeDefined();
  });

  it("blocks inactive users on world routes without leaking world details", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        currentUser: createUser({
          id: "user-1",
          status: "deleted",
        }),
        session: { user: { id: "user-1" } },
        worldRows: [
          createWorldRow({
            id: "00000000-0000-0000-0000-000000000505",
            name: "Deleted Owner World",
            owner_id: "user-1",
            visibility: "private",
          }),
        ],
      }),
    );

    renderAt("/worlds/00000000-0000-0000-0000-000000000505");

    expect(await screen.findByText("Account access unavailable")).toBeDefined();
    expect(screen.getByText(/account is not active/i)).toBeDefined();
    expect(screen.queryByText("Deleted Owner World")).toBeNull();
  });
});

function renderAt(path: string): TestRouter {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
  const router = createRouter({
    defaultPendingMs: 0,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
    routeTree,
  });

  render(<RouterProvider router={router} />);

  return router;
}

function createClient({
  adminRows = [],
  currentUser,
  session,
  settlementRows = [],
  worldError = null,
  worldRows = [],
}: {
  readonly adminRows?: readonly { readonly world_id: string }[];
  readonly currentUser?: TestUser | null;
  readonly session:
    | Promise<unknown>
    | {
        readonly user: {
          readonly id: string;
        };
      }
    | null;
  readonly settlementRows?: readonly TestSettlementReadinessRow[];
  readonly worldError?: { readonly message: string } | null;
  readonly worldRows?: Promise<unknown> | readonly TestWorldRow[];
}): unknown {
  const userRow =
    currentUser === undefined &&
    session !== null &&
    !(session instanceof Promise)
      ? createUser({ id: session.user.id })
      : currentUser;
  const getSessionResult =
    session instanceof Promise
      ? session.then((resolvedSession) => ({
          data: { session: resolvedSession },
          error: null,
        }))
      : Promise.resolve({
          data: { session },
          error: null,
        });

  return {
    auth: {
      getSession: vi.fn().mockReturnValue(getSessionResult),
    },
    from: vi.fn((table: string) => {
      if (table === "users") {
        return createUsersQueryBuilder(userRow ?? null);
      }

      if (table === "world_admins") {
        return createWorldAdminsQueryBuilder(adminRows);
      }

      if (table === "worlds") {
        return createWorldsQueryBuilder(worldRows, worldError);
      }

      if (table === "settlements") {
        return createSettlementsQueryBuilder(settlementRows);
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

type TestUser = {
  readonly created_at: string;
  readonly email: string;
  readonly id: string;
  readonly is_super_admin: boolean;
  readonly status: string;
  readonly updated_at: string;
  readonly username: string;
};

type TestWorldRow = {
  readonly archived_at: string | null;
  readonly created_at: string;
  readonly current_turn_number: number;
  readonly id: string;
  readonly name: string;
  readonly owner_id: string;
  readonly status: string;
  readonly updated_at: string;
  readonly visibility: string;
};
type TestSettlementReadinessRow = {
  readonly auto_ready_enabled: boolean;
  readonly id: string;
  readonly is_ready_current_turn: boolean;
  readonly name: string;
  readonly nation_id: string;
  readonly ready_set_at: string | null;
};

function createUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    created_at: "2026-01-01T00:00:00.000Z",
    email: "user@example.com",
    id: "user-1",
    is_super_admin: false,
    status: "active",
    updated_at: "2026-01-01T00:00:00.000Z",
    username: "user",
    ...overrides,
  };
}

function createWorldRow(overrides: Partial<TestWorldRow> = {}): TestWorldRow {
  return {
    archived_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    current_turn_number: 1,
    id: "00000000-0000-0000-0000-000000000001",
    name: "World",
    owner_id: "user-1",
    status: "active",
    updated_at: "2026-01-02T00:00:00.000Z",
    visibility: "public",
    ...overrides,
  };
}

function createSettlementRow(
  overrides: Partial<TestSettlementReadinessRow> = {},
): TestSettlementReadinessRow {
  return {
    auto_ready_enabled: false,
    id: "settlement-1",
    is_ready_current_turn: false,
    name: "Settlement",
    nation_id: "nation-1",
    ready_set_at: null,
    ...overrides,
  };
}

function createUsersQueryBuilder(user: TestUser | null): unknown {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({ data: user, error: null }),
      })),
    })),
  };
}

function createWorldAdminsQueryBuilder(
  rows: readonly { readonly world_id: string }[],
): unknown {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn().mockResolvedValue({ data: rows, error: null }),
      })),
    })),
  };
}

function createWorldsQueryBuilder(
  rows: Promise<unknown> | readonly TestWorldRow[],
  error: { readonly message: string } | null,
): unknown {
  const result =
    rows instanceof Promise
      ? rows
      : Promise.resolve({
          data: rows,
          error,
        });

  return {
    select: vi.fn(() => ({
      order: vi.fn().mockReturnValue(result),
      eq: vi.fn((column: string, value: string) => {
        const data =
          rows instanceof Promise || column !== "id"
            ? null
            : (rows.find((row) => row.id === value) ?? null);

        return {
          maybeSingle: vi.fn().mockResolvedValue({
            data,
            error,
          }),
        };
      }),
    })),
  };
}

function createSettlementsQueryBuilder(
  rows: readonly TestSettlementReadinessRow[],
): unknown {
  const builder = {
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    returns: vi.fn().mockResolvedValue({ data: rows, error: null }),
    select: vi.fn(() => builder),
  };

  return builder;
}
