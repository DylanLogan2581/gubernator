import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WorldCalendarConfig } from "@/features/calendar";

import { WorldListPage } from "./WorldListPage";

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
    params,
  }: {
    readonly children: ReactNode;
    readonly params: { readonly worldId: string };
  }) => <a href={`/worlds/${params.worldId}`}>{children}</a>,
}));

describe("WorldListPage", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
  });

  it("renders the world list loading state", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: new Promise(() => undefined),
      }),
    );

    renderWorldListPage();

    expect(
      await screen.findByRole("status", { name: "Loading worlds…" }),
    ).toBeDefined();
  });

  it("renders the no-access empty state", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: [],
      }),
    );

    renderWorldListPage();

    expect(await screen.findByText("No accessible worlds")).toBeDefined();
    expect(
      screen.getByText(
        "Your Gubernator account does not currently have access to any worlds.",
      ),
    ).toBeDefined();
  });

  it("renders accessible worlds", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: [
          createWorldRow({
            id: "00000000-0000-0000-0000-000000000101",
            name: "Public World",
            owner_id: "user-2",
            visibility: "public",
          }),
          createWorldRow({
            id: "00000000-0000-0000-0000-000000000202",
            name: "Private World",
            owner_id: "user-1",
            visibility: "private",
          }),
          createWorldRow({
            id: "00000000-0000-0000-0000-000000000303",
            name: "Inaccessible World",
            owner_id: "user-3",
            visibility: "private",
          }),
        ],
      }),
    );

    renderWorldListPage();

    expect(await screen.findByText("Public World")).toBeDefined();
    expect(screen.getByText("Private World")).toBeDefined();
    expect(screen.queryByText("Inaccessible World")).toBeNull();
    expect(screen.getByRole("link", { name: /Public World/i })).toHaveAttribute(
      "href",
      "/worlds/00000000-0000-0000-0000-000000000101",
    );
  });

  it("renders planning turn and computed in-world date", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: [
          createWorldRow({
            calendar_config_json: createCalendarConfig(),
            current_turn_number: 3,
            name: "Calendar World",
          }),
        ],
      }),
    );

    renderWorldListPage();

    expect(await screen.findByText("Calendar World")).toBeDefined();
    expect(screen.getByText("Planning turn")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
    expect(screen.getByText("In-world date")).toBeDefined();
    expect(screen.getByText("Firstday, Ember 1, 100 AG")).toBeDefined();
  });

  it("renders a safe fallback for missing or invalid calendar config", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: [
          createWorldRow({
            calendar_config_json: null,
            name: "Missing Calendar World",
          }),
          createWorldRow({
            calendar_config_json: { months: [] },
            id: "00000000-0000-0000-0000-000000000404",
            name: "Invalid Calendar World",
          }),
        ],
      }),
    );

    renderWorldListPage();

    expect(await screen.findByText("Missing Calendar World")).toBeDefined();
    expect(screen.getByText("Invalid Calendar World")).toBeDefined();
    expect(screen.getAllByText("Calendar unavailable")).toHaveLength(2);
  });
});

function renderWorldListPage(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <WorldListPage />
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
  worldRows = [],
}: {
  readonly adminRows?: readonly { readonly world_id: string }[];
  readonly session: {
    readonly user: {
      readonly id: string;
    };
  };
  readonly worldRows?: Promise<unknown> | readonly TestWorldRow[];
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
    dateFormatTemplate: "{weekday}, {month} {day}, {year} AG",
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

function createWorldsQueryBuilder(
  rows: Promise<unknown> | readonly TestWorldRow[],
): unknown {
  const result =
    rows instanceof Promise
      ? rows
      : Promise.resolve({ data: rows, error: null });

  return {
    select: vi.fn(() => ({
      order: vi.fn().mockReturnValue(result),
    })),
  };
}
