import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
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
    params,
    to,
  }: {
    readonly children: ReactNode;
    readonly params?: Readonly<Record<string, string>>;
    readonly to: string;
  }) => {
    const href =
      params === undefined
        ? to
        : Object.entries(params).reduce(
            (path, [name, value]) => path.replace(`$${name}`, value),
            to,
          );
    return <a href={href}>{children}</a>;
  },
  useNavigate: () => vi.fn(),
  useRouter: () => ({
    state: { location: { href: "/" } },
  }),
}));

describe("WorldShellPage", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
  });

  it("renders planning turn and full fantasy date for authorized world context", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        adminRows: [{ world_id: "00000000-0000-0000-0000-000000000101" }],
        session: { user: { id: "user-1" } },
        worldRows: [
          createWorldRow({
            calendar_config_json: createCalendarConfig(),
            current_turn_number: 7,
            id: "00000000-0000-0000-0000-000000000101",
            name: "Eastern Marches",
          }),
        ],
        settlementRows: [
          createSettlementRow({
            auto_ready_enabled: true,
            id: "settlement-1",
            is_ready_current_turn: false,
            name: "Amberhold",
          }),
          createSettlementRow({
            auto_ready_enabled: false,
            id: "settlement-2",
            is_ready_current_turn: false,
            name: "Briarwatch",
          }),
        ],
      }),
    );

    renderWorldShellPage("00000000-0000-0000-0000-000000000101");

    expect(
      await screen.findByRole("heading", { name: "Eastern Marches" }),
    ).toBeDefined();
    expect(screen.getByText("Firstday, Dawn 2, 101 AG")).toBeDefined();
    expect(await screen.findByText("Readiness Summary")).toBeDefined();
    expect(screen.getByText("Nation A")).toBeDefined();
    expect(
      screen.getByRole("link", { name: "Back to worlds" }),
    ).toHaveAttribute("href", "/worlds");
  });

  it("renders archived worlds as read-only", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        pcWorldIds: ["00000000-0000-0000-0000-000000000202"],
        session: { user: { id: "user-1" } },
        worldRows: [
          createWorldRow({
            archived_at: "2026-01-03T00:00:00.000Z",
            calendar_config_json: createCalendarConfig(),
            current_turn_number: 3,
            id: "00000000-0000-0000-0000-000000000202",
            name: "Archived Realm",
            status: "archived",
          }),
        ],
      }),
    );

    renderWorldShellPage("00000000-0000-0000-0000-000000000202");

    expect(
      await screen.findByRole("heading", { name: "Archived Realm" }),
    ).toBeDefined();
    expect(screen.getByText("Firstday, Ember 1, 100 AG")).toBeDefined();
    expect(screen.getByText("Read-only archive")).toBeDefined();
    expect(
      screen.getByText(/archived and available for review/i),
    ).toBeDefined();
  });

  it("renders a safe fallback when calendar data cannot be loaded", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        pcWorldIds: ["00000000-0000-0000-0000-000000000303"],
        session: { user: { id: "user-1" } },
        worldRows: [
          createWorldRow({
            calendar_config_json: { months: [] },
            current_turn_number: 2,
            id: "00000000-0000-0000-0000-000000000303",
            name: "Broken Calendar Realm",
          }),
        ],
      }),
    );

    renderWorldShellPage("00000000-0000-0000-0000-000000000303");

    expect(
      await screen.findByRole("heading", { name: "Broken Calendar Realm" }),
    ).toBeDefined();
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

  it("does not render the calendar or NPC flavor config panels", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        pcWorldIds: ["00000000-0000-0000-0000-000000000707"],
        session: { user: { id: "user-1" } },
        worldRows: [
          createWorldRow({
            calendar_config_json: createCalendarConfig(),
            current_turn_number: 1,
            id: "00000000-0000-0000-0000-000000000707",
            name: "Panel-Free World",
          }),
        ],
      }),
    );

    renderWorldShellPage("00000000-0000-0000-0000-000000000707");

    await screen.findByRole("heading", { name: "Panel-Free World" });
    expect(screen.queryByRole("heading", { name: "Calendar" })).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "NPC flavor pools" }),
    ).toBeNull();
  });

  it("renders World Reports for world admins", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        adminRows: [{ world_id: "00000000-0000-0000-0000-000000000901" }],
        session: { user: { id: "user-1" } },
        worldRows: [
          createWorldRow({
            calendar_config_json: createCalendarConfig(),
            current_turn_number: 1,
            id: "00000000-0000-0000-0000-000000000901",
            name: "Admin World",
          }),
        ],
      }),
    );

    renderWorldShellPage("00000000-0000-0000-0000-000000000901");

    await screen.findByRole("heading", { name: "Admin World" });
    expect(
      screen.getByRole("heading", { name: "World Reports" }),
    ).toBeDefined();
  });

  it("does not render World Reports for non-admins", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        pcWorldIds: ["00000000-0000-0000-0000-000000000902"],
        session: { user: { id: "user-1" } },
        worldRows: [
          createWorldRow({
            calendar_config_json: createCalendarConfig(),
            current_turn_number: 1,
            id: "00000000-0000-0000-0000-000000000902",
            name: "Non-Admin World",
          }),
        ],
      }),
    );

    renderWorldShellPage("00000000-0000-0000-0000-000000000902");

    await screen.findByRole("heading", { name: "Non-Admin World" });
    expect(screen.queryByRole("heading", { name: "World Reports" })).toBeNull();
  });

  it("renders the full End Turn card for world admins", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        adminRows: [{ world_id: "00000000-0000-0000-0000-000000001101" }],
        session: { user: { id: "user-1" } },
        worldRows: [
          createWorldRow({
            calendar_config_json: createCalendarConfig(),
            current_turn_number: 1,
            id: "00000000-0000-0000-0000-000000001101",
            name: "End Turn World",
          }),
        ],
      }),
    );

    renderWorldShellPage("00000000-0000-0000-0000-000000001101");

    await screen.findByRole("heading", { name: "End Turn World" });
    expect(
      await screen.findByRole("heading", { name: "Run turn transition" }),
    ).toBeDefined();
  });

  it("does not render the End Turn card for non-admins", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        pcWorldIds: ["00000000-0000-0000-0000-000000001102"],
        session: { user: { id: "user-1" } },
        worldRows: [
          createWorldRow({
            calendar_config_json: createCalendarConfig(),
            current_turn_number: 1,
            id: "00000000-0000-0000-0000-000000001102",
            name: "Non-Admin Dashboard World",
          }),
        ],
      }),
    );

    renderWorldShellPage("00000000-0000-0000-0000-000000001102");

    await screen.findByRole("heading", { name: "Non-Admin Dashboard World" });
    expect(
      screen.queryByRole("heading", { name: "Run turn transition" }),
    ).toBeNull();
  });

  it("renders dashboard stat tiles with real queried values, active events, and turn log excerpt", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        eventRows: [
          createEventRow({ id: "event-1", name: "Harvest Festival" }),
        ],
        pcWorldIds: ["00000000-0000-0000-0000-000000001001"],
        nationRows: [
          createNationRow({ id: "nation-1", name: "Nation A" }),
          createNationRow({ id: "nation-2", name: "Nation B" }),
        ],
        session: { user: { id: "user-1" } },
        settlementRows: [
          createSettlementRow({
            id: "settlement-1",
            is_ready_current_turn: true,
            name: "Amberhold",
          }),
          createSettlementRow({
            id: "settlement-2",
            is_ready_current_turn: false,
            name: "Briarwatch",
          }),
          createSettlementRow({
            id: "settlement-3",
            is_ready_current_turn: false,
            name: "Cliffwatch",
          }),
        ],
        totalCitizenCount: 42,
        turnLogRows: [
          createTurnLogRow({
            id: "log-1",
            log_category: "construction.completed",
          }),
        ],
        worldRows: [
          createWorldRow({
            calendar_config_json: createCalendarConfig(),
            current_turn_number: 5,
            id: "00000000-0000-0000-0000-000000001001",
            name: "Dashboard World",
          }),
        ],
      }),
    );

    const { container } = renderWorldShellPage(
      "00000000-0000-0000-0000-000000001001",
    );

    await screen.findByRole("heading", { name: "Dashboard World" });

    const statTileGrid = container.querySelector(".xl\\:grid-cols-5");
    expect(statTileGrid).not.toBeNull();
    expect(statTileGrid).toHaveClass("grid-cols-2", "md:grid-cols-3");

    const statTiles = within(statTileGrid as HTMLElement);
    expect(await statTiles.findByText("2")).toBeDefined(); // Nations
    expect(await statTiles.findByText("3")).toBeDefined(); // Settlements
    expect(await statTiles.findByText("42")).toBeDefined(); // Population
    expect(await statTiles.findByText("1/3")).toBeDefined(); // Settlements ready
    expect(await statTiles.findByText("1")).toBeDefined(); // Active events
    expect(statTileGrid?.childElementCount).toBe(5); // even rows at every breakpoint
    expect(statTiles.queryByText("Planning turn")).toBeNull();

    expect(await screen.findByText("Harvest Festival")).toBeDefined();
    expect(screen.getByText("Construction Completed")).toBeDefined();
  });
});

