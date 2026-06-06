import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WorldCalendarConfig } from "@/features/calendar";

import { WorldConfigurationPage } from "./WorldConfigurationPage";

import type { WorldNpcFlavorConfig } from "../schemas/worldNpcFlavorConfigSchemas";
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
    ...rest
  }: {
    readonly children: ReactNode;
    readonly params?: Readonly<Record<string, string>>;
    readonly to: string;
    readonly [key: string]: unknown;
  }) => {
    const href =
      params === undefined
        ? to
        : Object.entries(params).reduce(
            (path, [name, value]) => path.replace(`$${name}`, value),
            to,
          );
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
  useNavigate: () => vi.fn(),
}));

const WORLD_ID = "00000000-0000-0000-0000-000000000001";

describe("WorldConfigurationPage", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
  });

  it("mounts the resources panel when the resources tab is active", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: [createWorldRow()],
      }),
    );

    renderPage({ activeTab: "resources", worldId: WORLD_ID });

    expect(
      await screen.findByRole(
        "heading",
        { name: "Resources" },
        { timeout: 5000 },
      ),
    ).toBeDefined();
  });

  it("mounts the calendar panel when the calendar tab is active", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: [createWorldRow()],
      }),
    );

    renderPage({ activeTab: "calendar", worldId: WORLD_ID });

    expect(
      await screen.findByRole(
        "heading",
        { name: "Calendar" },
        { timeout: 5000 },
      ),
    ).toBeDefined();
  });

  it("mounts the NPC flavor panel when the npc-flavor tab is active", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: [createWorldRow()],
      }),
    );

    renderPage({ activeTab: "npc-flavor", worldId: WORLD_ID });

    expect(
      await screen.findByRole(
        "heading",
        { name: "NPC flavor pools" },
        { timeout: 5000 },
      ),
    ).toBeDefined();
  });

  it("renders the mobile select with the active tab label as its value", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: [createWorldRow()],
      }),
    );

    renderPage({ activeTab: "calendar", worldId: WORLD_ID });

    expect(
      await screen.findByRole("combobox", { name: "Configuration section" }),
    ).toHaveTextContent("Calendar");
  });

  it("marks the active tab with aria-selected in the tab list", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: [createWorldRow()],
      }),
    );

    renderPage({ activeTab: "calendar", worldId: WORLD_ID });

    const calendarTab = await screen.findByRole("tab", { name: "Calendar" });
    const resourcesTab = screen.getByRole("tab", { name: "Resources" });
    expect(calendarTab).toHaveAttribute("aria-selected", "true");
    expect(resourcesTab).toHaveAttribute("aria-selected", "false");
  });

  it("renders a back navigation link to the world page", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: [createWorldRow()],
      }),
    );

    renderPage({ activeTab: "resources", worldId: WORLD_ID });

    expect(
      await screen.findByRole("link", { name: "Back to world" }),
    ).toHaveAttribute("href", `/worlds/${WORLD_ID}`);
  });

  it("renders the Configuration page heading", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: [createWorldRow()],
      }),
    );

    renderPage({ activeTab: "resources", worldId: WORLD_ID });

    expect(
      await screen.findByRole("heading", { name: "Configuration" }),
    ).toBeDefined();
  });
});

function renderPage({
  activeTab,
  worldId,
}: {
  readonly activeTab: string;
  readonly worldId: string;
}): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <WorldConfigurationPage activeTab={activeTab} worldId={worldId} />
    </QueryClientProvider>,
  );
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0 },
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

      if (table === "citizens") {
        const b: Record<string, unknown> = {};
        b.eq = vi.fn(() => b);
        b.order = vi.fn().mockResolvedValue({ data: [], error: null });
        return { select: vi.fn(() => b) };
      }

      if (table === "resources") {
        const b: Record<string, unknown> = {};
        b.eq = vi.fn(() => b);
        b.order = vi.fn(() => b);
        b.returns = vi.fn().mockResolvedValue({ data: [], error: null });
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              maybeSingle: vi
                .fn()
                .mockResolvedValue({ data: null, error: null }),
            })),
          })),
          select: vi.fn(() => b),
        };
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
  readonly calendar_config_json: WorldCalendarConfig;
  readonly created_at: string;
  readonly current_turn_number: number;
  readonly id: string;
  readonly incest_prevention_depth: number;
  readonly name: string;
  readonly npc_flavor_config_json: WorldNpcFlavorConfig;
  readonly status: string;
  readonly updated_at: string;
  readonly visibility: string;
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
    id: WORLD_ID,
    incest_prevention_depth: 4,
    name: "Test World",
    npc_flavor_config_json: createNpcFlavorConfig(),
    status: "active",
    updated_at: "2026-01-02T00:00:00.000Z",
    visibility: "public",
    ...overrides,
  };
}

function createCalendarConfig(): WorldCalendarConfig {
  return {
    dateFormatTemplate: "{weekday}, {month} {day}, {year} AG",
    months: [
      { dayCount: 30, index: 0, name: "Dawn" },
      { dayCount: 30, index: 1, name: "Ember" },
    ],
    startingDayOfMonth: 1,
    startingMonthIndex: 0,
    startingWeekdayOffset: 0,
    startingYear: 100,
    weekdays: [
      { index: 0, name: "Firstday" },
      { index: 1, name: "Secondday" },
    ],
  };
}

function createNpcFlavorConfig(): WorldNpcFlavorConfig {
  return {
    contradictions: ["stoic but theatrical"],
    flaws: ["impatient"],
    goals: ["reclaim a lost relic"],
    traits: ["curious"],
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
      eq: vi.fn((column: string, value: string) => {
        const data =
          column === "id"
            ? (rows.find((row) => row.id === value) ?? null)
            : null;

        return {
          maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
        };
      }),
      order: vi.fn().mockResolvedValue({ data: rows, error: null }),
    })),
  };
}
