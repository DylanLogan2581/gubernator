import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WorldCalendarConfig } from "@/features/calendar";

import { WorldShellPage } from "./WorldShellPage";

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
  }: {
    readonly children: ReactNode;
    readonly to: string;
  }) => <a href={to}>{children}</a>,
}));

describe("WorldShellPage", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
  });

  it("renders planning turn and full fantasy date for authorized world context", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: [
          createWorldRow({
            calendar_config_json: createCalendarConfig(),
            current_turn_number: 7,
            id: "00000000-0000-0000-0000-000000000101",
            name: "Eastern Marches",
            owner_id: "user-1",
            visibility: "private",
          }),
        ],
        settlementRows: [
          {
            auto_ready_enabled: true,
            is_ready_current_turn: false,
          },
          {
            auto_ready_enabled: false,
            is_ready_current_turn: false,
          },
        ],
      }),
    );

    renderWorldShellPage("00000000-0000-0000-0000-000000000101");

    expect(
      await screen.findByRole("heading", { name: "Eastern Marches" }),
    ).toBeDefined();
    expect(screen.getByText("Planning turn")).toBeDefined();
    expect(screen.getByText("7")).toBeDefined();
    expect(screen.getByText("In-world date")).toBeDefined();
    expect(screen.getByText("Firstday, Dawn 2, 101 AG")).toBeDefined();
    expect(screen.getByText("private")).toBeDefined();
    expect(await screen.findByText("Settlement readiness")).toBeDefined();
    expect(screen.getByText("Total settlements")).toBeDefined();
    expect(screen.getByText("Not ready")).toBeDefined();
    expect(
      screen.getByRole("link", { name: "Back to worlds" }),
    ).toHaveAttribute("href", "/worlds");
  });

  it("renders archived worlds as read-only", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: [
          createWorldRow({
            archived_at: "2026-01-03T00:00:00.000Z",
            calendar_config_json: createCalendarConfig(),
            current_turn_number: 3,
            id: "00000000-0000-0000-0000-000000000202",
            name: "Archived Realm",
            owner_id: "user-1",
            status: "archived",
          }),
        ],
      }),
    );

    renderWorldShellPage("00000000-0000-0000-0000-000000000202");

    expect(
      await screen.findByRole("heading", { name: "Archived Realm" }),
    ).toBeDefined();
    expect(screen.getByText("Planning turn")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
    expect(screen.getByText("Firstday, Ember 1, 100 AG")).toBeDefined();
    expect(screen.getByText("Read-only archive")).toBeDefined();
    expect(screen.getByText(/gameplay actions are read-only/i)).toBeDefined();
  });

  it("renders a safe fallback when calendar data cannot be loaded", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: [
          createWorldRow({
            calendar_config_json: { months: [] },
            current_turn_number: 2,
            id: "00000000-0000-0000-0000-000000000303",
            name: "Broken Calendar Realm",
            owner_id: "user-1",
          }),
        ],
      }),
    );

    renderWorldShellPage("00000000-0000-0000-0000-000000000303");

    expect(
      await screen.findByRole("heading", { name: "Broken Calendar Realm" }),
    ).toBeDefined();
    expect(screen.getByText("Planning turn")).toBeDefined();
    expect(screen.getByText("2")).toBeDefined();
    expect(screen.getByText("Calendar unavailable")).toBeDefined();
  });

  it("renders back navigation for unavailable worlds", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: [],
      }),
    );

    renderWorldShellPage("00000000-0000-0000-0000-000000000404");

    expect(await screen.findByText("World unavailable")).toBeDefined();
    expect(
      screen.getByRole("link", { name: "Back to worlds" }),
    ).toHaveAttribute("href", "/worlds");
  });
});

function renderWorldShellPage(worldId: string): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <WorldShellPage worldId={worldId} />
    </QueryClientProvider>,
  );
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function createClient({
  adminRows = [],
  session,
  settlementRows = [],
  worldRows = [],
}: {
  readonly adminRows?: readonly { readonly world_id: string }[];
  readonly session: {
    readonly user: {
      readonly id: string;
    };
  };
  readonly settlementRows?: readonly TestSettlementReadinessSummaryRow[];
  readonly worldRows?: readonly TestWorldRow[];
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

      if (table === "settlements") {
        return createSettlementsQueryBuilder(settlementRows);
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
  readonly calendar_config_json: TestCalendarConfigJson;
  readonly created_at: string;
  readonly current_turn_number: number;
  readonly id: string;
  readonly name: string;
  readonly owner_id: string;
  readonly status: string;
  readonly updated_at: string;
  readonly visibility: string;
};
type TestCalendarConfigJson =
  | WorldCalendarConfig
  | { readonly months: [] }
  | null;
type TestSettlementReadinessSummaryRow = {
  readonly auto_ready_enabled: boolean;
  readonly is_ready_current_turn: boolean;
};

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
    id: "00000000-0000-0000-0000-000000000001",
    name: "World",
    owner_id: "user-1",
    status: "active",
    updated_at: "2026-01-02T00:00:00.000Z",
    visibility: "public",
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
    yearFormatTemplate: "{n} AG",
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

function createSettlementsQueryBuilder(
  rows: readonly TestSettlementReadinessSummaryRow[],
): unknown {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        returns: vi.fn().mockResolvedValue({ data: rows, error: null }),
      })),
    })),
  };
}
