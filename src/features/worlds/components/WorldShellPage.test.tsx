import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WorldCalendarConfig } from "@/features/calendar";
import type { Citizen } from "@/features/citizens";
import {
  ActivePlayerCharacterContext,
  type ActivePlayerCharacterContextValue,
} from "@/features/permissions";

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
            visibility: "private",
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
    expect(screen.getByText("Planning turn")).toBeDefined();
    expect(
      screen.getByText("Planning turn").nextElementSibling?.textContent,
    ).toBe("7");
    expect(screen.getByText("In-world date")).toBeDefined();
    expect(screen.getByText("Firstday, Dawn 2, 101 AG")).toBeDefined();
    expect(screen.getByText("private")).toBeDefined();
    expect(screen.getByText("Readiness Summary")).toBeDefined();
    expect(screen.getByText("Nation A")).toBeDefined();
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
    expect(
      screen.getByText("Planning turn").nextElementSibling?.textContent,
    ).toBe("3");
    expect(screen.getByText("Firstday, Ember 1, 100 AG")).toBeDefined();
    expect(screen.getByText("Read-only archive")).toBeDefined();
    expect(
      screen.getByText(/archived and available for review/i),
    ).toBeDefined();
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
          }),
        ],
      }),
    );

    renderWorldShellPage("00000000-0000-0000-0000-000000000303");

    expect(
      await screen.findByRole("heading", { name: "Broken Calendar Realm" }),
    ).toBeDefined();
    expect(screen.getByText("Planning turn")).toBeDefined();
    expect(
      screen.getByText("Planning turn").nextElementSibling?.textContent,
    ).toBe("2");
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

  it("shows a My character nav link when the user has an active player character", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: [
          createWorldRow({
            calendar_config_json: createCalendarConfig(),
            current_turn_number: 1,
            id: "00000000-0000-0000-0000-000000000505",
            name: "Test World",
          }),
        ],
      }),
    );

    const pc = createCitizen({
      id: "citizen-99",
      worldId: "00000000-0000-0000-0000-000000000505",
    });
    renderWorldShellPage("00000000-0000-0000-0000-000000000505", pc);

    expect(
      await screen.findByRole("heading", { name: "Test World" }),
    ).toBeDefined();
    const myCharLink = screen.getByRole("link", { name: /my character/i });
    expect(myCharLink).toHaveAttribute(
      "href",
      "/worlds/00000000-0000-0000-0000-000000000505/citizens/citizen-99",
    );
  });

  it("does not render the calendar or NPC flavor config panels", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
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

  it("does not show a My character nav link when there is no active player character", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: [
          createWorldRow({
            calendar_config_json: createCalendarConfig(),
            current_turn_number: 1,
            id: "00000000-0000-0000-0000-000000000606",
            name: "Admin World",
          }),
        ],
      }),
    );

    renderWorldShellPage("00000000-0000-0000-0000-000000000606");

    expect(
      await screen.findByRole("heading", { name: "Admin World" }),
    ).toBeDefined();
    expect(screen.queryByRole("link", { name: /my character/i })).toBeNull();
  });

  it("renders the Configuration card for world admins", async () => {
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
      screen.getByRole("heading", { name: "Configuration", level: 2 }),
    ).toBeDefined();
  });

  it("does not render the Configuration card for non-admins", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: [
          createWorldRow({
            calendar_config_json: createCalendarConfig(),
            current_turn_number: 1,
            id: "00000000-0000-0000-0000-000000000902",
            name: "Non-Admin World",
            visibility: "public",
          }),
        ],
      }),
    );

    renderWorldShellPage("00000000-0000-0000-0000-000000000902");

    await screen.findByRole("heading", { name: "Non-Admin World" });
    expect(screen.queryByRole("heading", { name: "Configuration" })).toBeNull();
  });
});

function renderWorldShellPage(
  worldId: string,
  activeCharacter?: Citizen,
): void {
  const contextValue: ActivePlayerCharacterContextValue = {
    activeCharacter: activeCharacter ?? null,
    clear: (): void => {},
    isPending: false,
    selectableCharacters:
      activeCharacter !== undefined ? [activeCharacter] : [],
    switchTo: (): void => {},
  };

  render(
    <QueryClientProvider client={createQueryClient()}>
      <ActivePlayerCharacterContext value={contextValue}>
        <WorldShellPage worldId={worldId} />
      </ActivePlayerCharacterContext>
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
  readonly settlementRows?: readonly TestSettlementReadinessRow[];
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
  readonly visibility: string;
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
  readonly is_hidden: boolean;
  readonly name: string;
  readonly nameset_id: string | null;
  readonly updated_at: string;
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

function createCitizen(overrides: Partial<Citizen> = {}): Citizen {
  return {
    bornOnTurnNumber: null,
    citizenType: "player_character",
    createdAt: "2026-05-01T00:00:00.000Z",
    deathCause: null,
    deathCauseCategory: null,
    givenName: "Player",
    id: "citizen-1",
    namesetId: null,
    name: "Player",
    parentACitizenId: null,
    parentBCitizenId: null,
    profilePhotoUrl: null,
    roleNationId: null,
    roleSettlementId: null,
    roleType: "none",
    settlementId: null,
    sex: null,
    status: "alive",
    surname: null,
    updatedAt: "2026-05-01T00:00:00.000Z",
    userId: "user-1",
    worldId: "world-1",
    ...overrides,
  } satisfies Citizen;
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
