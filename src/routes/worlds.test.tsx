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
  };
}
