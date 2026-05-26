import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WorldCalendarConfig } from "@/features/calendar";

import { NationListPage } from "./NationListPage";

import type { ReactNode } from "react";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    readonly children: ReactNode;
    readonly to: string;
    readonly params?: {
      readonly nationId?: string;
      readonly worldId?: string;
    };
  }) => {
    let href = to;
    if (params?.worldId !== undefined) {
      href = href.replace("$worldId", params.worldId);
    }
    if (params?.nationId !== undefined) {
      href = href.replace("$nationId", params.nationId);
    }
    return <a href={href}>{children}</a>;
  },
}));

const worldId = "00000000-0000-0000-0000-000000000101";

describe("NationListPage", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
  });

  it("shows a back link to the world shell", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        nationRows: [],
        session: { user: { id: "user-1" } },
        worldRows: [createWorldRow({ id: worldId, owner_id: "user-1" })],
      }),
    );

    renderPage();

    expect(
      await screen.findByRole("link", { name: "Back to world" }),
    ).toHaveAttribute("href", `/worlds/${worldId}`);
  });

  it("renders the empty state when there are no nations", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        nationRows: [],
        session: { user: { id: "user-1" } },
        worldRows: [createWorldRow({ id: worldId, owner_id: "user-1" })],
      }),
    );

    renderPage();

    expect(await screen.findByText("No nations yet")).toBeDefined();
  });

  it("renders nation rows with a hidden badge when applicable", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        nationRows: [
          createNationRow({
            description: "A mountain realm.",
            id: "11111111-1111-1111-1111-111111111111",
            is_hidden: false,
            name: "Highmark",
          }),
          createNationRow({
            description: null,
            id: "22222222-2222-2222-2222-222222222222",
            is_hidden: true,
            name: "Veilreach",
          }),
        ],
        session: { user: { id: "user-1" } },
        worldRows: [createWorldRow({ id: worldId, owner_id: "user-1" })],
      }),
    );

    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Highmark" }),
    ).toBeDefined();
    expect(screen.getByText("A mountain realm.")).toBeDefined();
    expect(screen.getByRole("heading", { name: "Veilreach" })).toBeDefined();
    expect(screen.getByText("Hidden")).toBeDefined();
    expect(screen.getByText("No description.")).toBeDefined();
  });

  it("links each nation row to the nation detail page", async () => {
    const nationId = "11111111-1111-1111-1111-111111111111";
    requireSupabaseClient.mockReturnValue(
      createClient({
        nationRows: [
          createNationRow({
            id: nationId,
            is_hidden: false,
            name: "Highmark",
          }),
        ],
        session: { user: { id: "user-1" } },
        worldRows: [createWorldRow({ id: worldId, owner_id: "user-1" })],
      }),
    );

    renderPage();

    const link = await screen.findByRole("link", { name: "Highmark" });
    expect(link).toHaveAttribute(
      "href",
      `/worlds/${worldId}/nations/${nationId}`,
    );
  });

  it("links hidden nations to the nation detail page", async () => {
    const nationId = "22222222-2222-2222-2222-222222222222";
    requireSupabaseClient.mockReturnValue(
      createClient({
        nationRows: [
          createNationRow({
            id: nationId,
            is_hidden: true,
            name: "Veilreach",
          }),
        ],
        session: { user: { id: "user-1" } },
        worldRows: [createWorldRow({ id: worldId, owner_id: "user-1" })],
      }),
    );

    renderPage();

    const link = await screen.findByRole("link", { name: "Veilreach" });
    expect(link).toHaveAttribute(
      "href",
      `/worlds/${worldId}/nations/${nationId}`,
    );
    expect(screen.getByText("Hidden")).toBeDefined();
  });

  it("shows the Create nation control for world admins", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        nationRows: [],
        session: { user: { id: "user-1" } },
        worldRows: [createWorldRow({ id: worldId, owner_id: "user-1" })],
      }),
    );

    renderPage();

    expect(
      await screen.findByRole("button", { name: /Create nation/i }),
    ).toBeDefined();
  });

  it("hides the Create nation control for non-admins", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        nationRows: [],
        session: { user: { id: "user-2" } },
        worldRows: [
          createWorldRow({
            id: worldId,
            owner_id: "user-1",
            visibility: "public",
          }),
        ],
      }),
    );

    renderPage();

    expect(await screen.findByText("No nations yet")).toBeDefined();
    expect(screen.queryByRole("button", { name: /Create nation/i })).toBeNull();
  });

  it("renders an access-denied state when the world is not visible", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        nationRows: [],
        session: { user: { id: "user-1" } },
        worldRows: [],
      }),
    );

    renderPage();

    expect(await screen.findByText("World unavailable")).toBeDefined();
  });
});

function renderPage(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <NationListPage worldId={worldId} />
    </QueryClientProvider>,
  );
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

type TestNationRow = {
  readonly created_at: string;
  readonly description: string | null;
  readonly id: string;
  readonly is_hidden: boolean;
  readonly name: string;
  readonly updated_at: string;
  readonly world_id: string;
};

type TestWorldRow = {
  readonly archived_at: string | null;
  readonly calendar_config_json: WorldCalendarConfig | null;
  readonly created_at: string;
  readonly current_turn_number: number;
  readonly id: string;
  readonly name: string;
  readonly owner_id: string;
  readonly status: string;
  readonly updated_at: string;
  readonly visibility: string;
};

type TestUser = {
  readonly created_at: string;
  readonly email: string;
  readonly id: string;
  readonly is_super_admin: boolean;
  readonly status: string;
  readonly updated_at: string;
  readonly username: string;
};

function createClient({
  adminRows = [],
  nationRows,
  session,
  worldRows,
}: {
  readonly adminRows?: readonly { readonly world_id: string }[];
  readonly nationRows: readonly TestNationRow[];
  readonly session: { readonly user: { readonly id: string } };
  readonly worldRows: readonly TestWorldRow[];
}): unknown {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === "users") {
        return createUsersQueryBuilder(createUser(session.user.id));
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
      throw new Error(`Unexpected table ${table}`);
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
    calendar_config_json: createCalendarConfig(),
    created_at: "2026-01-01T00:00:00.000Z",
    current_turn_number: 1,
    id: worldId,
    name: "World",
    owner_id: "user-1",
    status: "active",
    updated_at: "2026-01-02T00:00:00.000Z",
    visibility: "private",
    ...overrides,
  };
}

function createCalendarConfig(): WorldCalendarConfig {
  return {
    months: [
      { dayCount: 2, index: 0, name: "Dawn" },
      { dayCount: 3, index: 1, name: "Ember" },
    ],
    startingDayOfMonth: 1,
    startingMonthIndex: 0,
    startingWeekdayOffset: 0,
    startingYear: 100,
    weekdays: [
      { index: 0, name: "Firstday" },
      { index: 1, name: "Secondday" },
    ],
    dateFormatTemplate: "{weekday}, {month} {day}, {year} AG",
  };
}

function createNationRow(
  overrides: Partial<TestNationRow> = {},
): TestNationRow {
  return {
    created_at: "2026-01-01T00:00:00.000Z",
    description: null,
    id: "00000000-0000-0000-0000-0000000000aa",
    is_hidden: false,
    name: "Nation",
    updated_at: "2026-01-02T00:00:00.000Z",
    world_id: worldId,
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

function createNationsQueryBuilder(rows: readonly TestNationRow[]): unknown {
  const builder = {
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    returns: vi.fn().mockResolvedValue({ data: rows, error: null }),
    select: vi.fn(() => builder),
  };
  return builder;
}
