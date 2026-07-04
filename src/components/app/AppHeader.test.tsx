import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Citizen } from "@/features/citizens";
import { notificationQueryKeys } from "@/features/notifications";
import {
  ActivePlayerCharacterContext,
  type ActivePlayerCharacterContextValue,
} from "@/features/permissions";

import { AppHeader } from "./AppHeader";

import type { ReactNode } from "react";

const WORLD_ID = "00000000-0000-0000-0000-000000000101";
const NATION_ID = "nation-1";
const SETTLEMENT_ID = "settlement-1";

const { requireSupabaseClient, useParams } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
  useParams: vi.fn<() => Record<string, string | undefined>>(),
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
  useLocation: () => ({ pathname: "/" }),
  useNavigate: () => vi.fn(),
  useParams,
  useRouter: () => ({
    state: { location: { href: "/" } },
  }),
}));

describe("AppHeader", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    useParams.mockReset();
    useParams.mockReturnValue({});
    // useAppShellWorldContext persists the current route world to
    // gubernator:last-world (sticky sidebar fallback) — clear it so one
    // test's in-world route doesn't leak a stale fallback into the next.
    window.localStorage.clear();
  });

  it("renders the sidebar trigger", () => {
    requireSupabaseClient.mockReturnValue(
      createClient({ session: null }).client,
    );
    renderAppHeader();
    expect(
      screen.getByRole("button", { name: /toggle sidebar/i }),
    ).toBeDefined();
  });

  it("renders the notification bell", () => {
    requireSupabaseClient.mockReturnValue(
      createClient({ session: null }).client,
    );
    renderAppHeader();
    expect(
      screen.getByRole("button", { name: /notifications/i }),
    ).toBeDefined();
  });

  it("opens the command palette when the search button is clicked", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({ session: null }).client,
    );
    const onOpenCommandPalette = vi.fn();
    renderAppHeader(<AppHeader onOpenCommandPalette={onOpenCommandPalette} />);

    await user.click(screen.getByRole("button", { name: /search/i }));

    expect(onOpenCommandPalette).toHaveBeenCalledOnce();
  });

  it("shows search button text and the ⌘K hint", () => {
    requireSupabaseClient.mockReturnValue(
      createClient({ session: null }).client,
    );
    renderAppHeader();

    const searchButton = screen.getByRole("button", { name: /search/i });
    expect(searchButton.textContent).toContain("Search");
    expect(searchButton.textContent).toContain("K");
  });

  it("does not render a brand label — logo/product name lives in the sidebar only", () => {
    requireSupabaseClient.mockReturnValue(
      createClient({ session: null }).client,
    );
    renderAppHeader();
    expect(screen.queryByText("Gubernator")).toBeNull();
  });

  it("shows the unread notification badge when a user has unread rows", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        initialUnreadCount: 3,
        session: { user: { id: "user-1" } },
      }).client,
    );

    renderAppHeader();

    expect(await screen.findByText("3")).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Notifications (3 unread)" }),
    ).toBeDefined();
  });

  it("refreshes the unread notification badge after notification invalidation", async () => {
    const clientFixture = createClient({
      initialUnreadCount: 1,
      session: { user: { id: "user-1" } },
    });

    requireSupabaseClient.mockReturnValue(clientFixture.client);

    const queryClient = renderAppHeader();

    expect(
      await screen.findByRole("button", { name: "Notifications (1 unread)" }),
    ).toBeDefined();

    clientFixture.setUnreadCount(2);

    await act(async () => {
      await queryClient.invalidateQueries({
        queryKey: notificationQueryKeys.all,
      });
    });

    expect(
      await screen.findByRole("button", { name: "Notifications (2 unread)" }),
    ).toBeDefined();
  });

  it("renders the header action (user menu) at the far right, after notifications", () => {
    requireSupabaseClient.mockReturnValue(
      createClient({ session: null }).client,
    );
    renderAppHeader(<AppHeader action={<a href="/worlds">Worlds</a>} />);

    const worldsLink = screen.getByRole("link", { name: "Worlds" });
    const notificationsButton = screen.getByRole("button", {
      name: /notifications/i,
    });

    expect(
      notificationsButton.compareDocumentPosition(worldsLink) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows the world breadcrumb and turn chip on an in-world route", async () => {
    useParams.mockReturnValue({ worldId: WORLD_ID });
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: [
          createWorldRow({ current_turn_number: 7, name: "Eastern Marches" }),
        ],
      }).client,
    );

    renderAppHeader();

    expect(await screen.findByText("Eastern Marches")).toBeDefined();
    expect(
      screen.getByText((content) => content.startsWith("Turn 7")),
    ).toBeDefined();
  });

  it("does not show the breadcrumb or turn chip outside a world route", () => {
    useParams.mockReturnValue({});
    requireSupabaseClient.mockReturnValue(
      createClient({ session: null }).client,
    );

    renderAppHeader();

    expect(
      screen.queryByRole("navigation", { name: "World navigation breadcrumb" }),
    ).toBeNull();
  });

  it("shows the compact End Turn control for effective world admins", async () => {
    useParams.mockReturnValue({ worldId: WORLD_ID });
    requireSupabaseClient.mockReturnValue(
      createClient({
        adminRows: [{ world_id: WORLD_ID }],
        session: { user: { id: "user-1" } },
        worldRows: [createWorldRow({})],
      }).client,
    );

    renderAppHeader();

    expect(
      await screen.findByRole("button", { name: /^End Turn/ }),
    ).toBeDefined();
  });

  it("hides the End Turn control for non-admins", async () => {
    useParams.mockReturnValue({ worldId: WORLD_ID });
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: [createWorldRow({})],
      }).client,
    );

    renderAppHeader();

    await screen.findByText((content) => content.startsWith("Turn "));
    expect(screen.queryByRole("button", { name: /^End Turn/ })).toBeNull();
  });

  it("shows the readiness chip for a settlement manager on a settlement route", async () => {
    useParams.mockReturnValue({
      nationId: NATION_ID,
      settlementId: SETTLEMENT_ID,
      worldId: WORLD_ID,
    });
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        settlementRows: [createSettlementRow({ is_ready_current_turn: false })],
        worldRows: [createWorldRow({})],
      }).client,
    );

    renderAppHeader(<AppHeader />, {
      activeCharacter: createSettlementManagerCitizen(),
    });

    expect(
      await screen.findByRole("button", { name: "Mark ready" }),
    ).toBeDefined();
  });

  it("marks the settlement ready when the chip is clicked", async () => {
    const user = userEvent.setup();
    useParams.mockReturnValue({
      nationId: NATION_ID,
      settlementId: SETTLEMENT_ID,
      worldId: WORLD_ID,
    });
    const clientFixture = createClient({
      session: { user: { id: "user-1" } },
      settlementRows: [createSettlementRow({ is_ready_current_turn: false })],
      worldRows: [createWorldRow({})],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderAppHeader(<AppHeader />, {
      activeCharacter: createSettlementManagerCitizen(),
    });

    await user.click(await screen.findByRole("button", { name: "Mark ready" }));

    const rpc = (clientFixture.client as { readonly rpc: unknown }).rpc;
    await vi.waitFor(() => {
      expect(rpc).toHaveBeenCalledWith("set_settlement_readiness", {
        p_is_ready: true,
        p_settlement_id: SETTLEMENT_ID,
      });
    });
  });

  it("reflects current readiness in the chip", async () => {
    useParams.mockReturnValue({
      nationId: NATION_ID,
      settlementId: SETTLEMENT_ID,
      worldId: WORLD_ID,
    });
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        settlementRows: [createSettlementRow({ is_ready_current_turn: true })],
        worldRows: [createWorldRow({})],
      }).client,
    );

    renderAppHeader(<AppHeader />, {
      activeCharacter: createSettlementManagerCitizen(),
    });

    expect(await screen.findByRole("button", { name: "Ready" })).toBeDefined();
  });

  it("does not show the readiness chip for effective admins (they get End Turn instead)", async () => {
    useParams.mockReturnValue({
      nationId: NATION_ID,
      settlementId: SETTLEMENT_ID,
      worldId: WORLD_ID,
    });
    requireSupabaseClient.mockReturnValue(
      createClient({
        adminRows: [{ world_id: WORLD_ID }],
        session: { user: { id: "user-1" } },
        settlementRows: [createSettlementRow({ is_ready_current_turn: false })],
        worldRows: [createWorldRow({})],
      }).client,
    );

    renderAppHeader();

    await screen.findByRole("button", { name: /^End Turn/ });
    expect(screen.queryByRole("button", { name: "Mark ready" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ready" })).toBeNull();
  });
});

function renderAppHeader(
  ui: ReactNode = <AppHeader />,
  activePlayerCharacter?: { readonly activeCharacter: Citizen },
): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  const contextValue: ActivePlayerCharacterContextValue = {
    activeCharacter: activePlayerCharacter?.activeCharacter ?? null,
    clear: (): void => {},
    isPending: false,
    selectableCharacters: [],
    switchTo: (): void => {},
  };

  render(
    <QueryClientProvider client={queryClient}>
      <ActivePlayerCharacterContext value={contextValue}>
        <TooltipProvider>
          <SidebarProvider>{ui}</SidebarProvider>
        </TooltipProvider>
      </ActivePlayerCharacterContext>
    </QueryClientProvider>,
  );

  return queryClient;
}

