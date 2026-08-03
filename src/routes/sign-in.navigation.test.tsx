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

// Lives in its own file (not sign-in.test.tsx) so it runs with a fresh module
// registry: driving a real sign-in mounts protected routes whose async work
// would otherwise leak between the auth-guard tests and these navigation tests.

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

describe("sign-in success navigation", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
  });

  // Regression guard for #1350: the success handler must drive the router
  // lifecycle (router.navigate) so the destination route actually renders.
  // The old router.history.push changed the URL but left the outlet blank
  // until a manual reload.
  it("renders the destination route instead of a blank page after sign-in", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(createSignInClient());
    const router = renderAt("/sign-in?returnTo=/worlds/test-world");

    await user.type(
      await screen.findByLabelText("Email"),
      "worldadmin@gubernator.local",
    );
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(
      () => {
        expect(router.state.location.pathname).toBe("/worlds/test-world");
      },
      { timeout: 3000 },
    );
    // The outlet rendered the resolved route (not a blank page), and the
    // non-default returnTo target was honored.
    expect(await screen.findByText("World unavailable")).toBeDefined();
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

function createSignInClient(): unknown {
  const signedInUser = createUser({ id: "user-1" });
  const session = { user: { id: "user-1" } };
  // State-based so the result never depends on call ordering: the session is
  // null until a sign-in succeeds, then non-null on every subsequent read.
  let isSignedIn = false;

  return {
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({
          data: { session: isSignedIn ? session : null },
          error: null,
        }),
      ),
      signInWithPassword: vi.fn(() => {
        isSignedIn = true;
        return Promise.resolve({
          data: { session, user: session.user },
          error: null,
        });
      }),
    },
    from: vi.fn((table: string) => {
      if (table === "users") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi
                .fn()
                .mockResolvedValue({ data: signedInUser, error: null }),
            })),
          })),
        };
      }

      if (table === "world_admins") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            })),
          })),
        };
      }

      if (table === "worlds") {
        const emptyResult = Promise.resolve({ data: [], error: null });
        return {
          select: vi.fn(() => ({
            order: vi.fn().mockReturnValue(emptyResult),
            eq: vi.fn(() => ({
              order: vi.fn().mockReturnValue(emptyResult),
              maybeSingle: vi
                .fn()
                .mockResolvedValue({ data: null, error: null }),
            })),
          })),
        };
      }

      if (table === "settlements") {
        const builder = {
          eq: vi.fn(() => builder),
          order: vi.fn(() => builder),
          returns: vi.fn().mockResolvedValue({ data: [], error: null }),
          select: vi.fn(() => builder),
        };
        return builder;
      }

      if (table === "notifications") {
        const chain: Record<string, unknown> = {};
        chain.eq = vi
          .fn()
          .mockResolvedValue({ count: 0, data: [], error: null });
        chain.order = vi.fn(() => chain);
        chain.range = vi.fn(() => chain);
        return { select: vi.fn(() => ({ eq: vi.fn(() => chain) })) };
      }

      if (table === "turn_transitions") {
        const builder = {
          eq: vi.fn(() => builder),
          limit: vi.fn(() => builder),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          order: vi.fn(() => builder),
          select: vi.fn(() => builder),
        };
        return builder;
      }

      if (table === "citizens") {
        const builder: Record<string, unknown> = {};
        builder.eq = vi.fn(() => builder);
        builder.order = vi.fn(() => builder);
        builder.returns = vi.fn().mockResolvedValue({ data: [], error: null });
        return { select: vi.fn(() => builder) };
      }

      if (table === "user_active_player_characters") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi
                  .fn()
                  .mockResolvedValue({ data: null, error: null }),
              })),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnValue({ subscribe: vi.fn().mockReturnValue({}) }),
    }),
    removeChannel: vi.fn().mockResolvedValue("ok"),
    rpc: vi.fn((fn: string) => {
      if (fn === "current_user_player_character_world_ids") {
        return Promise.resolve({ data: [], error: null });
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    }),
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