function renderWorldShellPage(worldId: string): ReturnType<typeof render> {
  return render(
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
  eventRows = [],
  nationRows = [],
  pcWorldIds = [],
  session,
  settlementRows = [],
  totalCitizenCount = 0,
  turnLogRows = [],
  worldRows = [],
}: {
  readonly adminRows?: readonly { readonly world_id: string }[];
  readonly eventRows?: readonly TestEventRow[];
  readonly nationRows?: readonly TestNationRow[];
  readonly pcWorldIds?: readonly string[];
  readonly session: {
    readonly user: {
      readonly id: string;
    };
  };
  readonly settlementRows?: readonly TestSettlementReadinessRow[];
  readonly totalCitizenCount?: number;
  readonly turnLogRows?: readonly TestTurnLogRow[];
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

      if (table === "nations") {
        return createNationsQueryBuilder(nationRows);
      }

      if (table === "citizen_directory_view") {
        return createCitizenDirectoryQueryBuilder(totalCitizenCount);
      }

      if (table === "events") {
        return createEventsQueryBuilder(eventRows);
      }

      if (table === "turn_log_entries") {
        return createTurnLogEntriesQueryBuilder(turnLogRows);
      }

      if (table === "turn_transitions") {
        return createTurnTransitionsQueryBuilder();
      }

      throw new Error(`Unexpected table ${table}`);
    }),
    rpc: vi.fn((fn: string) => {
      if (fn === "current_user_player_character_world_ids") {
        return Promise.resolve({ data: pcWorldIds, error: null });
      }
      throw new Error(`Unexpected RPC: ${fn}`);
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
  readonly incest_prevention_depth: number;
  readonly name: string;
  readonly status: string;
  readonly updated_at: string;
};
type TestCalendarConfigJson =
  | WorldCalendarConfig
  | { readonly months: [] }
  | null;
type TestSettlementReadinessRow = {
  readonly auto_ready_enabled: boolean;
  readonly id: string;
  readonly is_ready_current_turn: boolean;
  readonly last_ready_at: string | null;
  readonly name: string;
  readonly nation_id: string;
  readonly nations: { readonly id: string; readonly name: string };
  readonly ready_set_at: string | null;
};
type TestNationRow = {
  readonly created_at: string;
  readonly description: string | null;
  readonly id: string;
  readonly name: string;
  readonly nameset_id: string | null;
  readonly updated_at: string;
  readonly world_id: string;
};
type TestEventRow = {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly scope_type: string;
  readonly duration_type: string;
  readonly remaining_transitions: number | null;
};
type TestTurnLogRow = {
  readonly id: string;
  readonly log_category: string;
  readonly citizen_id: string | null;
  readonly citizens: { readonly name: string } | null;
  readonly nation_id: string | null;
  readonly nations: { readonly name: string } | null;
  readonly payload_jsonb: unknown;
  readonly resource_id: string | null;
  readonly settlement_id: string | null;
  readonly settlements: {
    readonly name: string;
    readonly nation_id: string;
  } | null;
  readonly turn_transition_id: string;
  readonly turn_transitions: {
    readonly from_turn_number: number;
    readonly to_turn_number: number;
  } | null;
  readonly world_id: string;
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
    incest_prevention_depth: 4,
    name: "World",
    status: "active",
    updated_at: "2026-01-02T00:00:00.000Z",
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
    shortDateFormatTemplate: "{monthNumber}/{dayNumber}/{yearNumber}",
  };
}

