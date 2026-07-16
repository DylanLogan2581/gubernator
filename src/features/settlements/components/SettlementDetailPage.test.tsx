import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ActivePlayerCharacterContextValue } from "@/features/permissions";

import { SettlementDetailPage } from "./SettlementDetailPage";
import { useSettlementDetailContext } from "./SettlementDetailPage/SettlementDetailContext";

import type { JSX, ReactNode } from "react";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

const { useActivePlayerCharacterMock, useSettlementManageAuthorityMock } =
  vi.hoisted(() => ({
    useActivePlayerCharacterMock: vi.fn<
      () => ActivePlayerCharacterContextValue
    >(() => ({
      activeCharacter: null,
      clear: vi.fn(),
      isPending: false,
      selectableCharacters: [],
      switchTo: vi.fn(),
    })),
    useSettlementManageAuthorityMock: vi.fn(() => ({
      canManageSettlement: true,
      canManageNation: true,
    })),
  }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    readonly children: ReactNode;
    readonly to: string;
    readonly params?: Readonly<Record<string, string>>;
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
}));

vi.mock("@/features/permissions", async () => {
  const actual = await vi.importActual("@/features/permissions");
  return {
    ...actual,
    useActivePlayerCharacter: useActivePlayerCharacterMock,
    useEffectiveCanAdmin: (canAdmin: boolean) => {
      const { activeCharacter } = useActivePlayerCharacterMock();
      return canAdmin && activeCharacter === null;
    },
    useSettlementManageAuthority: useSettlementManageAuthorityMock,
  };
});

const WORLD_ID = "00000000-0000-0000-0000-000000000010";
const NATION_ID = "00000000-0000-0000-0000-000000000020";
const SETTLEMENT_ID = "00000000-0000-0000-0000-000000000030";
const USER_ID = "00000000-0000-0000-0000-000000000001";

type SettlementWithNationRow = {
  readonly coord_x: number | null;
  readonly coord_z: number | null;
  readonly created_at: string;
  readonly description: string | null;
  readonly id: string;
  readonly name: string;
  readonly nation_id: string;
  readonly nations: {
    readonly id: string;
    readonly name: string;
    readonly world_id: string;
  };
  readonly updated_at: string;
};

type ReadinessRow = {
  readonly auto_ready_enabled: boolean;
  readonly id: string;
  readonly is_ready_current_turn: boolean;
  readonly last_ready_at: string | null;
  readonly name: string;
  readonly nation_id: string;
  readonly nations: { readonly id: string; readonly name: string };
  readonly ready_set_at: string | null;
};

