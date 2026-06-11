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

describe("world configuration route", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
  });

  it("redirects authenticated non-admin users to the world shell", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: [
          createWorldRow({
            id: "00000000-0000-0000-0000-000000000101",
            name: "Public World",
            visibility: "public",
          }),
        ],
        adminRows: [],
      }),
    );

    const router = renderAt(
      "/worlds/00000000-0000-0000-0000-000000000101/configuration",
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        "/worlds/00000000-0000-0000-0000-000000000101",
      );
    });
  });

  it("marks the jobs tab as selected when ?tab=jobs is in the URL", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        adminRows: [{ world_id: "00000000-0000-0000-0000-000000000202" }],
        session: { user: { id: "user-1" } },
        worldRows: [
          createWorldRow({
            id: "00000000-0000-0000-0000-000000000202",
            name: "Admin World",
            visibility: "private",
          }),
        ],
      }),
    );

    renderAt(
      "/worlds/00000000-0000-0000-0000-000000000202/configuration?tab=jobs",
    );

    const jobsTab = await screen.findByRole("tab", { name: "Jobs" });
    expect(jobsTab).toHaveAttribute("aria-selected", "true");
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
  readonly calendar_config_json: null;
  readonly created_at: string;
  readonly current_turn_number: number;
  readonly id: string;
  readonly incest_prevention_depth: number;
  readonly name: string;
  readonly status: string;
  readonly updated_at: string;
  readonly visibility: string;
};

function createClient({
  adminRows = [],
  session,
  worldRows = [],
}: {
  readonly adminRows?: readonly { readonly world_id: string }[];
  readonly session: {
    readonly user: {
      readonly id: string;
    };
  };
  readonly worldRows?: readonly TestWorldRow[];
}): unknown {
  const userRow = createUser(session.user.id);

  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === "users") {
        return createUsersQueryBuilder(userRow);
      }

      if (table === "world_admins") {
        return createWorldAdminsQueryBuilder(adminRows);
      }

      if (table === "worlds") {
        return createWorldsQueryBuilder(worldRows);
      }

      if (table === "user_active_player_characters") {
        const b: Record<string, unknown> = {};
        b.eq = vi.fn(() => b);
        b.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        return { select: vi.fn(() => b) };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
    rpc: vi.fn((fn: string) => {
      if (fn === "current_user_player_character_world_ids") {
        return Promise.resolve({ data: [], error: null });
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    }),
  };
}

function createUser(id: string): TestUser {
  return {
    created_at: "2026-01-01T00:00:00.000Z",
    email: `${id}@example.com`,
    id,
    is_super_admin: false,
    status: "active",
    updated_at: "2026-01-01T00:00:00.000Z",
    username: id,
  };
}

function createWorldRow(overrides: Partial<TestWorldRow> = {}): TestWorldRow {
  return {
    archived_at: null,
    calendar_config_json: null,
    created_at: "2026-01-01T00:00:00.000Z",
    current_turn_number: 1,
    id: "00000000-0000-0000-0000-000000000001",
    incest_prevention_depth: 4,
    name: "World",
    status: "active",
    updated_at: "2026-01-02T00:00:00.000Z",
    visibility: "public",
    ...overrides,
  };
}

function createUsersQueryBuilder(user: TestUser): unknown {
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

function createWorldsQueryBuilder(rows: readonly TestWorldRow[]): unknown {
  return {
    select: vi.fn(() => ({
      order: vi.fn().mockResolvedValue({ data: rows, error: null }),
      eq: vi.fn((column: string, value: string) => {
        const data =
          column === "id"
            ? (rows.find((row) => row.id === value) ?? null)
            : null;

        return {
          maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
        };
      }),
    })),
  };
}