function createSettlementManagerCitizen(): Citizen {
  return {
    bornOnTurnNumber: null,
    citizenType: "player_character",
    createdAt: "2026-01-01T00:00:00.000Z",
    deathCause: null,
    deathCauseCategory: null,
    givenName: "Manager",
    id: "citizen-1",
    name: "Manager",
    namesetId: null,
    parentACitizenId: null,
    parentBCitizenId: null,
    profilePhotoUrl: null,
    roleNationId: NATION_ID,
    roleSettlementId: SETTLEMENT_ID,
    roleType: "settlement_manager",
    settlementId: SETTLEMENT_ID,
    sex: null,
    status: "alive",
    surname: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    userId: "user-1",
    worldId: WORLD_ID,
  } satisfies Citizen;
}

type TestWorldRow = {
  readonly archived_at: string | null;
  readonly calendar_config_json: unknown;
  readonly created_at: string;
  readonly current_turn_number: number;
  readonly id: string;
  readonly incest_prevention_depth: number;
  readonly is_trashed: boolean;
  readonly name: string;
  readonly status: string;
  readonly updated_at: string;
  readonly visibility: string;
};

function createWorldRow(overrides: Partial<TestWorldRow>): TestWorldRow {
  return {
    archived_at: null,
    calendar_config_json: {
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
    },
    created_at: "2026-01-01T00:00:00.000Z",
    current_turn_number: 1,
    id: WORLD_ID,
    incest_prevention_depth: 4,
    is_trashed: false,
    name: "World",
    status: "active",
    updated_at: "2026-01-02T00:00:00.000Z",
    visibility: "public",
    ...overrides,
  };
}