function createSettlementRow(
  overrides: Partial<TestSettlementReadinessRow> = {},
): TestSettlementReadinessRow {
  return {
    auto_ready_enabled: false,
    id: "settlement-1",
    is_ready_current_turn: false,
    last_ready_at: null,
    name: "Settlement",
    nation_id: "nation-1",
    nations: { id: "nation-1", name: "Nation A" },
    ready_set_at: null,
    ...overrides,
  };
}

function createNationRow(
  overrides: Partial<TestNationRow> = {},
): TestNationRow {
  return {
    created_at: "2026-01-01T00:00:00.000Z",
    description: null,
    id: "nation-1",
    name: "Nation A",
    nameset_id: null,
    updated_at: "2026-01-01T00:00:00.000Z",
    world_id: "world-1",
    ...overrides,
  };
}

function createEventRow(overrides: Partial<TestEventRow> = {}): TestEventRow {
  return {
    duration_type: "sustained",
    id: "event-1",
    name: "Event",
    remaining_transitions: 3,
    scope_type: "world",
    status: "active",
    ...overrides,
  };
}

function createTurnLogRow(
  overrides: Partial<TestTurnLogRow> = {},
): TestTurnLogRow {
  return {
    citizen_id: null,
    citizens: null,
    id: "log-1",
    log_category: "basic_turn_advancement",
    nation_id: null,
    nations: null,
    payload_jsonb: {},
    resource_id: null,
    settlement_id: null,
    settlements: null,
    turn_transition_id: "transition-1",
    turn_transitions: { from_turn_number: 4, to_turn_number: 5 },
    world_id: "world-1",
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

function createSettlementsQueryBuilder(
  rows: readonly TestSettlementReadinessRow[],
): unknown {
  const builder = {
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    returns: vi.fn().mockResolvedValue({ data: rows, error: null }),
    select: vi.fn(() => builder),
  };

  return builder;
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

function createCitizenDirectoryQueryBuilder(totalCount: number): unknown {
  const result = { count: totalCount, data: [], error: null };
  const builder = {
    eq: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn(() => builder),
    returns: vi.fn().mockResolvedValue(result),
    select: vi.fn(() => builder),
  };

  return builder;
}

function createTurnTransitionsQueryBuilder(): unknown {
  const builder = {
    eq: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    order: vi.fn(() => builder),
    select: vi.fn(() => builder),
  };

  return builder;
}

function createEventsQueryBuilder(rows: readonly TestEventRow[]): unknown {
  const result = { data: rows, error: null };
  const builder = {
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    or: vi.fn(() => builder),
    order: vi.fn(() => builder),
    select: vi.fn(() => builder),
    then: (onFulfilled: (value: typeof result) => unknown): Promise<unknown> =>
      Promise.resolve(result).then(onFulfilled),
  };

  return builder;
}

function createTurnLogEntriesQueryBuilder(
  rows: readonly TestTurnLogRow[],
): unknown {
  const result = { count: rows.length, data: rows, error: null };
  const builder = {
    eq: vi.fn(() => builder),
    filter: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn(() => builder),
    returns: vi.fn().mockResolvedValue(result),
    select: vi.fn(() => builder),
  };

  return builder;
}
