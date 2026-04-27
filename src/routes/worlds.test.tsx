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
        "/worlds/public-world-00000000",
      );
    });
    expect(await screen.findByText("World shell")).toBeDefined();
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
    })),
  };
}
