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

  it("redirects non-superadmin world admin away from ?tab=world-settings to resources", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        adminRows: [{ world_id: "00000000-0000-0000-0000-000000000303" }],
        session: { user: { id: "user-1" } },
        worldRows: [
          createWorldRow({
            id: "00000000-0000-0000-0000-000000000303",
            name: "Admin World",
            visibility: "private",
          }),
        ],
      }),
    );

    renderAt(
      "/worlds/00000000-0000-0000-0000-000000000303/configuration?tab=world-settings",
    );

    expect(
      await screen.findByRole("combobox", { name: "Configuration section" }),
    ).toHaveTextContent("Resources");
  });

  it("corrects an unknown ?tab= to the default tab in the URL", async () => {
    const worldId = "00000000-0000-0000-0000-000000000505";
    requireSupabaseClient.mockReturnValue(
      createClient({
        adminRows: [{ world_id: worldId }],
        session: { user: { id: "user-1" } },
        worldRows: [
          createWorldRow({
            id: worldId,
            name: "Admin World",
            visibility: "private",
          }),
        ],
      }),
    );

    const router = renderAt(`/worlds/${worldId}/configuration?tab=bogus`);

    expect(
      await screen.findByRole("combobox", { name: "Configuration section" }),
    ).toHaveTextContent("Resources");

    await waitFor(() => {
      expect(router.state.location.search).toEqual({ tab: "resources" });
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

    expect(
      await screen.findByRole("combobox", { name: "Configuration section" }),
    ).toHaveTextContent("Jobs");
  });

  // Regression for #1192: a pinned SETTLEMENT/NATION scope (from a prior
  // visit to a settlement page) must not leak into the WORLD sidebar's
  // active-tab highlighting while on the configuration route — the
  // settlement/nation sections should stay unhighlighted since their own
  // section guard (AppSidebar's isOnSettlementPage/isOnNationPage) only
  // reads a section from the pathname while actually on that scope's route.
  it("keeps the world admin sidebar active with Education highlighted despite a pinned settlement scope", async () => {
    const worldId = "00000000-0000-0000-0000-000000000404";
    const nationId = "00000000-0000-0000-0000-000000000405";
    const settlementId = "00000000-0000-0000-0000-000000000406";

    localStorage.setItem(
      `gubernator:world-scope-pin:${worldId}`,
      JSON.stringify({ nationId, settlementId }),
    );

    requireSupabaseClient.mockReturnValue(
      createClient({
        adminRows: [{ world_id: worldId }],
        session: { user: { id: "user-1" } },
        worldRows: [
          createWorldRow({
            id: worldId,
            name: "Admin World",
            visibility: "private",
          }),
        ],
        nationRows: [
          createNationRow({ id: nationId, name: "Homeland", worldId }),
        ],
        settlementRows: [
          createSettlementSummaryRow({
            id: settlementId,
            nationId,
            nationName: "Homeland",
          }),
        ],
      }),
    );

    renderAt(`/worlds/${worldId}/configuration?tab=education`);

    const educationLink = await screen.findByRole("link", {
      name: /Education/,
    });
    expect(educationLink).toHaveAttribute("data-active", "true");

    const constructionLink = await screen.findByRole("link", {
      name: /Construction/,
    });
    expect(constructionLink).toHaveAttribute("data-active", "false");

    const resourcesLink = screen.getByRole("link", { name: /Resources/ });
    expect(resourcesLink).toHaveAttribute("data-active", "false");

    // Only the clicked config tab should be marked active anywhere in the
    // sidebar — no SETTLEMENT/NATION section link (e.g. a stale "Overview"
    // or "Construction") should light up from the pinned scope.
    const activeLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("data-active") === "true");
    expect(activeLinks.map((link) => link.textContent)).toEqual([
      educationLink.textContent,
    ]);
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

type TestNationRow = {
  readonly id: string;
  readonly name: string;
  readonly world_id: string;
};

type TestSettlementSummaryRow = {
  readonly id: string;
  readonly name: string;
  readonly nation_id: string;
  readonly nations: { readonly name: string };
};

function createClient({
  adminRows = [],
  nationRows = [],
  session,
  settlementRows = [],
  worldRows = [],
}: {
  readonly adminRows?: readonly { readonly world_id: string }[];
  readonly nationRows?: readonly TestNationRow[];
  readonly session: {
    readonly user: {
      readonly id: string;
    };
  };
  readonly settlementRows?: readonly TestSettlementSummaryRow[];
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

      if (table === "nations") {
        return createNationsQueryBuilder(nationRows);
      }

      if (table === "settlements") {
        return createSettlementsQueryBuilder(settlementRows);
      }

      if (table === "user_active_player_characters") {
        const b: Record<string, unknown> = {};
        b.eq = vi.fn(() => b);
        b.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        return { select: vi.fn(() => b) };
      }

      if (table === "notifications") {
        return createNotificationsQueryBuilder();
      }

      throw new Error(`Unexpected table ${table}`);
    }),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnValue({
        subscribe: vi.fn().mockReturnValue({}),
      }),
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

function chainBuilder(result: unknown): Record<string, unknown> {
  const builder: Record<string, unknown> = {};
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.returns = vi.fn(() => Promise.resolve(result));
  builder.then = (
    resolve: (value: unknown) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

function createNationsQueryBuilder(rows: readonly TestNationRow[]): unknown {
  return {
    select: vi.fn(() => chainBuilder({ data: rows, error: null })),
  };
}

function createSettlementsQueryBuilder(
  rows: readonly TestSettlementSummaryRow[],
): unknown {
  return {
    select: vi.fn(() => chainBuilder({ data: rows, error: null })),
  };
}

function createNationRow(overrides: {
  readonly id: string;
  readonly name: string;
  readonly worldId: string;
}): TestNationRow {
  return {
    id: overrides.id,
    name: overrides.name,
    world_id: overrides.worldId,
  };
}

function createSettlementSummaryRow(overrides: {
  readonly id: string;
  readonly nationId: string;
  readonly nationName: string;
}): TestSettlementSummaryRow {
  return {
    id: overrides.id,
    name: "Hometown",
    nation_id: overrides.nationId,
    nations: { name: overrides.nationName },
  };
}

function createNotificationsQueryBuilder(): unknown {
  const chain: Record<string, unknown> = {};
  chain.eq = vi.fn().mockResolvedValue({ count: 0, data: [], error: null });
  chain.order = vi.fn(() => chain);
  chain.range = vi.fn(() => chain);
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => chain),
    })),
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