type TestSettlementRow = {
  readonly auto_ready_enabled: boolean;
  readonly coord_x: number | null;
  readonly coord_z: number | null;
  readonly created_at: string;
  readonly description: string | null;
  readonly id: string;
  readonly is_ready_current_turn: boolean;
  readonly last_ready_at: string | null;
  readonly name: string;
  readonly nameset_id: string | null;
  readonly nation_id: string;
  readonly nations: {
    readonly id: string;
    readonly name: string;
    readonly nameset_id: string | null;
    readonly world_id: string;
    readonly worlds: {
      readonly archived_at: string | null;
      readonly id: string;
      readonly status: string;
      readonly visibility: string;
    };
  };
  readonly ready_set_at: string | null;
  readonly updated_at: string;
};

function createSettlementRow(
  overrides: Partial<TestSettlementRow>,
): TestSettlementRow {
  return {
    auto_ready_enabled: false,
    coord_x: null,
    coord_z: null,
    created_at: "2026-01-01T00:00:00.000Z",
    description: null,
    id: SETTLEMENT_ID,
    is_ready_current_turn: false,
    last_ready_at: null,
    name: "Amberhold",
    nameset_id: null,
    nation_id: NATION_ID,
    nations: {
      id: NATION_ID,
      name: "Ironmark",
      nameset_id: null,
      world_id: WORLD_ID,
      worlds: {
        archived_at: null,
        id: WORLD_ID,
        status: "active",
        visibility: "public",
      },
    },
    ready_set_at: null,
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function createClient({
  adminRows = [],
  initialUnreadCount = 0,
  session,
  settlementRows = [],
  worldRows = [],
}: {
  readonly adminRows?: readonly { readonly world_id: string }[];
  readonly initialUnreadCount?: number;
  readonly session: { readonly user: { readonly id: string } } | null;
  readonly settlementRows?: readonly TestSettlementRow[];
  readonly worldRows?: readonly TestWorldRow[];
}): {
  readonly client: unknown;
  readonly setUnreadCount: (count: number) => void;
} {
  let unreadCount = initialUnreadCount;
  const notificationsSelect = vi.fn(() => ({
    eq: vi.fn(function (this: unknown) {
      const queryChain = {
        eq: vi.fn().mockImplementation(() =>
          Promise.resolve({
            count: unreadCount,
            data: [],
            error: null,
          }),
        ),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
      };
      return queryChain;
    }),
  }));

  return {
    client: {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session },
          error: null,
        }),
      },
      channel: vi.fn().mockReturnValue({
        on: vi.fn().mockReturnValue({
          subscribe: vi.fn().mockReturnValue({}),
        }),
      }),
      from: vi.fn((table: string) => {
        if (table === "notifications") {
          return { select: notificationsSelect };
        }
        if (table === "users") {
          return createUsersQueryBuilder(session?.user.id ?? null);
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
        if (table === "turn_transitions") {
          return createTurnTransitionsQueryBuilder();
        }
        throw new Error(`Unexpected table ${table}`);
      }),
      removeChannel: vi.fn().mockResolvedValue("ok"),
      rpc: vi.fn((fn: string, args?: Record<string, unknown>) => {
        if (fn === "current_user_player_character_world_ids") {
          return Promise.resolve({ data: [], error: null });
        }
        if (fn === "set_settlement_readiness") {
          const settlementId = args?.p_settlement_id;
          const isReady = args?.p_is_ready;
          return {
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: settlementId,
                is_ready_current_turn: isReady,
                last_ready_at: null,
                ready_set_at:
                  isReady === true ? "2026-01-02T00:00:00.000Z" : null,
              },
              error: null,
            }),
          };
        }
        throw new Error(`Unexpected RPC: ${fn}`);
      }),
    },
    setUnreadCount: (count: number): void => {
      unreadCount = count;
    },
  };
}

