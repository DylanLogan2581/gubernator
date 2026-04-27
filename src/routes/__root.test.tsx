import { QueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { routeTree } from "@/routeTree.gen";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
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
  };
}