function createSettlementWithNationRow(
  overrides: Partial<SettlementWithNationRow> = {},
): SettlementWithNationRow {
  return {
    coord_x: null,
    coord_z: null,
    created_at: "2026-05-01T00:00:00.000Z",
    description: null,
    id: SETTLEMENT_ID,
    name: "Hometown",
    nation_id: NATION_ID,
    nations: { id: NATION_ID, name: "Homeland", world_id: WORLD_ID },
    updated_at: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

function createReadinessRow(
  overrides: Partial<ReadinessRow> = {},
): ReadinessRow {
  return {
    auto_ready_enabled: false,
    id: SETTLEMENT_ID,
    is_ready_current_turn: false,
    last_ready_at: null,
    name: "Hometown",
    nation_id: NATION_ID,
    nations: { id: NATION_ID, name: "Homeland" },
    ready_set_at: null,
    ...overrides,
  };
}

function createCalendarConfig(): unknown {
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

function createClient({
  adminRows = [],
  pcWorldIds = [],
  readinessRows = [createReadinessRow()],
  settlementRow = createSettlementWithNationRow(),
  worldArchivedAt = null,
}: {
  readonly adminRows?: ReadonlyArray<{ readonly world_id: string }>;
  readonly pcWorldIds?: readonly string[];
  readonly readinessRows?: ReadonlyArray<ReadinessRow>;
  readonly settlementRow?: SettlementWithNationRow | null;
  readonly worldArchivedAt?: string | null;
} = {}): unknown {
  const worldRow = {
    archived_at: worldArchivedAt,
    calendar_config_json: createCalendarConfig(),
    created_at: "2026-01-01T00:00:00.000Z",
    current_turn_number: 3,
    id: WORLD_ID,
    incest_prevention_depth: 4,
    name: "Test World",
    status: worldArchivedAt !== null ? "archived" : "active",
    updated_at: "2026-01-02T00:00:00.000Z",
  };

  const userRow = {
    created_at: "2026-01-01T00:00:00.000Z",
    email: "user@example.com",
    id: USER_ID,
    is_super_admin: false,
    status: "active",
    updated_at: "2026-01-01T00:00:00.000Z",
    username: "testuser",
  };

  const settlementAccessRow = {
    id: SETTLEMENT_ID,
    nations: {
      world_id: WORLD_ID,
      worlds: {
        archived_at: worldArchivedAt,
        id: WORLD_ID,
        status: worldArchivedAt !== null ? "archived" : "active",
      },
    },
  };

  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: USER_ID } } },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === "users") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi
                .fn()
                .mockResolvedValue({ data: userRow, error: null }),
            })),
          })),
        };
      }
      if (table === "world_admins") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi
                .fn()
                .mockResolvedValue({ data: adminRows, error: null }),
            })),
          })),
        };
      }
      if (table === "worlds") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi
                .fn()
                .mockResolvedValue({ data: worldRow, error: null }),
            })),
            order: vi.fn().mockResolvedValue({ data: [worldRow], error: null }),
          })),
        };
      }
      if (table === "settlements") {
        return {
          select: vi.fn((columns: string) => {
            if (columns.includes("description")) {
              const b: Record<string, unknown> = {};
              b.eq = vi.fn(() => b);
              b.maybeSingle = vi
                .fn()
                .mockResolvedValue({ data: settlementRow, error: null });
              return b;
            }
            if (columns.includes("auto_ready_enabled")) {
              const b: Record<string, unknown> = {};
              b.eq = vi.fn(() => b);
              b.order = vi.fn(() => b);
              b.returns = vi
                .fn()
                .mockResolvedValue({ data: readinessRows, error: null });
              return b;
            }
            if (columns.includes("worlds!inner")) {
              const b: Record<string, unknown> = {};
              b.eq = vi.fn(() => b);
              b.maybeSingle = vi
                .fn()
                .mockResolvedValue({ data: settlementAccessRow, error: null });
              return b;
            }
            throw new Error(`Unexpected settlement select columns: ${columns}`);
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: vi.fn((fn: string) => {
      if (fn === "current_user_player_character_world_ids") {
        return Promise.resolve({ data: pcWorldIds, error: null });
      }
      throw new Error(`Unexpected RPC call: ${fn}`);
    }),
  };
}

// Renders the settlement detail context values as text so tests can assert
// on the computed permission booleans without depending on any particular
// child route's markup — those now live in the section route files.
function ContextProbe(): JSX.Element {
  const {
    canDelete,
    canEditCoordinates,
    canEditDetails,
    canManageSettlement,
    effectiveCanAdmin,
    isArchived,
    settlement,
    worldAccess,
  } = useSettlementDetailContext();

  return (
    <dl>
      <dt>canDelete</dt>
      <dd>{String(canDelete)}</dd>
      <dt>canEditCoordinates</dt>
      <dd>{String(canEditCoordinates)}</dd>
      <dt>canEditDetails</dt>
      <dd>{String(canEditDetails)}</dd>
      <dt>canManageSettlement</dt>
      <dd>{String(canManageSettlement)}</dd>
      <dt>effectiveCanAdmin</dt>
      <dd>{String(effectiveCanAdmin)}</dd>
      <dt>isArchived</dt>
      <dd>{String(isArchived)}</dd>
      <dt>settlementId</dt>
      <dd>{settlement.id}</dd>
      <dt>worldAccessCanAdmin</dt>
      <dd>{String(worldAccess.canAdmin)}</dd>
    </dl>
  );
}

describe("SettlementDetailPage", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    useActivePlayerCharacterMock.mockReset();
    useActivePlayerCharacterMock.mockReturnValue({
      activeCharacter: null,
      clear: vi.fn(),
      isPending: false,
      selectableCharacters: [],
      switchTo: vi.fn(),
    });
    useSettlementManageAuthorityMock.mockReset();
    useSettlementManageAuthorityMock.mockReturnValue({
      canManageSettlement: true,
      canManageNation: true,
    });
  });

  it("renders the loading state while the access context query is pending", () => {
    requireSupabaseClient.mockReturnValue({
      auth: { getSession: vi.fn(() => new Promise<never>(() => {})) },
      from: vi.fn(),
    });
    renderPage();
    expect(screen.getByText("Loading world access…")).toBeDefined();
  });

  it("renders the world-unavailable state when the world cannot be accessed", async () => {
    requireSupabaseClient.mockReturnValue(createClient());
    renderPage();
    expect(await screen.findByText("World unavailable")).toBeDefined();
  });

  it("renders the settlement-unavailable state when the settlement does not exist", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        adminRows: [{ world_id: WORLD_ID }],
        settlementRow: null,
      }),
    );
    renderPage();
    expect(await screen.findByText("Settlement unavailable")).toBeDefined();
  });

  it("renders the settlement name, subtitle, and back link once loaded", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({ adminRows: [{ world_id: WORLD_ID }] }),
    );
    renderPage();
    expect(
      await screen.findByRole("heading", { level: 1, name: "Hometown" }),
    ).toBeDefined();
    expect(screen.getByText(/Settlement in/)).toBeDefined();
    expect(
      screen.getByRole("link", { name: "Back to Homeland" }),
    ).toHaveAttribute("href", `/worlds/${WORLD_ID}/nations/${NATION_ID}`);
  });

  it("renders children once settlement and world access resolve", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({ adminRows: [{ world_id: WORLD_ID }] }),
    );
    renderPage();
    expect(await screen.findByText("settlementId")).toBeDefined();
  });

  it("exposes full edit/delete authority to admin viewers", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({ adminRows: [{ world_id: WORLD_ID }] }),
    );
    renderPage();
    await screen.findByText("settlementId");

    expect(
      screen.getByText("canEditDetails").nextElementSibling,
    ).toHaveTextContent("true");
    expect(
      screen.getByText("canEditCoordinates").nextElementSibling,
    ).toHaveTextContent("true");
    expect(screen.getByText("canDelete").nextElementSibling).toHaveTextContent(
      "true",
    );
    expect(
      screen.getByText("effectiveCanAdmin").nextElementSibling,
    ).toHaveTextContent("true");
  });

  it("hides edit/delete authority from plain viewers", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({ pcWorldIds: [WORLD_ID] }),
    );
    renderPage();
    await screen.findByText("settlementId");

    expect(
      screen.getByText("canEditDetails").nextElementSibling,
    ).toHaveTextContent("false");
    expect(
      screen.getByText("canEditCoordinates").nextElementSibling,
    ).toHaveTextContent("false");
    expect(screen.getByText("canDelete").nextElementSibling).toHaveTextContent(
      "false",
    );
  });

  it("suppresses admin authority (but keeps worldAccess.canAdmin) when the viewer has an active character", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({ adminRows: [{ world_id: WORLD_ID }] }),
    );
    useActivePlayerCharacterMock.mockReturnValue({
      activeCharacter: {
        id: "char-1",
        name: "Aria",
        roleType: "none",
        status: "alive",
      } as never,
      clear: vi.fn(),
      isPending: false,
      selectableCharacters: [],
      switchTo: vi.fn(),
    });
    renderPage();
    await screen.findByText("settlementId");

    expect(
      screen.getByText("effectiveCanAdmin").nextElementSibling,
    ).toHaveTextContent("false");
    expect(
      screen.getByText("worldAccessCanAdmin").nextElementSibling,
    ).toHaveTextContent("true");
  });

  it("allows a nation manager to edit details but not coordinates", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({ pcWorldIds: [WORLD_ID] }),
    );
    useActivePlayerCharacterMock.mockReturnValue({
      activeCharacter: {
        id: "char-1",
        roleType: "nation_manager",
        roleNationId: NATION_ID,
        status: "alive",
      } as never,
      clear: vi.fn(),
      isPending: false,
      selectableCharacters: [],
      switchTo: vi.fn(),
    });
    renderPage();
    await screen.findByText("settlementId");

    expect(
      screen.getByText("canEditDetails").nextElementSibling,
    ).toHaveTextContent("true");
    expect(
      screen.getByText("canEditCoordinates").nextElementSibling,
    ).toHaveTextContent("false");
  });

  it("marks the settlement archived and revokes edit/delete authority when the world is archived", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        adminRows: [{ world_id: WORLD_ID }],
        worldArchivedAt: "2026-06-01T00:00:00.000Z",
      }),
    );
    renderPage();
    await screen.findByText("settlementId");

    expect(screen.getByText("isArchived").nextElementSibling).toHaveTextContent(
      "true",
    );
    expect(
      screen.getByText("canEditDetails").nextElementSibling,
    ).toHaveTextContent("false");
    expect(screen.getByText("canDelete").nextElementSibling).toHaveTextContent(
      "false",
    );
  });

  it("passes canManageSettlement through from useSettlementManageAuthority", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({ pcWorldIds: [WORLD_ID] }),
    );
    useSettlementManageAuthorityMock.mockReturnValue({
      canManageSettlement: false,
      canManageNation: false,
    });
    renderPage();
    await screen.findByText("settlementId");

    expect(
      screen.getByText("canManageSettlement").nextElementSibling,
    ).toHaveTextContent("false");
  });
});

function renderPage(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <SettlementDetailPage
        nationId={NATION_ID}
        settlementId={SETTLEMENT_ID}
        worldId={WORLD_ID}
      >
        <ContextProbe />
      </SettlementDetailPage>
    </QueryClientProvider>,
  );
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
}
