import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WorldCalendarConfig } from "@/features/calendar";

import { NationDetailPage } from "./NationDetailPage";

import type { ReactNode } from "react";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

const { navigateMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    readonly children: ReactNode;
    readonly to: string;
    readonly params?: { readonly worldId?: string };
  }) => {
    const href =
      params?.worldId !== undefined
        ? to.replace("$worldId", params.worldId)
        : to;
    return <a href={href}>{children}</a>;
  },
  useNavigate: () => navigateMock,
}));

const worldId = "00000000-0000-0000-0000-000000000101";
const nationId = "11111111-1111-1111-1111-111111111111";

describe("NationDetailPage", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    navigateMock.mockReset();
  });

  it("renders nation name, description, and a back link to the nations list", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        nationRow: createNationRow({
          description: "A mountain realm.",
          name: "Highmark",
        }),
        session: { user: { id: "user-1" } },
        settlementRows: [],
        worldRows: [createWorldRow({ owner_id: "user-1" })],
      }),
    );

    renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Highmark" }),
    ).toBeDefined();
    expect(screen.getByText("A mountain realm.")).toBeDefined();
    expect(
      screen.getByRole("link", { name: "Back to nations" }),
    ).toHaveAttribute("href", `/worlds/${worldId}/nations`);
  });

  it("shows admin controls (edit, hide, delete) for world admins", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        nationRow: createNationRow({ name: "Highmark" }),
        session: { user: { id: "user-1" } },
        settlementRows: [],
        worldRows: [createWorldRow({ owner_id: "user-1" })],
      }),
    );

    renderPage();

    expect(await screen.findByRole("button", { name: /Edit/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /Hide nation/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /Delete nation/ })).toBeDefined();
  });

  it("hides admin controls for non-admin viewers", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        nationRow: createNationRow({ name: "Highmark" }),
        session: { user: { id: "user-2" } },
        settlementRows: [],
        worldRows: [
          createWorldRow({ owner_id: "user-1", visibility: "public" }),
        ],
      }),
    );

    renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Highmark" }),
    ).toBeDefined();
    expect(screen.queryByRole("button", { name: /Edit/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Hide nation/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Delete nation/ })).toBeNull();
  });

  it("lists settlements with links to the settlement detail page", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        nationRow: createNationRow({ name: "Highmark" }),
        session: { user: { id: "user-1" } },
        settlementRows: [
          {
            id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            name: "Stonehold",
            nation_id: nationId,
          },
        ],
        worldRows: [createWorldRow({ owner_id: "user-1" })],
      }),
    );

    renderPage();

    const link = await screen.findByRole("link", { name: "Stonehold" });
    expect(link).toHaveAttribute(
      "href",
      `/worlds/${worldId}/settlements/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`,
    );
  });

  it("redirects out when the nation is hidden and the viewer cannot manage the world", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        nationRow: createNationRow({ is_hidden: true, name: "Veilreach" }),
        session: { user: { id: "user-2" } },
        settlementRows: [],
        worldRows: [
          createWorldRow({ owner_id: "user-1", visibility: "public" }),
        ],
      }),
    );

    renderPage();

    await screen.findByRole("status", { name: "Redirecting…" });
    expect(navigateMock).toHaveBeenCalledWith({
      params: { worldId },
      replace: true,
      to: "/worlds/$worldId/nations",
    });
    expect(screen.queryByRole("heading", { name: "Veilreach" })).toBeNull();
  });

  it("shows the hidden badge to admins viewing a hidden nation", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        nationRow: createNationRow({ is_hidden: true, name: "Veilreach" }),
        session: { user: { id: "user-1" } },
        settlementRows: [],
        worldRows: [createWorldRow({ owner_id: "user-1" })],
      }),
    );

    renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Veilreach" }),
    ).toBeDefined();
    expect(screen.getByText("Hidden")).toBeDefined();
    expect(screen.getByRole("button", { name: /Show nation/ })).toBeDefined();
  });

  it("renders an access-denied state when the world is not visible", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        nationRow: createNationRow({ name: "Highmark" }),
        session: { user: { id: "user-1" } },
        settlementRows: [],
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
      <NationDetailPage nationId={nationId} worldId={worldId} />
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

type TestSettlementRow = {
  readonly id: string;
  readonly name: string;
  readonly nation_id: string;
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
  nationRow,
  session,
  settlementRows,
  worldRows,
}: {
  readonly adminRows?: readonly { readonly world_id: string }[];
  readonly nationRow: TestNationRow | null;
  readonly session: { readonly user: { readonly id: string } };
  readonly settlementRows: readonly TestSettlementRow[];
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
        return createNationsQueryBuilder(nationRow);
      }
      if (table === "settlements") {
        return createSettlementsQueryBuilder(settlementRows);
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
    id: nationId,
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

function createNationsQueryBuilder(row: TestNationRow | null): unknown {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
      })),
    })),
  };
}

function createSettlementsQueryBuilder(
  rows: readonly TestSettlementRow[],
): unknown {
  const builder = {
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    returns: vi.fn().mockResolvedValue({ data: rows, error: null }),
    select: vi.fn(() => builder),
  };
  return builder;
}