function createUsersQueryBuilder(userId: string | null): unknown {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({
          data:
            userId === null
              ? null
              : {
                  created_at: "2026-01-01T00:00:00.000Z",
                  email: `${userId}@example.com`,
                  id: userId,
                  is_super_admin: false,
                  status: "active",
                  updated_at: "2026-01-01T00:00:00.000Z",
                  username: userId,
                },
          error: null,
        }),
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

function createSettlementsQueryBuilder(
  rows: readonly TestSettlementRow[],
): unknown {
  function rowMatchesFilter(
    row: TestSettlementRow,
    column: string,
    value: string,
  ): boolean {
    if (column === "id") {
      return row.id === value;
    }
    if (column === "nations.world_id") {
      return row.nations.world_id === value;
    }
    return true;
  }

  function makeBuilder(filters: readonly [string, string][]): unknown {
    const matching = rows.filter((row) =>
      filters.every(([column, value]) => rowMatchesFilter(row, column, value)),
    );

    const builder = {
      eq: vi.fn((column: string, value: string) =>
        makeBuilder([...filters, [column, value]]),
      ),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: matching[0] ?? null, error: null }),
      order: vi.fn(() => builder),
      returns: vi.fn().mockResolvedValue({ data: matching, error: null }),
    };
    return builder;
  }

  return {
    select: vi.fn(() => makeBuilder([])),
  };
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
