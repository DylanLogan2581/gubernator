import { QueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
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

describe("sign-in route auth guard", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
  });

  it("shows the sign-in form to anonymous users", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ session: null }));

    renderAt("/sign-in");

    expect(
      await screen.findByRole("heading", { name: "Sign in" }),
    ).toBeDefined();
    expect(screen.getByLabelText("Email")).toBeDefined();
    expect(screen.getByLabelText("Password")).toBeDefined();
  });

  it("redirects authenticated users to worlds by default", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({ session: { user: { id: "user-1" } } }),
    );
    const router = renderAt("/sign-in");

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/worlds");
    });
    expect(screen.queryByRole("heading", { name: "Sign in" })).toBeNull();
  });

  it("redirects authenticated users to a normalized safe return path", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({ session: { user: { id: "user-1" } } }),
    );
    const router = renderAt("/sign-in?returnTo=/worlds/test-world");

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/worlds/test-world");
    });
    expect(screen.queryByRole("heading", { name: "Sign in" })).toBeNull();
  });

  it("defaults unsafe return paths before redirecting authenticated users", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({ session: { user: { id: "user-1" } } }),
    );
    const router = renderAt("/sign-in?returnTo=https://example.com");

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/worlds");
    });
    expect(router.state.location.search).toEqual({});
  });

  it("shows loading state while auth is resolving without flashing the form", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({ session: new Promise(() => undefined) }),
    );

    renderAt("/sign-in");

    expect(
      await screen.findByRole("status", { name: "Checking session…" }),
    ).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Sign in" })).toBeNull();
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
  session,
}: {
  readonly session:
    | Promise<unknown>
    | {
        readonly user: {
          readonly id: string;
        };
      }
    | null;
}): unknown {
  const userRow =
    session !== null && !(session instanceof Promise)
      ? createUser({ id: session.user.id })
      : null;
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
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { session: null, user: null },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === "users") {
        return createUsersQueryBuilder(userRow);
      }

      if (table === "world_admins") {
        return createWorldAdminsQueryBuilder();
      }

      if (table === "worlds") {
        return createWorldsQueryBuilder();
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

function createUsersQueryBuilder(user: TestUser | null): unknown {
  return {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: user, error: null }),
    select: vi.fn().mockReturnThis(),
  };
}

function createWorldAdminsQueryBuilder(): unknown {
  return {
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
    select: vi.fn().mockReturnThis(),
  };
}

function createWorldsQueryBuilder(): unknown {
  return {
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
    select: vi.fn().mockReturnThis(),
  };
}

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

type TestUser = {
  readonly created_at: string;
  readonly email: string;
  readonly id: string;
  readonly is_super_admin: boolean;
  readonly status: string;
  readonly updated_at: string;
  readonly username: string;
};
