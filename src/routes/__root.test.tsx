import { QueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";
import { routeTree } from "@/routeTree.gen";

const requireSupabaseClient = vi.hoisted(() => vi.fn<() => unknown>());
const supabaseState = vi.hoisted<{ current: unknown }>(() => ({
  current: null,
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
  get supabase() {
    return supabaseState.current;
  },
}));

type RenderResult = {
  readonly queryClient: QueryClient;
  readonly router: {
    readonly state: {
      readonly location: {
        readonly pathname: string;
      };
    };
  };
};

function renderAt(
  path: string,
  queryClient = createTestQueryClient(),
): RenderResult {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
  });
  render(<RouterProvider router={router} />);

  return { queryClient, router };
}

describe("not-found route", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    requireSupabaseClient.mockReturnValue(createClient());
    supabaseState.current = null;
  });

  it("renders a branded fallback for unknown routes", async () => {
    renderAt("/this-route-does-not-exist");
    expect(await screen.findByText("Page not found")).toBeDefined();
  });

  it("provides a link back to home", async () => {
    renderAt("/another-missing-route");
    await screen.findByText("Page not found");
    expect(screen.getByRole("link", { name: "Go to home" })).toBeDefined();
  });

  it("does not render template copy on the fallback", async () => {
    renderAt("/no-such-page");
    await screen.findByText("Page not found");
    expect(screen.queryByText(/web application template/i)).toBeNull();
    expect(screen.queryByText(/Small demo, strong defaults/i)).toBeNull();
  });

  it("still renders the app shell around the fallback", async () => {
    renderAt("/not-a-real-route");
    await screen.findByText("Page not found");
    expect(screen.getByText("Gubernator")).toBeDefined();
  });
});

describe("app shell auth controls", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    requireSupabaseClient.mockReturnValue(createClient());
  });

  it("does not expose sign-out when no user is authenticated", async () => {
    renderAt("/");

    await screen.findByRole("heading", { name: "Gubernator" });
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
  });

  it("signs out authenticated users, clears cached data, and redirects", async () => {
    const user = userEvent.setup();
    const signOut = vi.fn().mockResolvedValue({ error: null });
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["worlds"], [{ id: "world-1" }]);
    requireSupabaseClient.mockReturnValue(
      createClient({
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: "user-1" } } },
          error: null,
        }),
        signOut,
      }),
    );
    const { router } = renderAt("/worlds", queryClient);

    await user.click(await screen.findByRole("button", { name: "Sign out" }));

    await expect.poll(() => signOut).toHaveBeenCalledOnce();
    expect(queryClient.getQueryData(["worlds"])).toBeUndefined();
    await expect.poll(() => router.state.location.pathname).toBe("/");
  });

  it("shows safe sign-out failure copy", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: "user-1" } } },
          error: null,
        }),
        signOut: vi.fn().mockResolvedValue({
          error: { message: "Internal credential cleanup failed." },
        }),
      }),
    );

    renderAt("/worlds");
    await user.click(await screen.findByRole("button", { name: "Sign out" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sign-out failed. Try again.",
    );
    expect(
      screen.queryByText("Internal credential cleanup failed."),
    ).toBeNull();
  });

  it("syncs cached auth-dependent queries from root auth events", async () => {
    const authState: { handler: AuthStateHandler | null } = {
      handler: null,
    };
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(
      authStateQueryCacheKeys.currentSession(),
      createSession("user-1"),
    );
    queryClient.setQueryData(
      [...authStateQueryCacheKeys.worldsAll, "accessible", "user-1"],
      [{ id: "world-1" }],
    );
    supabaseState.current = createAuthStateClient((handler) => {
      authState.handler = handler;
    });

    renderAt("/", queryClient);
    await screen.findByRole("heading", { name: "Gubernator" });

    if (authState.handler === null) {
      throw new Error("Expected root layout to subscribe to auth state.");
    }

    authState.handler("SIGNED_OUT", null);

    await waitFor(() => {
      expect(
        queryClient.getQueryData(authStateQueryCacheKeys.currentSession()),
      ).toBeNull();
    });
    expect(queryClient.getQueriesData({ queryKey: ["worlds"] })).toEqual([]);
  });
});

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
}

function createClient(
  client: {
    readonly getSession?: unknown;
    readonly signOut?: unknown;
  } = {},
): unknown {
  return {
    auth: {
      getSession:
        client.getSession ??
        vi.fn().mockResolvedValue({
          data: { session: null },
          error: null,
        }),
      signOut:
        client.signOut ??
        vi.fn().mockResolvedValue({
          error: null,
        }),
    },
    from: vi.fn((table: string) => {
      if (table === "users") {
        return createUsersQueryBuilder();
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

type AuthStateHandler = (event: "SIGNED_OUT", session: null) => void;

function createAuthStateClient(
  onSubscribe: (handler: AuthStateHandler) => void,
): unknown {
  return {
    auth: {
      onAuthStateChange: vi.fn((handler: AuthStateHandler) => {
        onSubscribe(handler);

        return {
          data: {
            subscription: {
              unsubscribe: vi.fn(),
            },
          },
        };
      }),
    },
  };
}

function createSession(userId: string): {
  readonly user: {
    readonly id: string;
  };
} {
  return { user: { id: userId } };
}

function createUsersQueryBuilder(): unknown {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            created_at: "2026-01-01T00:00:00.000Z",
            email: "user@example.com",
            id: "user-1",
            is_super_admin: false,
            status: "active",
            updated_at: "2026-01-01T00:00:00.000Z",
            username: "user",
          },
          error: null,
        }),
      })),
    })),
  };
}

function createWorldAdminsQueryBuilder(): unknown {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    })),
  };
}

function createWorldsQueryBuilder(): unknown {
  return {
    select: vi.fn(() => ({
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  };
}
